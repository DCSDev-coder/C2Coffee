import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { authenticateCounterDevice } from '../../counter/guard.js';
import { getUtcConnection, mysqlPool } from '../../db/mysql.js';
import { generateOpaqueToken, generateOtpCode, hashSha256, otpMatches } from '../../lib/crypto.js';
import { normalizePhoneE164 } from '../../lib/phone.js';
import { ApiError } from '../errors.js';
import { getBootstrapForUser } from './auth.js';
import { env } from '../../config/env.js';
import { loadCatalogMenu } from './catalog.js';
import { isStoreTradingNow } from '../../services/store-availability.js';
import { sendOtpEmail } from '../../services/otp-email.js';
import { getKualaLumpurDateParts } from '../../lib/kuala-lumpur-time.js';
import { verifyPassword } from '../../lib/password.js';
import {
  collectMatchedUnits,
  isVoucherAvailableNow,
  loadCheckoutMenuItems,
  normalizeMoney,
  parsePromotionRule,
  parseVoucherScope,
  verifyCheckoutModifiers,
  type AppliedVoucherRow
} from './checkout.js';
import { getActiveChipMethods, type ChipPaymentMethod } from '../../payments/chip-client.js';

const lookupCustomerSchema = z.object({
  phone: z.string().trim().min(1).max(32)
});

const activateDeviceSchema = z.object({
  activation_code: z.string().trim().toUpperCase().min(8).max(64)
});

const administratorUnlockSchema = z.object({
  password: z.string().min(8).max(200)
});

const workstationKeyPattern = /^C2-[A-Z0-9]{12}$/;
const directPrinterConfigurationSchema = z.object({
  network_host: z.string().trim().ip({ version: 'v4' }),
  network_port: z.coerce.number().int().min(1).max(65535)
});
const directPrintAcknowledgementSchema = z.object({
  job_ref: z.string().uuid(),
  outcome: z.enum(['printed', 'failed']),
  error_code: z.string().trim().max(100).optional()
});

function counterWorkstationKey(request: FastifyRequest): string {
  const value = request.headers['x-c2-workstation-key'];
  const key = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!workstationKeyPattern.test(key)) {
    throw new ApiError(400, 'invalid_workstation_key', 'This device needs a valid workstation code.');
  }
  return key;
}

const counterQuoteSchema = z.object({
  applied_voucher_id: z.coerce.number().int().positive().nullish(),
  items: z.array(z.object({
    menu_item_id: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(20),
    remarks: z.string().trim().max(500).nullish(),
    modifiers: z.array(z.object({
      group_name: z.string().trim().min(1).max(255),
      option_name: z.string().trim().min(1).max(255),
      price_delta_rm: z.union([z.string(), z.number()]).transform(Number),
      token_price_delta: z.coerce.number().int().min(-999).max(999).default(0),
      calorie_delta_kcal: z.coerce.number().int().min(-5000).max(5000).default(0)
    })).max(20).default([])
  })).min(1).max(20)
});

const voucherOtpRequestSchema = counterQuoteSchema.extend({
  applied_voucher_id: z.coerce.number().int().positive()
});

const voucherOtpVerifySchema = z.object({
  request_id: z.string().uuid(),
  otp_code: z.string().trim().regex(/^\d{6}$/)
});

type CounterSession = RowDataPacket & {
  id: number;
  user_id: number;
  tenant_id: number;
  counter_device_id: number;
};

