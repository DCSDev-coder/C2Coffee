import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const voucherCreateUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: z.string(),
  tier: z.string(),
  reward: z.string(),
  discountValue: z.union([z.string(), z.number()]).optional(),
  eligibleItems: z.array(z.string()),
  expiry: z.string(),
  totalQty: z.number().int().nullable().optional(),
  limitPerUser: z.number().int().nullable().optional(),
  description: z.string().optional()
});

export async function registerAdminVoucherRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/admin/vouchers
  app.get('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `
        SELECT
          vt.id,
          vt.code,
          vt.name,
          vt.discount_mode,
          vt.discount_value,
          vt.token_value,
          vt.eligible_scope_json,
          vt.valid_until,
          vt.total_quantity,
          vt.limit_per_user,
          vt.is_active,
          vt.created_at,
          (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id) as issued_count,
          (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id AND uv.status = 'redeemed') as redeemed_count
        FROM voucher_templates vt
        ORDER BY vt.created_at DESC
      `
    );

    const vouchers = rows.map((row) => {
      const scope = typeof row.eligible_scope_json === 'string' ? JSON.parse(row.eligible_scope_json) : row.eligible_scope_json;
      let type = scope.frontend_type || 'Percentage Off';
      
      return {
        id: row.code, // Map DB code to frontend id
        db_id: row.id,
        name: row.name,
        type: type,
        tier: scope.tier || 'All Tiers',
        reward: scope.reward || '',
        discountValue: row.discount_mode === 'fixed_token' ? row.token_value : row.discount_value,
        eligibleItems: scope.items || ['All Items'],
        expiry: scope.expiry_string || (row.valid_until ? new Date(row.valid_until).toISOString() : ''),
        totalQty: row.total_quantity || 1000,
        limitPerUser: row.limit_per_user || 1,
        description: scope.description || '',
        status: row.is_active ? 'Active' : 'Inactive',
        issued: row.issued_count || 0,
        redeemed: row.redeemed_count || 0,
        rate: row.issued_count > 0 ? `${Math.round((row.redeemed_count / row.issued_count) * 100)}%` : '0%',
        created: new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      };
    });

    return { vouchers };
  });

  // POST /v1/admin/vouchers
  app.post('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherCreateUpdateSchema.parse(request.body);
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue = null;

    if (payload.type === 'Free Drink' || payload.type === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
    } else if (payload.type === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    }

    const scopeJson = JSON.stringify({
      frontend_type: payload.type,
      tier: payload.tier,
      reward: payload.reward,
      items: payload.eligibleItems,
      description: payload.description,
      expiry_string: payload.expiry
    });

    // Try to parse expiry date
    let validUntil = null;
    if (payload.expiry) {
      const parsed = Date.parse(payload.expiry);
      if (!isNaN(parsed)) {
        validUntil = new Date(parsed);
      }
    }

    const [result] = await mysqlPool.query<ResultSetHeader>(
      `
        INSERT INTO voucher_templates (
          code, name, voucher_type, discount_mode, discount_value, token_value,
          eligible_scope_json, valid_until, total_quantity, limit_per_user, is_active
        ) VALUES (
          :code, :name, :voucherType, :discountMode, :discountValue, :tokenValue,
          :scopeJson, :validUntil, :totalQty, :limitPerUser, 1
        )
      `,
      {
        code: payload.code,
        name: payload.name,
        voucherType,
        discountMode,
        discountValue,
        tokenValue,
        scopeJson,
        validUntil,
        totalQty: payload.totalQty || null,
        limitPerUser: payload.limitPerUser || 1
      }
    );

    return { id: payload.code, db_id: result.insertId };
  });

  // PUT /v1/admin/vouchers/:id
  app.put<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherCreateUpdateSchema.parse(request.body);
    const code = request.params.id;
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue = null;

    if (payload.type === 'Free Drink' || payload.type === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
    } else if (payload.type === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    }

    const scopeJson = JSON.stringify({
      frontend_type: payload.type,
      tier: payload.tier,
      reward: payload.reward,
      items: payload.eligibleItems,
      description: payload.description,
      expiry_string: payload.expiry
    });

    let validUntil = null;
    if (payload.expiry) {
      const parsed = Date.parse(payload.expiry);
      if (!isNaN(parsed)) {
        validUntil = new Date(parsed);
      }
    }

    await mysqlPool.query(
      `
        UPDATE voucher_templates
        SET
          name = :name,
          voucher_type = :voucherType,
          discount_mode = :discountMode,
          discount_value = :discountValue,
          token_value = :tokenValue,
          eligible_scope_json = :scopeJson,
          valid_until = :validUntil,
          total_quantity = :totalQty,
          limit_per_user = :limitPerUser
        WHERE code = :code
      `,
      {
        code,
        name: payload.name,
        voucherType,
        discountMode,
        discountValue,
        tokenValue,
        scopeJson,
        validUntil,
        totalQty: payload.totalQty || null,
        limitPerUser: payload.limitPerUser || 1
      }
    );

    return { success: true };
  });

  // DELETE /v1/admin/vouchers/:id
  app.delete<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const code = request.params.id;
    
    // Soft delete by setting is_active = 0
    await mysqlPool.query(
      `
        UPDATE voucher_templates
        SET is_active = 0
        WHERE code = :code
      `,
      { code }
    );

    return { success: true };
  });
}
