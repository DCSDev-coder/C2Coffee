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
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(255),
  image_url: z.string().trim().max(512).nullable().optional(),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  gradient_end_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  gradient_direction: z.enum(['diagonal', 'horizontal', 'vertical']).default('diagonal'),
  price_delta_rm: z.coerce.number().min(-999).max(999).default(0),
  token_price_delta: z.coerce.number().int().min(-999).max(999).default(0),
  calorie_delta_kcal: z.coerce.number().int().min(-5000).max(5000).default(0),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.coerce.boolean().default(true),
  is_default: z.coerce.boolean().default(false)
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
  hidden_when_option_ids: z.array(z.coerce.number().int().positive()).max(100).default([]),
  options: z.array(optionSchema).min(1)
}).superRefine((value, context) => {
  if (value.min_select > value.max_select) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['min_select'], message: 'Minimum selections cannot exceed maximum selections.' });
  }
  const defaultCount = value.options.filter((option) => option.is_active && option.is_default).length;
  const requiredMinimum = value.is_required ? Math.max(1, value.min_select) : value.min_select;
  if (defaultCount < requiredMinimum) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: `Choose at least ${requiredMinimum} default customer choice${requiredMinimum === 1 ? '' : 's'} for this required group.` });
  }
  if (defaultCount > value.max_select) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['options'], message: 'Default customer choices cannot exceed the group maximum.' });
  }
});

const nutritionSchema = z.object({ base_calories_kcal: z.coerce.number().int().min(0).max(5000) });
const optionExclusionsSchema = z.object({ option_ids: z.array(z.coerce.number().int().positive()).max(1000).default([]) });
const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(255),
  brand: z.string().trim().max(255).nullable().optional(),
  unit: z.enum(['g', 'ml']),
  calories_per_100_units: z.coerce.number().min(0).max(10000),
  protein_g_per_100_units: z.coerce.number().min(0).max(1000).default(0),
  carbs_g_per_100_units: z.coerce.number().min(0).max(1000).default(0),
  fat_g_per_100_units: z.coerce.number().min(0).max(1000).default(0),
  source_reference: z.string().trim().max(512).nullable().optional(),
  is_active: z.coerce.boolean().default(true)
});
const recipeSchema = z.object({
  notes: z.string().trim().max(1000).nullable().optional(),
  components: z.array(z.object({
    ingredient_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().positive().max(100000)
  })).min(1).max(100)
});
const optionNutritionOverridesSchema = z.object({
  overrides: z.array(z.object({
    option_id: z.coerce.number().int().positive(),
    calorie_delta_kcal: z.coerce.number().int().min(-5000).max(5000)
  })).max(1000).default([])
});
const applyOptionNutritionSchema = z.object({
  calorie_delta_kcal: z.coerce.number().int().min(-5000).max(5000)
});

