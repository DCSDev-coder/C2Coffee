import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import sharp from 'sharp';
import { z } from 'zod';
import { mysqlPool } from '../../db/mysql.js';
import { requireAnyAdminRole, authenticateAdminRequest } from '../../admin/guard.js';
import { ApiError } from '../errors.js';
import { saveMediaAsset } from '../../lib/media-assets.js';

const optionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  image_url: z.string().trim().max(512).nullable().optional(),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  gradient_end_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  price_delta_rm: z.coerce.number().min(-999).max(999).default(0),
  token_price_delta: z.coerce.number().int().min(-999).max(999).default(0),
  calorie_delta_kcal: z.coerce.number().int().min(-5000).max(5000).default(0),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true)
});

const optionImageUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  data_url: z.string().trim().min(1)
});

const groupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  applies_to: z.enum(['all_drinks', 'selected_items']),
  selection_type: z.enum(['single', 'multi']).default('single'),
  min_select: z.coerce.number().int().min(0).default(0),
  max_select: z.coerce.number().int().min(1).default(1),
  is_required: z.coerce.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
  menu_item_ids: z.array(z.coerce.number().int().positive()).default([]),
  options: z.array(optionSchema).min(1)
}).superRefine((value, context) => {
  if (value.min_select > value.max_select) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['min_select'], message: 'Minimum selections cannot exceed maximum selections.' });
  }
  if (value.applies_to === 'selected_items' && value.menu_item_ids.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['menu_item_ids'], message: 'Select at least one menu item.' });
  }
});

const nutritionSchema = z.object({ base_calories_kcal: z.coerce.number().int().min(0).max(5000) });

export async function registerAdminOptionLibraryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/menu/options-library', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT g.id, g.name, g.applies_to, g.selection_type, g.min_select, g.max_select, g.is_required, g.sort_order, g.is_active,
        o.id AS option_id, o.name AS option_name, o.image_url AS option_image_url, o.color_hex, o.gradient_end_hex, CAST(o.price_delta_rm AS CHAR) AS price_delta_rm, o.token_price_delta, o.calorie_delta_kcal, o.sort_order AS option_sort_order, o.is_active AS option_is_active,
        a.menu_item_id
       FROM menu_option_groups g
       LEFT JOIN menu_option_group_options o ON o.option_group_id = g.id
       LEFT JOIN menu_option_group_items a ON a.option_group_id = g.id
       WHERE g.tenant_id = :tenantId
       ORDER BY g.sort_order, g.id, o.sort_order, o.id`,
      { tenantId: request.adminAuth.tenantId }
    );
    const groups = new Map<number, any>();
    for (const row of rows) {
      let group = groups.get(row.id);
      if (!group) {
        group = { id: row.id, name: row.name, applies_to: row.applies_to, selection_type: row.selection_type, min_select: row.min_select, max_select: row.max_select, is_required: row.is_required === 1, sort_order: row.sort_order, is_active: row.is_active === 1, menu_item_ids: [], options: [] };
        groups.set(row.id, group);
      }
      if (row.menu_item_id && !group.menu_item_ids.includes(row.menu_item_id)) group.menu_item_ids.push(row.menu_item_id);
      if (row.option_id && !group.options.some((option: any) => option.id === row.option_id)) {
        group.options.push({ id: row.option_id, name: row.option_name, image_url: row.option_image_url, color_hex: row.color_hex, gradient_end_hex: row.gradient_end_hex, price_delta_rm: row.price_delta_rm, token_price_delta: row.token_price_delta, calorie_delta_kcal: row.calorie_delta_kcal, sort_order: row.option_sort_order, is_active: row.option_is_active === 1 });
      }
    }
    return { groups: [...groups.values()] };
  });

  app.post('/v1/admin/menu/options-library/uploads', {
    preHandler: authenticateAdminRequest,
    bodyLimit: 10 * 1024 * 1024
  }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const payload = optionImageUploadSchema.parse(request.body);
    const base64Payload = payload.data_url.includes('base64,')
      ? payload.data_url.split('base64,').pop() || ''
      : payload.data_url;
    const source = Buffer.from(base64Payload, 'base64');
    if (source.length === 0) throw new ApiError(400, 'invalid_upload', 'Uploaded image data was empty.');

    let content: Buffer;
    try {
      content = await sharp(source, { limitInputPixels: 32_000_000 })
        .rotate()
        .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84, effort: 4 })
        .toBuffer();
    } catch {
      throw new ApiError(400, 'invalid_upload', 'Please upload a valid PNG, JPEG, or WebP image.');
    }

    const safeName = payload.file_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bean-choice';
    const assetPath = `/assets/menu/options/${Date.now()}-${randomUUID()}-${safeName}.webp`;
    await saveMediaAsset({ assetPath, fileName: `${safeName}.webp`, mimeType: 'image/webp', content });
    return { image_url: assetPath };
  });

  app.post('/v1/admin/menu/options-library/groups', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const payload = groupSchema.parse(request.body);
    return saveGroup(request.adminAuth.tenantId, payload);
  });

  app.patch('/v1/admin/menu/options-library/groups/:groupId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const groupId = z.coerce.number().int().positive().parse((request.params as { groupId: string }).groupId);
    const payload = groupSchema.parse(request.body);
    const [owned] = await mysqlPool.query<Array<RowDataPacket>>('SELECT id FROM menu_option_groups WHERE id = :groupId AND tenant_id = :tenantId LIMIT 1', { groupId, tenantId: request.adminAuth.tenantId });
    if (!owned[0]) throw new ApiError(404, 'option_group_not_found', 'Option group was not found.');
    return saveGroup(request.adminAuth.tenantId, payload, groupId);
  });

  app.delete('/v1/admin/menu/options-library/groups/:groupId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const groupId = z.coerce.number().int().positive().parse((request.params as { groupId: string }).groupId);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      'DELETE FROM menu_option_groups WHERE id = :groupId AND tenant_id = :tenantId',
      { groupId, tenantId: request.adminAuth.tenantId }
    );
    if (result.affectedRows === 0) throw new ApiError(404, 'option_group_not_found', 'Option group was not found.');
    return { deleted: true, group_id: groupId };
  });

  app.patch('/v1/admin/menu/items/:itemId/nutrition', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const itemId = z.coerce.number().int().positive().parse((request.params as { itemId: string }).itemId);
    const payload = nutritionSchema.parse(request.body);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       JOIN admin_tenants t ON t.id = c.tenant_id
       SET i.base_calories_kcal = :calories
       WHERE i.id = :itemId AND t.id = :tenantId`,
      { itemId, calories: payload.base_calories_kcal, tenantId: request.adminAuth.tenantId }
    );
    if (result.affectedRows === 0) throw new ApiError(404, 'menu_item_not_found', 'Menu item was not found.');
    return { item_id: itemId, base_calories_kcal: payload.base_calories_kcal };
  });
}

