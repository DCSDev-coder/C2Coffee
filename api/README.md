# C2 Coffee API

Phase-1 backend scaffold for the C2 Coffee mobile app and admin panel.

## Current Scope

This API is intentionally separated from the placeholder `backend/` and `edge_server/` folders because those folders currently contain zero-byte skeleton files only.

The target stack follows the finalized C2MobileApp documentation:

- Node.js
- TypeScript
- Fastify
- MySQL managed through cPanel/phpMyAdmin
- Docker-ready runtime
- Billplz for direct payment and token top-up
- WhatsApp OTP primary, SMS only when the user explicitly requests it

## Domain Decision

Use `api.c2coffeeandcandle.com` for production API traffic.

Do not rely on `https://c2coffeeandcandle.com/api` unless a deliberate Vercel rewrite/proxy is configured, because the root domain is reserved for the C2Web landing site.

## Local Commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run migrate
npm run migrate:prod
npm run seed:demo
```

## Database

Create the real MySQL database and user in cPanel first, then copy `.env.example` to `.env` and fill:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

The reviewed schema source remains:

- `/Users/marketingdeveloper/DCStack/Documentation/C2MobileApp/SQL_Schema.sql`
- `/Users/marketingdeveloper/DCStack/Documentation/C2MobileApp/SQL_Seed.sql`

Before production, convert schema changes into ordered migration files under `src/db/migrations/`.

Current migration files:

- `001_create_customer_identity_auth.sql`
- `002_create_admin_rbac_audit.sql`
- `003_create_stores_menu_catalog.sql`
- `004_create_token_accounts_ledger.sql`
- `005_create_orders_payments_refunds.sql`
- `006_create_loyalty_vouchers_referrals.sql`
- `007_create_push_tokens.sql`

`npm run migrate` applies schema only.

`npm run seed:demo` applies schema first, then optional demo seed data. Do not use demo admin seed data in production.

## Health Check

```text
GET /health
GET /v1/health
```

## Uploaded assets

Marketing posters and menu images are served from the API host itself:

- route: `/assets/menu/*`
- disk root: `api/public/menu/`
- uploads: `api/public/menu/uploads/`

If an image is visible in the admin upload flow but the mobile app receives a 404, confirm that the file exists on the same API host that is serving the request and that the runtime can read the upload directory.

## Windows Server Deployment

Recommended production-style deployment:

- Docker container for the API
- IIS reverse proxy for `https://api.c2coffeeandcandle.com`
- MySQL remains external

Deployment guide:

- [DEPLOY_WINDOWS_SERVER.md](/Users/marketingdeveloper/DCStack/C2Coffee/api/DEPLOY_WINDOWS_SERVER.md)
