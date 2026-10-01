import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { authenticateAdminRequest, requireAnyAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const updateStoreSchema = z.object({
  name: z.string().trim().min(2).max(120)
});

const updateAppearanceSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.').optional(),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.').optional(),
  text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.').optional(),
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.').optional(),
  muted_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.').optional(),
  tier_appearances: z.array(z.object({
    tier_id: z.coerce.number().int().positive(),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.'),
    secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.'),
    text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.'),
    background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.'),
    muted_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.')
  })).max(50).optional()
}).refine((value) => Object.values(value).some(Boolean), {
  message: 'Choose at least one colour to update.'
});

type StoreRow = RowDataPacket & {
  id: number;
  name: string;
  pickup_lead_minutes: number;
};

type AppearanceRow = RowDataPacket & {
  primary_color: string | null;
  secondary_color: string | null;
  text_color: string | null;
  background_color: string | null;
  muted_text_color: string | null;
};

type TierAppearanceRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  min_cups: number | string;
  sort_order: number | string;
  primary_color: string | null;
  secondary_color: string | null;
  text_color: string | null;
  background_color: string | null;
  muted_text_color: string | null;
};

const defaultAppearance = {
  primary_color: '#2E5E58',
  secondary_color: '#D4AF7A',
  text_color: '#2C2C2C',
  background_color: '#FFFFFF',
  muted_text_color: '#6B7280'
};

function normalizeAppearance(row?: Partial<AppearanceRow>): typeof defaultAppearance {
  return {
    primary_color: row?.primary_color ?? defaultAppearance.primary_color,
    secondary_color: row?.secondary_color ?? defaultAppearance.secondary_color,
    text_color: row?.text_color ?? defaultAppearance.text_color,
    background_color: row?.background_color ?? defaultAppearance.background_color,
    muted_text_color: row?.muted_text_color ?? defaultAppearance.muted_text_color
  };
}