export async function registerAdminOptionLibraryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/menu/options-library', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT g.id, g.name, g.applies_to, g.selection_type, g.min_select, g.max_select, g.is_required, g.sort_order, g.is_active,
        o.id AS option_id, o.name AS option_name, o.image_url AS option_image_url, o.color_hex, o.gradient_end_hex, o.gradient_direction, CAST(o.price_delta_rm AS CHAR) AS price_delta_rm, o.token_price_delta, o.calorie_delta_kcal, o.sort_order AS option_sort_order, o.is_active AS option_is_active, o.is_default AS option_is_default,
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
        group = { id: row.id, name: row.name, applies_to: row.applies_to, selection_type: row.selection_type, min_select: row.min_select, max_select: row.max_select, is_required: row.is_required === 1, sort_order: row.sort_order, is_active: row.is_active === 1, menu_item_ids: [], hidden_when_option_ids: [], options: [] };
        groups.set(row.id, group);
      }
      if (row.menu_item_id && !group.menu_item_ids.includes(row.menu_item_id)) group.menu_item_ids.push(row.menu_item_id);
      if (row.option_id && !group.options.some((option: any) => option.id === row.option_id)) {
        group.options.push({ id: row.option_id, name: row.option_name, image_url: row.option_image_url, color_hex: row.color_hex, gradient_end_hex: row.gradient_end_hex, gradient_direction: row.gradient_direction || 'diagonal', price_delta_rm: row.price_delta_rm, token_price_delta: row.token_price_delta, calorie_delta_kcal: row.calorie_delta_kcal, sort_order: row.option_sort_order, is_active: row.option_is_active === 1, is_default: row.option_is_default === 1 });
      }
    }
    const [exclusionRows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT e.menu_item_id, e.option_group_option_id
       FROM menu_item_option_exclusions e
       JOIN menu_option_group_options o ON o.id = e.option_group_option_id
       JOIN menu_option_groups g ON g.id = o.option_group_id
       WHERE g.tenant_id = :tenantId`,
      { tenantId: request.adminAuth.tenantId }
    );
    const exclusionsByOption = new Map<number, number[]>();
    for (const row of exclusionRows) {
      const excludedItems = exclusionsByOption.get(row.option_group_option_id) || [];
      excludedItems.push(row.menu_item_id);
      exclusionsByOption.set(row.option_group_option_id, excludedItems);
    }
    for (const group of groups.values()) {
      for (const option of group.options) {
        option.excluded_menu_item_ids = exclusionsByOption.get(option.id) || [];
      }
    }
    const [visibilityRows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT r.option_group_id, r.trigger_option_id
       FROM menu_option_group_visibility_rules r
       JOIN menu_option_groups g ON g.id = r.option_group_id
       WHERE g.tenant_id = :tenantId`,
      { tenantId: request.adminAuth.tenantId }
    );
    for (const row of visibilityRows) {
      const group = groups.get(Number(row.option_group_id));
      if (group) {
        group.hidden_when_option_ids.push(Number(row.trigger_option_id));
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

  app.get('/v1/admin/nutrition/ingredients', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const [ingredients] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT id, name, brand, unit, calories_per_100_units, protein_g_per_100_units,
              carbs_g_per_100_units, fat_g_per_100_units, source_reference, is_active
       FROM nutrition_ingredients WHERE tenant_id = :tenantId ORDER BY is_active DESC, name ASC, id ASC`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { ingredients };
  });

  app.post('/v1/admin/nutrition/ingredients', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const payload = ingredientSchema.parse(request.body);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO nutrition_ingredients
       (tenant_id, name, brand, unit, calories_per_100_units, protein_g_per_100_units, carbs_g_per_100_units, fat_g_per_100_units, source_reference, is_active)
       VALUES (:tenantId, :name, :brand, :unit, :calories, :protein, :carbs, :fat, :sourceReference, :isActive)`,
      { tenantId: request.adminAuth.tenantId, name: payload.name, brand: payload.brand || null, unit: payload.unit,
        calories: payload.calories_per_100_units, protein: payload.protein_g_per_100_units, carbs: payload.carbs_g_per_100_units,
        fat: payload.fat_g_per_100_units, sourceReference: payload.source_reference || null, isActive: payload.is_active ? 1 : 0 }
    );
    return { ingredient_id: result.insertId };
  });

  app.patch('/v1/admin/nutrition/ingredients/:ingredientId', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const ingredientId = z.coerce.number().int().positive().parse((request.params as { ingredientId: string }).ingredientId);
    const payload = ingredientSchema.parse(request.body);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE nutrition_ingredients SET name=:name, brand=:brand, unit=:unit, calories_per_100_units=:calories,
       protein_g_per_100_units=:protein, carbs_g_per_100_units=:carbs, fat_g_per_100_units=:fat,
       source_reference=:sourceReference, is_active=:isActive WHERE id=:ingredientId AND tenant_id=:tenantId`,
      { ingredientId, tenantId: request.adminAuth.tenantId, name: payload.name, brand: payload.brand || null, unit: payload.unit,
        calories: payload.calories_per_100_units, protein: payload.protein_g_per_100_units, carbs: payload.carbs_g_per_100_units,
        fat: payload.fat_g_per_100_units, sourceReference: payload.source_reference || null, isActive: payload.is_active ? 1 : 0 }
    );
    if (!result.affectedRows) throw new ApiError(404, 'ingredient_not_found', 'Ingredient was not found.');
    return { ingredient_id: ingredientId };
  });

  app.get('/v1/admin/menu/items/:itemId/recipe-nutrition', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const itemId = z.coerce.number().int().positive().parse((request.params as { itemId: string }).itemId);
    await assertTenantMenuItem(itemId, request.adminAuth.tenantId);
    const [recipeRows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT r.id, r.version_no, r.status, r.notes, r.activated_at, r.created_at, c.ingredient_id, c.quantity, c.sort_order,
              i.name AS ingredient_name, i.unit, i.calories_per_100_units
       FROM menu_item_recipe_versions r
       LEFT JOIN menu_item_recipe_components c ON c.recipe_version_id = r.id
       LEFT JOIN nutrition_ingredients i ON i.id = c.ingredient_id
       WHERE r.menu_item_id = :itemId ORDER BY r.version_no DESC, c.sort_order ASC, c.id ASC`, { itemId }
    );
    const recipes = new Map<number, any>();
    for (const row of recipeRows) {
      const recipe = recipes.get(row.id) ?? { id: row.id, version_no: row.version_no, status: row.status, notes: row.notes, activated_at: row.activated_at, created_at: row.created_at, components: [] };
      if (row.ingredient_id) recipe.components.push({ ingredient_id: row.ingredient_id, quantity: Number(row.quantity), name: row.ingredient_name, unit: row.unit, calories_per_100_units: Number(row.calories_per_100_units) });
      recipes.set(row.id, recipe);
    }
    const [overrides] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT o.option_group_option_id AS option_id, o.calorie_delta_kcal
       FROM menu_item_option_nutrition_overrides o WHERE o.menu_item_id = :itemId`, { itemId }
    );
    return { recipes: [...recipes.values()], option_overrides: overrides };
  });

  app.put('/v1/admin/menu/items/:itemId/recipe-nutrition', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const itemId = z.coerce.number().int().positive().parse((request.params as { itemId: string }).itemId);
    const payload = recipeSchema.parse(request.body);
    await assertTenantMenuItem(itemId, request.adminAuth.tenantId);
    const ingredientIds = [...new Set(payload.components.map((component) => component.ingredient_id))];
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [ingredientRows] = await connection.query<Array<RowDataPacket>>(
        `SELECT id FROM nutrition_ingredients WHERE tenant_id=:tenantId AND is_active=1 AND id IN (:ingredientIds)`,
        { tenantId: request.adminAuth.tenantId, ingredientIds }
      );
      if (ingredientRows.length !== ingredientIds.length) throw new ApiError(400, 'invalid_recipe_ingredient', 'Choose active ingredients from this tenant.');
      const [versionRows] = await connection.query<Array<RowDataPacket>>(
        `SELECT COALESCE(MAX(version_no), 0) AS max_version FROM menu_item_recipe_versions WHERE menu_item_id=:itemId FOR UPDATE`, { itemId }
      );
      await connection.execute(`UPDATE menu_item_recipe_versions SET status='archived' WHERE menu_item_id=:itemId AND status='active'`, { itemId });
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO menu_item_recipe_versions (menu_item_id, version_no, status, notes, created_by_admin_user_id, activated_at)
         VALUES (:itemId, :versionNo, 'active', :notes, :adminUserId, UTC_TIMESTAMP())`,
        { itemId, versionNo: Number(versionRows[0]?.max_version || 0) + 1, notes: payload.notes || null, adminUserId: request.adminAuth.adminUserId }
      );
      for (const [index, component] of payload.components.entries()) {
        await connection.execute(`INSERT INTO menu_item_recipe_components (recipe_version_id, ingredient_id, quantity, sort_order)
          VALUES (:recipeId, :ingredientId, :quantity, :sortOrder)`, { recipeId: result.insertId, ingredientId: component.ingredient_id, quantity: component.quantity, sortOrder: index });
      }
      await connection.commit();
      return { recipe_id: result.insertId, version_no: Number(versionRows[0]?.max_version || 0) + 1 };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.put('/v1/admin/menu/items/:itemId/option-nutrition', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const itemId = z.coerce.number().int().positive().parse((request.params as { itemId: string }).itemId);
    const payload = optionNutritionOverridesSchema.parse(request.body);
    await assertTenantMenuItem(itemId, request.adminAuth.tenantId);
    const optionIds = [...new Set(payload.overrides.map((override) => override.option_id))];
    const [options] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT o.id FROM menu_option_group_options o JOIN menu_option_groups g ON g.id=o.option_group_id
       LEFT JOIN menu_option_group_items a ON a.option_group_id=g.id AND a.menu_item_id=:itemId
       WHERE g.tenant_id=:tenantId AND o.id IN (:optionIds) AND (g.applies_to='all_drinks' OR a.menu_item_id IS NOT NULL)`,
      { itemId, tenantId: request.adminAuth.tenantId, optionIds: optionIds.length ? optionIds : [0] }
    );
    if (options.length !== optionIds.length) throw new ApiError(400, 'invalid_option_override', 'One or more choices are unavailable for this drink.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM menu_item_option_nutrition_overrides WHERE menu_item_id=:itemId', { itemId });
      for (const override of payload.overrides) await connection.execute(
        `INSERT INTO menu_item_option_nutrition_overrides (menu_item_id, option_group_option_id, calorie_delta_kcal)
         VALUES (:itemId, :optionId, :calories)`, { itemId, optionId: override.option_id, calories: override.calorie_delta_kcal }
      );
      await connection.commit();
      return { item_id: itemId, overrides: payload.overrides };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.post('/v1/admin/menu/options/:optionId/nutrition/apply-to-drinks', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const optionId = z.coerce.number().int().positive().parse((request.params as { optionId: string }).optionId);
    const payload = applyOptionNutritionSchema.parse(request.body);
    const [targetRows] = await mysqlPool.query<Array<RowDataPacket>>(
      `SELECT DISTINCT i.id AS menu_item_id
       FROM menu_option_group_options o
       JOIN menu_option_groups g ON g.id = o.option_group_id
       CROSS JOIN menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       LEFT JOIN menu_option_group_items a ON a.option_group_id = g.id AND a.menu_item_id = i.id
       WHERE o.id = :optionId
         AND g.tenant_id = :tenantId
         AND o.is_active = 1
         AND g.is_active = 1
         AND i.is_active = 1
         AND LOWER(COALESCE(c.product_kind_code, '')) = 'drink'
         AND (g.applies_to = 'all_drinks' OR a.menu_item_id IS NOT NULL)`,
      { optionId, tenantId: request.adminAuth.tenantId }
    );
    if (targetRows.length === 0) throw new ApiError(404, 'option_not_found', 'Option was not found or is not available for any drink.');
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      for (const row of targetRows) {
        await connection.execute(
          `INSERT INTO menu_item_option_nutrition_overrides (menu_item_id, option_group_option_id, calorie_delta_kcal)
           VALUES (:itemId, :optionId, :calories)
           ON DUPLICATE KEY UPDATE calorie_delta_kcal = VALUES(calorie_delta_kcal)`,
          { itemId: row.menu_item_id, optionId, calories: payload.calorie_delta_kcal }
        );
      }
      await connection.commit();
      return { option_id: optionId, applied_to_drinks: targetRows.length, calorie_delta_kcal: payload.calorie_delta_kcal };
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  });

  app.patch('/v1/admin/menu/items/:itemId/nutrition', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const itemId = z.coerce.number().int().positive().parse((request.params as { itemId: string }).itemId);
    const payload = nutritionSchema.parse(request.body);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       SET i.base_calories_kcal = :calories
       WHERE i.id = :itemId`,
      {
        itemId,
        calories: payload.base_calories_kcal
      }
    );
    if (result.affectedRows === 0) throw new ApiError(404, 'menu_item_not_found', 'Menu item was not found.');
    return { item_id: itemId, base_calories_kcal: payload.base_calories_kcal };
  });

  app.patch('/v1/admin/menu/items/:itemId/option-exclusions', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'marketing_admin', 'operations_admin']);
    const itemId = z.coerce.number().int().positive().parse((request.params as { itemId: string }).itemId);
    const payload = optionExclusionsSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      const [itemRows] = await connection.query<Array<RowDataPacket>>(
        `SELECT i.id
         FROM menu_items i
         JOIN menu_categories c ON c.id = i.category_id
         WHERE i.id = :itemId
           AND LOWER(COALESCE(c.product_kind_code, '')) = 'drink'
         LIMIT 1`,
        { itemId }
      );
      if (!itemRows[0]) throw new ApiError(404, 'drink_menu_item_not_found', 'Drink menu item was not found.');

      const [availableRows] = await connection.query<Array<RowDataPacket>>(
        `SELECT g.id AS group_id, o.id AS option_id
         FROM menu_option_groups g
         JOIN menu_option_group_options o ON o.option_group_id = g.id AND o.is_active = 1
         LEFT JOIN menu_option_group_items a ON a.option_group_id = g.id AND a.menu_item_id = :itemId
         WHERE g.tenant_id = :tenantId
           AND g.is_active = 1
           AND (g.applies_to = 'all_drinks' OR a.menu_item_id IS NOT NULL)`,
        { itemId, tenantId: request.adminAuth.tenantId }
      );
      const availableOptionIds = new Set(availableRows.map((row) => Number(row.option_id)));
      const excludedOptionIds = [...new Set(payload.option_ids)];
      if (excludedOptionIds.some((optionId) => !availableOptionIds.has(optionId))) {
        throw new ApiError(400, 'invalid_option_exclusion', 'One or more choices are not available for this drink.');
      }

      const excludedByGroup = new Map<number, number>();
      for (const row of availableRows) {
        if (excludedOptionIds.includes(Number(row.option_id))) {
          excludedByGroup.set(Number(row.group_id), (excludedByGroup.get(Number(row.group_id)) || 0) + 1);
        }
      }
      const availableByGroup = new Map<number, number>();
      for (const row of availableRows) {
        availableByGroup.set(Number(row.group_id), (availableByGroup.get(Number(row.group_id)) || 0) + 1);
      }
      if ([...availableByGroup.entries()].some(([groupId, count]) => excludedByGroup.get(groupId) === count)) {
        throw new ApiError(400, 'empty_option_group', 'Keep at least one choice available in every enabled option group.');
      }

      await connection.execute('DELETE FROM menu_item_option_exclusions WHERE menu_item_id = :itemId', { itemId });
      for (const optionId of excludedOptionIds) {
        await connection.execute(
          'INSERT INTO menu_item_option_exclusions (menu_item_id, option_group_option_id) VALUES (:itemId, :optionId)',
          { itemId, optionId }
        );
      }
      await connection.commit();
      return { item_id: itemId, excluded_option_ids: excludedOptionIds };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}

