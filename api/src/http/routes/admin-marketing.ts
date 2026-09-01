import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const bannerTypeSchema = z.enum(['voucher', 'event', 'new_item', 'general']);
const destinationTypeSchema = z.enum(['reward_section', 'menu', 'calendar']);
const placementSchema = z.enum(['home', 'profile', 'both']);

const bannerCreateSchema = z.object({
  title: z.string().trim().min(1).max(255),
  subtitle: z.string().trim().min(1).max(512),
  imageSource: z.string().trim().min(1).max(512),
  bannerType: bannerTypeSchema,
  destinationType: destinationTypeSchema.optional().default('menu'),
  secondaryDestinationType: destinationTypeSchema.nullable().optional().default(null),
  targetValue: z.string().trim().max(120).nullable().optional().default(null),
  startsAt: z.string().trim().nullable().optional().default(null),
  endsAt: z.string().trim().nullable().optional().default(null),
  placement: placementSchema.optional().default('both'),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  floatingPriority: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true)
});

const bannerUpdateSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  subtitle: z.string().trim().min(1).max(512).optional(),
  imageSource: z.string().trim().min(1).max(512).optional(),
  bannerType: bannerTypeSchema.optional(),
  destinationType: destinationTypeSchema.optional(),
  secondaryDestinationType: destinationTypeSchema.nullable().optional(),
  targetValue: z.string().trim().max(120).nullable().optional(),
  startsAt: z.string().trim().nullable().optional(),
  endsAt: z.string().trim().nullable().optional(),
  placement: placementSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  floatingPriority: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional()
});

type BannerRow = RowDataPacket & {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  image_source: string;
  banner_type: string;
  destination_type: string;
  secondary_destination_type: string | null;
  target_value: string | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  placement: 'home' | 'profile' | 'both';
  sort_order: number;
  floating_priority: number;
  is_active: number;
  created_at: Date | string;
  updated_at: Date | string;
  menu_item_name: string | null;
  voucher_name: string | null;
};

type DestinationType = 'reward_section' | 'menu' | 'calendar';

let homeBannerColumnsPromise: Promise<Set<string>> | null = null;

async function getHomeBannerColumns(): Promise<Set<string>> {
  if (!homeBannerColumnsPromise) {
    homeBannerColumnsPromise = mysqlPool
      .query<Array<RowDataPacket>>('SHOW COLUMNS FROM home_banners')
      .then(([rows]) => new Set(rows.map((row) => String((row as { Field?: string }).Field ?? '').trim()).filter(Boolean)));
  }

  return homeBannerColumnsPromise;
}

function supportsHomeBannerTargeting(columns: Set<string>): boolean {
  return [
    'banner_type',
    'destination_type',
    'secondary_destination_type',
    'target_value',
    'starts_at',
    'ends_at'
  ].every((column) => columns.has(column));
}

function supportsHomeBannerFloatingPriority(columns: Set<string>): boolean {
  return columns.has('floating_priority');
}

function buildHomeBannerSelectClause(columns: Set<string>): string {
  const selects = [
    'hb.id',
    'hb.code',
    'hb.title',
    'hb.subtitle',
    'hb.image_source'
  ];

  if (supportsHomeBannerTargeting(columns)) {
    selects.push(
      'hb.banner_type',
      'hb.destination_type',
      'hb.secondary_destination_type',
      'hb.target_value',
      'hb.starts_at',
      'hb.ends_at'
    );
  } else {
    selects.push(
      "'general' AS banner_type",
      "'menu' AS destination_type",
      'NULL AS secondary_destination_type',
      'NULL AS target_value',
      'NULL AS starts_at',
      'NULL AS ends_at'
    );
  }

  selects.push(
    'hb.placement',
    'hb.sort_order',
    supportsHomeBannerFloatingPriority(columns)
      ? 'hb.floating_priority'
      : '0 AS floating_priority',
    'hb.is_active',
    'hb.created_at',
    'hb.updated_at'
  );

  if (supportsHomeBannerTargeting(columns)) {
    selects.push(
      'mi.name AS menu_item_name',
      'vt.name AS voucher_name'
    );
  } else {
    selects.push(
      'NULL AS menu_item_name',
      'NULL AS voucher_name'
    );
  }

  return selects.join(',\n          ');
}

