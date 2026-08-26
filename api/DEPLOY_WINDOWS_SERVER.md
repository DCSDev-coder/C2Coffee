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

- `PUBLIC_API_BASE_URL`
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `CORS_ALLOWED_ORIGINS` should include any browser origin you use for local testing, including the barista web build on `http://localhost:60120`

## 3. Initial auth test mode

Until the real WhatsApp OTP delivery is implemented, use:

```env
OTP_DELIVERY_MODE=stub
OTP_DEBUG_EXPOSE_CODE=true
```

This keeps the deployed server usable for end-to-end mobile testing because the
app can still receive the debug OTP from the API response.

Do not keep this enabled for public production use.

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
```

## 10. Operational notes

- The container binds only to `127.0.0.1:8080` on the server host
- Public traffic should come through IIS only
- The current auth flow stores OTPs in MySQL
- Real WhatsApp/SMS delivery is not implemented yet
- Billplz env placeholders are intentionally present but not yet required by live routes
