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
  muted_text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six-digit hex colour.').optional()
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
    return { appearance: normalizeAppearance(rows[0]) };
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
    const [rows] = await mysqlPool.query<AppearanceRow[]>(
      `SELECT primary_color, secondary_color, text_color, background_color, muted_text_color
       FROM admin_tenants WHERE id = :tenantId LIMIT 1`,
      { tenantId: request.adminAuth.tenantId }
    );
    return { appearance: normalizeAppearance(rows[0]) };
  });
}