function buildHomeBannerInsertParts(columns: Set<string>): { columns: string[]; values: string[] } {
  const insertColumns = ['code', 'title', 'subtitle', 'image_source'];
  const insertValues = [':code', ':title', ':subtitle', ':imageSource'];

  if (supportsHomeBannerTargeting(columns)) {
    insertColumns.push(
      'banner_type',
      'destination_type',
      'secondary_destination_type',
      'target_value',
      'starts_at',
      'ends_at'
    );
    insertValues.push(
      ':bannerType',
      ':destinationType',
      ':secondaryDestinationType',
      ':targetValue',
      ':startsAt',
      ':endsAt'
    );
  }

  if (supportsHomeBannerFloatingPriority(columns)) {
    insertColumns.push('floating_priority');
    insertValues.push(':floatingPriority');
  }

  insertColumns.push('placement', 'sort_order', 'is_active', 'created_at', 'updated_at');
  insertValues.push(':placement', ':sortOrder', ':isActive', 'UTC_TIMESTAMP()', 'UTC_TIMESTAMP()');

  return {
    columns: insertColumns,
    values: insertValues
  };
}

function buildHomeBannerUpdateFields(columns: Set<string>): string[] {
  const fields = ['title = :title', 'subtitle = :subtitle', 'image_source = :imageSource', 'placement = :placement', 'sort_order = :sortOrder'];

  if (supportsHomeBannerTargeting(columns)) {
    fields.splice(3, 0,
      'banner_type = :bannerType',
      'destination_type = :destinationType',
      'secondary_destination_type = :secondaryDestinationType',
      'target_value = :targetValue',
      'starts_at = :startsAt',
      'ends_at = :endsAt'
    );
  }

  if (supportsHomeBannerFloatingPriority(columns)) {
    fields.push('floating_priority = :floatingPriority');
  }

  fields.push('is_active = :isActive');
  fields.push('updated_at = UTC_TIMESTAMP()');
  return fields;
}

async function getNextHomeBannerSortOrder(): Promise<number> {
  const [rows] = await mysqlPool.query<Array<RowDataPacket & { max_sort_order: number | null }>>(
    `
      SELECT COALESCE(MAX(sort_order), 0) + 10 AS max_sort_order
      FROM home_banners
    `
  );

  return Number(rows[0]?.max_sort_order ?? 10) || 10;
}

function requireMarketingAccess(request: { adminAuth?: { roles: string[] } }): void {
  const roles = request.adminAuth?.roles || [];
  if (!roles.includes('super_admin') && !roles.includes('marketing_admin')) {
    throw new ApiError(403, 'admin_forbidden', 'You do not have permission to perform this action.');
  }
}

function toUtcDateTimeString(input: string | Date | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function formatDestinationLabel(destinationType: string): string {
  switch (destinationType as DestinationType) {
    case 'reward_section':
      return 'Reward section';
    case 'calendar':
      return 'Calendar';
    case 'menu':
    default:
      return 'Menu';
  }
}

function formatBannerStatus(row: BannerRow): string {
  if (row.is_active !== 1) {
    return 'Inactive';
  }

  if (row.banner_type !== 'event' || !row.starts_at || !row.ends_at) {
    return 'Active';
  }

  const now = Date.now();
  const startsAt = new Date(row.starts_at).getTime();
  const endsAt = new Date(row.ends_at).getTime();

  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) {
    return 'Active';
  }
  if (now < startsAt) {
    return 'Scheduled';
  }
  if (now > endsAt) {
    return 'Ended';
  }

  return 'Live';
}

