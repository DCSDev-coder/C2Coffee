# Online Token Top-up Readiness

## Current policy

- Menu purchases are paid with C2 Tokens only.
- CHIP Collect is the approved provider.
- FPX Online Banking and DuitNow QR are currently approved for launch.
- Cards and E-wallet remain disabled while CHIP shows them as Pending.
- Atome is not approved for C2 Token top-up.

## Fail-closed configuration

Keep `TOPUP_GATEWAY_ENABLED=false` until the CHIP API key and Brand ID are
installed, the configured method codes match CHIP `GET /payment_methods/`, and
one real payment callback has been verified. The secret key belongs only in the
API environment.

```
TOPUP_GATEWAY_ENABLED=false
TOPUP_GATEWAY_PROVIDER=chip
TOPUP_GATEWAY_BASE_URL=https://gate.chip-in.asia/api/v1/
TOPUP_GATEWAY_API_KEY=
TOPUP_GATEWAY_BRAND_ID=
TOPUP_GATEWAY_ALLOWED_METHODS=fpx,duitnow_qr
CHIP_FPX_METHOD_CODES=fpx
CHIP_DUITNOW_METHOD_CODES=duitnow_qr,dnqr
CHIP_CARD_METHOD_CODES=visa,mastercard,maestro
CHIP_EWALLET_METHOD_CODES=
```

## Required implementation before activation

1. Create a server-side top-up intent from fixed, server-owned token packages. Never accept token price or token quantity from the client.
2. Keep the existing top-up reference and pending payment record before creating a CHIP purchase.
3. Redirect customers to the provider only after the intent and pending payment record commit.
4. Verify CHIP's RSA `X-Signature` against the exact raw callback body and the public key from `GET /public_key/`. Then retrieve the referenced purchase from CHIP with the server-only API key and verify Brand ID, MYR currency, paid status, and exact amount before crediting tokens. Browser return URLs are informational only.
5. In one transaction, lock the payment, top-up, and token account; then credit tokens once, add a `topup_paid` ledger entry, and persist the provider event ID.
6. Reject duplicate, failed, cancelled, mismatched-currency, mismatched-amount, and late callbacks without changing the wallet.
7. Run `npm run reconcile:chip:prod` every five minutes. It releases expired reservations and rechecks pending CHIP purchases. Provider-paid records blocked by wallet capacity remain `needs_review` and are retried safely after capacity is available.
8. Run end-to-end tests for FPX and DuitNow QR success, failure, cancel, timeout, duplicate callback, delayed callback, and double-tap cases. Repeat the suite before enabling Cards or E-wallet.

## Activation evidence

Before changing `TOPUP_GATEWAY_ENABLED` to `true`, retain the CHIP approval,
test purchase references, callback verification result, and a successful
production-readiness run. Counter DuitNow is a separate release gate because
the current counter app still needs real order creation and payment settlement;
the payment-method endpoint alone is not proof of counter checkout.

## Reconciliation operation

From the running production container:

```powershell
docker compose exec -T c2-api npm run reconcile:chip:prod
```

The command prints only aggregate counts and failed provider references; it
does not print the CHIP secret. A non-zero exit code means at least one pending
purchase could not be retrieved or reconciled and requires an operator review.
