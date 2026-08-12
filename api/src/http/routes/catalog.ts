import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateRequest } from '../../auth/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { getBootstrapForUser } from './auth.js';
import { getUserResponse } from './me.js';

const menuQuerySchema = z.object({
  store_id: z.coerce.number().int().positive()
});

type StoreRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  status: 'active' | 'inactive';
  supports_pickup: number;
  pickup_lead_minutes: number;
};

type MenuRow = RowDataPacket & {
  category_id: number;
  category_code: string;
  category_name: string;
  category_sort_order: number;
  item_id: number;
  item_code: string;
  item_name: string;
  item_description: string | null;
  base_price_rm: string;
  image_url: string | null;
  is_available: number;
  is_handcrafted_drink: number;
  is_qualifying_cup: number;
  tier_code: 'kawan' | 'dilamun' | 'ketagih' | 'legend' | null;
  token_price: number | null;
};

const homeBanners = [
  { code: 'operation_hours', image: 'operationhour.jpeg' },
  { code: 'happy_hour', image: 'happyhour.jpeg' },
  { code: 'emergency_notice', image: 'incaseofemergency.jpeg' }
];

export async function registerCatalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/bootstrap', { preHandler: authenticateRequest }, async (request) => {
    const [user, summary] = await Promise.all([
      getUserResponse(request.auth.userId),
      getBootstrapForUser(request.auth.userId)
    ]);

    return {
      user,
      token: {
        balance_available: summary.token_balance,
        balance_reserved: summary.token_reserved,
        balance_cap: summary.token_cap
      },
      loyalty: {
        tier: summary.tier,
        cups_last_180d: summary.cups_last_180d,
        next_tier: null
      },
      active_order: null,
      home_banners: homeBanners
    };
  });

  app.get('/v1/stores', { preHandler: authenticateRequest }, async () => {
    return {
      stores: await listActiveStores()
    };
  });

  app.get('/v1/menu', { preHandler: authenticateRequest }, async (request) => {
    const { store_id: storeId } = menuQuerySchema.parse(request.query);

    const stores = await listActiveStores();
    if (!stores.some((store) => store.id === storeId)) {
      throw new ApiError(404, 'store_not_found', 'Store was not found.');
    }

    const [rows] = await mysqlPool.query<Array<MenuRow>>(
      `
        SELECT
          c.id AS category_id,
          c.code AS category_code,
          c.name AS category_name,
          c.sort_order AS category_sort_order,
          i.id AS item_id,
          i.code AS item_code,
          i.name AS item_name,
          i.description AS item_description,
          CAST(i.base_price_rm AS CHAR) AS base_price_rm,
          i.image_url,
          COALESCE(a.is_available, 1) AS is_available,
          i.is_handcrafted_drink,
          i.is_qualifying_cup,
          tp.tier_code,
          tp.token_price
        FROM menu_categories c
        JOIN menu_items i
          ON i.category_id = c.id
         AND i.is_active = 1
        LEFT JOIN menu_item_store_availability a
          ON a.store_id = :storeId
         AND a.menu_item_id = i.id
        LEFT JOIN menu_item_token_prices tp
          ON tp.menu_item_id = i.id
         AND tp.is_enabled = 1
         AND tp.effective_from <= UTC_TIMESTAMP()
         AND (tp.effective_to IS NULL OR tp.effective_to > UTC_TIMESTAMP())
        WHERE c.is_active = 1
        ORDER BY c.sort_order, c.id, i.sort_order, i.id, tp.tier_code
      `,
      { storeId }
    );

    const categories = new Map<
      number,
      {
        id: number;
        code: string;
        name: string;
        sort_order: number;
        items: Array<{
          id: number;
          code: string;
          name: string;
          description: string | null;
          base_price_rm: string;
          image_url: string | null;
          is_available: boolean;
          is_handcrafted_drink: boolean;
          is_qualifying_cup: boolean;
          token_prices: Record<string, number>;
        }>;
      }
    >();

    const itemsByCategory = new Map<string, number>();

    for (const row of rows) {
      const category =
        categories.get(row.category_id) ??
        {
          id: row.category_id,
          code: row.category_code,
          name: row.category_name,
          sort_order: row.category_sort_order,
          items: []
        };

      if (!categories.has(row.category_id)) {
        categories.set(row.category_id, category);
      }

      const itemKey = `${row.category_id}:${row.item_id}`;
      let itemIndex = itemsByCategory.get(itemKey);
      if (itemIndex === undefined) {
        category.items.push({
          id: row.item_id,
          code: row.item_code,
          name: row.item_name,
          description: row.item_description,
          base_price_rm: row.base_price_rm,
          image_url: row.image_url,
          is_available: row.is_available === 1,
          is_handcrafted_drink: row.is_handcrafted_drink === 1,
          is_qualifying_cup: row.is_qualifying_cup === 1,
          token_prices: {}
        });
        itemIndex = category.items.length - 1;
        itemsByCategory.set(itemKey, itemIndex);
      }

      if (row.tier_code && row.token_price !== null) {
        category.items[itemIndex].token_prices[row.tier_code] = row.token_price;
      }
    }

    return {
      store_id: storeId,
      categories: [...categories.values()]
    };
  });
}

async function listActiveStores(): Promise<
  Array<{
    id: number;
    code: string;
    name: string;
    supports_pickup: boolean;
    pickup_lead_minutes: number;
    is_open_now: null;
    status: 'active' | 'inactive';
  }>
> {
  const [rows] = await mysqlPool.query<Array<StoreRow>>(
    `
      SELECT
        id,
        code,
        name,
        status,
        supports_pickup,
        pickup_lead_minutes
      FROM stores
      WHERE status = 'active'
      ORDER BY name ASC, id ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    supports_pickup: row.supports_pickup === 1,
    pickup_lead_minutes: row.pickup_lead_minutes,
    is_open_now: null,
    status: row.status
  }));
}
