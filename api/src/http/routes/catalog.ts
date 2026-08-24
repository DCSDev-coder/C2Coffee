import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateRequest } from '../../auth/guard.js';
import { env } from '../../config/env.js';
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
  category_product_kind_code: string;
  category_sort_order: number;
  subcategory_id: number | null;
  subcategory_code: string | null;
  subcategory_name: string | null;
  item_id: number;
  item_code: string;
  item_name: string;
  item_description: string | null;
  base_price_rm: string;
  base_price_token: number;
  image_url: string | null;
  is_available: number;
  is_handcrafted_drink: number;
  is_qualifying_cup: number;
  allow_choice_of_beans: number;
  allow_espresso_shot: number;
  allow_choice_of_milk: number;
  allow_choice_of_sweetness: number;
  allow_ice_level: number;
  allow_temperature: number;
  allow_sparkling_mixer: number;
  allow_order_type: number;
  allow_remarks: number;
  tier_code: 'kawan' | 'dilamun' | 'ketagih' | 'legend' | null;
  token_price: number | null;
  modifier_group_id: number | null;
  modifier_group_code: string | null;
  modifier_group_name: string | null;
  modifier_selection_type: 'single' | 'multi' | null;
  modifier_min_select: number | null;
  modifier_max_select: number | null;
  modifier_is_required: number | null;
  modifier_group_sort_order: number | null;
  modifier_option_id: number | null;
  modifier_option_code: string | null;
  modifier_option_name: string | null;
  modifier_option_price_delta_rm: string | null;
  modifier_option_token_price_delta: number | null;
  modifier_option_sort_order: number | null;
};

type MenuModifierOption = {
  id: number;
  code: string;
  name: string;
  price_delta_rm: string;
  token_price_delta: number;
};

type MenuModifierGroup = {
  id: number;
  code: string;
  name: string;
  selection_type: 'single' | 'multi';
  min_select: number;
  max_select: number;
  is_required: boolean;
  options: Array<MenuModifierOption>;
};

type MenuItemResponse = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  base_price_rm: string;
  base_price_token: number;
  image_url: string | null;
  is_available: boolean;
  is_handcrafted_drink: boolean;
  is_qualifying_cup: boolean;
  allow_choice_of_beans: boolean;
  allow_espresso_shot: boolean;
  allow_choice_of_milk: boolean;
  allow_choice_of_sweetness: boolean;
  allow_ice_level: boolean;
  allow_temperature: boolean;
  allow_sparkling_mixer: boolean;
  allow_order_type: boolean;
  allow_remarks: boolean;
  subcategory_id: number | null;
  subcategory_code: string | null;
  subcategory_name: string | null;
  product_kind_code: string;
  product_kind_name: string;
  token_prices: Record<string, number>;
  modifier_groups: Array<MenuModifierGroup>;
};

type MenuCategoryResponse = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  product_kind_code: string;
  product_kind_name: string;
  items: Array<MenuItemResponse>;
};

function resolveProductKind(productKindCode: string | null | undefined, categoryCode?: string): { code: string; name: string } {
  switch (String(productKindCode ?? '').trim().toLowerCase()) {
    case 'drink':
      return { code: 'drink', name: 'Drinks' };
    case 'food':
      return { code: 'food', name: 'Food' };
    case 'merchandise':
      return { code: 'merchandise', name: 'Merchandise' };
    case 'candle':
      return { code: 'candle', name: 'Candles' };
    case 'other':
      return { code: 'other', name: 'Other' };
    default:
      switch (String(categoryCode ?? '').trim().toLowerCase()) {
        case 'coffee':
        case 'non_coffee':
          return { code: 'drink', name: 'Drinks' };
        case 'food':
          return { code: 'food', name: 'Food' };
        case 'merchandise':
          return { code: 'merchandise', name: 'Merchandise' };
        case 'candles':
          return { code: 'candle', name: 'Candles' };
        default:
          return { code: 'other', name: 'Other' };
      }
  }
}

type HomeBannerRow = RowDataPacket & {
  code: string;
  title: string;
  subtitle: string;
  image_source: string;
  placement: 'home' | 'profile' | 'both';
  sort_order: number;
  is_active: number;
};

