import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const campaignSchema = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9_-]+$/).min(2).max(50),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),
  assignment_mode: z.enum(['customer_choice', 'server_random']),
  legacy_fallback: z.enum(['random', 'no_reward']).default('no_reward'),
  allow_decline: z.boolean().default(true),
  price_mode: z.enum(['free', 'fixed_rm', 'fixed_token']).default('free'),
  fixed_price_rm: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  fixed_token_amount: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
  price_amount: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  minimum_quantity: z.coerce.number().int().min(1).max(100).default(1),
  qualifying_product_kind_codes: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  qualifying_category_ids: z.array(z.coerce.number().int().positive()).max(100).default([]),
  qualifying_menu_item_ids: z.array(z.coerce.number().int().positive()).max(500).default([]),
  reward_menu_item_ids: z.array(z.coerce.number().int().positive()).min(1).max(100),
  store_ids: z.array(z.coerce.number().int().positive()).max(100).default([]),
  payment_modes: z.array(z.enum(['token', 'direct'])).default([]),
  sales_channels: z.array(z.enum(['mobile', 'counter'])).min(1).default(['mobile']),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  priority: z.coerce.number().int().min(-10000).max(10000).default(0),
}).superRefine((value, context) => {
  if (value.price_mode === 'fixed_rm' && value.fixed_price_rm == null && value.price_amount == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fixed_price_rm'], message: 'Enter the promotional RM price.' });
  }
  if (value.price_mode === 'fixed_token' && value.fixed_token_amount == null && value.price_amount == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fixed_token_amount'], message: 'Enter the promotional token price.' });
  }
  if (value.price_mode === 'fixed_rm' && value.payment_modes.length > 0 && value.payment_modes.some((mode) => mode !== 'direct')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_modes'], message: 'Fixed RM add-ons are available only for direct payment.' });
  }
  if (value.price_mode === 'fixed_token' && value.payment_modes.length > 0 && value.payment_modes.some((mode) => mode !== 'token')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['payment_modes'], message: 'Fixed token add-ons are available only for token payment.' });
  }
  if (value.price_mode !== 'free' && value.legacy_fallback === 'random') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['legacy_fallback'], message: 'Paid add-ons require an updated app and cannot be assigned silently to older versions.' });
  }
  if (value.starts_at && value.ends_at && Date.parse(value.ends_at) <= Date.parse(value.starts_at)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['ends_at'], message: 'End time must be after start time.' });
  }
});

async function writeAudit(connection: PoolConnection, request: FastifyRequest, action: string, id: number, after: unknown) {
  await connection.execute(
    `INSERT INTO admin_audit_logs
       (admin_user_id, effective_roles_json, action_code, target_type, target_id,
        after_json, reason_code, reason_note, ip_address, user_agent, created_at)
     VALUES
       (:adminUserId, :roles, :action, 'promotional_addon_campaign', :targetId,
        :afterJson, :action, 'Promotional add-on campaign administration', :ipAddress, :userAgent, UTC_TIMESTAMP())`,
    {
      adminUserId: request.adminAuth.adminUserId,
      roles: JSON.stringify(request.adminAuth.roles),
      action,
      targetId: String(id),
      afterJson: JSON.stringify(after),
      ipAddress: request.ip,
      userAgent: String(request.headers['user-agent'] ?? '').slice(0, 512),
    },
  );
}

async function validateReferences(connection: PoolConnection, tenantId: number, payload: z.infer<typeof campaignSchema>) {
  if (payload.store_ids.length) {
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT id FROM stores WHERE tenant_id = :tenantId AND id IN (:ids)',
      { tenantId, ids: payload.store_ids },
    );
    if (rows.length !== new Set(payload.store_ids).size) throw new ApiError(400, 'invalid_campaign_store', 'Choose only stores from the active tenant.');
  }
  const [rewardRows] = await connection.query<Array<RowDataPacket & { id: number; recipe_count: number }>>(
    `SELECT item.id, COUNT(recipe.inventory_item_id) AS recipe_count
       FROM menu_items item
       LEFT JOIN inventory_menu_item_recipes recipe ON recipe.menu_item_id = item.id AND recipe.tenant_id = :tenantId
      WHERE item.id IN (:ids) AND item.is_active = 1 AND item.sale_visibility = 'promotion_only'
      GROUP BY item.id`,
    { tenantId, ids: payload.reward_menu_item_ids },
  );
  if (rewardRows.length !== new Set(payload.reward_menu_item_ids).size || rewardRows.some((row) => Number(row.recipe_count) === 0)) {
    throw new ApiError(400, 'invalid_promotional_reward', 'Every reward must be an active promotion-only menu item with an inventory recipe.');
  }
}

