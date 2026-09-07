import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { ApiError } from '../errors.js';
import { mysqlPool } from '../../db/mysql.js';
import {
  defaultCapabilities,
  integrationCapabilities,
  integrationProviders,
  parseCapabilities,
  printerDeliveryModes
} from '../../services/operational-integrations.js';

const integrationStatus = z.enum(['not_configured', 'pending', 'connected', 'disabled']);
const printerConfigurationStatus = z.enum(['not_configured', 'pending', 'disabled']);
const providerCode = z.enum(integrationProviders);
const capability = z.enum(integrationCapabilities);
const nullableStoreId = z.coerce.number().int().positive().nullable().optional().default(null);

const integrationSchema = z.object({
  store_id: nullableStoreId,
  provider_code: providerCode,
  display_name: z.string().trim().min(1).max(120),
  status: integrationStatus.optional().default('not_configured'),
  capabilities: z.array(capability).optional(),
  connection_reference: z.string().trim().max(255).nullable().optional().default(null)
});

const printerSchema = z.object({
  store_id: nullableStoreId,
  integration_id: z.coerce.number().int().positive().nullable().optional().default(null),
  name: z.string().trim().min(1).max(120),
  delivery_mode: z.enum(printerDeliveryModes),
  printer_reference: z.string().trim().min(1).max(255),
  // A connector, not a form submission, is responsible for declaring a printer connected.
  status: printerConfigurationStatus.optional().default('pending'),
  is_default: z.boolean().optional().default(false)
});

const weeklyScheduleSchema = z.object({
  entries: z.array(z.object({
    barista_id: z.coerce.number().int().positive(),
    weekday: z.coerce.number().int().min(1).max(7),
    starts_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.'),
    ends_at: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM time.')
  }).refine((entry) => entry.ends_at > entry.starts_at, {
    message: 'Shift end time must be after start time.',
    path: ['ends_at']
  })).max(200)
});

function canOperate(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.some((role) => ['super_admin', 'operations_admin', 'barista'].includes(role))) {
    throw new ApiError(403, 'forbidden', 'You do not have access to operational integrations.');
  }
}

function canConfigure(request: { adminAuth?: { roles?: string[] } }): void {
  const roles = request.adminAuth?.roles ?? [];
  if (!roles.some((role) => ['super_admin', 'operations_admin'].includes(role))) {
    throw new ApiError(403, 'forbidden', 'Only operations administrators can configure integrations.');
  }
}

async function assertStoreInTenant(storeId: number | null, tenantCode: string): Promise<void> {
  if (storeId === null) return;
  const [rows] = await mysqlPool.execute<RowDataPacket[]>(
    `SELECT s.id
     FROM stores s
     JOIN admin_tenants t ON t.id = s.tenant_id
     WHERE s.id = :storeId AND t.code = :tenantCode
     LIMIT 1`,
    { storeId, tenantCode }
  );
  if (!rows[0]) throw new ApiError(404, 'store_not_found', 'Store not found for this tenant.');
}

function integrationResponse(row: RowDataPacket) {
  return {
    ...row,
    capabilities: parseCapabilities(
      typeof row.capabilities_json === 'string' ? JSON.parse(row.capabilities_json) : row.capabilities_json
    )
  };
}