function contrastRatio(first: string, second: string): number {
  const toLuminance = (color: string): number => {
    const channels = color.slice(1).match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16) / 255);
    const linear = channels.map((channel) => channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [lighter, darker] = [toLuminance(first), toLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function requireAccessibleText(appearance: typeof defaultAppearance): void {
  for (const [label, value] of [
    ['Text colour', appearance.text_color],
    ['Muted text colour', appearance.muted_text_color]
  ] as const) {
    if (contrastRatio(value, appearance.background_color) < 4.5) {
      throw new ApiError(400, 'appearance_contrast_too_low', `${label} must have at least 4.5:1 contrast against the background colour.`);
    }
  }
}

function normalizeTierAppearance(row: TierAppearanceRow, fallback: typeof defaultAppearance) {
  return {
    tier_id: row.id,
    code: row.code,
    name: row.name,
    min_cups: Number(row.min_cups ?? 0),
    sort_order: Number(row.sort_order ?? 0),
    primary_color: row.primary_color ?? fallback.primary_color,
    secondary_color: row.secondary_color ?? fallback.secondary_color,
    text_color: row.text_color ?? fallback.text_color,
    background_color: row.background_color ?? fallback.background_color,
    muted_text_color: row.muted_text_color ?? fallback.muted_text_color
  };
}

async function loadTierAppearances(tenantId: number, fallback: typeof defaultAppearance) {
  const [rows] = await mysqlPool.query<TierAppearanceRow[]>(
    `SELECT lt.id, lt.code, lt.name, lt.min_cups, lt.sort_order,
            appearance.primary_color, appearance.secondary_color, appearance.text_color,
            appearance.background_color, appearance.muted_text_color
     FROM loyalty_tiers lt
     LEFT JOIN tenant_loyalty_tier_appearances appearance
       ON appearance.loyalty_tier_id = lt.id AND appearance.tenant_id = :tenantId
     WHERE lt.is_active = 1
     ORDER BY lt.min_cups ASC, lt.sort_order ASC, lt.id ASC`,
    { tenantId }
  );
  return rows.map((row) => normalizeTierAppearance(row, fallback));
}

async function getCustomerFacingStore(tenantId: number): Promise<StoreRow> {
  const [stores] = await mysqlPool.query<StoreRow[]>(
    `SELECT id, name, pickup_lead_minutes
     FROM stores
     WHERE tenant_id = :tenantId AND status = 'active' AND is_customer_facing = 1
     ORDER BY id ASC
     LIMIT 1`,
    { tenantId }
  );
  if (!stores[0]) {
    throw new ApiError(409, 'customer_store_not_configured', 'No customer-facing outlet is configured.');
  }
  return stores[0];
}

export async function registerAdminStoreRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/store', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    return { store: await getCustomerFacingStore(request.adminAuth.tenantId) };
  });

  app.patch('/v1/admin/store', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin', 'operations_admin']);
    const { name } = updateStoreSchema.parse(request.body);
    const store = await getCustomerFacingStore(request.adminAuth.tenantId);
    await mysqlPool.execute<ResultSetHeader>(
      'UPDATE stores SET name = :name, updated_at = UTC_TIMESTAMP() WHERE id = :storeId',
      { name, storeId: store.id }
    );
    return { store: { ...store, name } };
  });

  app.get('/v1/admin/appearance', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin']);
    const [rows] = await mysqlPool.query<AppearanceRow[]>(
      `SELECT primary_color, secondary_color, text_color, background_color, muted_text_color
       FROM admin_tenants WHERE id = :tenantId LIMIT 1`,
      { tenantId: request.adminAuth.tenantId }
    );
    const appearance = normalizeAppearance(rows[0]);
    return { appearance, tier_appearances: await loadTierAppearances(request.adminAuth.tenantId, appearance) };
  });

  app.patch('/v1/admin/appearance', { preHandler: authenticateAdminRequest }, async (request) => {
    requireAnyAdminRole(request, ['super_admin']);
    const update = updateAppearanceSchema.parse(request.body);
    const [existingRows] = await mysqlPool.query<AppearanceRow[]>(
      `SELECT primary_color, secondary_color, text_color, background_color, muted_text_color
       FROM admin_tenants WHERE id = :tenantId LIMIT 1`,
      { tenantId: request.adminAuth.tenantId }
    );
    const existing = existingRows[0];
    const appearance = {
      primary_color: update.primary_color?.toUpperCase() ?? existing?.primary_color ?? defaultAppearance.primary_color,
      secondary_color: update.secondary_color?.toUpperCase() ?? existing?.secondary_color ?? defaultAppearance.secondary_color,
      text_color: update.text_color?.toUpperCase() ?? existing?.text_color ?? defaultAppearance.text_color,
      background_color: update.background_color?.toUpperCase() ?? existing?.background_color ?? defaultAppearance.background_color,
      muted_text_color: update.muted_text_color?.toUpperCase() ?? existing?.muted_text_color ?? defaultAppearance.muted_text_color
    };
    requireAccessibleText(appearance);
    for (const tierAppearance of update.tier_appearances ?? []) {
      requireAccessibleText(tierAppearance);
    }
    await mysqlPool.execute<ResultSetHeader>(
      `UPDATE admin_tenants
       SET primary_color = COALESCE(:primaryColor, primary_color),
           secondary_color = COALESCE(:secondaryColor, secondary_color),
           text_color = COALESCE(:textColor, text_color),
           background_color = COALESCE(:backgroundColor, background_color),
           muted_text_color = COALESCE(:mutedTextColor, muted_text_color),
           updated_at = UTC_TIMESTAMP()
       WHERE id = :tenantId`,
      {
        primaryColor: update.primary_color?.toUpperCase() ?? null,
        secondaryColor: update.secondary_color?.toUpperCase() ?? null,
        textColor: update.text_color?.toUpperCase() ?? null,
        backgroundColor: update.background_color?.toUpperCase() ?? null,
        mutedTextColor: update.muted_text_color?.toUpperCase() ?? null,
        tenantId: request.adminAuth.tenantId
      }
    );
    if (update.tier_appearances?.length) {
      for (const tierAppearance of update.tier_appearances) {
        await mysqlPool.execute<ResultSetHeader>(
          `INSERT INTO tenant_loyalty_tier_appearances (
             tenant_id, loyalty_tier_id, primary_color, secondary_color,
             text_color, background_color, muted_text_color
           )
           SELECT :tenantId, id, :primaryColor, :secondaryColor,
                  :textColor, :backgroundColor, :mutedTextColor
           FROM loyalty_tiers
           WHERE id = :tierId AND is_active = 1
           ON DUPLICATE KEY UPDATE
             primary_color = VALUES(primary_color),
             secondary_color = VALUES(secondary_color),
             text_color = VALUES(text_color),
             background_color = VALUES(background_color),
             muted_text_color = VALUES(muted_text_color),
             updated_at = UTC_TIMESTAMP()`,
          {
            tierId: tierAppearance.tier_id,
            tenantId: request.adminAuth.tenantId,
            primaryColor: tierAppearance.primary_color.toUpperCase(),
            secondaryColor: tierAppearance.secondary_color.toUpperCase(),
            textColor: tierAppearance.text_color.toUpperCase(),
            backgroundColor: tierAppearance.background_color.toUpperCase(),
            mutedTextColor: tierAppearance.muted_text_color.toUpperCase()
          }
        );
      }
    }
    const [rows] = await mysqlPool.query<AppearanceRow[]>(
      `SELECT primary_color, secondary_color, text_color, background_color, muted_text_color
       FROM admin_tenants WHERE id = :tenantId LIMIT 1`,
      { tenantId: request.adminAuth.tenantId }
    );
    const savedAppearance = normalizeAppearance(rows[0]);
    return {
      appearance: savedAppearance,
      tier_appearances: await loadTierAppearances(request.adminAuth.tenantId, savedAppearance)
    };
  });
}