function formatDateTimeLabel(value: Date | string | null): string {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function buildBannerCode(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'banner';
  return `banner-${slug}-${randomUUID().slice(0, 8)}`;
}

function normalizeRequestBody(body: z.infer<typeof bannerCreateSchema> | z.infer<typeof bannerUpdateSchema>) {
  const bannerType = body.bannerType ?? 'general';
  const isEvent = bannerType === 'event' || body.destinationType === 'calendar';
  const normalizedBannerType = isEvent ? 'event' : bannerType;
  const isVoucher = bannerType === 'voucher';
  const isNewItem = bannerType === 'new_item';

  const destinationType = isEvent
    ? 'calendar'
    : isNewItem
      ? 'menu'
      : (body.destinationType ?? 'menu');

  const secondaryDestinationType = isEvent ? 'menu' : null;

  const targetValue = isVoucher || isNewItem ? String(body.targetValue ?? '').trim() : null;
  const startsAt = isEvent ? toUtcDateTimeString(body.startsAt ?? null) : null;
  const endsAt = isEvent ? toUtcDateTimeString(body.endsAt ?? null) : null;

  return {
    bannerType: normalizedBannerType,
    destinationType,
    secondaryDestinationType,
    targetValue: targetValue || null,
    startsAt,
    endsAt,
    placement: body.placement ?? 'both',
    sortOrder: body.sortOrder ?? null,
    floatingPriority: body.floatingPriority ?? null,
    isActive: body.isActive ?? true
  };
}

export async function registerAdminMarketingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/marketing/banners', { preHandler: authenticateAdminRequest }, async (request) => {
    requireMarketingAccess(request);

    const query = typeof request.query === 'object' && request.query !== null
      ? (request.query as {
          search?: string;
          banner_type?: string;
          placement?: string;
          is_active?: string;
        })
      : {};

    const searchTerm = String(query.search ?? '').trim().toLowerCase();
    const bannerType = String(query.banner_type ?? '').trim().toLowerCase();
    const placement = String(query.placement ?? '').trim().toLowerCase();
    const isActive = String(query.is_active ?? '').trim();
    const columns = await getHomeBannerColumns();
    const supportsTargeting = supportsHomeBannerTargeting(columns);

    if (supportsTargeting) {
      await mysqlPool.execute(
        `
          UPDATE home_banners
          SET is_active = 0,
              updated_at = UTC_TIMESTAMP()
          WHERE banner_type = 'event'
            AND is_active = 1
            AND ends_at IS NOT NULL
            AND ends_at <= UTC_TIMESTAMP()
        `
      );
    }

    const selectClause = buildHomeBannerSelectClause(columns);
    const joinClause = supportsTargeting
      ? `
        LEFT JOIN menu_items mi
          ON hb.banner_type = 'new_item'
         AND mi.code = hb.target_value
        LEFT JOIN voucher_templates vt
          ON hb.banner_type = 'voucher'
         AND vt.code = hb.target_value
      `
      : `
        LEFT JOIN menu_items mi
          ON 1 = 0
        LEFT JOIN voucher_templates vt
          ON 1 = 0
      `;

    const [rows] = await mysqlPool.query<Array<BannerRow>>(
      `
        SELECT
          ${selectClause}
        FROM home_banners hb
        ${joinClause}
        ORDER BY hb.floating_priority DESC, hb.sort_order ASC, hb.id ASC
      `
    );

    const banners = rows.map((row) => ({
      id: row.id,
      code: row.code,
      title: row.title,
      subtitle: row.subtitle,
      imageSource: row.image_source,
      bannerType: row.banner_type,
      destinationType: row.destination_type,
      secondaryDestinationType: row.secondary_destination_type,
        targetValue: row.target_value || '',
        targetLabel: row.banner_type === 'new_item'
          ? row.menu_item_name || row.target_value || ''
          : row.banner_type === 'voucher'
            ? row.voucher_name || row.target_value || ''
          : row.target_value || '',
      startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
      endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
      scheduleLabel: row.banner_type === 'event'
        ? `${formatDateTimeLabel(row.starts_at)}${row.starts_at && row.ends_at ? ' - ' : ''}${formatDateTimeLabel(row.ends_at)}`
        : '',
        placement: row.placement,
        sortOrder: row.sort_order,
        floatingPriority: row.floating_priority === 1,
        status: formatBannerStatus(row),
        isActive: row.is_active === 1,
        destinationLabel: formatDestinationLabel(row.destination_type),
        secondaryDestinationLabel: row.secondary_destination_type ? formatDestinationLabel(row.secondary_destination_type) : '',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
    })).filter((banner) => {
      const matchesSearch = !searchTerm
        || String(banner.code ?? '').toLowerCase().includes(searchTerm)
        || String(banner.title ?? '').toLowerCase().includes(searchTerm)
        || String(banner.subtitle ?? '').toLowerCase().includes(searchTerm)
        || String(banner.targetValue ?? '').toLowerCase().includes(searchTerm)
        || String(banner.targetLabel ?? '').toLowerCase().includes(searchTerm);
      const matchesType = !bannerType || String(banner.bannerType ?? '').toLowerCase() === bannerType;
      const matchesPlacement = !placement || String(banner.placement ?? '').toLowerCase() === placement;
      const matchesActive = !isActive
        || (isActive === '1' && banner.isActive)
        || (isActive === '0' && !banner.isActive);
      return matchesSearch && matchesType && matchesPlacement && matchesActive;
    });

    return { banners };
  });

  app.post('/v1/admin/marketing/banners', { preHandler: authenticateAdminRequest }, async (request) => {
    requireMarketingAccess(request);
    const payload = bannerCreateSchema.parse(request.body);
    const normalized = normalizeRequestBody(payload);
    const columns = await getHomeBannerColumns();
    const supportsTargeting = supportsHomeBannerTargeting(columns);
    const selectClause = buildHomeBannerSelectClause(columns);
    const joinClause = supportsTargeting
      ? `
        LEFT JOIN menu_items mi
          ON hb.banner_type = 'new_item'
         AND mi.code = hb.target_value
        LEFT JOIN voucher_templates vt
          ON hb.banner_type = 'voucher'
         AND vt.code = hb.target_value
      `
      : `
        LEFT JOIN menu_items mi
          ON 1 = 0
        LEFT JOIN voucher_templates vt
          ON 1 = 0
      `;

    if (!supportsTargeting && (payload.bannerType !== 'general' || payload.destinationType === 'calendar')) {
      throw new ApiError(412, 'poster_targeting_unavailable', 'Poster targeting fields are not installed in the database yet.');
    }

    if (payload.floatingPriority === true && !supportsHomeBannerFloatingPriority(columns)) {
      throw new ApiError(412, 'poster_priority_unavailable', 'Poster priority is not installed in the database yet.');
    }

    if ((payload.bannerType === 'voucher' || payload.bannerType === 'new_item') && !normalized.targetValue) {
      throw new ApiError(400, 'missing_target', 'Target value is required for this poster type.');
    }

    if ((payload.bannerType === 'event' || payload.destinationType === 'calendar') && (!normalized.startsAt || !normalized.endsAt)) {
      throw new ApiError(400, 'missing_schedule', 'Event posters require a start and end date.');
    }

    if (normalized.startsAt && normalized.endsAt && new Date(normalized.endsAt).getTime() <= new Date(normalized.startsAt).getTime()) {
      throw new ApiError(400, 'invalid_schedule', 'Event end time must be after the start time.');
    }

    const code = buildBannerCode(payload.title);
    const sortOrder = normalized.sortOrder ?? await getNextHomeBannerSortOrder();

    const insertParts = buildHomeBannerInsertParts(columns);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `
        INSERT INTO home_banners (
          ${insertParts.columns.join(', ')}
        )
        VALUES (
          ${insertParts.values.join(', ')}
        )
      `,
      {
        code,
        title: payload.title,
        subtitle: payload.subtitle,
        imageSource: payload.imageSource,
        bannerType: normalized.bannerType,
        destinationType: normalized.destinationType,
        secondaryDestinationType: normalized.secondaryDestinationType,
        targetValue: normalized.targetValue,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        placement: normalized.placement,
        sortOrder,
        floatingPriority: normalized.floatingPriority ? 1 : 0,
        isActive: normalized.isActive ? 1 : 0
      }
    );

    const [rows] = await mysqlPool.query<Array<BannerRow>>(
      `
        SELECT
          ${selectClause}
        FROM home_banners hb
        ${joinClause}
        WHERE hb.id = :id
        LIMIT 1
      `,
      { id: result.insertId }
    );

    const created = rows[0];
    if (!created) {
      throw new ApiError(500, 'banner_create_failed', 'Banner was created but could not be loaded.');
    }

    return {
      banner: {
        id: created.id,
        code: created.code,
        title: created.title,
        subtitle: created.subtitle,
        imageSource: created.image_source,
        bannerType: created.banner_type,
        destinationType: created.destination_type,
        secondaryDestinationType: created.secondary_destination_type,
        targetValue: created.target_value || '',
        targetLabel: created.banner_type === 'new_item'
          ? created.menu_item_name || created.target_value || ''
          : created.banner_type === 'voucher'
            ? created.voucher_name || created.target_value || ''
            : created.target_value || '',
        startsAt: created.starts_at ? new Date(created.starts_at).toISOString() : null,
        endsAt: created.ends_at ? new Date(created.ends_at).toISOString() : null,
        placement: created.placement,
        sortOrder: created.sort_order,
        floatingPriority: created.floating_priority === 1,
        status: formatBannerStatus(created),
        isActive: created.is_active === 1,
        destinationLabel: formatDestinationLabel(created.destination_type),
        secondaryDestinationLabel: created.secondary_destination_type ? formatDestinationLabel(created.secondary_destination_type) : '',
        createdAt: created.created_at ? new Date(created.created_at).toISOString() : null,
        updatedAt: created.updated_at ? new Date(created.updated_at).toISOString() : null
      }
    };
  });

  app.patch('/v1/admin/marketing/banners/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireMarketingAccess(request);
    const bannerId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
    const payload = bannerUpdateSchema.parse(request.body);
    const normalized = normalizeRequestBody(payload);
    const columns = await getHomeBannerColumns();
    const supportsTargeting = supportsHomeBannerTargeting(columns);

    if (!supportsTargeting && ((payload.bannerType !== undefined && payload.bannerType !== 'general') || payload.destinationType === 'calendar')) {
      throw new ApiError(412, 'poster_targeting_unavailable', 'Poster targeting fields are not installed in the database yet.');
    }

    if (payload.floatingPriority === true && !supportsHomeBannerFloatingPriority(columns)) {
      throw new ApiError(412, 'poster_priority_unavailable', 'Poster priority is not installed in the database yet.');
    }

    const [existingRows] = await mysqlPool.query<Array<RowDataPacket & { id: number; banner_type: string }>>(
      `
        SELECT id, banner_type
        FROM home_banners
        WHERE id = :bannerId
        LIMIT 1
      `,
      { bannerId }
    );
    if (!existingRows[0]) {
      throw new ApiError(404, 'banner_not_found', 'Poster was not found.');
    }

    const updateFields: string[] = [];
    const params: Record<string, unknown> = { bannerId };

    if (payload.title !== undefined) {
      updateFields.push('title = :title');
      params.title = payload.title;
    }
    if (payload.subtitle !== undefined) {
      updateFields.push('subtitle = :subtitle');
      params.subtitle = payload.subtitle;
    }
    if (payload.imageSource !== undefined) {
      updateFields.push('image_source = :imageSource');
      params.imageSource = payload.imageSource;
    }
    if (payload.bannerType !== undefined || payload.destinationType === 'calendar') {
      if (supportsTargeting) {
        updateFields.push('banner_type = :bannerType');
      }
      params.bannerType = normalized.bannerType;
    }
    if (payload.destinationType !== undefined || payload.bannerType !== undefined) {
      if (supportsTargeting) {
        updateFields.push('destination_type = :destinationType');
      }
      params.destinationType = normalized.destinationType;
    }
    if (payload.secondaryDestinationType !== undefined || payload.bannerType !== undefined) {
      if (supportsTargeting) {
        updateFields.push('secondary_destination_type = :secondaryDestinationType');
      }
      params.secondaryDestinationType = normalized.secondaryDestinationType;
    }
    if (payload.targetValue !== undefined || payload.bannerType !== undefined || payload.destinationType === 'calendar') {
      if (supportsTargeting) {
        updateFields.push('target_value = :targetValue');
      }
      params.targetValue = normalized.targetValue;
    }
    if (payload.startsAt !== undefined || payload.bannerType !== undefined || payload.destinationType === 'calendar') {
      if (supportsTargeting) {
        updateFields.push('starts_at = :startsAt');
      }
      params.startsAt = normalized.startsAt;
    }
    if (payload.endsAt !== undefined || payload.bannerType !== undefined || payload.destinationType === 'calendar') {
      if (supportsTargeting) {
        updateFields.push('ends_at = :endsAt');
      }
      params.endsAt = normalized.endsAt;
    }
    if (payload.placement !== undefined) {
      updateFields.push('placement = :placement');
      params.placement = normalized.placement;
    }
    if (payload.sortOrder !== undefined) {
      updateFields.push('sort_order = :sortOrder');
      params.sortOrder = normalized.sortOrder;
    }
    if (payload.isActive !== undefined) {
      updateFields.push('is_active = :isActive');
      params.isActive = normalized.isActive ? 1 : 0;
    }
    if (payload.floatingPriority !== undefined) {
      if (supportsHomeBannerFloatingPriority(columns)) {
        updateFields.push('floating_priority = :floatingPriority');
      }
      params.floatingPriority = payload.floatingPriority ? 1 : 0;
    }

    if (updateFields.length === 0) {
      return { bannerId };
    }

    updateFields.push('updated_at = UTC_TIMESTAMP()');

    await mysqlPool.execute(
      `
        UPDATE home_banners
        SET ${updateFields.join(', ')}
        WHERE id = :bannerId
      `,
      params as any
    );

    return { bannerId };
  });

  app.delete('/v1/admin/marketing/banners/:id', { preHandler: authenticateAdminRequest }, async (request) => {
    requireMarketingAccess(request);
    const bannerId = z.coerce.number().int().positive().parse((request.params as { id: string }).id);

    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `
        DELETE FROM home_banners
        WHERE id = :bannerId
      `,
      { bannerId }
    );

    if (result.affectedRows === 0) {
      throw new ApiError(404, 'banner_not_found', 'Poster was not found.');
    }

    return { ok: true };
  });
}
