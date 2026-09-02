import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { authenticateRequest } from '../../auth/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const sectionSchema = z.enum(['featured_drinks', 'lifestyle_picks']);
const updateSchema = z.object({
  section: sectionSchema,
  itemIds: z.array(z.coerce.number().int().positive()).max(6).refine((ids) => new Set(ids).size === ids.length, 'Items must be unique.')
});
const storeSchema = z.object({ store_id: z.coerce.number().int().positive() });

type HomeSection = z.infer<typeof sectionSchema>;

function sectionCondition(section: HomeSection): string {
  return section === 'featured_drinks'
    ? "(LOWER(COALESCE(c.product_kind_code, '')) = 'drink' OR LOWER(c.code) IN ('coffee', 'non_coffee'))"
    : "(LOWER(COALESCE(c.product_kind_code, '')) IN ('merchandise', 'candle') OR LOWER(c.code) IN ('merchandise', 'candles'))";
}

async function loadSectionItemIds(storeId: number, section: HomeSection): Promise<number[]> {
  const condition = sectionCondition(section);
  const [pinnedRows] = await mysqlPool.query<Array<RowDataPacket & { menu_item_id: number }>>(
    `SELECT h.menu_item_id
     FROM home_featured_items h
     JOIN menu_items i ON i.id = h.menu_item_id AND i.is_active = 1
     JOIN menu_categories c ON c.id = i.category_id AND c.is_active = 1
     LEFT JOIN menu_item_store_availability a ON a.store_id = :storeId AND a.menu_item_id = i.id
     WHERE h.section_code = :section
       AND COALESCE(a.is_available, 1) = 1
       AND ${condition}
     ORDER BY h.sort_order ASC, h.id ASC`,
    { storeId, section }
  );
  const itemIds = pinnedRows.map((row) => Number(row.menu_item_id));
  if (itemIds.length >= 6) return itemIds.slice(0, 6);

  const [fallbackRows] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
    `SELECT i.id
     FROM menu_items i
     JOIN menu_categories c ON c.id = i.category_id AND c.is_active = 1
     LEFT JOIN menu_item_store_availability a ON a.store_id = :storeId AND a.menu_item_id = i.id
     LEFT JOIN order_items oi ON oi.menu_item_id = i.id
     LEFT JOIN orders o ON o.id = oi.order_id
       AND o.store_id = :storeId
       AND o.status = 'collected'
       AND o.collected_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)
     WHERE i.is_active = 1
       AND COALESCE(a.is_available, 1) = 1
       AND ${condition}
     GROUP BY i.id, i.sort_order
     ORDER BY COALESCE(SUM(CASE WHEN o.id IS NULL THEN 0 ELSE oi.quantity END), 0) DESC, i.sort_order ASC, i.id ASC
     LIMIT 12`,
    { storeId }
  );
  for (const row of fallbackRows) {
    if (!itemIds.includes(Number(row.id))) itemIds.push(Number(row.id));
    if (itemIds.length === 6) break;
  }
  return itemIds;
}

export async function registerHomeFeaturedRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/home/featured', { preHandler: authenticateRequest }, async (request) => {
    const { store_id: storeId } = storeSchema.parse(request.query);
    const [stores] = await mysqlPool.query<Array<RowDataPacket & { id: number }>>(
      'SELECT id FROM stores WHERE id = :storeId AND status = \'active\' LIMIT 1', { storeId }
    );
    if (!stores[0]) throw new ApiError(404, 'store_not_found', 'Store was not found.');
    return {
      featured_drinks: await loadSectionItemIds(storeId, 'featured_drinks'),
      lifestyle_picks: await loadSectionItemIds(storeId, 'lifestyle_picks')
    };
  });

  app.get('/v1/admin/home-featured', { preHandler: authenticateAdminRequest }, async () => {
    const [rows] = await mysqlPool.query<Array<RowDataPacket & { section_code: HomeSection; menu_item_id: number; sort_order: number }>>(
      'SELECT section_code, menu_item_id, sort_order FROM home_featured_items ORDER BY section_code, sort_order'
    );
    return { placements: rows.map((row) => ({ section: row.section_code, itemId: Number(row.menu_item_id), sortOrder: Number(row.sort_order) })) };
  });

  app.put('/v1/admin/home-featured', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const { section, itemIds } = updateSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      if (itemIds.length > 0) {
        const condition = sectionCondition(section);
        const [eligibleRows] = await connection.query<Array<RowDataPacket & { id: number }>>(
          `SELECT i.id FROM menu_items i JOIN menu_categories c ON c.id = i.category_id
           WHERE i.is_active = 1 AND c.is_active = 1 AND ${condition} AND i.id IN (?)`, [itemIds]
        );
        if (eligibleRows.length !== itemIds.length) {
          throw new ApiError(400, 'invalid_home_featured_item', 'Choose active items that belong in this Home section.');
        }
      }
      await connection.execute('DELETE FROM home_featured_items WHERE section_code = :section', { section });
      for (var index = 0; index < itemIds.length; index += 1) {
        await connection.execute(
          'INSERT INTO home_featured_items (section_code, menu_item_id, sort_order) VALUES (:section, :itemId, :sortOrder)',
          { section, itemId: itemIds[index], sortOrder: index + 1 }
        );
      }
      await connection.commit();
      return { section, itemIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
