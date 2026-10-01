import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { authenticateRequest } from '../../auth/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const updateSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  itemIds: z.array(z.coerce.number().int().positive()).max(6).refine((ids) => new Set(ids).size === ids.length, 'Items must be unique.')
});
const storeSchema = z.object({ store_id: z.coerce.number().int().positive() });
const groupSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(2).max(120),
  selection_mode: z.enum(['automatic', 'manual', 'mixed']),
  category_ids: z.array(z.coerce.number().int().positive()).max(20),
  item_ids: z.array(z.coerce.number().int().positive()).max(12),
  display_limit: z.coerce.number().int().min(1).max(12),
  sort_order: z.coerce.number().int().min(0).max(10000),
  is_active: z.boolean()
}).refine((group) => group.selection_mode === 'manual' ? group.item_ids.length > 0 : group.category_ids.length > 0,
  'Choose products for a manual group or categories for an automatic group.');
const groupsSchema = z.object({ groups: z.array(groupSchema).max(30) });

type LegacyHomeSection = 'featured_drinks' | 'lifestyle_picks';

function legacySectionCondition(section: LegacyHomeSection): string {
  return section === 'featured_drinks'
    ? "(LOWER(COALESCE(c.product_kind_code, '')) = 'drink' OR LOWER(c.code) IN ('coffee', 'non_coffee'))"
    : "(LOWER(COALESCE(c.product_kind_code, '')) IN ('merchandise', 'candle') OR LOWER(c.code) IN ('merchandise', 'candles'))";
}

// Retain these legacy fields until all released mobile clients use category sections.
async function loadLegacySectionItemIds(storeId: number, section: LegacyHomeSection): Promise<number[]> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { menu_item_id: number }>>(
    `SELECT h.menu_item_id
     FROM home_featured_items h
     JOIN menu_items i ON i.id = h.menu_item_id AND i.is_active = 1
     JOIN menu_categories c ON c.id = i.category_id AND c.is_active = 1
     LEFT JOIN menu_item_store_availability a ON a.store_id = :storeId AND a.menu_item_id = i.id
     WHERE h.section_code = :section
       AND COALESCE(a.is_available, 1) = 1
       AND ${legacySectionCondition(section)}
     ORDER BY h.sort_order ASC, h.id ASC
     LIMIT 6`,
    { storeId, section }
  );
  return rows.map((row) => Number(row.menu_item_id));
}

async function loadCategoryItemIds(storeId: number, categoryId: number): Promise<number[]> {
  const [pinnedRows] = await mysqlPool.query<Array<RowDataPacket & { menu_item_id: number }>>(
    `SELECT h.menu_item_id
     FROM home_featured_category_items h
     JOIN menu_items i ON i.id = h.menu_item_id AND i.is_active = 1
     LEFT JOIN menu_item_store_availability a ON a.store_id = :storeId AND a.menu_item_id = i.id
     WHERE h.category_id = :categoryId
       AND i.category_id = :categoryId
       AND COALESCE(a.is_available, 1) = 1
     ORDER BY h.sort_order ASC, h.id ASC`,
    { storeId, categoryId }
  );
  const itemIds = pinnedRows.map((row) => Number(row.menu_item_id));
  if (itemIds.length >= 6) return itemIds.slice(0, 6);

  const [fallbackRows] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
    `SELECT i.id
     FROM menu_items i
     LEFT JOIN menu_item_store_availability a ON a.store_id = :storeId AND a.menu_item_id = i.id
     LEFT JOIN order_items oi ON oi.menu_item_id = i.id
     LEFT JOIN orders o ON o.id = oi.order_id
       AND o.store_id = :storeId
       AND o.status = 'collected'
       AND o.collected_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
     WHERE i.is_active = 1
       AND i.category_id = :categoryId
       AND COALESCE(a.is_available, 1) = 1
     GROUP BY i.id, i.sort_order
     ORDER BY COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.quantity END), 0) DESC, i.sort_order ASC, i.id ASC
     LIMIT 12`,
    { storeId, categoryId }
  );
  for (const row of fallbackRows) {
    if (!itemIds.includes(Number(row.id))) itemIds.push(Number(row.id));
    if (itemIds.length === 6) break;
  }
  return itemIds;
}

