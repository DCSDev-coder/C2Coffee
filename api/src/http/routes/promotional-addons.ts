import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateRequest } from '../../auth/guard.js';
import { getUtcConnection } from '../../db/mysql.js';
import { resolvePromotionalAddonForCheckout } from '../../services/promotional-addons.js';
import { ApiError } from '../errors.js';

const quoteSchema = z.object({
  store_id: z.coerce.number().int().positive(),
  payment_mode: z.enum(['token', 'direct']),
  client_capabilities: z.array(z.string().trim().max(80)).max(20).default([]),
  selected_promotional_reward_menu_item_id: z.coerce.number().int().positive().nullable().optional(),
  promotional_reward_declined: z.boolean().default(false),
  items: z.array(z.object({
    menu_item_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20),
  })).min(1).max(20),
});

export async function registerPromotionalAddonRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/promotional-addons/quote', { preHandler: authenticateRequest }, async (request) => {
    const payload = quoteSchema.parse(request.body);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const [storeRows] = await connection.query<Array<RowDataPacket & { tenant_id: number }>>(
        `SELECT store.tenant_id
           FROM stores store
          WHERE store.id = :storeId AND store.status = 'active' AND store.is_customer_facing = 1
          LIMIT 1`,
        { storeId: payload.store_id },
      );
      const store = storeRows[0];
      if (!store) throw new ApiError(404, 'store_not_found', 'Store was not found.');

      const [menuRows] = await connection.query<Array<RowDataPacket & {
        menu_item_id: number;
        category_id: number;
        product_kind_code: string;
      }>>(
        `SELECT item.id AS menu_item_id, item.category_id,
                COALESCE(NULLIF(LOWER(category.product_kind_code), ''),
                  CASE WHEN item.is_handcrafted_drink = 1 THEN 'drink' ELSE 'other' END) AS product_kind_code
           FROM menu_items item
           JOIN menu_categories category ON category.id = item.category_id
          WHERE item.id IN (:menuItemIds) AND item.is_active = 1
            AND item.sale_visibility = 'normal'`,
        { menuItemIds: payload.items.map((item) => item.menu_item_id) },
      );
      const itemById = new Map(menuRows.map((row) => [Number(row.menu_item_id), row]));
      if (itemById.size !== new Set(payload.items.map((item) => item.menu_item_id)).size) {
        throw new ApiError(400, 'menu_item_not_available', 'One or more items are unavailable.');
      }
      const promotion = await resolvePromotionalAddonForCheckout(connection, {
        tenantId: Number(store.tenant_id),
        storeId: payload.store_id,
        paymentMode: payload.payment_mode,
        channel: 'mobile',
        clientCapabilities: payload.client_capabilities,
        selectedRewardMenuItemId: payload.selected_promotional_reward_menu_item_id ?? null,
        declined: payload.promotional_reward_declined,
        lockStock: false,
        requireSelection: false,
        items: payload.items.map((item) => ({
          menu_item_id: item.menu_item_id,
          category_id: Number(itemById.get(item.menu_item_id)!.category_id),
          product_kind_code: String(itemById.get(item.menu_item_id)!.product_kind_code),
          quantity: item.quantity,
          line_type: 'sale',
        })),
      });
      await connection.rollback();
      if (!promotion) return { eligible: false, campaign: null };
      return {
        eligible: true,
        campaign: {
          id: promotion.campaignId,
          code: promotion.campaignCode,
          name: promotion.campaignName,
          assignment_mode: promotion.assignmentMode,
          allow_decline: promotion.allowDecline,
          price_mode: promotion.priceMode,
          price_rm: promotion.priceRm.toFixed(2),
          token_amount: promotion.tokenAmount,
          qualification_summary: promotion.qualificationSummary,
          rewards: promotion.availableRewards,
        },
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