async function replaceScopes(connection: PoolConnection, campaignId: number, payload: z.infer<typeof campaignSchema>) {
  await Promise.all([
    connection.execute('DELETE FROM promotional_addon_campaign_stores WHERE campaign_id = :campaignId', { campaignId }),
    connection.execute('DELETE FROM promotional_addon_qualifying_categories WHERE campaign_id = :campaignId', { campaignId }),
    connection.execute('DELETE FROM promotional_addon_qualifying_items WHERE campaign_id = :campaignId', { campaignId }),
    connection.execute('DELETE FROM promotional_addon_reward_items WHERE campaign_id = :campaignId', { campaignId }),
  ]);
  for (const storeId of payload.store_ids) await connection.execute('INSERT INTO promotional_addon_campaign_stores (campaign_id, store_id) VALUES (:campaignId, :storeId)', { campaignId, storeId });
  for (const categoryId of payload.qualifying_category_ids) await connection.execute('INSERT INTO promotional_addon_qualifying_categories (campaign_id, category_id) VALUES (:campaignId, :categoryId)', { campaignId, categoryId });
  for (const menuItemId of payload.qualifying_menu_item_ids) await connection.execute('INSERT INTO promotional_addon_qualifying_items (campaign_id, menu_item_id) VALUES (:campaignId, :menuItemId)', { campaignId, menuItemId });
  for (const [sortOrder, menuItemId] of payload.reward_menu_item_ids.entries()) await connection.execute('INSERT INTO promotional_addon_reward_items (campaign_id, menu_item_id, sort_order) VALUES (:campaignId, :menuItemId, :sortOrder)', { campaignId, menuItemId, sortOrder });
}

function campaignBindings(tenantId: number, adminId: number, payload: z.infer<typeof campaignSchema>) {
  return {
    tenantId,
    adminId,
    code: payload.code.toUpperCase(),
    name: payload.name,
    description: payload.description ?? null,
    status: payload.status,
    assignmentMode: payload.assignment_mode,
    legacyFallback: payload.legacy_fallback,
    allowDecline: payload.allow_decline ? 1 : 0,
    priceMode: payload.price_mode,
    fixedPriceRm: payload.price_mode === 'fixed_rm' ? (payload.fixed_price_rm ?? payload.price_amount ?? null) : null,
    fixedTokenAmount: payload.price_mode === 'fixed_token' ? Math.floor(payload.fixed_token_amount ?? payload.price_amount ?? 0) : null,
    minimumQuantity: payload.minimum_quantity,
    kinds: JSON.stringify(payload.qualifying_product_kind_codes),
    paymentModes: JSON.stringify(payload.payment_modes.length ? payload.payment_modes : payload.price_mode === 'fixed_rm' ? ['direct'] : payload.price_mode === 'fixed_token' ? ['token'] : ['token', 'direct']),
    channels: JSON.stringify(payload.sales_channels),
    startsAt: payload.starts_at ? new Date(payload.starts_at) : null,
    endsAt: payload.ends_at ? new Date(payload.ends_at) : null,
    priority: payload.priority,
  };
}

export async function registerAdminPromotionalAddonRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/promotional-addons/options', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const tenantId = request.adminAuth.tenantId;
    const [[stores], [categories], [items]] = await Promise.all([
      mysqlPool.query<RowDataPacket[]>('SELECT id, name FROM stores WHERE tenant_id = :tenantId AND status = \'active\' ORDER BY name', { tenantId }),
      mysqlPool.query<RowDataPacket[]>('SELECT id, code, name, product_kind_code FROM menu_categories WHERE is_active = 1 ORDER BY sort_order, name'),
      mysqlPool.query<RowDataPacket[]>(`SELECT item.id, item.code, item.name, item.category_id, item.sale_visibility,
          EXISTS(SELECT 1 FROM inventory_menu_item_recipes recipe WHERE recipe.menu_item_id = item.id AND recipe.tenant_id = :tenantId) AS has_inventory_recipe
        FROM menu_items item WHERE item.is_active = 1 ORDER BY item.name`, { tenantId }),
    ]);
    const productKinds = [...new Map(categories.map((category) => {
      const code = String(category.product_kind_code || 'other').toLowerCase();
      return [code, { code, name: code.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }];
    })).values()];
    return { stores, categories, items, menu_items: items, product_kinds: productKinds };
  });

  app.get('/v1/admin/promotional-addons/readiness', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT campaign.id AS campaign_id,
              COUNT(DISTINCT reward.menu_item_id) AS reward_count,
              COUNT(DISTINCT CASE WHEN recipe.menu_item_id IS NOT NULL THEN reward.menu_item_id END) AS recipe_ready_count,
              COUNT(DISTINCT CASE WHEN stock.id IS NOT NULL AND stock.on_hand_quantity > stock.reserved_quantity THEN reward.menu_item_id END) AS stocked_reward_count
         FROM promotional_addon_campaigns campaign
         LEFT JOIN promotional_addon_reward_items reward ON reward.campaign_id = campaign.id AND reward.is_active = 1
         LEFT JOIN inventory_menu_item_recipes recipe ON recipe.menu_item_id = reward.menu_item_id AND recipe.tenant_id = campaign.tenant_id
         LEFT JOIN promotional_addon_campaign_stores scope ON scope.campaign_id = campaign.id
         LEFT JOIN stores store ON store.tenant_id = campaign.tenant_id AND (scope.store_id IS NULL OR store.id = scope.store_id)
         LEFT JOIN inventory_store_stocks stock ON stock.store_id = store.id AND stock.inventory_item_id = recipe.inventory_item_id
        WHERE campaign.tenant_id = :tenantId
        GROUP BY campaign.id`,
      { tenantId: request.adminAuth.tenantId },
    );
    return {
      campaigns: rows.map((row) => {
        const issues = [];
        if (Number(row.reward_count) === 0) issues.push({ code: 'no_rewards', message: 'Add at least one reward item.' });
        if (Number(row.recipe_ready_count) < Number(row.reward_count)) issues.push({ code: 'missing_recipe', message: 'Every reward needs an inventory recipe.' });
        if (Number(row.stocked_reward_count) === 0) issues.push({ code: 'out_of_stock', message: 'No reward is currently in stock at a participating outlet.' });
        return { ...row, ready: issues.length === 0, issues };
      }),
    };
  });

  app.get('/v1/admin/promotional-addons', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const tenantId = request.adminAuth.tenantId;
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT campaign.*,
        campaign.qualifying_product_kind_codes_json AS qualifying_product_kind_codes,
        CASE WHEN campaign.price_mode = 'fixed_rm' THEN campaign.fixed_price_rm
             WHEN campaign.price_mode = 'fixed_token' THEN campaign.fixed_token_amount ELSE 0 END AS price_amount,
        (SELECT JSON_ARRAYAGG(scope.store_id) FROM promotional_addon_campaign_stores scope WHERE scope.campaign_id = campaign.id) AS store_ids,
        (SELECT JSON_ARRAYAGG(scope.category_id) FROM promotional_addon_qualifying_categories scope WHERE scope.campaign_id = campaign.id) AS qualifying_category_ids,
        (SELECT JSON_ARRAYAGG(scope.menu_item_id) FROM promotional_addon_qualifying_items scope WHERE scope.campaign_id = campaign.id) AS qualifying_menu_item_ids,
        (SELECT JSON_ARRAYAGG(reward.menu_item_id) FROM promotional_addon_reward_items reward WHERE reward.campaign_id = campaign.id AND reward.is_active = 1) AS reward_menu_item_ids,
        (SELECT COUNT(*) FROM promotional_addon_campaign_stores scope WHERE scope.campaign_id = campaign.id) AS store_count,
        (SELECT COUNT(*) FROM promotional_addon_reward_items reward WHERE reward.campaign_id = campaign.id AND reward.is_active = 1) AS reward_count
       FROM promotional_addon_campaigns campaign
       WHERE campaign.tenant_id = :tenantId
       ORDER BY campaign.priority DESC, campaign.id DESC`,
      { tenantId },
    );
    return {
      campaigns: rows.map((row) => ({
        ...row,
        qualifying_product_kind_codes: jsonArray(row.qualifying_product_kind_codes),
        payment_modes: jsonArray(row.payment_modes_json),
        sales_channels: jsonArray(row.sales_channels_json),
        store_ids: jsonArray(row.store_ids),
        qualifying_category_ids: jsonArray(row.qualifying_category_ids),
        qualifying_menu_item_ids: jsonArray(row.qualifying_menu_item_ids),
        reward_menu_item_ids: jsonArray(row.reward_menu_item_ids),
      })),
    };
  });

  app.post('/v1/admin/promotional-addons', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const payload = campaignSchema.parse(request.body);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      await validateReferences(connection, request.adminAuth.tenantId, payload);
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO promotional_addon_campaigns
          (tenant_id, code, name, description, status, assignment_mode, legacy_fallback, allow_decline,
           price_mode, fixed_price_rm, fixed_token_amount, minimum_quantity,
           qualifying_product_kind_codes_json, payment_modes_json, sales_channels_json,
           starts_at, ends_at, priority, created_by_admin_id, updated_by_admin_id)
         VALUES
          (:tenantId, :code, :name, :description, :status, :assignmentMode, :legacyFallback, :allowDecline,
           :priceMode, :fixedPriceRm, :fixedTokenAmount, :minimumQuantity,
           :kinds, :paymentModes, :channels, :startsAt, :endsAt, :priority, :adminId, :adminId)`,
        campaignBindings(request.adminAuth.tenantId, request.adminAuth.adminUserId, payload),
      );
      await replaceScopes(connection, result.insertId, payload);
      await writeAudit(connection, request, 'promotional_addon_campaign_created', result.insertId, payload);
      await connection.commit();
      return reply.code(201).send({ id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.put('/v1/admin/promotional-addons/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const campaignId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const payload = campaignSchema.parse(request.body);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      await validateReferences(connection, request.adminAuth.tenantId, payload);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE promotional_addon_campaigns SET
           code = :code, name = :name, description = :description, status = :status,
           assignment_mode = :assignmentMode, legacy_fallback = :legacyFallback, allow_decline = :allowDecline,
           price_mode = :priceMode, fixed_price_rm = :fixedPriceRm, fixed_token_amount = :fixedTokenAmount,
           minimum_quantity = :minimumQuantity, qualifying_product_kind_codes_json = :kinds,
           payment_modes_json = :paymentModes, sales_channels_json = :channels,
           starts_at = :startsAt, ends_at = :endsAt, priority = :priority, updated_by_admin_id = :adminId
         WHERE id = :campaignId AND tenant_id = :tenantId`,
        { ...campaignBindings(request.adminAuth.tenantId, request.adminAuth.adminUserId, payload), campaignId },
      );
      if (!result.affectedRows) throw new ApiError(404, 'promotional_campaign_not_found', 'Campaign was not found.');
      await replaceScopes(connection, campaignId, payload);
      await writeAudit(connection, request, 'promotional_addon_campaign_updated', campaignId, payload);
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/promotional-addons/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin']);
    const campaignId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `DELETE FROM promotional_addon_campaigns
          WHERE id = :campaignId AND tenant_id = :tenantId AND status IN ('draft', 'archived')
            AND NOT EXISTS (SELECT 1 FROM order_promotional_addons assignment WHERE assignment.campaign_id = :campaignId)`,
        { campaignId, tenantId: request.adminAuth.tenantId },
      );
      if (!result.affectedRows) throw new ApiError(409, 'promotional_campaign_in_use', 'Only unused draft or archived campaigns can be deleted.');
      await writeAudit(connection, request, 'promotional_addon_campaign_deleted', campaignId, { id: campaignId });
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
