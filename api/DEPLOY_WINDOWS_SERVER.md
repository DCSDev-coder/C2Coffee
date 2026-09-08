# C2 Coffee API Deployment on Windows Server

This is the recommended production-style deployment path for C2 Coffee Phase 1.

It follows the same operational shape as Smart Monitoring:

- Docker runs the Node.js API
- IIS exposes the public HTTPS domain
- MySQL stays external
- DNS points the API subdomain to the Windows Server

## Target topology

- Mobile app -> `https://api.c2coffeeandcandle.com/v1`
- IIS reverse proxy -> `http://127.0.0.1:8080`
- Docker container -> Fastify API on internal port `8080`
- MySQL -> cPanel/phpMyAdmin-hosted database

## 1. Copy the backend to the server

Recommended server path:

```text
D:\C2Coffee\api
```

Copy the full contents of the local `api/` folder into that path.

## 2. Prepare the server env file

From the server path:

```powershell
copy .env.windows.example .env
```

Then edit `.env` and set the real values for:

- `NODE_ENV=production`
- `PUBLIC_API_BASE_URL`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CORS_ALLOWED_ORIGINS` can use bare localhost origins to allow any local port during development, for example `http://localhost` and `http://127.0.0.1`
- `OTP_DELIVERY_MODE=email` and `OTP_DEBUG_EXPOSE_CODE=false`
- SMTP settings: `EMAIL_SMTP_HOST`, `EMAIL_SMTP_USER`,
  `EMAIL_SMTP_PASSWORD`, and `EMAIL_FROM_ADDRESS`
- `FCM_DELIVERY_ENABLED=true` and `FCM_SERVICE_ACCOUNT_JSON` after storing
  the Firebase service-account JSON in the deployment secret store
- `PRINT_CONNECTOR_SHARED_SECRET` when a Windows Print Bridge or approved POS
  connector is deployed

## 3. OTP test mode is development-only

For a local development server only, use:

```env
OTP_DELIVERY_MODE=stub
OTP_DEBUG_EXPOSE_CODE=true
```

This allows local end-to-end testing because the app can receive the debug OTP
from the API response.

The API now refuses to start with this configuration when `NODE_ENV=production`.

## 4. Build and start the container

From:

```text
D:\C2Coffee\api
```

Run:

```powershell
docker compose build --no-cache
docker compose run --rm --no-deps c2-api npm run migrate:prod
docker compose up -d
```

## 5. Verify the container

Run:

```powershell
docker compose ps
docker compose logs --tail 100 c2-api
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/v1/health
```

Expected:

- `/health` returns `{"status":"ok","service":"c2coffee-api"}`
- `/v1/health` returns database health JSON

## 6. IIS reverse proxy

Configure IIS to terminate HTTPS for:

```text
https://api.c2coffeeandcandle.com
```

and proxy requests to:

```text
http://127.0.0.1:8080
```

Recommended public path behavior:

- `https://api.c2coffeeandcandle.com/health`
- `https://api.c2coffeeandcandle.com/v1/health`
- `https://api.c2coffeeandcandle.com/v1/auth/request-otp`

## 7. DNS

Point:

```text
api.c2coffeeandcandle.com
```

to the Windows Server public IP, not the cPanel server IP.

## 8. Database access prerequisite

Because the API container runs on a different machine from MySQL, ensure the
cPanel Remote MySQL access list includes the Windows Server public IP.

## 9. Updating the server later

From `D:\C2Coffee\api`:

```powershell
docker compose down
docker compose build --no-cache
docker compose run --rm --no-deps c2-api npm run migrate:prod
docker compose up -d
docker compose logs --tail 100 c2-api
docker compose exec c2-api npm run production-readiness:prod
```

## 10. Operational notes

- The container binds only to `127.0.0.1:8080` on the server host
- Public traffic should come through IIS only
- The current auth flow stores OTPs in MySQL and delivers them by SMTP email
  in production.
- Customer push delivery uses Firebase Cloud Messaging. The API stores
  professional in-app notifications even if FCM is temporarily unavailable.
- A printer route becomes connected only after a print connector heartbeat.
  The connector protocol is documented in `PRINT_CONNECTOR_PROTOCOL.md`.
- Billplz env placeholders are intentionally present but not yet required by live routes

## 11. Production readiness evidence

After the container is healthy and IIS/DNS are live, run:

```powershell
docker compose exec c2-api npm run production-readiness:prod
```

Record the command output with the deployment date. The verifier checks
production-safe configuration, public HTTPS health, local database health,
SMTP authentication, Admin Web CORS configuration, and FCM secret shape without
printing credentials. A `FAIL` result blocks release.

The remaining manual checks are deliberate because they require external
services or hardware: receive one OTP email, Admin Web login/refresh/logout,
customer push notification on a physical device, and a real receipt through the
deployed print bridge.
