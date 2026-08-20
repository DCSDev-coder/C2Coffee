import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest, requireAdminRole } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const voucherCreateUpdateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(255),
  type: z.string(),
  tier: z.string(),
  reward: z.string().trim().max(255).optional(),
  discountValue: z.union([z.string(), z.number()]).optional(),
  eligibleItems: z.array(z.string()),
  expiry: z.string(),
  totalQty: z.number().int().nullable().optional(),
  limitPerUser: z.number().int().nullable().optional(),
  description: z.string().optional()
});

type VoucherPayload = z.infer<typeof voucherCreateUpdateSchema>;

type VoucherTemplateRow = RowDataPacket & {
  id: number;
  code: string;
  name: string;
  voucher_type: string;
  discount_mode: string;
  discount_value: string | number;
  token_value: number | null;
  min_spend_rm: string | number | null;
  eligible_scope_json: string | Record<string, unknown>;
  exclude_scope_json: string | null;
  requires_drink_in_cart: number;
  stack_rule: string;
  expires_in_days: number | null;
  valid_until?: string | Date | null;
  total_quantity?: number | null;
  limit_per_user?: number | null;
  is_active: number;
  created_at: string | Date;
  updated_at: string | Date;
  issued_count?: number;
  redeemed_count?: number;
};

let voucherTemplateColumnsPromise: Promise<Set<string>> | null = null;

async function getVoucherTemplateColumns(): Promise<Set<string>> {
  if (!voucherTemplateColumnsPromise) {
    voucherTemplateColumnsPromise = mysqlPool
      .query<Array<RowDataPacket>>('SHOW COLUMNS FROM voucher_templates')
      .then(([rows]) => new Set(rows.map((row) => String((row as { Field?: string }).Field ?? '').trim()).filter(Boolean)));
  }

  return voucherTemplateColumnsPromise;
}

function hasColumn(columns: Set<string>, column: string): boolean {
  return columns.has(column);
}

function parseScopeJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return {};
}

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(base: Date, days: number): Date {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function deriveReward(payload: VoucherPayload): string {
  const explicitReward = payload.reward?.trim();
  if (explicitReward) return explicitReward;

  const firstItem = payload.eligibleItems[0]?.trim();

  if (payload.type === 'Free Drink') {
    return firstItem ? `Free ${firstItem}` : 'Free Drink';
  }

  if (payload.type === 'Free Food') {
    return firstItem ? `Free ${firstItem}` : 'Free Food';
  }

  if (payload.type === 'Percentage Off') {
    return `${Number(payload.discountValue) || 0}% Discount`;
  }

  if (payload.type === 'Token Discount') {
    return `${Number(payload.discountValue) || 0} Tokens Off`;
  }

  if (payload.type === 'Birthday Voucher') {
    return 'Birthday Treat';
  }

  return payload.name;
}

function getVoucherExpiryDate(scope: Record<string, unknown>, row: VoucherTemplateRow): Date | null {
  const scopeExpiry = parseDateValue(scope.expiry_string);
  if (scopeExpiry) return scopeExpiry;

  const validUntil = parseDateValue(row.valid_until);
  if (validUntil) return validUntil;

  if (typeof row.expires_in_days === 'number' && row.created_at) {
    const createdAt = parseDateValue(row.created_at);
    if (createdAt) {
      return addDays(createdAt, row.expires_in_days);
    }
  }

  return null;
}

function getVoucherStatus(row: VoucherTemplateRow, expiryDate: Date | null): string {
  if (!row.is_active) return 'Draft';
  if (expiryDate && expiryDate.getTime() < Date.now()) return 'Expired';
  return 'Active';
}

function buildVoucherWriteBindings(
  columns: Set<string>,
  payload: VoucherPayload,
  scopeJson: string,
  discountMode: string,
  voucherType: string,
  discountValue: number,
  tokenValue: number | null
): { columns: string[]; placeholders: string[]; values: Record<string, unknown> } {
  const columnsToWrite = [
    'code',
    'name',
    'voucher_type',
    'discount_mode',
    'discount_value',
    'token_value',
    'eligible_scope_json',
    'is_active'
  ];
  const placeholders = [
    ':code',
    ':name',
    ':voucherType',
    ':discountMode',
    ':discountValue',
    ':tokenValue',
    ':scopeJson',
    '1'
  ];

  const values: Record<string, unknown> = {
    code: payload.code,
    name: payload.name,
    voucherType,
    discountMode,
    discountValue,
    tokenValue,
    scopeJson
  };

  if (hasColumn(columns, 'expires_in_days')) {
    columnsToWrite.push('expires_in_days');
    placeholders.push(':expiresInDays');
    values.expiresInDays = null;
  }

  if (hasColumn(columns, 'valid_until')) {
    columnsToWrite.push('valid_until');
    placeholders.push(':validUntil');
    values.validUntil = null;
  }

  if (hasColumn(columns, 'total_quantity')) {
    columnsToWrite.push('total_quantity');
    placeholders.push(':totalQty');
    values.totalQty = payload.totalQty ?? null;
  }

  if (hasColumn(columns, 'limit_per_user')) {
    columnsToWrite.push('limit_per_user');
    placeholders.push(':limitPerUser');
    values.limitPerUser = payload.limitPerUser ?? 1;
  }

  return { columns: columnsToWrite, placeholders, values };
}

export async function registerAdminVoucherRoutes(app: FastifyInstance): Promise<void> {
  // GET /v1/admin/vouchers
  app.get('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const voucherColumns = await getVoucherTemplateColumns();
    const selectColumns = [
      'vt.id',
      'vt.code',
      'vt.name',
      'vt.voucher_type',
      'vt.discount_mode',
      'vt.discount_value',
      'vt.token_value',
      'vt.min_spend_rm',
      'vt.eligible_scope_json',
      'vt.expires_in_days',
      'vt.is_active',
      'vt.created_at'
    ];

    if (hasColumn(voucherColumns, 'valid_until')) {
      selectColumns.push('vt.valid_until');
    }
    if (hasColumn(voucherColumns, 'total_quantity')) {
      selectColumns.push('vt.total_quantity');
    }
    if (hasColumn(voucherColumns, 'limit_per_user')) {
      selectColumns.push('vt.limit_per_user');
    }

    const [rows] = await mysqlPool.query<Array<RowDataPacket>>(
      `
        SELECT
          ${selectColumns.join(',\n          ')},
          (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id) as issued_count,
          (SELECT COUNT(*) FROM user_vouchers uv WHERE uv.voucher_template_id = vt.id AND uv.status = 'redeemed') as redeemed_count
        FROM voucher_templates vt
        ORDER BY vt.created_at DESC
      `
    );

    const vouchers = rows.map((row) => {
      const templateRow = row as VoucherTemplateRow;
      const scope = parseScopeJson(templateRow.eligible_scope_json);
      const type = String(scope.frontend_type || templateRow.voucher_type || 'Percentage Off');
      const expiryDate = getVoucherExpiryDate(scope, templateRow);
      const createdDate = parseDateValue(templateRow.created_at);
      const issuedCount = Number(templateRow.issued_count || 0);
      const redeemedCount = Number(templateRow.redeemed_count || 0);

      return {
        id: templateRow.code,
        db_id: templateRow.id,
        name: templateRow.name,
        type: type,
        tier: String(scope.tier || 'All Tiers'),
        reward: String(scope.reward || templateRow.name || ''),
        discountValue: templateRow.discount_mode === 'fixed_token' ? templateRow.token_value : templateRow.discount_value,
        eligibleItems: Array.isArray(scope.items) && scope.items.length > 0 ? scope.items : ['All Items'],
        expiry: expiryDate ? expiryDate.toISOString() : String(scope.expiry_string || ''),
        expiryFull: expiryDate
          ? expiryDate.toLocaleString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: 'numeric',
              minute: 'numeric',
              hour12: true
            })
          : String(scope.expiry_string || ''),
        totalQty: hasColumn(voucherColumns, 'total_quantity') ? (templateRow.total_quantity ?? null) : null,
        limitPerUser: hasColumn(voucherColumns, 'limit_per_user') ? (templateRow.limit_per_user ?? 1) : 1,
        description: String(scope.description || ''),
        status: getVoucherStatus(templateRow, expiryDate),
        issued: issuedCount,
        redeemed: redeemedCount,
        rate: issuedCount > 0 ? `${Math.round((redeemedCount / issuedCount) * 100)}%` : '0%',
        created: createdDate
          ? createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : ''
      };
    });

    return { vouchers };
  });

  // POST /v1/admin/vouchers
  app.post('/v1/admin/vouchers', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherCreateUpdateSchema.parse(request.body);
    const voucherColumns = await getVoucherTemplateColumns();
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue = null;

    if (payload.type === 'Free Drink' || payload.type === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
    } else if (payload.type === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    }

    const derivedReward = deriveReward(payload);
    const scopeJson = JSON.stringify({
      frontend_type: payload.type,
      tier: payload.tier,
      reward: derivedReward,
      items: payload.eligibleItems,
      description: payload.description,
      expiry_string: payload.expiry
    });
    const writeBindings = buildVoucherWriteBindings(
      voucherColumns,
      payload,
      scopeJson,
      discountMode,
      voucherType,
      discountValue,
      tokenValue
    );

    const [result] = await mysqlPool.query<ResultSetHeader>(
      `
        INSERT INTO voucher_templates (
          ${writeBindings.columns.join(', ')}
        ) VALUES (
          ${writeBindings.placeholders.join(', ')}
        )
      `,
      writeBindings.values as never
    );

    return { id: payload.code, db_id: result.insertId };
  });

  // PUT /v1/admin/vouchers/:id
  app.put<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const payload = voucherCreateUpdateSchema.parse(request.body);
    const voucherColumns = await getVoucherTemplateColumns();
    const code = request.params.id;
    
    let discountMode = 'percent_rm';
    let voucherType = 'campaign_direct_pay';
    let discountValue = 0;
    let tokenValue = null;

    if (payload.type === 'Free Drink' || payload.type === 'Free Food') {
      discountMode = 'free_drink';
      discountValue = 1;
    } else if (payload.type === 'Percentage Off') {
      discountMode = 'percent_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Cash Voucher') {
      discountMode = 'fixed_rm';
      discountValue = Number(payload.discountValue) || 0;
    } else if (payload.type === 'Token Discount') {
      discountMode = 'fixed_token';
      voucherType = 'campaign_token_equivalent';
      tokenValue = Number(payload.discountValue) || 0;
    }

    const derivedReward = deriveReward(payload);
    const scopeJson = JSON.stringify({
      frontend_type: payload.type,
      tier: payload.tier,
      reward: derivedReward,
      items: payload.eligibleItems,
      description: payload.description,
      expiry_string: payload.expiry
    });
    const writeBindings = buildVoucherWriteBindings(
      voucherColumns,
      payload,
      scopeJson,
      discountMode,
      voucherType,
      discountValue,
      tokenValue
    );

    const updateAssignments = [
      'name = :name',
      'voucher_type = :voucherType',
      'discount_mode = :discountMode',
      'discount_value = :discountValue',
      'token_value = :tokenValue',
      'eligible_scope_json = :scopeJson'
    ];

    if (hasColumn(voucherColumns, 'valid_until')) {
      updateAssignments.push('valid_until = :validUntil');
    }
    if (hasColumn(voucherColumns, 'total_quantity')) {
      updateAssignments.push('total_quantity = :totalQty');
    }
    if (hasColumn(voucherColumns, 'limit_per_user')) {
      updateAssignments.push('limit_per_user = :limitPerUser');
    }

    await mysqlPool.query(
      `
        UPDATE voucher_templates
        SET ${updateAssignments.join(', ')}
        WHERE code = :code
      `,
      {
        code,
        name: payload.name,
        voucherType,
        discountMode,
        discountValue,
        tokenValue,
        scopeJson,
        validUntil: null,
        totalQty: payload.totalQty || null,
        limitPerUser: payload.limitPerUser || 1
      }
    );

    return { success: true };
  });

  // DELETE /v1/admin/vouchers/:id
  app.delete<{ Params: { id: string } }>('/v1/admin/vouchers/:id', { preHandler: [authenticateAdminRequest] }, async (request) => {
    requireAdminRole(request, 'super_admin');
    const code = request.params.id;
    
    // Soft delete by setting is_active = 0
    await mysqlPool.query(
      `
        UPDATE voucher_templates
        SET is_active = 0
        WHERE code = :code
      `,
      { code }
    );

    return { success: true };
  });
}
