import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { authenticateAdminRequest } from '../../admin/guard.js';
import { mysqlPool } from '../../db/mysql.js';

const baristaSchema = z.object({
  name: z.string().trim().min(1).max(255),
  is_active: z.boolean().optional().default(true)
});

export async function registerAdminBaristasRoutes(app: FastifyInstance) {
  app.get('/v1/admin/baristas', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    const admin = request.adminAuth;

    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      `SELECT id, name, is_active, created_at, updated_at
       FROM baristas
       WHERE tenant_code = ?
       ORDER BY created_at DESC`,
      [admin.tenantCode]
    );

    const baristas = rows.map((row: any) => ({
      ...row,
      is_active: !!row.is_active
    }));

    return reply.send({ baristas });
  });

  app.post('/v1/admin/baristas', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    const admin = request.adminAuth;
    const body = baristaSchema.parse(request.body);

    const [result] = await mysqlPool.query<ResultSetHeader>(
      `INSERT INTO baristas (tenant_code, name, is_active)
       VALUES (?, ?, ?)`,
      [admin.tenantCode, body.name, body.is_active]
    );

    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT id, name, is_active, created_at, updated_at FROM baristas WHERE id = ?',
      [result.insertId]
    );

    const barista = { ...rows[0], is_active: !!rows[0].is_active };
    return reply.code(201).send({ barista });
  });

  app.put('/v1/admin/baristas/:id', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    const admin = request.adminAuth;
    const { id } = request.params as { id: string };
    const body = baristaSchema.partial().parse(request.body);

    if (body.name !== undefined) {
      await mysqlPool.query<ResultSetHeader>(
        'UPDATE baristas SET name = ? WHERE id = ? AND tenant_code = ?',
        [body.name, id, admin.tenantCode]
      );
    }

    if (body.is_active !== undefined) {
      await mysqlPool.query<ResultSetHeader>(
        'UPDATE baristas SET is_active = ? WHERE id = ? AND tenant_code = ?',
        [body.is_active, id, admin.tenantCode]
      );
    }

    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT id, name, is_active, created_at, updated_at FROM baristas WHERE id = ? AND tenant_code = ?',
      [id, admin.tenantCode]
    );

    if (!rows.length) {
      return reply.code(404).send({ error: 'Barista not found' });
    }

    const barista = { ...rows[0], is_active: !!rows[0].is_active };
    return reply.send({ barista });
  });

  app.delete('/v1/admin/baristas/:id', { preHandler: authenticateAdminRequest }, async (request, reply) => {
    const admin = request.adminAuth;
    const { id } = request.params as { id: string };

    const [result] = await mysqlPool.query<ResultSetHeader>(
      'DELETE FROM baristas WHERE id = ? AND tenant_code = ?',
      [id, admin.tenantCode]
    );

    if (result.affectedRows === 0) {
      return reply.code(404).send({ error: 'Barista not found' });
    }

    return reply.code(204).send();
  });
}