function parseJsonColumn(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function basketHash(payload: z.infer<typeof voucherOtpRequestSchema>): string {
  return hashSha256(JSON.stringify({
    applied_voucher_id: payload.applied_voucher_id,
    items: payload.items.map((item) => ({
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      remarks: item.remarks ?? null,
      modifiers: item.modifiers
    }))
  }));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return 'your registered email';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function readCustomerSessionToken(request: FastifyRequest): string {
  const value = request.headers['x-counter-customer-session'];
  const token = Array.isArray(value) ? value[0] : value;
  if (!token?.trim()) {
    throw new ApiError(401, 'missing_counter_customer_session', 'Select a customer before continuing.');
  }
  return token.trim();
}

async function requireCounterCustomerSession(request: FastifyRequest): Promise<CounterSession> {
  const [sessions] = await mysqlPool.query<CounterSession[]>(
    `SELECT ccs.id, ccs.user_id, ccs.tenant_id, ccs.counter_device_id
     FROM counter_customer_sessions ccs
     JOIN users u ON u.id = ccs.user_id AND u.status = 'active' AND u.deleted_at IS NULL
     WHERE ccs.token_hash = :tokenHash
       AND ccs.counter_device_id = :deviceId
       AND ccs.tenant_id = :tenantId
       AND ccs.ended_at IS NULL
       AND ccs.expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    {
      tokenHash: hashSha256(readCustomerSessionToken(request)),
      deviceId: request.counterAuth.deviceId,
      tenantId: request.counterAuth.tenantId
    }
  );
  if (!sessions[0]) {
    throw new ApiError(401, 'counter_customer_session_expired', 'Customer selection has expired. Please enter the phone number again.');
  }
  return sessions[0];
}

async function getCounterCustomerSummary(tenantId: number, userId: number) {
  const [profiles, bootstrap, vouchers] = await Promise.all([
    mysqlPool.query<Array<RowDataPacket & { display_name: string; birthday_month_day: string | null }>>(
      `SELECT up.display_name, DATE_FORMAT(up.birthday, '%m-%d') AS birthday_month_day
       FROM user_profiles up
       JOIN customer_tenant_memberships ctm ON ctm.user_id = up.user_id
       WHERE up.user_id = :userId AND ctm.tenant_id = :tenantId
       LIMIT 1`,
      { tenantId, userId }
    ),
    getBootstrapForUser(userId),
    mysqlPool.query<Array<RowDataPacket & {
      id: number;
      code: string;
      name: string;
      voucher_type: string;
      discount_mode: 'fixed_rm' | 'percent_rm' | 'free_drink';
      discount_value: string;
      min_spend_rm: string | null;
      eligible_scope_json: unknown;
      issue_case_ref: string | null;
      expires_at: Date | null;
    }>>(
      `SELECT uv.id, uv.issue_case_ref, vt.code, vt.name, vt.voucher_type, vt.discount_mode,
              CAST(vt.discount_value AS CHAR) AS discount_value,
              CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
              vt.eligible_scope_json, uv.expires_at
       FROM user_vouchers uv
       JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
       WHERE uv.user_id = :userId
         AND uv.status = 'active'
         AND vt.tenant_id = :tenantId
         AND vt.is_active = 1
         AND vt.discount_mode IN ('fixed_rm', 'percent_rm', 'free_drink')
         AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
         AND (uv.expires_at IS NULL OR uv.expires_at > UTC_TIMESTAMP())
       ORDER BY uv.expires_at IS NULL DESC, uv.expires_at ASC, uv.id ASC
       LIMIT 20`,
      { tenantId, userId }
    )
  ]);

  const profile = profiles[0][0];
  if (!profile) throw new ApiError(404, 'counter_customer_not_found', 'No active customer account was found for this phone number.');

  return {
    customer: {
      display_name: profile.display_name,
      loyalty_tier: bootstrap.tier,
      token_balance: bootstrap.token_balance,
      active_vouchers: vouchers[0].filter((voucher) => {
        const scope = parseVoucherScope(voucher.eligible_scope_json);
        const isTierBirthday = voucher.issue_case_ref?.startsWith('tier_birthday:') ?? false;
        const schedule = scope.schedule && typeof scope.schedule === 'object'
          ? scope.schedule as Record<string, unknown>
          : null;
        const isBirthdayVoucher = isTierBirthday || voucher.voucher_type === 'birthday_treat' ||
          String(schedule?.mode ?? 'always') === 'birthday';
        const birthdayMonth = profile.birthday_month_day?.slice(0, 2);
        const currentMonth = getKualaLumpurDateParts().month;
        return (!isBirthdayVoucher || birthdayMonth === currentMonth) &&
          isVoucherAvailableNow(scope, new Date(), profile.birthday_month_day);
      }).map((voucher) => ({
        id: voucher.id,
        code: voucher.code,
        name: voucher.name,
        discount_mode: voucher.discount_mode,
        discount_value: voucher.discount_value,
        min_spend_rm: voucher.min_spend_rm,
        eligible_scope: parseJsonColumn(voucher.eligible_scope_json),
        expires_at: voucher.expires_at?.toISOString() ?? null
      }))
    }
  };
}

export async function registerCounterRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/counter/activate', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }
  }, async (request) => {
    const { activation_code: activationCode } = activateDeviceSchema.parse(request.body);
    const deviceToken = generateOpaqueToken();
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [devices] = await connection.query<RowDataPacket[]>(
        `SELECT cd.id, cd.label, cd.tenant_id, cd.store_id
         FROM counter_devices cd
         JOIN admin_tenants tenant
           ON tenant.id = cd.tenant_id AND tenant.status = 'active'
          AND tenant.code = :tenantCode
         JOIN stores store
           ON store.id = cd.store_id AND store.tenant_id = cd.tenant_id AND store.status = 'active'
         WHERE cd.activation_code_hash = :activationCodeHash
           AND cd.activation_expires_at > UTC_TIMESTAMP()
           AND cd.status = 'active'
         LIMIT 1 FOR UPDATE`,
        { activationCodeHash: hashSha256(activationCode), tenantCode: env.DEPLOYMENT_TENANT_CODE }
      );
      const device = devices[0];
      if (!device) {
        throw new ApiError(401, 'invalid_counter_activation', 'The activation code is invalid or has expired.');
      }
      await connection.execute(
        `UPDATE counter_devices
         SET token_hash = :tokenHash, activation_code_hash = NULL,
             activation_expires_at = NULL, activated_at = UTC_TIMESTAMP(),
             updated_at = UTC_TIMESTAMP()
         WHERE id = :deviceId`,
        { deviceId: device.id, tokenHash: hashSha256(deviceToken) }
      );
      await connection.commit();
      return {
        device_token: deviceToken,
        device: {
          id: device.id,
          label: device.label,
          tenant_id: device.tenant_id,
          store_id: device.store_id
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/counter/device', { preHandler: authenticateCounterDevice }, async (request) => ({
    device: {
      id: request.counterAuth.deviceId,
      label: request.counterAuth.label,
      store_id: request.counterAuth.storeId,
      tenant_id: request.counterAuth.tenantId
    }
  }));

  app.post('/v1/counter/administrator-unlock', {
    preHandler: authenticateCounterDevice,
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
  }, async (request) => {
    const parsed = administratorUnlockSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(401, 'administrator_unlock_failed', 'Administrator password is incorrect.');
    }

    const [administrators] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT DISTINCT u.id, u.password_hash
       FROM admin_users u
       JOIN admin_user_roles ur ON ur.admin_user_id = u.id
       JOIN admin_roles r ON r.id = ur.admin_role_id
       WHERE u.tenant_id = :tenantId
         AND u.status = 'active'
         AND u.password_hash IS NOT NULL
         AND r.code IN ('super_admin', 'operations_admin')`,
      { tenantId: request.counterAuth.tenantId }
    );

    let administratorId: number | null = null;
    for (const administrator of administrators) {
      if (await verifyPassword(parsed.data.password, administrator.password_hash)) {
        administratorId = Number(administrator.id);
        break;
      }
    }
    if (administratorId == null) {
      throw new ApiError(401, 'administrator_unlock_failed', 'Administrator password is incorrect.');
    }

    await mysqlPool.execute(
      `INSERT INTO admin_audit_logs
         (admin_user_id, effective_roles_json, action_code, target_type, target_id,
          after_json, ip_address, user_agent, created_at)
       VALUES
         (:adminUserId, :roles, 'counter_workspace_unlocked', 'counter_device', :deviceId,
          :afterJson, :ipAddress, :userAgent, UTC_TIMESTAMP())`,
      {
        adminUserId: administratorId,
        roles: JSON.stringify(['device_unlock']),
        deviceId: String(request.counterAuth.deviceId),
        afterJson: JSON.stringify({ store_id: request.counterAuth.storeId }),
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'] ?? null
      }
    );

    return { unlocked: true };
  });

  app.post('/v1/counter/direct-printer/configure', { preHandler: authenticateCounterDevice }, async (request, reply) => {
    const key = counterWorkstationKey(request);
    const body = directPrinterConfigurationSchema.parse(request.body);
    const printerReference = `counter-device-${request.counterAuth.deviceId}`;
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE printer_targets
         SET is_default = 0
         WHERE tenant_code = :tenantCode AND store_id = :storeId`,
        {
          tenantCode: request.counterAuth.tenantCode,
          storeId: request.counterAuth.storeId
        }
      );
      await connection.execute(
        `UPDATE printer_targets
         SET status = 'disabled', is_default = 0
         WHERE tenant_code = :tenantCode AND store_id = :storeId
           AND delivery_mode = 'android_direct'
           AND direct_print_device_key = :workstationKey
           AND printer_reference <> :printerReference`,
        {
          tenantCode: request.counterAuth.tenantCode,
          storeId: request.counterAuth.storeId,
          workstationKey: key,
          printerReference
        }
      );
      await connection.execute(
        `INSERT INTO printer_targets (
           tenant_code, store_id, integration_id, name, delivery_mode,
           printer_reference, network_host, network_port,
           direct_print_device_key, status, is_default
         ) VALUES (
           :tenantCode, :storeId, NULL, :name, 'android_direct',
           :printerReference, :networkHost, :networkPort,
           :workstationKey, 'pending', 1
         )
         ON DUPLICATE KEY UPDATE
           store_id = VALUES(store_id), name = VALUES(name),
           delivery_mode = 'android_direct', network_host = VALUES(network_host),
           network_port = VALUES(network_port),
           direct_print_device_key = VALUES(direct_print_device_key),
           status = 'pending', is_default = 1,
           last_checked_at = NULL, last_error_code = NULL`,
        {
          tenantCode: request.counterAuth.tenantCode,
          storeId: request.counterAuth.storeId,
          name: `${request.counterAuth.label} receipt printer`.slice(0, 120),
          printerReference,
          networkHost: body.network_host,
          networkPort: body.network_port,
          workstationKey: key
        }
      );
      await connection.commit();
      return reply.send({ configured: true, status: 'pending_test' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/counter/direct-printer/remove', { preHandler: authenticateCounterDevice }, async (request, reply) => {
    const key = counterWorkstationKey(request);
    await mysqlPool.execute(
      `UPDATE printer_targets
       SET status = 'disabled', is_default = 0,
           last_checked_at = UTC_TIMESTAMP(), last_error_code = 'removed_on_device'
       WHERE tenant_code = :tenantCode AND store_id = :storeId
         AND delivery_mode = 'android_direct' AND direct_print_device_key = :workstationKey`,
      {
        tenantCode: request.counterAuth.tenantCode,
        storeId: request.counterAuth.storeId,
        workstationKey: key
      }
    );
    return reply.send({ removed: true });
  });

  app.post('/v1/counter/direct-printer/tested', { preHandler: authenticateCounterDevice }, async (request, reply) => {
    const key = counterWorkstationKey(request);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE printer_targets
       SET status = 'connected', last_checked_at = UTC_TIMESTAMP(), last_error_code = NULL
       WHERE tenant_code = :tenantCode AND store_id = :storeId
         AND delivery_mode = 'android_direct' AND direct_print_device_key = :workstationKey`,
      {
        tenantCode: request.counterAuth.tenantCode,
        storeId: request.counterAuth.storeId,
        workstationKey: key
      }
    );
    if (result.affectedRows !== 1) {
      throw new ApiError(404, 'direct_printer_not_assigned', 'No direct printer is assigned to this outlet device.');
    }
    return reply.send({ connected: true });
  });

  app.post('/v1/counter/direct-print-jobs/claim', { preHandler: authenticateCounterDevice }, async (request, reply) => {
    const key = counterWorkstationKey(request);
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [printers] = await connection.execute<RowDataPacket[]>(
        `SELECT id, name, network_host, network_port
         FROM printer_targets
         WHERE tenant_code = :tenantCode AND store_id = :storeId
           AND delivery_mode = 'android_direct' AND status = 'connected'
           AND direct_print_device_key = :workstationKey
         LIMIT 1 FOR UPDATE`,
        {
          tenantCode: request.counterAuth.tenantCode,
          storeId: request.counterAuth.storeId,
          workstationKey: key
        }
      );
      const printer = printers[0];
      if (!printer?.network_host || !printer.network_port) {
        await connection.commit();
        return reply.code(204).send();
      }

      await connection.execute(
        `UPDATE print_jobs
         SET status = 'queued', last_error_code = 'device_claim_timed_out'
         WHERE printer_target_id = :printerTargetId AND status = 'dispatching'
           AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 MINUTE)`,
        { printerTargetId: printer.id }
      );
      const [jobs] = await connection.execute<RowDataPacket[]>(
        `SELECT j.id, j.job_ref, o.order_ref, o.created_at,
                COALESCE(NULLIF(TRIM(up.display_name), ''), 'Guest') AS customer_name,
                COALESCE(ctm.is_employee, 0) AS is_employee
         FROM print_jobs j
         JOIN orders o ON o.id = j.order_id AND o.store_id = :storeId
         JOIN stores s ON s.id = o.store_id
         LEFT JOIN user_profiles up ON up.user_id = o.user_id
         LEFT JOIN customer_tenant_memberships ctm
           ON ctm.user_id = o.user_id AND ctm.tenant_id = s.tenant_id
         WHERE j.printer_target_id = :printerTargetId AND j.status = 'queued'
         ORDER BY j.created_at ASC LIMIT 1 FOR UPDATE`,
        { printerTargetId: printer.id, storeId: request.counterAuth.storeId }
      );
      const job = jobs[0];
      if (!job) {
        await connection.commit();
        return reply.code(204).send();
      }

      await connection.execute(
        `UPDATE print_jobs
         SET status = 'dispatching', attempt_count = attempt_count + 1, last_error_code = NULL
         WHERE id = :jobId`,
        { jobId: job.id }
      );
      const [items] = await connection.execute<RowDataPacket[]>(
        `SELECT oi.id, oi.item_name_snapshot, oi.quantity
         FROM order_items oi
         WHERE oi.order_id = (SELECT order_id FROM print_jobs WHERE id = :jobId)
         ORDER BY oi.id ASC`,
        { jobId: job.id }
      );
      const [modifiers] = await connection.execute<RowDataPacket[]>(
        `SELECT oim.order_item_id, oim.modifier_group_name_snapshot, oim.modifier_option_name_snapshot
         FROM order_item_modifiers oim
         JOIN order_items oi ON oi.id = oim.order_item_id
         WHERE oi.order_id = (SELECT order_id FROM print_jobs WHERE id = :jobId)
         ORDER BY oim.id ASC`,
        { jobId: job.id }
      );
      const detailsByItemId = new Map<number, string[]>();
      for (const modifier of modifiers) {
        const details = detailsByItemId.get(Number(modifier.order_item_id)) ?? [];
        details.push(`${modifier.modifier_group_name_snapshot}: ${modifier.modifier_option_name_snapshot}`);
        detailsByItemId.set(Number(modifier.order_item_id), details);
      }
      await connection.commit();
      return reply.send({
        job_ref: job.job_ref,
        printer: {
          name: printer.name,
          host: printer.network_host,
          port: Number(printer.network_port)
        },
        order: {
          order_ref: job.order_ref,
          customer_name: job.customer_name,
          is_employee: Number(job.is_employee) === 1,
          created_at: new Date(job.created_at).toISOString(),
          items: items.map((item) => ({
            name: item.item_name_snapshot,
            quantity: Number(item.quantity),
            details: detailsByItemId.get(Number(item.id)) ?? []
          }))
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/counter/direct-print-jobs/acknowledge', { preHandler: authenticateCounterDevice }, async (request, reply) => {
    const key = counterWorkstationKey(request);
    const body = directPrintAcknowledgementSchema.parse(request.body);
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE print_jobs j
       JOIN printer_targets pt ON pt.id = j.printer_target_id
       SET j.status = :status,
           j.last_error_code = :errorCode,
           j.printed_at = CASE WHEN :status = 'printed' THEN UTC_TIMESTAMP() ELSE NULL END
       WHERE j.job_ref = :jobRef AND j.status = 'dispatching'
         AND pt.tenant_code = :tenantCode AND pt.store_id = :storeId
         AND pt.delivery_mode = 'android_direct'
         AND pt.direct_print_device_key = :workstationKey`,
      {
        status: body.outcome,
        errorCode: body.outcome === 'failed' ? body.error_code ?? 'device_print_failed' : null,
        jobRef: body.job_ref,
        tenantCode: request.counterAuth.tenantCode,
        storeId: request.counterAuth.storeId,
        workstationKey: key
      }
    );
    if (result.affectedRows !== 1) {
      throw new ApiError(409, 'print_job_not_dispatching', 'The print job is no longer available.');
    }
    return reply.send({ acknowledged: true });
  });

  app.get('/v1/counter/menu', { preHandler: authenticateCounterDevice }, async (request) => {
    return loadCatalogMenu(request.counterAuth.storeId);
  });

  app.get('/v1/counter/payment-methods', { preHandler: authenticateCounterDevice }, async () => {
    if (!env.TOPUP_GATEWAY_ENABLED || env.TOPUP_GATEWAY_PROVIDER !== 'chip') {
      return { methods: [] };
    }
    const active = await getActiveChipMethods();
    const allowed: ChipPaymentMethod[] = ['duitnow_qr', 'ewallet'];
    return { methods: allowed.filter((method) => active.has(method)) };
  });

  app.post('/v1/counter/orders/quote', { preHandler: authenticateCounterDevice }, async (request) => {
    const payload = counterQuoteSchema.parse(request.body);
    const session = await requireCounterCustomerSession(request);
    const connection = await getUtcConnection();
    try {
      const [stores] = await connection.query<Array<RowDataPacket & {
        id: number;
        tenant_id: number;
        status: 'active' | 'inactive';
        supports_pickup: number;
        temporarily_closed: number;
        timezone: string;
        weekly_hours_json: unknown;
      }>>(
        `SELECT id, tenant_id, status, supports_pickup, temporarily_closed, timezone, weekly_hours_json
         FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1`,
        { storeId: request.counterAuth.storeId, tenantId: request.counterAuth.tenantId }
      );
      const store = stores[0];
      if (!store || store.status !== 'active') {
        throw new ApiError(404, 'store_not_found', 'This counter outlet is unavailable.');
      }
      if (!isStoreTradingNow(store)) {
        throw new ApiError(409, 'store_closed', 'This outlet is currently closed and cannot accept orders.');
      }

      const bootstrap = await getBootstrapForUser(session.user_id, connection);
      const menuItems = await loadCheckoutMenuItems(
        connection,
        store.id,
        payload.items.map((item) => item.menu_item_id),
        bootstrap.tier
      );
      const itemsById = new Map(menuItems.map((item) => [Number(item.id), item]));
      let subtotalRm = 0;
      let modifierTotalRm = 0;
      const normalizedItems = [] as Array<{
        payload: (typeof payload.items)[number];
        menuItem: (typeof menuItems)[number];
        basePriceRm: number;
        tokenPrice: number;
        modifierRm: number;
        modifierTokens: number;
      }>;

      for (const item of payload.items) {
        const menuItem = itemsById.get(item.menu_item_id);
        if (!menuItem || menuItem.is_available !== 1) {
          throw new ApiError(400, 'menu_item_not_available', 'One or more items are unavailable.');
        }
        const modifiers = await verifyCheckoutModifiers(
          connection,
          store.tenant_id,
          menuItem.id,
          item.modifiers
        );
        const modifierRm = modifiers.reduce(
          (sum, modifier) => sum + normalizeMoney(modifier.price_delta_rm),
          0
        );
        const basePriceRm = Number(menuItem.base_price_rm);
        subtotalRm += basePriceRm * item.quantity;
        modifierTotalRm += modifierRm * item.quantity;
        normalizedItems.push({
          payload: { ...item, modifiers },
          menuItem,
          basePriceRm,
          tokenPrice: menuItem.token_price ?? menuItem.base_price_token,
          modifierRm,
          modifierTokens: modifiers.reduce((sum, modifier) => sum + modifier.token_price_delta, 0)
        });
      }

      const totalBeforeDiscountRm = normalizeMoney(subtotalRm + modifierTotalRm);
      let discountRm = 0;
      let voucherName: string | null = null;
      if (payload.applied_voucher_id) {
        const [voucherRows] = await connection.query<AppliedVoucherRow[]>(
          `SELECT uv.id, uv.user_id, uv.status, uv.issue_case_ref, uv.expires_at,
                  vt.id AS template_id, vt.tenant_id AS template_tenant_id,
                  vt.code AS template_code, vt.name AS template_name, vt.voucher_type,
                  vt.discount_mode, CAST(vt.discount_value AS CHAR) AS discount_value,
                  vt.token_value, CAST(vt.min_spend_rm AS CHAR) AS min_spend_rm,
                  vt.requires_drink_in_cart, vt.eligible_scope_json, vt.exclude_scope_json,
                  vt.is_active AS template_is_active, vt.valid_until AS template_valid_until
           FROM user_vouchers uv
           JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
           WHERE uv.id = :voucherId AND uv.user_id = :userId LIMIT 1`,
          { voucherId: payload.applied_voucher_id, userId: session.user_id }
        );
        const voucher = voucherRows[0];
        if (!voucher || voucher.status !== 'active' || voucher.template_is_active !== 1) {
          throw new ApiError(400, 'voucher_not_active', 'Selected voucher is no longer available.');
        }
        if (voucher.template_tenant_id !== store.tenant_id) {
          throw new ApiError(400, 'voucher_store_mismatch', 'Selected voucher is not valid at this outlet.');
        }
        if ((voucher.template_valid_until && new Date(voucher.template_valid_until).getTime() <= Date.now()) ||
            new Date(voucher.expires_at).getTime() <= Date.now()) {
          throw new ApiError(400, 'voucher_expired', 'Selected voucher has expired.');
        }
        if (voucher.discount_mode === 'fixed_token') {
          throw new ApiError(400, 'voucher_payment_mode_mismatch', 'This token voucher cannot be used for an RM counter order.');
        }

        const scope = parseVoucherScope(voucher.eligible_scope_json);
        const rule = parsePromotionRule(scope);
        const isTierBirthday = voucher.issue_case_ref?.startsWith('tier_birthday:') ?? false;
        let birthdayMonthDay: string | null = null;
        const schedule = scope.schedule && typeof scope.schedule === 'object'
          ? scope.schedule as Record<string, unknown>
          : null;
        const isBirthdayVoucher = isTierBirthday || voucher.voucher_type === 'birthday_treat' ||
          String(schedule?.mode ?? 'always') === 'birthday';
        if (isBirthdayVoucher) {
          const [birthdays] = await connection.query<Array<RowDataPacket & { birthday_month_day: string | null }>>(
            `SELECT DATE_FORMAT(birthday, '%m-%d') AS birthday_month_day
             FROM user_profiles WHERE user_id = :userId LIMIT 1`,
            { userId: session.user_id }
          );
          birthdayMonthDay = birthdays[0]?.birthday_month_day ?? null;
        }
        const birthdayEligible = !isBirthdayVoucher || Boolean(
          birthdayMonthDay &&
          birthdayMonthDay.slice(0, 2) === getKualaLumpurDateParts().month
        );
        if (!birthdayEligible || !isVoucherAvailableNow(scope, new Date(), birthdayMonthDay)) {
          throw new ApiError(400, 'voucher_not_available_now', 'Selected voucher is outside its active promotion time.');
        }
        const qualifying = collectMatchedUnits(rule.qualifying_scope, normalizedItems);
        const rewards = collectMatchedUnits(rule.reward_scope, normalizedItems);
        if (qualifying.length < rule.qualifying_quantity || rewards.length < rule.reward_quantity) {
          throw new ApiError(400, 'voucher_not_applicable_to_cart', 'Selected voucher does not match this basket.');
        }
        const minimum = voucher.min_spend_rm === null ? 0 : Number(voucher.min_spend_rm);
        if (minimum > 0 && totalBeforeDiscountRm < minimum) {
          throw new ApiError(400, 'voucher_min_spend_not_met', `Minimum spend of RM ${minimum.toFixed(2)} is required.`);
        }
        const rewardable = rewards.slice().sort(
          (a, b) => (b.basePriceRm + b.modifierRm) - (a.basePriceRm + a.modifierRm)
        ).slice(0, rule.reward_quantity);
        if (voucher.discount_mode === 'fixed_rm') {
          discountRm = Math.min(totalBeforeDiscountRm, Number(voucher.discount_value));
        } else if (voucher.discount_mode === 'percent_rm') {
          discountRm = Math.min(totalBeforeDiscountRm, totalBeforeDiscountRm * Number(voucher.discount_value) / 100);
        } else if (voucher.discount_mode === 'free_drink') {
          discountRm = rewardable.reduce((sum, unit) => sum + unit.basePriceRm + unit.modifierRm, 0);
        }
        voucherName = voucher.template_name;
      }

      discountRm = normalizeMoney(discountRm);
      return {
        quote: {
          subtotal_rm: totalBeforeDiscountRm.toFixed(2),
          discount_rm: discountRm.toFixed(2),
          final_total_rm: Math.max(0, normalizeMoney(totalBeforeDiscountRm - discountRm)).toFixed(2),
          applied_voucher_id: payload.applied_voucher_id ?? null,
          applied_voucher_name: voucherName,
          requires_customer_otp_authorization: Boolean(payload.applied_voucher_id)
        }
      };
    } finally {
      connection.release();
    }
  });

  app.post('/v1/counter/voucher-authorizations/request', {
    preHandler: authenticateCounterDevice,
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } }
  }, async (request) => {
    const payload = voucherOtpRequestSchema.parse(request.body);
    const session = await requireCounterCustomerSession(request);
    const [stores] = await mysqlPool.query<Array<RowDataPacket & {
      status: string;
      temporarily_closed: number;
      timezone: string;
      weekly_hours_json: unknown;
    }>>(
      `SELECT status, temporarily_closed, timezone, weekly_hours_json
       FROM stores WHERE id = :storeId AND tenant_id = :tenantId LIMIT 1`,
      { storeId: request.counterAuth.storeId, tenantId: session.tenant_id }
    );
    if (!stores[0] || !isStoreTradingNow(stores[0])) {
      throw new ApiError(409, 'store_closed', 'This outlet is currently closed and cannot accept orders.');
    }
    const [rows] = await mysqlPool.query<Array<RowDataPacket & {
      email: string | null;
      birthday_month_day: string | null;
      issue_case_ref: string | null;
      voucher_type: string;
      eligible_scope_json: unknown;
    }>>(
      `SELECT up.email, DATE_FORMAT(up.birthday, '%m-%d') AS birthday_month_day,
              uv.issue_case_ref, vt.voucher_type, vt.eligible_scope_json
       FROM user_vouchers uv
       JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
       JOIN user_profiles up ON up.user_id = uv.user_id
       WHERE uv.id = :voucherId
         AND uv.user_id = :userId
         AND uv.status = 'active'
         AND vt.tenant_id = :tenantId
         AND vt.is_active = 1
         AND vt.discount_mode IN ('fixed_rm', 'percent_rm', 'free_drink')
         AND (vt.valid_until IS NULL OR vt.valid_until > UTC_TIMESTAMP())
         AND (uv.expires_at IS NULL OR uv.expires_at > UTC_TIMESTAMP())
       LIMIT 1`,
      {
        voucherId: payload.applied_voucher_id,
        userId: session.user_id,
        tenantId: session.tenant_id
      }
    );
    const email = rows[0]?.email?.trim().toLowerCase();
    if (!rows[0]) {
      throw new ApiError(400, 'voucher_not_active', 'Selected voucher is no longer available.');
    }
    const selectedVoucher = rows[0];
    const selectedScope = parseVoucherScope(selectedVoucher.eligible_scope_json);
    const selectedSchedule = selectedScope.schedule && typeof selectedScope.schedule === 'object'
      ? selectedScope.schedule as Record<string, unknown>
      : null;
    const isBirthdayVoucher =
      (selectedVoucher.issue_case_ref?.startsWith('tier_birthday:') ?? false) ||
      selectedVoucher.voucher_type === 'birthday_treat' ||
      String(selectedSchedule?.mode ?? 'always') === 'birthday';
    const birthdayEligible = !isBirthdayVoucher || Boolean(
      selectedVoucher.birthday_month_day &&
      selectedVoucher.birthday_month_day.slice(0, 2) === getKualaLumpurDateParts().month
    );
    if (!birthdayEligible || !isVoucherAvailableNow(
      selectedScope,
      new Date(),
      selectedVoucher.birthday_month_day
    )) {
      throw new ApiError(
        400,
        'voucher_not_available_now',
        'Selected voucher is outside of its active promotion time.'
      );
    }
    if (!email) {
      throw new ApiError(400, 'voucher_otp_email_missing', 'Add an email address to the customer account before using a voucher at the counter.');
    }

    await mysqlPool.execute(
      `UPDATE counter_voucher_authorizations
       SET status = 'cancelled'
       WHERE counter_customer_session_id = :sessionId AND status IN ('pending', 'verified')`,
      { sessionId: session.id }
    );

    const requestId = randomUUID();
    const otpCode = generateOtpCode();
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO counter_voucher_authorizations (
         request_id, counter_customer_session_id, counter_device_id, tenant_id,
         store_id, user_id, user_voucher_id, basket_hash, recipient_email,
         otp_hash, max_attempts, expires_at
       ) VALUES (
         :requestId, :sessionId, :deviceId, :tenantId, :storeId, :userId,
         :voucherId, :basketHash, :recipientEmail, :otpHash, :maxAttempts,
         DATE_ADD(UTC_TIMESTAMP(), INTERVAL :expirySeconds SECOND)
       )`,
      {
        requestId,
        sessionId: session.id,
        deviceId: request.counterAuth.deviceId,
        tenantId: session.tenant_id,
        storeId: request.counterAuth.storeId,
        userId: session.user_id,
        voucherId: payload.applied_voucher_id,
        basketHash: basketHash(payload),
        recipientEmail: email,
        otpHash: hashSha256(otpCode),
        maxAttempts: env.OTP_MAX_ATTEMPTS,
        expirySeconds: env.OTP_EXPIRY_SECONDS
      }
    );

    try {
      if (env.OTP_DELIVERY_MODE === 'email') {
        await sendOtpEmail({
          to: email,
          otpCode,
          subject: 'Authorize your C2 Coffee counter voucher',
          heading: 'Enter this code at the counter to authorize your voucher:'
        });
      } else if (env.OTP_DELIVERY_MODE === 'log') {
        request.log.warn({ requestId, otpCode }, 'Counter voucher OTP generated in log delivery mode.');
      }
    } catch (error) {
      await mysqlPool.execute(
        `UPDATE counter_voucher_authorizations SET status = 'cancelled' WHERE id = :id`,
        { id: result.insertId }
      );
      request.log.error({ err: error, requestId }, 'Failed to send counter voucher OTP email.');
      throw new ApiError(503, 'voucher_otp_delivery_failed', 'We could not send the voucher code. Please try again shortly.');
    }

    return {
      request_id: requestId,
      channel: 'email',
      sent_to: maskEmail(email),
      expires_in_seconds: env.OTP_EXPIRY_SECONDS,
      ...(env.NODE_ENV !== 'production' || env.OTP_DEBUG_EXPOSE_CODE ? { debug_otp_code: otpCode } : {})
    };
  });

  app.post('/v1/counter/voucher-authorizations/verify', {
    preHandler: authenticateCounterDevice,
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } }
  }, async (request) => {
    const payload = voucherOtpVerifySchema.parse(request.body);
    const session = await requireCounterCustomerSession(request);
    const connection = await getUtcConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<Array<RowDataPacket & {
        id: number; otp_hash: string; attempts_used: number; max_attempts: number;
        status: string; expires_at: Date; user_voucher_id: number; basket_hash: string;
      }>>(
        `SELECT id, otp_hash, attempts_used, max_attempts, status, expires_at,
                user_voucher_id, basket_hash
         FROM counter_voucher_authorizations
         WHERE request_id = :requestId
           AND counter_customer_session_id = :sessionId
           AND counter_device_id = :deviceId
           AND tenant_id = :tenantId
           AND store_id = :storeId
         LIMIT 1 FOR UPDATE`,
        {
          requestId: payload.request_id,
          sessionId: session.id,
          deviceId: request.counterAuth.deviceId,
          tenantId: session.tenant_id,
          storeId: request.counterAuth.storeId
        }
      );
      const authorization = rows[0];
      if (!authorization || authorization.status !== 'pending') {
        throw new ApiError(401, 'voucher_otp_not_pending', 'This voucher code is no longer valid.');
      }
      if (new Date(authorization.expires_at).getTime() <= Date.now()) {
        await connection.execute(
          `UPDATE counter_voucher_authorizations SET status = 'expired' WHERE id = :id`,
          { id: authorization.id }
        );
        await connection.commit();
        throw new ApiError(401, 'voucher_otp_expired', 'The voucher code has expired. Request a new code.');
      }
      if (!otpMatches(payload.otp_code, authorization.otp_hash)) {
        const attempts = authorization.attempts_used + 1;
        await connection.execute(
          `UPDATE counter_voucher_authorizations
           SET attempts_used = :attempts,
               status = CASE WHEN :attempts >= max_attempts THEN 'blocked' ELSE status END
           WHERE id = :id`,
          { id: authorization.id, attempts }
        );
        await connection.commit();
        throw new ApiError(401, attempts >= authorization.max_attempts ? 'voucher_otp_blocked' : 'voucher_otp_invalid',
          attempts >= authorization.max_attempts ? 'Too many incorrect attempts. Request a new code.' : 'The voucher code is incorrect.');
      }

      const token = generateOpaqueToken();
      await connection.execute(
        `UPDATE counter_voucher_authorizations
         SET status = 'verified', authorization_token_hash = :tokenHash,
             verified_at = UTC_TIMESTAMP(), verified_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
         WHERE id = :id`,
        { id: authorization.id, tokenHash: hashSha256(token) }
      );
      await connection.commit();
      return {
        voucher_authorization_token: token,
        user_voucher_id: authorization.user_voucher_id,
        basket_hash: authorization.basket_hash,
        expires_in_seconds: 600
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/counter/customer-sessions', {
    preHandler: authenticateCounterDevice,
    config: { rateLimit: { max: 30, timeWindow: '15 minutes' } }
  }, async (request, reply) => {
    const phone = normalizePhoneE164(lookupCustomerSchema.parse(request.body).phone);
    const [customers] = await mysqlPool.query<Array<RowDataPacket & { user_id: number }>>(
      `SELECT ctm.user_id
       FROM customer_tenant_memberships ctm
       JOIN users u ON u.id = ctm.user_id AND u.phone_e164 = :phone
       WHERE ctm.tenant_id = :tenantId
         AND ctm.registration_status = 'registered'
         AND u.status = 'active'
         AND u.deleted_at IS NULL
       LIMIT 1`,
      { phone, tenantId: request.counterAuth.tenantId }
    );
    const customer = customers[0];
    if (!customer) {
      throw new ApiError(404, 'counter_customer_not_found', 'No active customer account was found for this phone number.');
    }

    const sessionToken = generateOpaqueToken();
    await mysqlPool.execute<ResultSetHeader>(
      `UPDATE counter_customer_sessions
       SET ended_at = UTC_TIMESTAMP()
       WHERE counter_device_id = :deviceId AND ended_at IS NULL`,
      { deviceId: request.counterAuth.deviceId }
    );
    await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO counter_customer_sessions (counter_device_id, tenant_id, user_id, token_hash, expires_at)
       VALUES (:deviceId, :tenantId, :userId, :tokenHash, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
      {
        deviceId: request.counterAuth.deviceId,
        tenantId: request.counterAuth.tenantId,
        userId: customer.user_id,
        tokenHash: hashSha256(sessionToken)
      }
    );

    return reply.code(201).send({
      customer_session_token: sessionToken,
      expires_in_seconds: 600,
      ...(await getCounterCustomerSummary(request.counterAuth.tenantId, customer.user_id))
    });
  });

  app.get('/v1/counter/customer-session', { preHandler: authenticateCounterDevice }, async (request) => {
    const session = await requireCounterCustomerSession(request);
    await mysqlPool.execute(
      `UPDATE counter_customer_sessions
       SET expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE)
       WHERE id = :sessionId`,
      { sessionId: session.id }
    );
    return getCounterCustomerSummary(session.tenant_id, session.user_id);
  });

  app.delete('/v1/counter/customer-session', { preHandler: authenticateCounterDevice }, async (request) => {
    const session = await requireCounterCustomerSession(request);
    await mysqlPool.execute(
      'UPDATE counter_customer_sessions SET ended_at = UTC_TIMESTAMP() WHERE id = :sessionId',
      { sessionId: session.id }
    );
    return { ended: true };
  });
}
