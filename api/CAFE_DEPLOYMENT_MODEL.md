# Cafe deployment model

Each independent cafe business runs a separate API deployment and database. All outlets belonging to that cafe share its deployment.

This boundary is intentional because several catalog, loyalty, payment, notification, and media settings are deployment-wide. A second cafe must not be inserted into an existing cafe database.

## Existing C2 deployment

Set `DEPLOYMENT_TENANT_CODE=c2coffee`. The startup guard requires exactly one active row in `admin_tenants`, matching that code. It refuses to start if the database is empty, contains another cafe tenant, contains multiple tenants, or the configured tenant is inactive.

Adding another C2 branch is done from Admin Web > Outlets. New outlets are not customer-facing by default and cannot silently replace the outlet currently routed to the customer app.

## New independent cafe

Provision separate infrastructure and secrets for each cafe:

- database and database credentials
- API hostname and `PUBLIC_API_BASE_URL`
- unique access and refresh token secrets
- Admin Web origin and cookie settings
- payment gateway credentials and webhook secret
- Firebase/FCM service account
- SMTP, support email, media storage, and printer secrets
- branded Admin Web and mobile app configuration

Initialize a fresh database for the cafe. Do not clone C2 customer, order, token, voucher, or staff data. Set `DEPLOYMENT_TENANT_CODE` to the new cafe code, run the migrations, then run the one-time initializer before starting the API:

```bash
CAFE_BOOTSTRAP_NAME="Example Cafe Sdn Bhd" \
CAFE_BOOTSTRAP_DISPLAY_NAME="Example Cafe" \
CAFE_BOOTSTRAP_ADMIN_USERNAME="owner" \
CAFE_BOOTSTRAP_ADMIN_EMAIL="owner@example.com" \
CAFE_BOOTSTRAP_ADMIN_FULL_NAME="Cafe Owner" \
CAFE_BOOTSTRAP_TEMP_PASSWORD="replace-with-a-random-temporary-password" \
npm run initialize:cafe:prod
```

The initializer refuses to operate unless the database has the single untouched placeholder tenant and contains no customers, outlets, or orders. It replaces the bootstrap admin credentials, revokes old sessions, and requires a password change on first login.

## Before migration or rebuild

Back up the database, build the API, then run the read-only preflight:

```bash
npm run build
npm run preflight:admin:prod
```

Only proceed with migration when the preflight reports one matching active cafe, no orphan memberships, and at most one active customer-facing outlet.
