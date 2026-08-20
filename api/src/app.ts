import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { env } from './config/env.js';
import { errorHandler } from './http/errors.js';
import { registerAuthRoutes } from './http/routes/auth.js';
import { registerAssetRoutes } from './http/routes/assets.js';
import { registerAdminAuthRoutes } from './http/routes/admin-auth.js';
import { registerAdminMenuRoutes } from './http/routes/admin-menu.js';
import { registerCatalogRoutes } from './http/routes/catalog.js';
import { registerCheckoutRoutes } from './http/routes/checkout.js';
import { registerCustomerDataRoutes } from './http/routes/customer-data.js';
import { registerHealthRoutes } from './http/routes/health.js';
import { registerMeRoutes } from './http/routes/me.js';
import { registerAdminVoucherRoutes } from './http/routes/admin-vouchers.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]'
      ]
    },
    genReqId: (request) => {
      const existing = request.headers['x-request-id'];
      return typeof existing === 'string' && existing.length <= 128
        ? existing
        : crypto.randomUUID();
    }
  });

  app.setErrorHandler(errorHandler);

  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, env.CORS_ALLOWED_ORIGINS.includes(origin));
    },
    credentials: false
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute'
  });

  await registerHealthRoutes(app);
  await registerAssetRoutes(app);
  await registerAuthRoutes(app);
  await registerAdminAuthRoutes(app);
  await registerAdminVoucherRoutes(app);
  await registerAdminMenuRoutes(app);
  await registerMeRoutes(app);
  await registerCatalogRoutes(app);
  await registerCheckoutRoutes(app);
  await registerCustomerDataRoutes(app);

  return app;
}
