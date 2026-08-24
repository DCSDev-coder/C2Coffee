import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { authenticateAdminRequest } from '../../admin/guard.js';

const tierCodes = ['kawan', 'dilamun', 'ketagih', 'legend'] as const;

const modifierSelectionTypes = ['single', 'multi'] as const;

const tokenPricesSchema = z.object({
  kawan: z.coerce.number().int().min(0).optional(),
  dilamun: z.coerce.number().int().min(0).optional(),
  ketagih: z.coerce.number().int().min(0).optional(),
  legend: z.coerce.number().int().min(0).optional()
});

const adminMenuModifierOptionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  price_delta_rm: z.coerce.number().optional().default(0),
  token_price_delta: z.coerce.number().int().min(0).optional().default(0),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
  is_active: z.coerce.boolean().optional().default(true)
});

const adminMenuModifierGroupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  selection_type: z.enum(modifierSelectionTypes).optional().default('single'),
  min_select: z.coerce.number().int().min(0).optional().default(0),
  max_select: z.coerce.number().int().min(1).optional().default(1),
  is_required: z.coerce.boolean().optional().default(false),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
  options: z.array(adminMenuModifierOptionSchema).optional().default([])
});

const adminMenuUpsertSchema = z.object({
  category_code: z.string().trim().min(1).max(50),
  subcategory_code: z.string().trim().min(1).max(50).optional().or(z.literal('')),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional().or(z.literal('')),
  base_price_rm: z.coerce.number().positive(),
  base_price_token: z.coerce.number().int().min(0),
  image_url: z.string().trim().max(512).optional().or(z.literal('')),
  is_active: z.coerce.boolean().optional(),
  is_handcrafted_drink: z.coerce.boolean().optional(),
  is_qualifying_cup: z.coerce.boolean().optional(),
  allow_choice_of_beans: z.coerce.boolean().optional(),
  allow_espresso_shot: z.coerce.boolean().optional(),
  allow_choice_of_milk: z.coerce.boolean().optional(),
  allow_choice_of_sweetness: z.coerce.boolean().optional(),
  allow_ice_level: z.coerce.boolean().optional(),
  allow_temperature: z.coerce.boolean().optional(),
  allow_sparkling_mixer: z.coerce.boolean().optional(),
  allow_order_type: z.coerce.boolean().optional(),
  allow_remarks: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
  token_prices: tokenPricesSchema.partial().optional(),
  modifier_groups: z.array(adminMenuModifierGroupSchema).optional()
});

const adminMenuPatchSchema = adminMenuUpsertSchema.partial().extend({
  category_code: z.string().trim().min(1).max(50).optional()
});

const adminMenuSubcategoryUpsertSchema = z.object({
  category_code: z.string().trim().min(1).max(50),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
  is_active: z.coerce.boolean().optional().default(true)
});

const adminMenuCategoryUpsertSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  product_kind_code: z.enum(['drink', 'food', 'merchandise', 'candle', 'other']).optional().default('drink'),
  sort_order: z.coerce.number().int().min(0).optional().default(0),
  is_active: z.coerce.boolean().optional().default(true)
});

const adminMenuImageUploadSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  data_url: z.string().trim().min(1)
});

let menuCategoryColumnsPromise: Promise<Set<string>> | null = null;

async function getMenuCategoryColumns(): Promise<Set<string>> {
  if (!menuCategoryColumnsPromise) {
    menuCategoryColumnsPromise = mysqlPool
      .query<Array<RowDataPacket>>('SHOW COLUMNS FROM menu_categories')
      .then(([rows]) => new Set(rows.map((row) => String((row as { Field?: string }).Field ?? '').trim()).filter(Boolean)));
  }

  return menuCategoryColumnsPromise;
}

function normalizeMenuCode(value: string): string {
  const code = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return code || 'item';
}

