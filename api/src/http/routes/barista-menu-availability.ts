import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';
import { resolveAttendanceStoreId } from './barista-staff.js';

export function normalizeCustomizationValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveCustomizationTypeForGroup(
  groupName: string
): 'bean' | 'milk' | 'sparkling' | null {
  const normalized = normalizeCustomizationValue(groupName);
  if (/\bbeans?\b/.test(normalized)) return 'bean';
  if (/\bmilks?\b/.test(normalized)) return 'milk';
  if (/\b(sparkling|mixers?)\b/.test(normalized)) return 'sparkling';
  return null;
}

const itemAvailabilitySchema = z.object({
  is_available: z.boolean()
});

const customizationAvailabilitySchema = z.object({
  type: z.string().trim().min(1).max(80),
  value: z.string().trim().toLowerCase(),
  is_available: z.boolean()
});

const legacyBeanAvailabilitySchema = z.object({
  bean: z.string().trim().toLowerCase(),
  is_available: z.boolean()
});

function requireBaristaMenuAccess(request: FastifyRequest): void {
  requireAnyAdminRole(request, ['super_admin', 'operations_admin', 'barista']);
}

let tableEnsured = false;
async function ensureStoreCustomizationTable(): Promise<void> {
  if (tableEnsured) return;
  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS store_customization_availability (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      store_id BIGINT UNSIGNED NOT NULL,
      customization_type VARCHAR(50) NOT NULL,
      customization_value VARCHAR(100) NOT NULL,
      is_available TINYINT(1) NOT NULL DEFAULT 1,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_store_customization (store_id, customization_type, customization_value),
      KEY idx_store_customization_type (store_id, customization_type, is_available),
      CONSTRAINT fk_store_customization_store
        FOREIGN KEY (store_id) REFERENCES stores(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  tableEnsured = true;
}

export async function registerBaristaMenuAvailabilityRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/barista/menu/availability', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaMenuAccess(request);
    await ensureStoreCustomizationTable();
    const storeId = await resolveAttendanceStoreId(request);

    const [stores] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT name FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1',
      { storeId, tenantId: request.adminAuth.tenantId }
    );
    const storeName = stores[0]?.name ?? 'Current outlet';

    // Fetch all store customization statuses
    const [customizationRows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT customization_type, customization_value, is_available
         FROM store_customization_availability
        WHERE store_id = :storeId`,
      { storeId }
    );

    const statusMap = new Map<string, boolean>();
    for (const row of customizationRows) {
      const key = `${String(row.customization_type).toLowerCase()}:${normalizeCustomizationValue(String(row.customization_value))}`;
      statusMap.set(key, Number(row.is_available) === 1);
    }

    const isAvailable = (type: string, value: string) =>
      statusMap.get(`${type.toLowerCase()}:${normalizeCustomizationValue(value)}`) ?? true;

    const legacyCustomizations = [
      {
        type: 'bean',
        category_name: 'Coffee Beans',
        description: 'Choice of espresso bean blend for coffee drinks.',
        options: [
          {
            code: 'dato_blend',
            name: "Dato' Blend",
            subtitle: 'Bold & Dark Chocolatey',
            value: 'dato blend',
            is_available: isAvailable('bean', 'dato blend')
          },
          {
            code: 'datin_blend',
            name: 'Datin Blend',
            subtitle: 'Floral & Citrusy Bright',
            value: 'datin blend',
            is_available: isAvailable('bean', 'datin blend')
          }
        ]
      },
      {
        type: 'milk',
        category_name: 'Milk Choices',
        description: 'Dairy and plant-based milks for lattes and iced drinks.',
        options: [
          {
            code: 'fresh_milk',
            name: 'Fresh Milk',
            subtitle: 'Full Cream Dairy Milk',
            value: 'fresh milk',
            is_available: isAvailable('milk', 'fresh milk')
          },
          {
            code: 'oat_milk',
            name: 'Oat Milk',
            subtitle: 'Oatside Barista Plant-Based Milk',
            value: 'oat milk',
            is_available: isAvailable('milk', 'oat milk')
          }
        ]
      },
      {
        type: 'sparkling',
        category_name: 'Mixers & Sparkling',
        description: 'Carbonated mixers for cold refreshers and signature drinks.',
        options: [
          {
            code: 'ginger_ade',
            name: 'Ginger Ade',
            subtitle: 'Sparkling ginger mixer',
            value: 'ginger ade',
            is_available: isAvailable('sparkling', 'ginger ade')
          },
          {
            code: 'tonic_water',
            name: 'Tonic Water',
            subtitle: 'Sparkling tonic water mixer',
            value: 'tonic water',
            is_available: isAvailable('sparkling', 'tonic water')
          }
        ]
      }
    ];

    const [libraryRows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT g.id AS group_id, g.name AS group_name, g.sort_order AS group_sort_order,
              o.id AS option_id, o.name AS option_name,
              o.sort_order AS option_sort_order
         FROM menu_option_groups g
         JOIN menu_option_group_options o
           ON o.option_group_id = g.id AND o.is_active = 1
        WHERE g.tenant_id = :tenantId AND g.is_active = 1
        ORDER BY g.sort_order, g.id, o.sort_order, o.id`,
      { tenantId: request.adminAuth.tenantId }
    );

    const customizations = libraryRows.length > 0
      ? [...libraryRows.reduce((groups, row) => {
          const groupId = Number(row.group_id);
          const type = resolveCustomizationTypeForGroup(String(row.group_name)) ?? `group:${groupId}`;
          const group = groups.get(groupId) ?? {
            type,
            category_name: String(row.group_name),
            description: 'Options configured in Options & Nutrition.',
            sort_order: Number(row.group_sort_order),
            options: [] as Array<Record<string, unknown>>
          };
          const value = String(row.option_name);
          group.options.push({
            code: `library-${row.option_id}`,
            name: value,
            subtitle: 'Configured customer choice',
            value: normalizeCustomizationValue(value),
            is_available: isAvailable(type, value)
          });
          groups.set(groupId, group);
          return groups;
        }, new Map<number, {
          type: string;
          category_name: string;
          description: string;
          sort_order: number;
          options: Array<Record<string, unknown>>;
        }>()).values()].sort((a, b) => a.sort_order - b.sort_order)
        .map(({ sort_order: _sortOrder, ...group }) => group)
      : legacyCustomizations;

    // Fetch categories and items
    const [itemRows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT
         c.id AS category_id,
         c.name AS category_name,
         c.sort_order AS category_sort_order,
         i.id AS item_id,
         i.name AS item_name,
         i.description AS item_description,
         CAST(i.base_price_rm AS CHAR) AS base_price_rm,
         i.image_url,
         i.allow_choice_of_beans,
         i.allow_choice_of_milk,
         i.allow_sparkling_mixer,
         COALESCE(a.is_available, 1) AS is_available
       FROM menu_categories c
       JOIN menu_items i ON i.category_id = c.id AND i.is_active = 1
       JOIN menu_item_tenants tenant_item
         ON tenant_item.menu_item_id = i.id AND tenant_item.tenant_id = :tenantId
       LEFT JOIN menu_item_store_availability a
         ON a.store_id = :storeId AND a.menu_item_id = i.id
      WHERE c.is_active = 1
      ORDER BY c.sort_order, c.name, i.sort_order, i.name`,
      { storeId, tenantId: request.adminAuth.tenantId }
    );

    const categoriesMap = new Map<number, {
      id: number;
      name: string;
      sort_order: number;
      items: Array<{
        id: number;
        name: string;
        description: string | null;
        base_price_rm: string;
        image_url: string | null;
        allow_choice_of_beans: boolean;
        allow_choice_of_milk: boolean;
        allow_sparkling_mixer: boolean;
        is_available: boolean;
      }>;
    }>();

    for (const row of itemRows) {
      const catId = Number(row.category_id);
      let cat = categoriesMap.get(catId);
      if (!cat) {
        cat = {
          id: catId,
          name: row.category_name,
          sort_order: Number(row.category_sort_order),
          items: []
        };
        categoriesMap.set(catId, cat);
      }
      cat.items.push({
        id: Number(row.item_id),
        name: row.item_name,
        description: row.item_description || null,
        base_price_rm: row.base_price_rm,
        image_url: row.image_url || null,
        allow_choice_of_beans: Number(row.allow_choice_of_beans) === 1,
        allow_choice_of_milk: Number(row.allow_choice_of_milk) === 1,
        allow_sparkling_mixer: Number(row.allow_sparkling_mixer) === 1,
        is_available: Number(row.is_available) === 1
      });
    }

    return {
      store_id: storeId,
      store_name: storeName,
      customizations,
      beans: customizations.find((group) => group.type === 'bean')?.options ?? [], // backward compatibility
      categories: Array.from(categoriesMap.values())
    };
  });

  app.patch('/v1/barista/menu/items/:itemId/availability', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaMenuAccess(request);
    const params = z.object({ itemId: z.coerce.number().int().positive() }).parse(request.params);
    const payload = itemAvailabilitySchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);

    const [ownedItems] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT i.id
         FROM menu_items i
         JOIN menu_item_tenants tenant_item
           ON tenant_item.menu_item_id = i.id AND tenant_item.tenant_id = :tenantId
        WHERE i.id = :itemId AND i.is_active = 1
        LIMIT 1`,
      { itemId: params.itemId, tenantId: request.adminAuth.tenantId }
    );
    if (!ownedItems[0]) {
      throw new ApiError(404, 'menu_item_not_found', 'Menu item not found.');
    }

    await mysqlPool.query(
      `INSERT INTO menu_item_store_availability (store_id, menu_item_id, is_available)
       VALUES (:storeId, :itemId, :isAvailable)
       ON DUPLICATE KEY UPDATE is_available = :isAvailable`,
      { storeId, itemId: params.itemId, isAvailable: payload.is_available ? 1 : 0 }
    );

    return {
      success: true,
      menu_item_id: params.itemId,
      is_available: payload.is_available
    };
  });

  app.patch('/v1/barista/menu/customizations/availability', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaMenuAccess(request);
    await ensureStoreCustomizationTable();
    const payload = customizationAvailabilitySchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);

    const normalizedValue = normalizeCustomizationValue(payload.value);

    await mysqlPool.query(
      `INSERT INTO store_customization_availability (store_id, customization_type, customization_value, is_available)
       VALUES (:storeId, :type, :value, :isAvailable)
       ON DUPLICATE KEY UPDATE is_available = :isAvailable`,
      {
        storeId,
        type: payload.type,
        value: normalizedValue,
        isAvailable: payload.is_available ? 1 : 0
      }
    );

    return {
      success: true,
      type: payload.type,
      value: normalizedValue,
      is_available: payload.is_available
    };
  });

  // Backward-compatible bean route
  app.patch('/v1/barista/menu/beans/availability', { preHandler: authenticateAdminRequest }, async (request) => {
    requireBaristaMenuAccess(request);
    await ensureStoreCustomizationTable();
    const payload = legacyBeanAvailabilitySchema.parse(request.body);
    const storeId = await resolveAttendanceStoreId(request);

    const normalizedBean = normalizeCustomizationValue(payload.bean);

    await mysqlPool.query(
      `INSERT INTO store_customization_availability (store_id, customization_type, customization_value, is_available)
       VALUES (:storeId, 'bean', :bean, :isAvailable)
       ON DUPLICATE KEY UPDATE is_available = :isAvailable`,
      { storeId, bean: normalizedBean, isAvailable: payload.is_available ? 1 : 0 }
    );

    return {
      success: true,
      bean: normalizedBean,
      is_available: payload.is_available
    };
  });
}
