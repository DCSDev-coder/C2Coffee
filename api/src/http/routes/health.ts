import type { FastifyInstance } from 'fastify';
import { assertDatabaseConnection } from '../../db/mysql.js';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'c2coffee-api'
    };
  });

  app.get('/v1/health', async () => {
    await assertDatabaseConnection();

    return {
      status: 'ok',
      service: 'c2coffee-api',
      database: 'ok'
    };
  });
}
