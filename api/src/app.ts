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
import { registerAdminOrdersRoutes } from './http/routes/admin-orders.js';
import { registerAdminCustomersRoutes } from './http/routes/admin-customers.js';
import { registerAdminLoyaltyRoutes } from './http/routes/admin-loyalty.js';
import { registerAdminAuditRoutes } from './http/routes/admin-audit.js';
import { registerAdminMarketingRoutes } from './http/routes/admin-marketing.js';
import { registerAdminBaristasRoutes } from './http/routes/admin-baristas.js';
import { registerAdminDashboardRoutes } from './http/routes/admin-dashboard.js';
import { registerHomeFeaturedRoutes } from './http/routes/home-featured.js';

function isAllowedCorsOrigin(origin: string, allowedOrigins: string[]): boolean {
  let requestUrl: URL;

  try {
    requestUrl = new URL(origin);
  } catch {
    return false;
  }

  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) {
      return true;
    }

    let allowedUrl: URL;

    try {
      allowedUrl = new URL(allowedOrigin);
    } catch {
      return false;
    }

    if (allowedUrl.protocol !== requestUrl.protocol || allowedUrl.hostname !== requestUrl.hostname) {
      return false;
    }

    if (allowedUrl.port) {
      return allowedUrl.port === requestUrl.port;
    }

    return allowedUrl.hostname === 'localhost' || allowedUrl.hostname === '127.0.0.1';
  });
}

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

      callback(null, isAllowedCorsOrigin(origin, env.CORS_ALLOWED_ORIGINS));
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
  await registerAdminOrdersRoutes(app);
  await registerAdminDashboardRoutes(app);
  await registerAdminCustomersRoutes(app);
  await registerAdminLoyaltyRoutes(app);
  await registerAdminMenuRoutes(app);
  await registerAdminAuditRoutes(app);
  await registerAdminMarketingRoutes(app);
  await registerAdminBaristasRoutes(app);
  await registerHomeFeaturedRoutes(app);
  await registerMeRoutes(app);
  await registerCatalogRoutes(app);
  await registerCheckoutRoutes(app);
  await registerCustomerDataRoutes(app);

  return app;
}