async function saveGroup(tenantId: number, payload: z.infer<typeof groupSchema>, groupId?: number) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    let id = groupId;
    if (id) {
      await connection.execute(`UPDATE menu_option_groups SET name=:name, applies_to=:appliesTo, selection_type=:selectionType, min_select=:minSelect, max_select=:maxSelect, is_required=:isRequired, sort_order=:sortOrder, is_active=:isActive WHERE id=:id AND tenant_id=:tenantId`, { id, tenantId, name: payload.name, appliesTo: payload.applies_to, selectionType: payload.selection_type, minSelect: payload.min_select, maxSelect: payload.max_select, isRequired: payload.is_required ? 1 : 0, sortOrder: payload.sort_order, isActive: payload.is_active ? 1 : 0 });
      await connection.execute('DELETE FROM menu_option_group_options WHERE option_group_id = :id', { id });
      await connection.execute('DELETE FROM menu_option_group_items WHERE option_group_id = :id', { id });
    } else {
      const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO menu_option_groups (tenant_id,name,applies_to,selection_type,min_select,max_select,is_required,sort_order,is_active) VALUES (:tenantId,:name,:appliesTo,:selectionType,:minSelect,:maxSelect,:isRequired,:sortOrder,:isActive)`, { tenantId, name: payload.name, appliesTo: payload.applies_to, selectionType: payload.selection_type, minSelect: payload.min_select, maxSelect: payload.max_select, isRequired: payload.is_required ? 1 : 0, sortOrder: payload.sort_order, isActive: payload.is_active ? 1 : 0 });
      id = result.insertId;
    }
    for (const [index, option] of payload.options.entries()) {
      await connection.execute(`INSERT INTO menu_option_group_options (option_group_id,name,image_url,color_hex,gradient_end_hex,price_delta_rm,token_price_delta,calorie_delta_kcal,sort_order,is_active) VALUES (:id,:name,:imageUrl,:colorHex,:gradientEndHex,:rm,:tokens,:calories,:sortOrder,:active)`, { id, name: option.name, imageUrl: option.image_url || null, colorHex: option.color_hex || null, gradientEndHex: option.gradient_end_hex || null, rm: option.price_delta_rm.toFixed(2), tokens: option.token_price_delta, calories: option.calorie_delta_kcal, sortOrder: option.sort_order ?? index, active: option.is_active ? 1 : 0 });
    }
    if (payload.applies_to === 'selected_items') {
      for (const menuItemId of [...new Set(payload.menu_item_ids)]) {
        const [items] = await connection.query<Array<RowDataPacket>>(`SELECT i.id FROM menu_items i JOIN menu_categories c ON c.id=i.category_id WHERE i.id=:menuItemId AND CASE WHEN LOWER(c.code) IN ('coffee', 'non_coffee') THEN 'drink' WHEN LOWER(c.code) = 'food' THEN 'food' WHEN LOWER(c.code) = 'merchandise' THEN 'merchandise' WHEN LOWER(c.code) = 'candles' THEN 'candle' ELSE 'other' END = 'drink' LIMIT 1`, { menuItemId });
        if (!items[0]) throw new ApiError(400, 'invalid_option_item', 'Options can only be assigned to drink items.');
        await connection.execute('INSERT INTO menu_option_group_items (option_group_id,menu_item_id) VALUES (:id,:menuItemId)', { id, menuItemId });
      }
    }
    await connection.commit();
    return { group: { id, ...payload } };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}