async function resolveUniqueMenuCode(
  tableName: 'menu_categories' | 'menu_subcategories',
  preferredCode: string
): Promise<string> {
  const baseCode = normalizeMenuCode(preferredCode);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? baseCode : `${baseCode}_${attempt + 1}`;
    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT 1 FROM ${tableName} WHERE code = :code LIMIT 1`,
      { code: candidate }
    );

    if (rows.length === 0) {
      return candidate;
    }
  }

  return `${baseCode}_${Date.now()}`;
}

type AdminMenuRow = RowDataPacket & {
  category_id: number;
  category_code: string;
  category_name: string;
  category_product_kind_code: string;
  category_sort_order: number;
  category_is_active: number;
  subcategory_id: number | null;
  subcategory_code: string | null;
  subcategory_name: string | null;
  subcategory_sort_order: number | null;
  subcategory_is_active: number | null;
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
  item_sort_order: number;
  item_created_at: Date;
  item_updated_at: Date;
  tier_code: string | null;
  token_price: number | null;
  total_units_sold: number | null;
  total_revenue_rm: string | null;
  last_ordered_at: Date | null;
  modifier_group_id: number | null;
  modifier_group_code: string | null;
  modifier_group_name: string | null;
  modifier_group_selection_type: string | null;
  modifier_group_min_select: number | null;
  modifier_group_max_select: number | null;
  modifier_group_is_required: number | null;
  modifier_group_sort_order: number | null;
  modifier_option_id: number | null;
  modifier_option_code: string | null;
  modifier_option_name: string | null;
  modifier_option_price_delta_rm: string | null;
  modifier_option_token_price_delta: number | null;
  modifier_option_sort_order: number | null;
  modifier_option_is_active: number | null;
};

type AdminMenuModifierOption = {
  id: number;
  code: string;
  name: string;
  price_delta_rm: string;
  token_price_delta: number;
  sort_order: number;
  is_active: boolean;
};

type AdminMenuModifierGroup = {
  id: number;
  code: string;
  name: string;
  selection_type: string;
  min_select: number;
  max_select: number;
  is_required: boolean;
  sort_order: number;
  options: Array<AdminMenuModifierOption>;
};

type AdminMenuItem = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  base_price_rm: string;
  base_price_token: number;
  image_url: string | null;
  is_available: boolean;
  is_active: boolean;
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
  sort_order: number;
  created_at: string;
  updated_at: string;
  sales_count: number;
  total_revenue_rm: string;
  last_ordered_at: string | null;
  token_prices: Record<string, number>;
  modifier_groups: Array<AdminMenuModifierGroup>;
  subcategory_id: number | null;
  subcategory_code: string | null;
  subcategory_name: string | null;
  product_kind_code: string;
  product_kind_name: string;
};

type AdminMenuSubcategory = {
  id: number;
  code: string;
  name: string;
  category_id: number;
  category_code: string;
  category_name: string;
  sort_order: number;
  is_active: boolean;
  product_kind_code: string;
  product_kind_name: string;
};

type AdminMenuCategory = {
  id: number;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  product_kind_code: string;
  product_kind_name: string;
  subcategories: Array<AdminMenuSubcategory>;
  items: Array<AdminMenuItem>;
};

type AdminMenuResponse = {
  categories: Array<AdminMenuCategory>;
  subcategories: Array<AdminMenuSubcategory>;
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

export async function registerAdminMenuRoutes(app: FastifyInstance): Promise<void> {
  const routeDir = path.dirname(fileURLToPath(import.meta.url));
  const publicRoot = path.resolve(routeDir, '../../public');
  const menuRoot = path.join(publicRoot, 'menu');
  const uploadRoot = path.join(menuRoot, 'uploads');

  await mkdir(uploadRoot, { recursive: true });

  app.get('/v1/admin/menu', { preHandler: authenticateAdminRequest }, async () => {
    const [rows] = await mysqlPool.query<Array<AdminMenuRow>>(
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
          c.is_active AS category_is_active,
          sc.id AS subcategory_id,
          sc.code AS subcategory_code,
          sc.name AS subcategory_name,
          sc.sort_order AS subcategory_sort_order,
          sc.is_active AS subcategory_is_active,
          i.id AS item_id,
          i.code AS item_code,
          i.name AS item_name,
          i.description AS item_description,
          CAST(i.base_price_rm AS CHAR) AS base_price_rm,
          i.base_price_token,
          i.image_url,
          i.is_active AS is_available,
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
          i.sort_order AS item_sort_order,
          i.created_at AS item_created_at,
          i.updated_at AS item_updated_at,
          tp.tier_code,
          tp.token_price,
          sales.total_units_sold,
          sales.total_revenue_rm,
          sales.last_ordered_at,
          img.id AS modifier_group_id,
          img.code AS modifier_group_code,
          img.name AS modifier_group_name,
          img.selection_type AS modifier_group_selection_type,
          img.min_select AS modifier_group_min_select,
          img.max_select AS modifier_group_max_select,
          img.is_required AS modifier_group_is_required,
          img.sort_order AS modifier_group_sort_order,
          imo.id AS modifier_option_id,
          imo.code AS modifier_option_code,
          imo.name AS modifier_option_name,
          CAST(imo.price_delta_rm AS CHAR) AS modifier_option_price_delta_rm,
          imo.token_price_delta AS modifier_option_token_price_delta,
          imo.sort_order AS modifier_option_sort_order,
          imo.is_active AS modifier_option_is_active
        FROM menu_categories c
        JOIN menu_items i
          ON i.category_id = c.id
        LEFT JOIN menu_subcategories sc
          ON sc.id = i.subcategory_id
        LEFT JOIN (
          SELECT
            oi.menu_item_id,
            SUM(oi.quantity) AS total_units_sold,
            CAST(SUM(oi.line_subtotal_rm) AS CHAR) AS total_revenue_rm,
            MAX(o.created_at) AS last_ordered_at
          FROM order_items oi
          JOIN orders o ON o.id = oi.order_id
          WHERE o.status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected')
          GROUP BY oi.menu_item_id
        ) sales
          ON sales.menu_item_id = i.id
        LEFT JOIN menu_item_token_prices tp
          ON tp.menu_item_id = i.id
         AND tp.is_enabled = 1
         AND tp.effective_from <= UTC_TIMESTAMP()
         AND (tp.effective_to IS NULL OR tp.effective_to > UTC_TIMESTAMP())
        LEFT JOIN item_modifier_groups img
          ON img.menu_item_id = i.id
        LEFT JOIN item_modifier_options imo
          ON imo.modifier_group_id = img.id
        ORDER BY c.sort_order ASC, c.id ASC, i.sort_order ASC, i.id ASC, tp.tier_code ASC
      `
    );

    return buildMenuResponse(rows);
  });

  app.post('/v1/admin/menu/items', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = adminMenuUpsertSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    await connection.query("SET time_zone = '+00:00'");

    try {
      await connection.beginTransaction();

      const categoryId = await resolveCategoryId(connection, payload.category_code);
      const subcategoryId = await resolveSubcategoryId(connection, payload.category_code, payload.subcategory_code);
      const itemCode = generateMenuCode(payload.name);
      const itemResult = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO menu_items (
            category_id,
            subcategory_id,
            code,
            name,
            description,
            base_price_rm,
            base_price_token,
            is_handcrafted_drink,
            is_qualifying_cup,
            is_active,
            image_url,
            sort_order,
            allow_choice_of_beans,
            allow_espresso_shot,
            allow_choice_of_milk,
            allow_choice_of_sweetness,
            allow_ice_level,
            allow_temperature,
            allow_sparkling_mixer,
            allow_order_type,
            allow_remarks,
            created_at,
            updated_at
          )
          VALUES (
            :categoryId,
            :subcategoryId,
            :code,
            :name,
            :description,
            :basePriceRm,
            :basePriceToken,
            :isHandcraftedDrink,
            :isQualifyingCup,
            :isActive,
            :imageUrl,
            :sortOrder,
            :allowChoiceOfBeans,
            :allowEspressoShot,
            :allowChoiceOfMilk,
            :allowChoiceOfSweetness,
            :allowIceLevel,
            :allowTemperature,
            :allowSparklingMixer,
            :allowOrderType,
            :allowRemarks,
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
        `,
        {
          categoryId,
          subcategoryId,
          code: itemCode,
          name: payload.name,
          description: nullableString(payload.description),
          basePriceRm: payload.base_price_rm.toFixed(2),
          basePriceToken: payload.base_price_token,
          isHandcraftedDrink: payload.is_handcrafted_drink ?? 0,
          isQualifyingCup: payload.is_qualifying_cup ?? 0,
          isActive: payload.is_active ?? true,
          imageUrl: nullableString(payload.image_url),
          sortOrder: payload.sort_order ?? 0,
          allowChoiceOfBeans: payload.allow_choice_of_beans ?? payload.is_handcrafted_drink ?? 0,
          allowEspressoShot: payload.allow_espresso_shot ?? payload.is_handcrafted_drink ?? 0,
          allowChoiceOfMilk: payload.allow_choice_of_milk ?? payload.is_handcrafted_drink ?? 0,
          allowChoiceOfSweetness: payload.allow_choice_of_sweetness ?? payload.is_handcrafted_drink ?? 0,
          allowIceLevel: payload.allow_ice_level ?? payload.is_handcrafted_drink ?? 0,
          allowTemperature: payload.allow_temperature ?? payload.is_handcrafted_drink ?? 0,
          allowSparklingMixer: payload.allow_sparkling_mixer ?? payload.is_handcrafted_drink ?? 0,
          allowOrderType: payload.allow_order_type ?? payload.is_handcrafted_drink ?? 0,
          allowRemarks: payload.allow_remarks ?? payload.is_handcrafted_drink ?? 0
        }
      );

      const menuItemId = itemResult[0].insertId;
      await upsertMenuTokenPrices(connection, menuItemId, payload.token_prices);
      await replaceMenuModifiers(connection, menuItemId, payload.modifier_groups);

      await connection.commit();

      return {
        item: await loadMenuItemById(menuItemId)
      };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'menu_item_conflict', 'Menu item code already exists.');
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post(
    '/v1/admin/menu/uploads',
    {
      preHandler: authenticateAdminRequest,
      bodyLimit: 10 * 1024 * 1024
    },
    async (request) => {
      const payload = adminMenuImageUploadSchema.parse(request.body);
      const fileExtension = extensionForMimeType(payload.mime_type);
      const uploadName = `${Date.now()}-${randomUUID()}-${slugifyFileName(payload.file_name)}${fileExtension}`;
      const targetPath = path.join(uploadRoot, uploadName);
      const base64Payload = payload.data_url.includes('base64,')
        ? payload.data_url.split('base64,').pop() || ''
        : payload.data_url;

      const fileBuffer = Buffer.from(base64Payload, 'base64');
      if (fileBuffer.length === 0) {
        throw new ApiError(400, 'invalid_upload', 'Uploaded image data was empty.');
      }

      await writeFile(targetPath, fileBuffer);

      return {
        image_url: `/assets/menu/uploads/${uploadName}`
      };
    }
  );

  app.patch('/v1/admin/menu/items/:menuItemId', { preHandler: authenticateAdminRequest }, async (request) => {
    const menuItemId = z.coerce.number().int().positive().parse((request.params as { menuItemId: string }).menuItemId);
    const payload = adminMenuPatchSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();
    await connection.query("SET time_zone = '+00:00'");

    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.query<Array<RowDataPacket & { id: number; name: string; category_code: string }>>(
        `
          SELECT
            i.id,
            i.name,
            c.code AS category_code
          FROM menu_items i
          JOIN menu_categories c ON c.id = i.category_id
          WHERE i.id = :menuItemId
          LIMIT 1
        `,
        { menuItemId }
      );

      if (!existingRows[0]) {
        throw new ApiError(404, 'menu_item_not_found', 'Menu item was not found.');
      }

      const updateFields: string[] = [];
      const updateParams: Record<string, unknown> = {
        menuItemId
      };

      if (payload.category_code) {
        updateFields.push('category_id = :categoryId');
        updateParams.categoryId = await resolveCategoryId(connection, payload.category_code);
      }
      if (payload.subcategory_code !== undefined) {
        const categoryCodeForSubcategory = payload.category_code || existingRows[0].category_code;
        updateFields.push('subcategory_id = :subcategoryId');
        updateParams.subcategoryId = await resolveSubcategoryId(
          connection,
          categoryCodeForSubcategory,
          payload.subcategory_code
        );
      }
      if (payload.name !== undefined) {
        updateFields.push('name = :name');
        updateParams.name = payload.name;
      }
      if (payload.description !== undefined) {
        updateFields.push('description = :description');
        updateParams.description = nullableString(payload.description);
      }
      if (payload.base_price_rm !== undefined) {
        updateFields.push('base_price_rm = :basePriceRm');
        updateParams.basePriceRm = payload.base_price_rm.toFixed(2);
      }
      if (payload.base_price_token !== undefined) {
        updateFields.push('base_price_token = :basePriceToken');
        updateParams.basePriceToken = payload.base_price_token;
      }
      if (payload.image_url !== undefined) {
        updateFields.push('image_url = :imageUrl');
        updateParams.imageUrl = nullableString(payload.image_url);
      }
      if (payload.is_active !== undefined) {
        updateFields.push('is_active = :isActive');
        updateParams.isActive = payload.is_active ? 1 : 0;
      }
      if (payload.is_handcrafted_drink !== undefined) {
        updateFields.push('is_handcrafted_drink = :isHandcraftedDrink');
        updateParams.isHandcraftedDrink = payload.is_handcrafted_drink ? 1 : 0;
      }
      if (payload.is_qualifying_cup !== undefined) {
        updateFields.push('is_qualifying_cup = :isQualifyingCup');
        updateParams.isQualifyingCup = payload.is_qualifying_cup ? 1 : 0;
      }
      if (payload.allow_choice_of_beans !== undefined) {
        updateFields.push('allow_choice_of_beans = :allowChoiceOfBeans');
        updateParams.allowChoiceOfBeans = payload.allow_choice_of_beans ? 1 : 0;
      }
      if (payload.allow_espresso_shot !== undefined) {
        updateFields.push('allow_espresso_shot = :allowEspressoShot');
        updateParams.allowEspressoShot = payload.allow_espresso_shot ? 1 : 0;
      }
      if (payload.allow_choice_of_milk !== undefined) {
        updateFields.push('allow_choice_of_milk = :allowChoiceOfMilk');
        updateParams.allowChoiceOfMilk = payload.allow_choice_of_milk ? 1 : 0;
      }
      if (payload.allow_choice_of_sweetness !== undefined) {
        updateFields.push('allow_choice_of_sweetness = :allowChoiceOfSweetness');
        updateParams.allowChoiceOfSweetness = payload.allow_choice_of_sweetness ? 1 : 0;
      }
      if (payload.allow_ice_level !== undefined) {
        updateFields.push('allow_ice_level = :allowIceLevel');
        updateParams.allowIceLevel = payload.allow_ice_level ? 1 : 0;
      }
      if (payload.allow_temperature !== undefined) {
        updateFields.push('allow_temperature = :allowTemperature');
        updateParams.allowTemperature = payload.allow_temperature ? 1 : 0;
      }
      if (payload.allow_sparkling_mixer !== undefined) {
        updateFields.push('allow_sparkling_mixer = :allowSparklingMixer');
        updateParams.allowSparklingMixer = payload.allow_sparkling_mixer ? 1 : 0;
      }
      if (payload.allow_order_type !== undefined) {
        updateFields.push('allow_order_type = :allowOrderType');
        updateParams.allowOrderType = payload.allow_order_type ? 1 : 0;
      }
      if (payload.allow_remarks !== undefined) {
        updateFields.push('allow_remarks = :allowRemarks');
        updateParams.allowRemarks = payload.allow_remarks ? 1 : 0;
      }
      if (payload.sort_order !== undefined) {
        updateFields.push('sort_order = :sortOrder');
        updateParams.sortOrder = payload.sort_order;
      }

      if (updateFields.length > 0) {
        updateFields.push('updated_at = UTC_TIMESTAMP()');
        const updateValues = updateFields
          .filter((field) => field !== 'updated_at = UTC_TIMESTAMP()')
          .map((field) => {
            const paramName = field.split(' = ')[1].replace(/^:/, '');
            return updateParams[paramName as keyof typeof updateParams];
          });
        await connection.execute(
          `
            UPDATE menu_items
            SET ${updateFields
              .filter((field) => field !== 'updated_at = UTC_TIMESTAMP()')
              .map((field) => field.replace(/:([A-Za-z0-9_]+)/g, '?'))
              .concat('updated_at = UTC_TIMESTAMP()')
              .join(', ')}
            WHERE id = ?
          `,
          [...updateValues, menuItemId] as any
        );
      }

      await upsertMenuTokenPrices(connection, menuItemId, payload.token_prices);
      await replaceMenuModifiers(connection, menuItemId, payload.modifier_groups);

      await connection.commit();

      return {
        item: await loadMenuItemById(menuItemId)
      };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'menu_item_conflict', 'Menu item code already exists.');
      }
      throw error;
    } finally {
      connection.release();
    }
  });

  app.delete('/v1/admin/menu/items/:menuItemId', { preHandler: authenticateAdminRequest }, async (request) => {
    const menuItemId = z.coerce.number().int().positive().parse((request.params as { menuItemId: string }).menuItemId);

    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `
        UPDATE menu_items
        SET is_active = 0,
            updated_at = UTC_TIMESTAMP()
        WHERE id = :menuItemId
      `,
      { menuItemId }
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'menu_item_not_found', 'Menu item was not found.');
    }

    return { ok: true };
  });

  app.post('/v1/admin/menu/subcategories', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = adminMenuSubcategoryUpsertSchema.parse(request.body);
    const categoryId = await resolveCategoryId(mysqlPool, payload.category_code);
    const code = await resolveUniqueMenuCode('menu_subcategories', payload.code);

    try {
      const [result] = await mysqlPool.execute<ResultSetHeader>(
        `
          INSERT INTO menu_subcategories (
            category_id,
            code,
            name,
            sort_order,
            is_active,
            created_at,
            updated_at
          )
          VALUES (
            :categoryId,
            :code,
            :name,
            :sortOrder,
            :isActive,
            UTC_TIMESTAMP(),
            UTC_TIMESTAMP()
          )
        `,
        {
          categoryId,
          code,
          name: payload.name,
          sortOrder: payload.sort_order,
          isActive: payload.is_active ? 1 : 0
        }
      );

      return { subcategory: await loadMenuSubcategoryById(result.insertId) };
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'menu_subcategory_conflict', 'Menu subcategory code already exists.');
      }
      throw error;
    }
  });

  app.post('/v1/admin/menu/categories', { preHandler: authenticateAdminRequest }, async (request) => {
    const payload = adminMenuCategoryUpsertSchema.parse(request.body);
    const code = await resolveUniqueMenuCode('menu_categories', payload.code);

    const categoryColumns = await getMenuCategoryColumns();
    const hasProductKindColumn = categoryColumns.has('product_kind_code');
    const insertColumns = ['code', 'name', ...(hasProductKindColumn ? ['product_kind_code'] : []), 'sort_order', 'is_active'];
    const insertPlaceholders = [':code', ':name', ...(hasProductKindColumn ? [':productKindCode'] : []), ':sortOrder', ':isActive'];

    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `
        INSERT INTO menu_categories (
          ${insertColumns.join(', ')}
        )
        VALUES (
          ${insertPlaceholders.join(', ')}
        )
      `,
      {
        code,
        name: payload.name,
        productKindCode: payload.product_kind_code,
        sortOrder: payload.sort_order,
        isActive: payload.is_active ? 1 : 0
      }
    );

    return { category: await loadMenuCategoryById(result.insertId) };
  });

  app.patch('/v1/admin/menu/categories/:categoryId', { preHandler: authenticateAdminRequest }, async (request) => {
    const categoryId = z.coerce.number().int().positive().parse((request.params as { categoryId: string }).categoryId);
    const payload = adminMenuCategoryUpsertSchema.partial().parse(request.body);
    const updates: string[] = [];
    const params: Record<string, unknown> = { categoryId };

    if (payload.code !== undefined) {
      updates.push('code = :code');
      params.code = payload.code;
    }
    if (payload.name !== undefined) {
      updates.push('name = :name');
      params.name = payload.name;
    }
    if (payload.product_kind_code !== undefined) {
      updates.push('product_kind_code = :productKindCode');
      params.productKindCode = payload.product_kind_code;
    }
    if (payload.sort_order !== undefined) {
      updates.push('sort_order = :sortOrder');
      params.sortOrder = payload.sort_order;
    }
    if (payload.is_active !== undefined) {
      updates.push('is_active = :isActive');
      params.isActive = payload.is_active ? 1 : 0;
    }

    if (updates.length === 0) {
      return { category: await loadMenuCategoryById(categoryId) };
    }

    const categoryColumns = await getMenuCategoryColumns();
    if (!categoryColumns.has('product_kind_code')) {
      const filteredUpdates = updates.filter((update) => update !== 'product_kind_code = :productKindCode');
      if (filteredUpdates.length !== updates.length) {
        delete params.productKindCode;
      }
      updates.length = 0;
      updates.push(...filteredUpdates);
    }

    try {
      await mysqlPool.query(
        `
          UPDATE menu_categories
          SET ${updates.join(', ')}
          WHERE id = :categoryId
        `,
        params as never
      );

      return { category: await loadMenuCategoryById(categoryId) };
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'menu_category_conflict', 'Menu category code already exists.');
      }
      throw error;
    }
  });

  app.delete('/v1/admin/menu/categories/:categoryId', { preHandler: authenticateAdminRequest }, async (request) => {
    const categoryId = z.coerce.number().int().positive().parse((request.params as { categoryId: string }).categoryId);

    const [rows] = await mysqlPool.query<Array<RowDataPacket & {
      item_count: number;
      subcategory_count: number;
    }>>(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM menu_items
            WHERE category_id = :categoryId
          ) AS item_count,
          (
            SELECT COUNT(*)
            FROM menu_subcategories
            WHERE category_id = :categoryId
          ) AS subcategory_count
      `,
      { categoryId }
    );

    const counts = rows[0];
    if (!counts) {
      throw new ApiError(404, 'menu_category_not_found', 'Menu category was not found.');
    }

    const canHardDelete = Number(counts.item_count) === 0 && Number(counts.subcategory_count) === 0;

    if (canHardDelete) {
      await mysqlPool.query(
        `
          DELETE FROM menu_categories
          WHERE id = :categoryId
        `,
        { categoryId }
      );

      return { ok: true, mode: 'deleted' };
    }

    await mysqlPool.query(
      `
        UPDATE menu_categories
        SET is_active = 0,
            updated_at = UTC_TIMESTAMP()
        WHERE id = :categoryId
      `,
      { categoryId }
    );

    return { ok: true, mode: 'archived' };
  });

  app.patch('/v1/admin/menu/subcategories/:subcategoryId', { preHandler: authenticateAdminRequest }, async (request) => {
    const subcategoryId = z.coerce.number().int().positive().parse((request.params as { subcategoryId: string }).subcategoryId);
    const payload = adminMenuSubcategoryUpsertSchema.partial().parse(request.body);
    const updates: string[] = [];
    const params: Record<string, unknown> = { subcategoryId };

    if (payload.category_code) {
      updates.push('category_id = :categoryId');
      params.categoryId = await resolveCategoryId(mysqlPool, payload.category_code);
    }
    if (payload.code !== undefined) {
      updates.push('code = :code');
      params.code = payload.code;
    }
    if (payload.name !== undefined) {
      updates.push('name = :name');
      params.name = payload.name;
    }
    if (payload.sort_order !== undefined) {
      updates.push('sort_order = :sortOrder');
      params.sortOrder = payload.sort_order;
    }
    if (payload.is_active !== undefined) {
      updates.push('is_active = :isActive');
      params.isActive = payload.is_active ? 1 : 0;
    }

    if (updates.length === 0) {
      return { subcategory: await loadMenuSubcategoryById(subcategoryId) };
    }

    try {
      await mysqlPool.query(
        `
          UPDATE menu_subcategories
          SET ${updates.join(', ')},
              updated_at = UTC_TIMESTAMP()
          WHERE id = :subcategoryId
        `,
        params as never
      );

      return { subcategory: await loadMenuSubcategoryById(subcategoryId) };
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ApiError(409, 'menu_subcategory_conflict', 'Menu subcategory code already exists.');
      }
      throw error;
    }
  });

  app.delete('/v1/admin/menu/subcategories/:subcategoryId', { preHandler: authenticateAdminRequest }, async (request) => {
    const subcategoryId = z.coerce.number().int().positive().parse((request.params as { subcategoryId: string }).subcategoryId);

    const [rows] = await mysqlPool.query<Array<RowDataPacket & { item_count: number }>>(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM menu_items
            WHERE subcategory_id = :subcategoryId
          ) AS item_count
      `,
      { subcategoryId }
    );

    const counts = rows[0];
    if (!counts) {
      throw new ApiError(404, 'menu_subcategory_not_found', 'Menu subcategory was not found.');
    }

    if (Number(counts.item_count) === 0) {
      await mysqlPool.query(
        `
          DELETE FROM menu_subcategories
          WHERE id = :subcategoryId
        `,
        { subcategoryId }
      );

      return { ok: true, mode: 'deleted' };
    }

    await mysqlPool.query(
      `
        UPDATE menu_subcategories
        SET is_active = 0,
            updated_at = UTC_TIMESTAMP()
        WHERE id = :subcategoryId
      `,
      { subcategoryId }
    );

    return { ok: true, mode: 'archived' };
  });
}

function buildMenuResponse(rows: Array<AdminMenuRow>): AdminMenuResponse {
  const categories = new Map<number, AdminMenuCategory>();
  const subcategories = new Map<number, AdminMenuSubcategory>();

  for (const row of rows) {
    let category = categories.get(row.category_id);
    if (!category) {
      const productKind = resolveProductKind(row.category_product_kind_code, row.category_code);
      category = {
        id: row.category_id,
        code: row.category_code,
        name: row.category_name,
        sort_order: row.category_sort_order,
        is_active: row.category_is_active === 1,
        product_kind_code: productKind.code,
        product_kind_name: productKind.name,
        subcategories: [],
        items: []
      };
      categories.set(row.category_id, category);
    }

    if (row.subcategory_id !== null && !subcategories.has(row.subcategory_id)) {
      const subcategory = {
        id: row.subcategory_id,
        code: row.subcategory_code ?? '',
        name: row.subcategory_name ?? '',
        category_id: row.category_id,
        category_code: row.category_code,
        category_name: row.category_name,
        sort_order: row.subcategory_sort_order ?? 0,
        is_active: row.subcategory_is_active === 1,
        product_kind_code: category.product_kind_code,
        product_kind_name: category.product_kind_name
      };
      subcategories.set(row.subcategory_id, subcategory);
      category.subcategories.push(subcategory);
    }

    let item = category.items.find((candidate) => candidate.id === row.item_id);
      if (!item) {
      const productKind = resolveProductKind(row.category_product_kind_code, row.category_code);
      item = {
        id: row.item_id,
        code: row.item_code,
        name: row.item_name,
        description: row.item_description,
        base_price_rm: row.base_price_rm,
        base_price_token: row.base_price_token,
        image_url: row.image_url,
        is_available: row.is_available === 1,
        is_active: row.is_available === 1,
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
        sort_order: row.item_sort_order,
        created_at: row.item_created_at instanceof Date ? row.item_created_at.toISOString() : new Date(row.item_created_at).toISOString(),
        updated_at: row.item_updated_at instanceof Date ? row.item_updated_at.toISOString() : new Date(row.item_updated_at).toISOString(),
        sales_count: row.total_units_sold ?? 0,
        total_revenue_rm: row.total_revenue_rm ?? '0.00',
        last_ordered_at: row.last_ordered_at ? new Date(row.last_ordered_at).toISOString() : null,
        token_prices: {},
        modifier_groups: [],
        subcategory_id: row.subcategory_id,
        subcategory_code: row.subcategory_code,
        subcategory_name: row.subcategory_name,
        product_kind_code: productKind.code,
        product_kind_name: productKind.name
      };
      category.items.push(item);
    }

    if (row.tier_code && row.token_price !== null) {
      item.token_prices[row.tier_code] = row.token_price;
    }

    if (row.modifier_group_id !== null) {
      let modifierGroup = item.modifier_groups.find(
        (candidate) => candidate.id === row.modifier_group_id
      );

      if (!modifierGroup) {
        modifierGroup = {
          id: row.modifier_group_id,
          code: row.modifier_group_code ?? '',
          name: row.modifier_group_name ?? '',
          selection_type: row.modifier_group_selection_type ?? 'single',
          min_select: row.modifier_group_min_select ?? 0,
          max_select: row.modifier_group_max_select ?? 1,
          is_required: row.modifier_group_is_required === 1,
          sort_order: row.modifier_group_sort_order ?? 0,
          options: []
        };
        item.modifier_groups.push(modifierGroup);
      }

      if (row.modifier_option_id !== null) {
        const hasOption = modifierGroup.options.some(
          (option) => option.id === row.modifier_option_id
        );

        if (!hasOption) {
          modifierGroup.options.push({
            id: row.modifier_option_id,
            code: row.modifier_option_code ?? '',
            name: row.modifier_option_name ?? '',
            price_delta_rm: row.modifier_option_price_delta_rm ?? '0.00',
            token_price_delta: row.modifier_option_token_price_delta ?? 0,
            sort_order: row.modifier_option_sort_order ?? 0,
            is_active: row.modifier_option_is_active === 1
          });
        }
      }
    }
  }

  for (const category of categories.values()) {
    for (const item of category.items) {
      item.modifier_groups.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      for (const modifierGroup of item.modifier_groups) {
        modifierGroup.options.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
      }
    }
  }

  return {
    categories: [...categories.values()].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    subcategories: [...subcategories.values()].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  };
}

async function loadMenuItemById(menuItemId: number): Promise<AdminMenuItem | null> {
  const [rows] = await mysqlPool.query<Array<AdminMenuRow>>(
    `
      SELECT
        c.id AS category_id,
        c.code AS category_code,
        c.name AS category_name,
        c.sort_order AS category_sort_order,
        c.is_active AS category_is_active,
        sc.id AS subcategory_id,
        sc.code AS subcategory_code,
        sc.name AS subcategory_name,
        sc.sort_order AS subcategory_sort_order,
        sc.is_active AS subcategory_is_active,
        i.id AS item_id,
        i.code AS item_code,
        i.name AS item_name,
        i.description AS item_description,
        CAST(i.base_price_rm AS CHAR) AS base_price_rm,
        i.base_price_token,
        i.image_url,
        i.is_active AS is_available,
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
        i.sort_order AS item_sort_order,
        i.created_at AS item_created_at,
        i.updated_at AS item_updated_at,
        tp.tier_code,
        tp.token_price,
        sales.total_units_sold,
        sales.total_revenue_rm,
        sales.last_ordered_at,
        img.id AS modifier_group_id,
        img.code AS modifier_group_code,
        img.name AS modifier_group_name,
        img.selection_type AS modifier_group_selection_type,
        img.min_select AS modifier_group_min_select,
        img.max_select AS modifier_group_max_select,
        img.is_required AS modifier_group_is_required,
        img.sort_order AS modifier_group_sort_order,
        imo.id AS modifier_option_id,
        imo.code AS modifier_option_code,
        imo.name AS modifier_option_name,
        CAST(imo.price_delta_rm AS CHAR) AS modifier_option_price_delta_rm,
        imo.token_price_delta AS modifier_option_token_price_delta,
        imo.sort_order AS modifier_option_sort_order,
        imo.is_active AS modifier_option_is_active
      FROM menu_items i
      JOIN menu_categories c ON c.id = i.category_id
      LEFT JOIN menu_subcategories sc ON sc.id = i.subcategory_id
      LEFT JOIN (
        SELECT
          oi.menu_item_id,
          SUM(oi.quantity) AS total_units_sold,
          CAST(SUM(oi.line_subtotal_rm) AS CHAR) AS total_revenue_rm,
          MAX(o.created_at) AS last_ordered_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status IN ('paid', 'accepted', 'preparing', 'ready_for_pickup', 'collected')
        GROUP BY oi.menu_item_id
      ) sales
        ON sales.menu_item_id = i.id
      LEFT JOIN menu_item_token_prices tp
        ON tp.menu_item_id = i.id
       AND tp.is_enabled = 1
       AND tp.effective_from <= UTC_TIMESTAMP()
       AND (tp.effective_to IS NULL OR tp.effective_to > UTC_TIMESTAMP())
      LEFT JOIN item_modifier_groups img
        ON img.menu_item_id = i.id
      LEFT JOIN item_modifier_options imo
        ON imo.modifier_group_id = img.id
      WHERE i.id = :menuItemId
      ORDER BY tp.tier_code ASC
    `,
    { menuItemId }
  );

  const response = buildMenuResponse(rows);
  return response.categories[0]?.items[0] ?? null;
}

async function resolveCategoryId(
  connection: Pick<Awaited<ReturnType<typeof mysqlPool.getConnection>>, 'query'>,
  categoryCode: string
): Promise<number> {
  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `
      SELECT id
      FROM menu_categories
      WHERE code = :categoryCode
      LIMIT 1
    `,
    { categoryCode }
  );

  const category = rows[0];
  if (!category) {
    throw new ApiError(404, 'menu_category_not_found', 'Menu category was not found.');
  }

  return category.id;
}

async function loadMenuCategoryById(categoryId: number): Promise<AdminMenuCategory | null> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & {
    id: number;
    code: string;
    name: string;
    product_kind_code: string;
    sort_order: number;
    is_active: number;
  }>>(
    `
      SELECT
        id,
        code,
        name,
        CASE
          WHEN LOWER(code) IN ('coffee', 'non_coffee') THEN 'drink'
          WHEN LOWER(code) = 'food' THEN 'food'
          WHEN LOWER(code) = 'merchandise' THEN 'merchandise'
          WHEN LOWER(code) = 'candles' THEN 'candle'
          ELSE 'other'
        END AS product_kind_code,
        sort_order,
        is_active
      FROM menu_categories
      WHERE id = :categoryId
      LIMIT 1
    `,
    { categoryId }
  );

  const row = rows[0];
  if (!row) return null;
  const productKind = resolveProductKind(row.product_kind_code, row.code);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
    product_kind_code: productKind.code,
    product_kind_name: productKind.name,
    subcategories: [],
    items: []
  };
}

async function resolveSubcategoryId(
  connection: Pick<Awaited<ReturnType<typeof mysqlPool.getConnection>>, 'query'>,
  categoryCode: string,
  subcategoryCode: string | null | undefined
): Promise<number | null> {
  const trimmedCode = String(subcategoryCode ?? '').trim();
  if (!trimmedCode) {
    return null;
  }

  const [rows] = await connection.query<Array<RowDataPacket & { id: number }>>(
    `
      SELECT sc.id
      FROM menu_subcategories sc
      JOIN menu_categories c ON c.id = sc.category_id
      WHERE sc.code = :subcategoryCode
        AND c.code = :categoryCode
      LIMIT 1
    `,
    {
      subcategoryCode: trimmedCode,
      categoryCode
    }
  );

  const subcategory = rows[0];
  if (!subcategory) {
    throw new ApiError(404, 'menu_subcategory_not_found', 'Menu subcategory was not found.');
  }

  return subcategory.id;
}

async function loadMenuSubcategoryById(subcategoryId: number): Promise<AdminMenuSubcategory | null> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & {
    id: number;
    code: string;
    name: string;
    sort_order: number;
    is_active: number;
    category_id: number;
    category_code: string;
    category_name: string;
    category_product_kind_code: string;
  }>>(
    `
      SELECT
        sc.id,
        sc.code,
        sc.name,
        sc.sort_order,
        sc.is_active,
        c.id AS category_id,
        c.code AS category_code,
        c.name AS category_name,
        CASE
          WHEN LOWER(c.code) IN ('coffee', 'non_coffee') THEN 'drink'
          WHEN LOWER(c.code) = 'food' THEN 'food'
          WHEN LOWER(c.code) = 'merchandise' THEN 'merchandise'
          WHEN LOWER(c.code) = 'candles' THEN 'candle'
          ELSE 'other'
        END AS category_product_kind_code
      FROM menu_subcategories sc
      JOIN menu_categories c ON c.id = sc.category_id
      WHERE sc.id = :subcategoryId
      LIMIT 1
    `,
    { subcategoryId }
  );

  const row = rows[0];
  if (!row) return null;
  const productKind = resolveProductKind(row.category_product_kind_code, row.category_code);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category_id: row.category_id,
    category_code: row.category_code,
    category_name: row.category_name,
    sort_order: row.sort_order,
    is_active: row.is_active === 1,
    product_kind_code: productKind.code,
    product_kind_name: productKind.name
  };
}

async function upsertMenuTokenPrices(
  connection: Awaited<ReturnType<typeof mysqlPool.getConnection>>,
  menuItemId: number,
  tokenPrices?: Partial<Record<(typeof tierCodes)[number], number>>
): Promise<void> {
  if (!tokenPrices) {
    return;
  }

  for (const tierCode of tierCodes) {
    const price = tokenPrices[tierCode];
    if (price === undefined) {
      continue;
    }

    await connection.execute(
      `
        UPDATE menu_item_token_prices
        SET is_enabled = 0,
            effective_to = UTC_TIMESTAMP()
        WHERE menu_item_id = :menuItemId
          AND tier_code = :tierCode
          AND is_enabled = 1
          AND effective_to IS NULL
      `,
      {
        menuItemId,
        tierCode
      }
    );

    await connection.execute(
      `
        INSERT INTO menu_item_token_prices (
          menu_item_id,
          tier_code,
          token_price,
          is_enabled,
          effective_from,
          effective_to
        )
        VALUES (
          :menuItemId,
          :tierCode,
          :tokenPrice,
          1,
          UTC_TIMESTAMP(),
          NULL
        )
      `,
      {
        menuItemId,
        tierCode,
        tokenPrice: price
      }
    );
  }
}

async function replaceMenuModifiers(
  connection: Awaited<ReturnType<typeof mysqlPool.getConnection>>,
  menuItemId: number,
  modifierGroups?: Array<z.infer<typeof adminMenuModifierGroupSchema>>
): Promise<void> {
  if (modifierGroups === undefined) {
    return;
  }

  await connection.execute(
    `
      DELETE FROM item_modifier_groups
      WHERE menu_item_id = :menuItemId
    `,
    { menuItemId }
  );

  for (let groupIndex = 0; groupIndex < modifierGroups.length; groupIndex += 1) {
    const group = modifierGroups[groupIndex];
    const groupCode = generateModifierCode(group.name, groupIndex);
    const [groupResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO item_modifier_groups (
          menu_item_id,
          code,
          name,
          selection_type,
          min_select,
          max_select,
          is_required,
          sort_order
        )
        VALUES (
          :menuItemId,
          :code,
          :name,
          :selectionType,
          :minSelect,
          :maxSelect,
          :isRequired,
          :sortOrder
        )
      `,
      {
        menuItemId,
        code: groupCode,
        name: group.name,
        selectionType: group.selection_type,
        minSelect: group.min_select,
        maxSelect: group.max_select,
        isRequired: group.is_required ? 1 : 0,
        sortOrder: group.sort_order
      }
    );

    const modifierGroupId = groupResult.insertId;
    for (let optionIndex = 0; optionIndex < group.options.length; optionIndex += 1) {
      const option = group.options[optionIndex];
      await connection.execute(
        `
          INSERT INTO item_modifier_options (
            modifier_group_id,
            code,
            name,
            price_delta_rm,
            token_price_delta,
            sort_order,
            is_active
          )
          VALUES (
            :modifierGroupId,
            :code,
            :name,
            :priceDeltaRm,
            :tokenPriceDelta,
            :sortOrder,
            :isActive
          )
        `,
        {
          modifierGroupId,
          code: generateModifierCode(option.name, optionIndex),
          name: option.name,
          priceDeltaRm: Number(option.price_delta_rm).toFixed(2),
          tokenPriceDelta: option.token_price_delta,
          sortOrder: option.sort_order,
          isActive: option.is_active ? 1 : 0
        }
      );
    }
  }
}

function generateMenuCode(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'ITEM';
  return `MENU-${slug}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function generateModifierCode(name: string, index: number): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'MOD';
  return `MOD-${slug}-${String(index + 1).padStart(2, '0')}`;
}

function nullableString(value: string | undefined | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extensionForMimeType(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    default:
      return '.bin';
  }
}

function slugifyFileName(fileName: string): string {
  const baseName = path.basename(fileName, path.extname(fileName));
  const slug = baseName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return slug.length > 0 ? slug : 'menu-image';
}