export async function registerOperationalIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/operational-integrations', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const [integrations, printers, schedules] = await Promise.all([
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, store_id, provider_code, display_name, status, capabilities_json,
                connection_reference, last_checked_at, last_error_code, created_at, updated_at
         FROM outlet_integrations
         WHERE tenant_code = :tenantCode
         ORDER BY display_name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, store_id, integration_id, name, delivery_mode, printer_reference, status,
                is_default, last_checked_at, last_error_code, created_at, updated_at
         FROM printer_targets
         WHERE tenant_code = :tenantCode
         ORDER BY is_default DESC, name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.id, s.barista_id, b.name AS barista_name, s.weekday, s.starts_at, s.ends_at, s.is_active
         FROM barista_weekly_schedules s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND s.is_active = 1
         ORDER BY s.weekday ASC, s.starts_at ASC, b.name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      )
    ]);

    return reply.send({
      integrations: integrations[0].map(integrationResponse),
      printers: printers[0].map((row) => ({ ...row, is_default: !!row.is_default })),
      weekly_schedule: schedules[0].map((row) => ({ ...row, is_active: !!row.is_active }))
    });
  });

  app.put('/v1/admin/weekly-schedule', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = weeklyScheduleSchema.parse(request.body);
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      const [baristas] = await connection.execute<RowDataPacket[]>(
        'SELECT id FROM baristas WHERE tenant_code = :tenantCode AND is_active = 1',
        { tenantCode: request.adminAuth.tenantCode }
      );
      const activeBaristaIds = new Set(baristas.map((barista) => Number(barista.id)));
      const invalidEntry = body.entries.find((entry) => !activeBaristaIds.has(entry.barista_id));
      if (invalidEntry) {
        throw new ApiError(400, 'barista_unavailable', 'Every scheduled barista must be active for this tenant.');
      }

      const shiftKeys = new Set<string>();
      for (const entry of body.entries) {
        const shiftKey = `${entry.barista_id}:${entry.weekday}:${entry.starts_at}`;
        if (shiftKeys.has(shiftKey)) {
          throw new ApiError(400, 'duplicate_shift', 'A barista cannot have duplicate shifts with the same start time.');
        }
        shiftKeys.add(shiftKey);
      }

      await connection.execute(
        'DELETE FROM barista_weekly_schedules WHERE tenant_code = :tenantCode',
        { tenantCode: request.adminAuth.tenantCode }
      );
      for (const entry of body.entries) {
        await connection.execute(
          `INSERT INTO barista_weekly_schedules (
            tenant_code, barista_id, weekday, starts_at, ends_at, is_active
          ) VALUES (
            :tenantCode, :baristaId, :weekday, :startsAt, :endsAt, 1
          )`,
          {
            tenantCode: request.adminAuth.tenantCode,
            baristaId: entry.barista_id,
            weekday: entry.weekday,
            startsAt: entry.starts_at,
            endsAt: entry.ends_at
          }
        );
      }
      await connection.commit();
      return reply.send({ saved: body.entries.length });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/admin/operational-integrations', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = integrationSchema.parse(request.body);
    await assertStoreInTenant(body.store_id, request.adminAuth.tenantCode);
    const capabilities = body.capabilities ?? defaultCapabilities[body.provider_code];

    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO outlet_integrations (
        tenant_code, store_id, provider_code, display_name, status, capabilities_json, connection_reference
      ) VALUES (
        :tenantCode, :storeId, :providerCode, :displayName, :status, :capabilities, :connectionReference
      )`,
      {
        tenantCode: request.adminAuth.tenantCode,
        storeId: body.store_id,
        providerCode: body.provider_code,
        displayName: body.display_name,
        status: body.status,
        capabilities: JSON.stringify(capabilities),
        connectionReference: body.connection_reference
      }
    );

    return reply.code(201).send({ id: result.insertId });
  });

  app.post('/v1/admin/printer-targets', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canConfigure(request);
    const body = printerSchema.parse(request.body);
    await assertStoreInTenant(body.store_id, request.adminAuth.tenantCode);

    if (body.integration_id !== null) {
      const [integrations] = await mysqlPool.execute<RowDataPacket[]>(
        `SELECT id FROM outlet_integrations WHERE id = :integrationId AND tenant_code = :tenantCode LIMIT 1`,
        { integrationId: body.integration_id, tenantCode: request.adminAuth.tenantCode }
      );
      if (!integrations[0]) throw new ApiError(404, 'integration_not_found', 'Integration not found for this tenant.');
    }

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      if (body.is_default) {
        await connection.execute(
          'UPDATE printer_targets SET is_default = 0 WHERE tenant_code = :tenantCode',
          { tenantCode: request.adminAuth.tenantCode }
        );
      }
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO printer_targets (
          tenant_code, store_id, integration_id, name, delivery_mode, printer_reference, status, is_default
        ) VALUES (
          :tenantCode, :storeId, :integrationId, :name, :deliveryMode, :printerReference, :status, :isDefault
        )`,
        {
          tenantCode: request.adminAuth.tenantCode,
          storeId: body.store_id,
          integrationId: body.integration_id,
          name: body.name,
          deliveryMode: body.delivery_mode,
          printerReference: body.printer_reference,
          status: body.status,
          isDefault: body.is_default
        }
      );
      await connection.commit();
      return reply.code(201).send({ id: result.insertId });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.get('/v1/barista/operations/context', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const [integrations, printers, schedules] = await Promise.all([
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT provider_code, display_name, status, capabilities_json, last_checked_at, last_error_code
         FROM outlet_integrations WHERE tenant_code = :tenantCode ORDER BY display_name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT id, name, delivery_mode, status, is_default, last_checked_at, last_error_code
         FROM printer_targets WHERE tenant_code = :tenantCode ORDER BY is_default DESC, name ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      ),
      mysqlPool.execute<RowDataPacket[]>(
        `SELECT s.weekday, s.starts_at, s.ends_at, b.id AS barista_id, b.name AS barista_name
         FROM barista_weekly_schedules s
         JOIN baristas b ON b.id = s.barista_id
         WHERE s.tenant_code = :tenantCode AND s.is_active = 1
         ORDER BY s.weekday ASC, s.starts_at ASC`,
        { tenantCode: request.adminAuth.tenantCode }
      )
    ]);

    return reply.send({
      integrations: integrations[0].map(integrationResponse),
      printers: printers[0].map((row) => ({ ...row, is_default: !!row.is_default })),
      weekly_schedule: schedules[0]
    });
  });

  app.post('/v1/barista/print-jobs', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    canOperate(request);
    const body = z.object({
      order_ref: z.string().trim().min(1).max(80),
      printer_target_id: z.coerce.number().int().positive(),
      request_type: z.enum(['original', 'reprint']).default('original')
    }).parse(request.body);

    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders] = await connection.execute<RowDataPacket[]>(
        `SELECT o.id
         FROM orders o
         JOIN stores s ON s.id = o.store_id
         JOIN admin_tenants t ON t.id = s.tenant_id
         WHERE o.order_ref = :orderRef AND t.code = :tenantCode
         LIMIT 1 FOR UPDATE`,
        { orderRef: body.order_ref, tenantCode: request.adminAuth.tenantCode }
      );
      if (!orders[0]) throw new ApiError(404, 'order_not_found', 'Order not found for this tenant.');

      const [printers] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM printer_targets
         WHERE id = :printerTargetId AND tenant_code = :tenantCode AND status = 'connected'
         LIMIT 1 FOR UPDATE`,
        { printerTargetId: body.printer_target_id, tenantCode: request.adminAuth.tenantCode }
      );
      if (!printers[0]) {
        throw new ApiError(409, 'printer_not_ready', 'The selected printer is not connected.');
      }

      const jobRef = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO print_jobs (
          job_ref, tenant_code, order_id, printer_target_id, requested_by_admin_user_id, request_type
        ) VALUES (
          :jobRef, :tenantCode, :orderId, :printerTargetId, :adminUserId, :requestType
        )`,
        {
          jobRef,
          tenantCode: request.adminAuth.tenantCode,
          orderId: orders[0].id,
          printerTargetId: body.printer_target_id,
          adminUserId: request.adminAuth.adminUserId,
          requestType: body.request_type
        }
      );
      await connection.commit();
      return reply.code(202).send({ job_ref: jobRef, status: 'queued' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}
