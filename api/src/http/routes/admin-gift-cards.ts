import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest } from '../../admin/guard.js';
import { requireAdminActionConfirmation } from '../../admin/action-confirmation.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { normalizePhoneE164 } from '../../lib/phone.js';
import { creditGiftCardToWallet } from '../../services/gift-cards.js';
import { deliverPushToUser } from '../../services/push-delivery.js';

const issueSchema = z.object({
  currency: z.enum(['rm', 'token']),
  amount: z.coerce.number().positive().max(5000),
  recipient_phone: z.string().trim().max(30).optional().nullable(),
  recipient_message: z.string().trim().max(280).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
  confirmation_password: z.string().trim().min(8).max(200)
}).superRefine((value, context) => {
  if (!Number.isInteger(value.amount)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Gift cards require a whole value because they are credited as C2 Tokens.' });
});
const statusSchema = z.object({ status: z.enum(['active', 'suspended', 'cancelled']), reason: z.string().trim().min(3).max(500), confirmation_password: z.string().trim().min(8).max(200) });
const listSchema = z.object({ q: z.string().trim().max(100).optional().default(''), limit: z.coerce.number().int().min(1).max(500).optional().default(100) });

function code(): string { return `C2G-${crypto.randomBytes(6).toString('hex').toUpperCase()}`; }
function requireGiftCardAccess(request: { adminAuth: { roles: string[] } }): void {
  if (!request.adminAuth.roles.some((role) => ['super_admin', 'marketing_admin', 'support_admin'].includes(role))) throw new ApiError(403, 'admin_forbidden', 'You do not have permission to manage gift cards.');
}
function requireGiftCardControl(request: { adminAuth: { roles: string[] } }): void {
  if (!request.adminAuth.roles.includes('super_admin')) throw new ApiError(403, 'admin_forbidden', 'Only a Super Admin can issue or change gift-card balances.');
}

export async function registerAdminGiftCardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/gift-cards', { preHandler: authenticateAdminRequest }, async (request) => {
    requireGiftCardAccess(request);
    const { q, limit } = listSchema.parse(request.query);
    const search = `%${q}%`;
    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT gc.id, gc.code, gc.currency, CAST(gc.original_amount AS CHAR) AS original_amount, CAST(gc.remaining_amount AS CHAR) AS remaining_amount,
              gc.status, gc.recipient_phone, gc.recipient_message, gc.purchase_ref, gc.created_at, gc.paid_at, gc.claimed_at,
              purchaser.display_name AS purchaser_name, recipient.display_name AS recipient_name,
              (SELECT COUNT(*) FROM gift_card_transactions gct WHERE gct.gift_card_id = gc.id) AS transaction_count
         FROM gift_cards gc
         LEFT JOIN user_profiles purchaser ON purchaser.user_id = gc.purchaser_user_id
         LEFT JOIN user_profiles recipient ON recipient.user_id = gc.recipient_user_id
        WHERE gc.tenant_id = :tenantId
          AND (gc.code LIKE :search OR gc.recipient_phone LIKE :search OR gc.purchase_ref LIKE :search)
        ORDER BY gc.created_at DESC, gc.id DESC LIMIT :limit`,
      { tenantId: request.adminAuth.tenantId, search, limit }
    );
    return { gift_cards: rows.map((row) => ({ ...row, created_at: row.created_at?.toISOString?.() ?? row.created_at, paid_at: row.paid_at?.toISOString?.() ?? null, claimed_at: row.claimed_at?.toISOString?.() ?? null })) };
  });

  app.post('/v1/admin/gift-cards', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireGiftCardControl(request);
    const payload = issueSchema.parse(request.body);
    payload.recipient_phone = payload.recipient_phone?.trim() ? normalizePhoneE164(payload.recipient_phone) : null;
    const connection = await mysqlPool.getConnection();
    let committed = false;
    let deliveredRecipientUserId: number | null = null;
    let issuedCardId = 0;
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const cardCode = code();
      const [recipientRows] = payload.recipient_phone ? await connection.execute<Array<RowDataPacket & { id: number }>>(`SELECT u.id FROM users u JOIN customer_tenant_memberships ctm ON ctm.user_id = u.id WHERE u.phone_e164 = :phone AND ctm.tenant_id = :tenantId LIMIT 1`, { phone: payload.recipient_phone, tenantId: request.adminAuth.tenantId }) : [[]];
      const recipientUserId = recipientRows[0]?.id ?? null;
      if (payload.recipient_phone && !recipientUserId) throw new ApiError(404, 'gift_card_recipient_not_found', 'That phone number is not registered for this café. Leave the phone field blank to create a shareable gift-card code.');
      const [insert] = await connection.execute<ResultSetHeader>(
        `INSERT INTO gift_cards (tenant_id, code, currency, original_amount, remaining_amount, status, recipient_user_id, recipient_phone, recipient_message, purchase_ref, paid_at, created_by_admin_id, created_at)
         VALUES (:tenantId, :code, :currency, :amount, :amount, 'active', :recipientUserId, :phone, :message, :purchaseRef, UTC_TIMESTAMP(), :adminId, UTC_TIMESTAMP())`,
        { tenantId: request.adminAuth.tenantId, code: cardCode, currency: payload.currency, amount: payload.amount, recipientUserId, phone: payload.recipient_phone, message: payload.recipient_message ?? null, purchaseRef: `ADM-${crypto.randomUUID().slice(0, 12).toUpperCase()}`, adminId: request.adminAuth.adminUserId }
      );
      issuedCardId = Number(insert.insertId);
      await connection.execute(`INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, actor_admin_id, remarks, created_at) VALUES (:cardId, 'issued', :amount, :amount, :adminId, :remarks, UTC_TIMESTAMP())`, { cardId: insert.insertId, amount: payload.amount, adminId: request.adminAuth.adminUserId, remarks: payload.reason });
      if (recipientUserId) {
        await creditGiftCardToWallet(connection, Number(insert.insertId), Number(recipientUserId), null);
        deliveredRecipientUserId = Number(recipientUserId);
      }
      await connection.execute(`INSERT INTO admin_audit_logs (admin_user_id, effective_roles_json, action_code, target_type, target_id, reason_note, ip_address, user_agent, created_at) VALUES (:adminId, :roles, 'gift_card_issued', 'gift_card', :cardId, :reason, :ip, :userAgent, UTC_TIMESTAMP())`, { adminId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), cardId: insert.insertId, reason: payload.reason, ip: request.ip, userAgent: String(request.headers['user-agent'] ?? '').slice(0, 512) || null });
      await connection.commit(); committed = true;
      if (deliveredRecipientUserId) {
        void deliverPushToUser({
          userId: deliveredRecipientUserId,
          title: 'Gift card added to your wallet',
          body: `${payload.amount} C2 Tokens are ready in your wallet.`,
          data: { type: 'gift_card_received', gift_card_id: String(issuedCardId) }
        }).catch((error) => request.log.warn({ err: error, giftCardId: issuedCardId }, 'Admin gift-card push failed after wallet credit.'));
      }
      return reply.code(201).send({ id: insert.insertId, code: cardCode, status: 'active' });
    } catch (error) { if (!committed) await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.patch('/v1/admin/gift-cards/:giftCardId/status', { preHandler: authenticateAdminRequest }, async (request) => {
    requireGiftCardControl(request);
    const { giftCardId } = z.object({ giftCardId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = statusSchema.parse(request.body);
    const connection = await mysqlPool.getConnection(); let committed = false;
    try {
      await connection.beginTransaction();
      await requireAdminActionConfirmation(connection, request.adminAuth.adminUserId, payload.confirmation_password);
      const [cards] = await connection.execute<Array<RowDataPacket & { id: number; remaining_amount: string; status: string }>>(`SELECT id, status, CAST(remaining_amount AS CHAR) AS remaining_amount FROM gift_cards WHERE id = :id AND tenant_id = :tenantId LIMIT 1 FOR UPDATE`, { id: giftCardId, tenantId: request.adminAuth.tenantId });
      const card = cards[0]; if (!card) throw new ApiError(404, 'gift_card_not_found', 'Gift card was not found.');
      const allowed: Record<string, string[]> = { active: ['suspended', 'cancelled'], suspended: ['active', 'cancelled'] };
      if (!(allowed[card.status] ?? []).includes(payload.status)) throw new ApiError(409, 'gift_card_status_locked', `A ${card.status.replace('_', ' ')} gift card cannot be changed to ${payload.status}.`);
      await connection.execute(`UPDATE gift_cards SET status = :status WHERE id = :id`, { status: payload.status, id: giftCardId });
      await connection.execute(`INSERT INTO gift_card_transactions (gift_card_id, transaction_type, amount, balance_after, actor_admin_id, remarks, created_at) VALUES (:cardId, :transactionType, 0, :balance, :adminId, :reason, UTC_TIMESTAMP())`, { cardId: giftCardId, transactionType: payload.status === 'cancelled' ? 'cancelled' : 'adjusted', balance: card.remaining_amount, adminId: request.adminAuth.adminUserId, reason: payload.reason });
      await connection.execute(`INSERT INTO admin_audit_logs (admin_user_id, effective_roles_json, action_code, target_type, target_id, reason_note, ip_address, user_agent, created_at) VALUES (:adminId, :roles, 'gift_card_status_changed', 'gift_card', :cardId, :reason, :ip, :userAgent, UTC_TIMESTAMP())`, { adminId: request.adminAuth.adminUserId, roles: JSON.stringify(request.adminAuth.roles), cardId: giftCardId, reason: payload.reason, ip: request.ip, userAgent: String(request.headers['user-agent'] ?? '').slice(0, 512) || null });
      await connection.commit(); committed = true; return { id: giftCardId, status: payload.status };
    } catch (error) { if (!committed) await connection.rollback(); throw error; } finally { connection.release(); }
  });
}
