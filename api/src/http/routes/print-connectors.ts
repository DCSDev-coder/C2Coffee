import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { mysqlPool } from '../../db/mysql.js';
import { ApiError } from '../errors.js';

const connectorHeader = 'x-c2-print-connector-key';
const printerReferenceSchema = z.object({
  printer_reference: z.string().trim().min(1).max(255)
});
const acknowledgeSchema = printerReferenceSchema.extend({
  job_ref: z.string().uuid(),
  outcome: z.enum(['printed', 'failed']),
  error_code: z.string().trim().max(100).optional()
});

function authenticateConnector(request: { headers: Record<string, string | string[] | undefined> }): void {
  const provided = request.headers[connectorHeader];
  const value = typeof provided === 'string' ? provided : '';
  const expected = env.PRINT_CONNECTOR_SHARED_SECRET;
  const providedBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);

  if (!expected || providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    throw new ApiError(401, 'invalid_print_connector', 'The print connector could not be verified.');
  }
}

type JobRow = RowDataPacket & {
  id: number;
  job_ref: string;
  order_id: number;
  order_ref: string;
  daily_order_number: number | null;
  final_total_rm: string;
  token_amount_charged: number;
  created_at: Date;
};

/**
 * A bridge runs close to the printer (Windows, Android service, or approved
 * POS adapter). It pulls one job at a time, renders vendor-specific ESC/POS or
 * spooler output locally, then acknowledges the immutable job reference.
 */
export async function registerPrintConnectorRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/print-connectors/heartbeat', async (request, reply) => {
    authenticateConnector(request);
    const body = printerReferenceSchema.parse(request.body ?? {});
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE printer_targets
       SET status = 'connected', last_checked_at = UTC_TIMESTAMP(), last_error_code = NULL
       WHERE printer_reference = :printerReference AND status <> 'disabled'`,
      { printerReference: body.printer_reference }
    );
    if (result.affectedRows !== 1) {
      throw new ApiError(404, 'printer_not_registered', 'No active printer route matches this connector.');
    }
    return reply.send({ connected: true });
  });

  app.post('/v1/print-connectors/jobs/claim', async (request, reply) => {
    authenticateConnector(request);
    const body = printerReferenceSchema.parse(request.body ?? {});
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const [jobs] = await connection.execute<JobRow[]>(
        `SELECT j.id, j.job_ref, j.order_id, o.order_ref, o.daily_order_number,
                CAST(o.final_total_rm AS CHAR) AS final_total_rm, o.token_amount_charged, o.created_at
         FROM print_jobs j
         JOIN printer_targets p ON p.id = j.printer_target_id
         JOIN orders o ON o.id = j.order_id
         WHERE p.printer_reference = :printerReference
           AND p.status = 'connected'
           AND j.status = 'queued'
         ORDER BY j.created_at ASC
         LIMIT 1
         FOR UPDATE`,
        { printerReference: body.printer_reference }
      );
      const job = jobs[0];
      if (!job) {
        await connection.commit();
        return reply.status(204).send();
      }

      await connection.execute(
        `UPDATE print_jobs
         SET status = 'dispatching', attempt_count = attempt_count + 1, last_error_code = NULL
         WHERE id = :jobId`,
        { jobId: job.id }
      );
      const [items] = await connection.execute<RowDataPacket[]>(
        `SELECT item_name_snapshot, quantity, CAST(line_subtotal_rm AS CHAR) AS line_total_rm
         FROM order_items
         WHERE order_id = :orderId
         ORDER BY id ASC`,
        { orderId: job.order_id }
      );
      await connection.commit();
      return reply.send({
        job_ref: job.job_ref,
        receipt: {
          order_ref: job.order_ref,
          order_number: job.daily_order_number,
          created_at: job.created_at.toISOString(),
          items: items.map((item) => ({
            name: item.item_name_snapshot,
            quantity: Number(item.quantity),
            line_total_rm: item.line_total_rm
          })),
          final_total_rm: job.final_total_rm,
          token_amount: job.token_amount_charged
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });

  app.post('/v1/print-connectors/jobs/acknowledge', async (request, reply) => {
    authenticateConnector(request);
    const body = acknowledgeSchema.parse(request.body ?? {});
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `UPDATE print_jobs j
       JOIN printer_targets p ON p.id = j.printer_target_id
       SET j.status = :status,
           j.last_error_code = :errorCode,
           j.printed_at = CASE WHEN :status = 'printed' THEN UTC_TIMESTAMP() ELSE NULL END
       WHERE j.job_ref = :jobRef
         AND p.printer_reference = :printerReference
         AND j.status = 'dispatching'`,
      {
        status: body.outcome,
        errorCode: body.outcome === 'failed' ? body.error_code ?? 'connector_failed' : null,
        jobRef: body.job_ref,
        printerReference: body.printer_reference
      }
    );
    if (result.affectedRows !== 1) {
      throw new ApiError(409, 'print_job_not_dispatching', 'The print job cannot be acknowledged.');
    }
    return reply.send({ acknowledged: true });
  });
}