async function loadGroupItemIds(storeId: number, group: RowDataPacket): Promise<number[]> {
  const categoryIds = JSON.parse(group.category_ids_json || '[]') as number[];
  const pinnedIds = JSON.parse(group.item_ids_json || '[]') as number[];
  const limit = Number(group.display_limit);
  const result: number[] = [];
  if (group.selection_mode !== 'automatic' && pinnedIds.length > 0) {
    const [eligiblePinned] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
      `SELECT i.id FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id AND c.is_active = 1
       LEFT JOIN menu_item_store_availability a ON a.store_id = ? AND a.menu_item_id = i.id
       WHERE i.id IN (?) AND i.is_active = 1 AND COALESCE(a.is_available, 1) = 1`,
      [storeId, pinnedIds]
    );
    const eligibleIds = new Set(eligiblePinned.map((row) => Number(row.id)));
    result.push(...pinnedIds.filter((id) => eligibleIds.has(id)));
  }
  if (group.selection_mode === 'manual' || result.length >= limit || categoryIds.length === 0) return result.slice(0, limit);
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
    `SELECT i.id FROM menu_items i
     JOIN menu_categories c ON c.id = i.category_id AND c.is_active = 1
     LEFT JOIN menu_item_store_availability a ON a.store_id = ? AND a.menu_item_id = i.id
     LEFT JOIN order_items oi ON oi.menu_item_id = i.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.store_id = ? AND o.status = 'collected'
       AND o.collected_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
     WHERE i.is_active = 1 AND i.category_id IN (?) AND COALESCE(a.is_available, 1) = 1
     GROUP BY i.id, i.sort_order
     ORDER BY COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.quantity END), 0) DESC, i.sort_order, i.id
     LIMIT ?`, [storeId, storeId, categoryIds, limit * 2]
  );
  for (const row of rows) if (!result.includes(Number(row.id)) && result.push(Number(row.id)) >= limit) break;
  return result.slice(0, limit);
}