async function saveGroup(tenantId: number, payload: z.infer<typeof groupSchema>, groupId?: number) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    let id = groupId;
    if (id) {
      await connection.execute(`UPDATE menu_option_groups SET name=:name, applies_to=:appliesTo, selection_type=:selectionType, min_select=:minSelect, max_select=:maxSelect, is_required=:isRequired, sort_order=:sortOrder, is_active=:isActive WHERE id=:id AND tenant_id=:tenantId`, { id, tenantId, name: payload.name, appliesTo: payload.applies_to, selectionType: payload.selection_type, minSelect: payload.min_select, maxSelect: payload.max_select, isRequired: payload.is_required ? 1 : 0, sortOrder: payload.sort_order, isActive: payload.is_active ? 1 : 0 });
      await connection.execute('DELETE FROM menu_option_group_items WHERE option_group_id = :id', { id });
    } else {
      const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO menu_option_groups (tenant_id,name,applies_to,selection_type,min_select,max_select,is_required,sort_order,is_active) VALUES (:tenantId,:name,:appliesTo,:selectionType,:minSelect,:maxSelect,:isRequired,:sortOrder,:isActive)`, { tenantId, name: payload.name, appliesTo: payload.applies_to, selectionType: payload.selection_type, minSelect: payload.min_select, maxSelect: payload.max_select, isRequired: payload.is_required ? 1 : 0, sortOrder: payload.sort_order, isActive: payload.is_active ? 1 : 0 });
      id = result.insertId;
    }
    const currentOptionIds = new Set<number>();
    for (const [index, option] of payload.options.entries()) {
      if (option.id && groupId) {
        const [result] = await connection.execute<ResultSetHeader>(`UPDATE menu_option_group_options SET name=:name,image_url=:imageUrl,color_hex=:colorHex,gradient_end_hex=:gradientEndHex,gradient_direction=:gradientDirection,price_delta_rm=:rm,token_price_delta=:tokens,calorie_delta_kcal=:calories,sort_order=:sortOrder,is_active=:active,is_default=:isDefault WHERE id=:optionId AND option_group_id=:id`, { id, optionId: option.id, name: option.name, imageUrl: option.image_url || null, colorHex: option.color_hex || null, gradientEndHex: option.gradient_end_hex || null, gradientDirection: option.gradient_direction || 'diagonal', rm: option.price_delta_rm.toFixed(2), tokens: option.token_price_delta, calories: option.calorie_delta_kcal, sortOrder: option.sort_order ?? index, active: option.is_active ? 1 : 0, isDefault: option.is_default ? 1 : 0 });
        if (result.affectedRows === 0) throw new ApiError(400, 'invalid_option_choice', 'Option choice does not belong to this group.');
        currentOptionIds.add(option.id);
      } else {
        const [result] = await connection.execute<ResultSetHeader>(`INSERT INTO menu_option_group_options (option_group_id,name,image_url,color_hex,gradient_end_hex,gradient_direction,price_delta_rm,token_price_delta,calorie_delta_kcal,sort_order,is_active,is_default) VALUES (:id,:name,:imageUrl,:colorHex,:gradientEndHex,:gradientDirection,:rm,:tokens,:calories,:sortOrder,:active,:isDefault)`, { id, name: option.name, imageUrl: option.image_url || null, colorHex: option.color_hex || null, gradientEndHex: option.gradient_end_hex || null, gradientDirection: option.gradient_direction || 'diagonal', rm: option.price_delta_rm.toFixed(2), tokens: option.token_price_delta, calories: option.calorie_delta_kcal, sortOrder: option.sort_order ?? index, active: option.is_active ? 1 : 0, isDefault: option.is_default ? 1 : 0 });
        currentOptionIds.add(result.insertId);
      }
    }
    if (groupId) {
      const [existingOptionRows] = await connection.query<Array<RowDataPacket>>(
        'SELECT id FROM menu_option_group_options WHERE option_group_id = :id',
        { id }
      );
      for (const existingOption of existingOptionRows) {
        if (!currentOptionIds.has(Number(existingOption.id))) {
          await connection.execute(
            'DELETE FROM menu_option_group_options WHERE id = :optionId AND option_group_id = :id',
            { id, optionId: existingOption.id }
          );
        }
      }
    }
    if (payload.applies_to === 'selected_items') {
      for (const menuItemId of [...new Set(payload.menu_item_ids)]) {
        const [items] = await connection.query<Array<RowDataPacket>>(
          `SELECT i.id
           FROM menu_items i
           JOIN menu_categories c ON c.id = i.category_id
           WHERE i.id = :menuItemId
             AND LOWER(COALESCE(c.product_kind_code, '')) = 'drink'
           LIMIT 1`,
          { menuItemId }
        );
        if (!items[0]) throw new ApiError(400, 'invalid_option_item', 'Options can only be assigned to drink items.');
        await connection.execute('INSERT INTO menu_option_group_items (option_group_id,menu_item_id) VALUES (:id,:menuItemId)', { id, menuItemId });
      }
    }
    const hiddenWhenOptionIds = [...new Set(payload.hidden_when_option_ids)];
    if (hiddenWhenOptionIds.some((optionId) => currentOptionIds.has(optionId))) {
      throw new ApiError(400, 'invalid_visibility_rule', 'A choice cannot hide its own option group.');
    }
    if (hiddenWhenOptionIds.length > 0) {
      const [triggerRows] = await connection.query<Array<RowDataPacket>>(
        `SELECT o.id
         FROM menu_option_group_options o
         JOIN menu_option_groups g ON g.id = o.option_group_id
         WHERE g.tenant_id = :tenantId AND o.id IN (:optionIds)`,
        { tenantId, optionIds: hiddenWhenOptionIds }
      );
      if (triggerRows.length !== hiddenWhenOptionIds.length) {
        throw new ApiError(400, 'invalid_visibility_rule', 'One or more choices used to hide this group are unavailable.');
      }
    }
    await connection.execute(
      'DELETE FROM menu_option_group_visibility_rules WHERE option_group_id = :id',
      { id }
    );
    for (const optionId of hiddenWhenOptionIds) {
      await connection.execute(
        'INSERT INTO menu_option_group_visibility_rules (option_group_id, trigger_option_id) VALUES (:id, :optionId)',
        { id, optionId }
      );
    }
    await connection.commit();
    return { group: { id, ...payload } };
  } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
}

async function assertTenantMenuItem(itemId: number, tenantId: number): Promise<void> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
    `SELECT i.id
     FROM menu_items i
     JOIN menu_categories c ON c.id = i.category_id
     JOIN stores s ON s.tenant_id = :tenantId
     WHERE i.id = :itemId
       AND LOWER(COALESCE(c.product_kind_code, '')) = 'drink'
     LIMIT 1`,
    { itemId, tenantId }
  );
  if (!rows[0]) throw new ApiError(404, 'drink_menu_item_not_found', 'Drink menu item was not found.');
}