const defaultHomeBanners = [
  {
    code: 'operation_hours',
    title: 'Operation Hours',
    subtitle: 'Open daily with updated store hours and pickup coverage.',
    image_source: 'assets/images/operationhour.jpeg',
    placement: 'both' as const,
    sort_order: 10
  },
  {
    code: 'happy_hour',
    title: 'Happy Hour',
    subtitle: 'Limited-time rewards and extra reasons to stop by.',
    image_source: 'assets/images/happyhour.jpeg',
    placement: 'both' as const,
    sort_order: 20
  },
  {
    code: 'emergency_notice',
    title: 'Emergency Notice',
    subtitle: 'Important store advisories and service updates from the team.',
    image_source: 'assets/images/incaseofemergency.jpeg',
    placement: 'both' as const,
    sort_order: 30
  }
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
      home_banners: await listActiveHomeBanners()
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
          CASE
            WHEN LOWER(c.code) IN ('coffee', 'non_coffee') THEN 'drink'
            WHEN LOWER(c.code) = 'food' THEN 'food'
            WHEN LOWER(c.code) = 'merchandise' THEN 'merchandise'
            WHEN LOWER(c.code) = 'candles' THEN 'candle'
            ELSE 'other'
          END AS category_product_kind_code,
          c.sort_order AS category_sort_order,
          sc.id AS subcategory_id,
          sc.code AS subcategory_code,
          sc.name AS subcategory_name,
          i.id AS item_id,
          i.code AS item_code,
          i.name AS item_name,
          i.description AS item_description,
          CAST(i.base_price_rm AS CHAR) AS base_price_rm,
          i.base_price_token,
          i.image_url,
          COALESCE(a.is_available, 1) AS is_available,
          i.is_handcrafted_drink,
          i.is_qualifying_cup,
          i.allow_choice_of_beans,
          i.allow_espresso_shot,
          i.allow_choice_of_milk,
          i.allow_choice_of_sweetness,
          i.allow_ice_level,
          i.allow_temperature,
          i.allow_sparkling_mixer,
          i.allow_order_type,
          i.allow_remarks,
          tp.tier_code,
          tp.token_price,
          img.id AS modifier_group_id,
          img.code AS modifier_group_code,
          img.name AS modifier_group_name,
          img.selection_type AS modifier_selection_type,
          img.min_select AS modifier_min_select,
          img.max_select AS modifier_max_select,
          img.is_required AS modifier_is_required,
          img.sort_order AS modifier_group_sort_order,
          imo.id AS modifier_option_id,
          imo.code AS modifier_option_code,
          imo.name AS modifier_option_name,
          CAST(imo.price_delta_rm AS CHAR) AS modifier_option_price_delta_rm,
          imo.token_price_delta AS modifier_option_token_price_delta,
          imo.sort_order AS modifier_option_sort_order
        FROM menu_categories c
        JOIN menu_items i
          ON i.category_id = c.id
         AND i.is_active = 1
        LEFT JOIN menu_subcategories sc
          ON sc.id = i.subcategory_id
        LEFT JOIN menu_item_store_availability a
          ON a.store_id = :storeId
         AND a.menu_item_id = i.id
        LEFT JOIN menu_item_token_prices tp
          ON tp.menu_item_id = i.id
         AND tp.is_enabled = 1
         AND tp.effective_from <= UTC_TIMESTAMP()
         AND (tp.effective_to IS NULL OR tp.effective_to > UTC_TIMESTAMP())
        LEFT JOIN item_modifier_groups img
          ON img.menu_item_id = i.id
        LEFT JOIN item_modifier_options imo
          ON imo.modifier_group_id = img.id
         AND imo.is_active = 1
        WHERE c.is_active = 1
        ORDER BY
          c.sort_order,
          c.id,
          i.sort_order,
          i.id,
          tp.tier_code,
          img.sort_order,
          img.id,
          imo.sort_order,
          imo.id
      `,
      { storeId }
    );

    const categories = new Map<number, MenuCategoryResponse>();

    const itemsByCategory = new Map<string, number>();

    for (const row of rows) {
      const category =
        categories.get(row.category_id) ??
        (() => {
          const productKind = resolveProductKind(row.category_product_kind_code, row.category_code);
          return {
            id: row.category_id,
            code: row.category_code,
            name: row.category_name,
            sort_order: row.category_sort_order,
            product_kind_code: productKind.code,
            product_kind_name: productKind.name,
            items: [],
          } satisfies MenuCategoryResponse;
        })();

      if (!categories.has(row.category_id)) {
        categories.set(row.category_id, category);
      }

      const itemKey = `${row.category_id}:${row.item_id}`;
      let itemIndex = itemsByCategory.get(itemKey);
      if (itemIndex === undefined) {
        const productKind = resolveProductKind(row.category_product_kind_code, row.category_code);
        category.items.push({
          id: row.item_id,
          code: row.item_code,
          name: row.item_name,
          description: row.item_description,
          base_price_rm: row.base_price_rm,
          base_price_token: row.base_price_token,
          image_url: _resolveImageUrl(row.image_url),
          is_available: row.is_available === 1,
          is_handcrafted_drink: row.is_handcrafted_drink === 1,
          is_qualifying_cup: row.is_qualifying_cup === 1,
          allow_choice_of_beans: row.allow_choice_of_beans === 1,
          allow_espresso_shot: row.allow_espresso_shot === 1,
          allow_choice_of_milk: row.allow_choice_of_milk === 1,
          allow_choice_of_sweetness: row.allow_choice_of_sweetness === 1,
          allow_ice_level: row.allow_ice_level === 1,
          allow_temperature: row.allow_temperature === 1,
          allow_sparkling_mixer: row.allow_sparkling_mixer === 1,
          allow_order_type: row.allow_order_type === 1,
          allow_remarks: row.allow_remarks === 1,
          subcategory_id: row.subcategory_id,
          subcategory_code: row.subcategory_code,
          subcategory_name: row.subcategory_name,
          product_kind_code: productKind.code,
          product_kind_name: productKind.name,
          token_prices: {},
          modifier_groups: []
        });
        itemIndex = category.items.length - 1;
        itemsByCategory.set(itemKey, itemIndex);
      }

      const item = category.items[itemIndex];

      if (row.tier_code && row.token_price !== null) {
        item.token_prices[row.tier_code] = row.token_price;
      }

      if (row.modifier_group_id !== null) {
        let modifierGroup = item.modifier_groups.find(
          (group) => group.id === row.modifier_group_id,
        );

        if (!modifierGroup) {
          modifierGroup = {
            id: row.modifier_group_id,
            code: row.modifier_group_code ?? '',
            name: row.modifier_group_name ?? '',
            selection_type: row.modifier_selection_type ?? 'single',
            min_select: row.modifier_min_select ?? 0,
            max_select: row.modifier_max_select ?? 1,
            is_required: row.modifier_is_required === 1,
            options: [],
          };
          item.modifier_groups.push(modifierGroup);
        }

        if (row.modifier_option_id !== null) {
          const alreadyExists = modifierGroup.options.some(
            (option) => option.id === row.modifier_option_id,
          );
          if (!alreadyExists) {
            modifierGroup.options.push({
              id: row.modifier_option_id,
              code: row.modifier_option_code ?? '',
              name: row.modifier_option_name ?? '',
              price_delta_rm: row.modifier_option_price_delta_rm ?? '0.00',
              token_price_delta: row.modifier_option_token_price_delta ?? 0,
            });
          }
        }
      }
    }

    return {
      store_id: storeId,
      categories: [...categories.values()]
    };
  });
}

function _resolveImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  const baseOrigin = env.PUBLIC_API_BASE_URL.replace(/\/v1\/?$/, '');
  if (imageUrl.startsWith('/')) {
    return `${baseOrigin}${imageUrl}`;
  }

  return `${baseOrigin}/${imageUrl}`;
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

async function listActiveHomeBanners(): Promise<
  Array<{
    code: string;
    title: string;
    subtitle: string;
    image_source: string;
    placement: 'home' | 'profile' | 'both';
    sort_order: number;
  }>
> {
  try {
    const [rows] = await mysqlPool.query<Array<HomeBannerRow>>(
      `
        SELECT
          code,
          title,
          subtitle,
          image_source,
          placement,
          sort_order,
          is_active
        FROM home_banners
        WHERE is_active = 1
        ORDER BY sort_order ASC, id ASC
      `
    );

    return rows
      .filter((row) => row.is_active === 1)
      .map((row) => ({
        code: row.code,
        title: row.title,
        subtitle: row.subtitle,
        image_source: row.image_source,
        placement: row.placement,
        sort_order: row.sort_order
      }));
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'ER_NO_SUCH_TABLE'
    ) {
      return defaultHomeBanners;
    }

    throw error;
  }
}