export async function registerHomeFeaturedRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/home/featured', { preHandler: authenticateRequest }, async (request) => {
    const { store_id: storeId } = storeSchema.parse(request.query);
    const [stores] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM stores WHERE id = :storeId AND status = \'active\' AND is_customer_facing = 1 LIMIT 1', { storeId }
    );
    if (!stores[0]) throw new ApiError(404, 'store_not_found', 'Store was not found.');
    const [categories] = await mysqlPool.query<Array<RowDataPacket & { id: number; code: string; name: string; sort_order: number }>>(
      `SELECT DISTINCT c.id, c.code, c.name, c.sort_order
       FROM menu_categories c
       JOIN menu_items i ON i.category_id = c.id AND i.is_active = 1
       LEFT JOIN menu_item_store_availability a ON a.store_id = :storeId AND a.menu_item_id = i.id
       WHERE c.is_active = 1 AND COALESCE(a.is_available, 1) = 1
       ORDER BY c.sort_order ASC, c.id ASC`,
      { storeId }
    );
    const [groups] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, title, selection_mode, category_ids_json, item_ids_json, display_limit, sort_order
       FROM home_featured_groups WHERE is_active = 1 ORDER BY sort_order, id`
    );
    const configuredSections = await Promise.all(groups.map(async (group) => ({
      group_id: Number(group.id),
      title: group.title,
      selection_mode: group.selection_mode,
      category_ids: JSON.parse(group.category_ids_json || '[]'),
      item_ids: await loadGroupItemIds(storeId, group)
    })));
    return {
      sections: configuredSections.length > 0 ? configuredSections : await Promise.all(categories.map(async (category) => ({
        category_id: Number(category.id),
        category_code: category.code,
        category_name: category.name,
        item_ids: await loadCategoryItemIds(storeId, Number(category.id))
      }))),
      featured_drinks: await loadLegacySectionItemIds(storeId, 'featured_drinks'),
      lifestyle_picks: await loadLegacySectionItemIds(storeId, 'lifestyle_picks')
    };
  });

  app.get('/v1/admin/home-featured', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const [rows] = await mysqlPool.query<Array<RowDataPacket & { category_id: number; menu_item_id: number; sort_order: number }>>(
      'SELECT category_id, menu_item_id, sort_order FROM home_featured_category_items ORDER BY category_id, sort_order, id'
    );
    const [groups] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM home_featured_groups ORDER BY sort_order, id');
    return {
      groups: groups.map((group) => ({ id: Number(group.id), title: group.title, selection_mode: group.selection_mode,
        category_ids: JSON.parse(group.category_ids_json || '[]'), item_ids: JSON.parse(group.item_ids_json || '[]'),
        display_limit: Number(group.display_limit), sort_order: Number(group.sort_order), is_active: group.is_active === 1 })),
      placements: rows.map((row) => ({ categoryId: Number(row.category_id), itemId: Number(row.menu_item_id), sortOrder: Number(row.sort_order) }))
    };
  });

  app.put('/v1/admin/home-featured/groups', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { groups } = groupsSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM home_featured_groups');
      for (const group of groups) {
        if (group.category_ids.length > 0) {
          const [activeCategories] = await connection.query<RowDataPacket[]>(
            'SELECT id FROM menu_categories WHERE id IN (?) AND is_active = 1', [group.category_ids]
          );
          if (activeCategories.length !== group.category_ids.length) {
            throw new ApiError(400, 'invalid_home_featured_category', 'Featured groups can only use active menu categories.');
          }
        }
        if (group.item_ids.length > 0) {
          const [activeItems] = await connection.query<RowDataPacket[]>(
            `SELECT i.id FROM menu_items i JOIN menu_categories c ON c.id = i.category_id AND c.is_active = 1
             WHERE i.id IN (?) AND i.is_active = 1`, [group.item_ids]
          );
          if (activeItems.length !== group.item_ids.length) {
            throw new ApiError(400, 'invalid_home_featured_item', 'Featured groups can only use active products from active categories.');
          }
        }
        await connection.execute(
          `INSERT INTO home_featured_groups
           (title, selection_mode, category_ids_json, item_ids_json, display_limit, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [group.title, group.selection_mode, JSON.stringify(group.category_ids), JSON.stringify(group.item_ids),
            group.display_limit, group.sort_order, group.is_active ? 1 : 0]
        );
      }
      await connection.commit();
      return { groups };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.put('/v1/admin/home-featured', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { category_id: categoryId, itemIds } = updateSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      if (itemIds.length > 0) {
        const [eligibleRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
          `SELECT i.id FROM menu_items i JOIN menu_categories c ON c.id = i.category_id
           WHERE i.is_active = 1 AND c.is_active = 1 AND i.category_id = ? AND i.id IN (?)`, [categoryId, itemIds]
        );
        if (eligibleRows.length !== itemIds.length) {
          throw new ApiError(400, 'invalid_home_featured_item', 'Choose active items that belong in this menu category.');
        }
      }
      await connection.execute('DELETE FROM home_featured_category_items WHERE category_id = :categoryId', { categoryId });
      for (var index = 0; index < itemIds.length; index += 1) {
        await connection.execute(
          'INSERT INTO home_featured_category_items (category_id, menu_item_id, sort_order) VALUES (:categoryId, :itemId, :sortOrder)',
          { categoryId, itemId: itemIds[index], sortOrder: index + 1 }
        );
      }
      await connection.commit();
      return { category_id: categoryId, item_ids: itemIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
