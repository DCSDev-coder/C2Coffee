# Online Token Top-up Readiness

## Current policy

- Menu purchases are paid with C2 Tokens only.
- Online top-up is disabled until the approved payment provider supplies sandbox access and webhook documentation.
- Permitted top-up methods are Touch 'n Go eWallet, credit/debit card, and supported bank transfer/FPX methods.
- Atome is not supported.

## Fail-closed configuration

Keep `TOPUP_GATEWAY_ENABLED=false` in every environment until all items below are complete. When enabled, the API requires a provider name, HTTPS gateway URL, API key, webhook secret, and at least one permitted method. Unsupported methods, including Atome, make the API refuse to start.

```
TOPUP_GATEWAY_ENABLED=false
TOPUP_GATEWAY_PROVIDER=
TOPUP_GATEWAY_BASE_URL=
TOPUP_GATEWAY_API_KEY=
TOPUP_GATEWAY_WEBHOOK_SECRET=
TOPUP_GATEWAY_ALLOWED_METHODS=touch_n_go,card,bank_transfer
```

## Required implementation before activation

1. Create a server-side top-up intent from fixed, server-owned token packages. Never accept token price or token quantity from the client.
2. Use an idempotency key per top-up intent. Repeated taps must return the existing pending payment rather than create another bill.
3. Redirect customers to the provider only after the intent and pending payment record commit.
4. Verify every provider webhook using its documented raw-body signature and timestamp/replay protection. Browser return URLs are informational only and must never credit tokens.
5. In one transaction, lock the payment, top-up, and token account; then credit tokens once, add a `topup_paid` ledger entry, and persist the provider event ID.
6. Reject duplicate, failed, cancelled, mismatched-currency, mismatched-amount, and late callbacks without changing the wallet.
7. Add a reconciliation job for pending payments and manual review of provider-paid records that were not credited.
8. Run sandbox tests for Touch 'n Go, card, and bank transfer/FPX success, failure, cancel, timeout, duplicate webhook, delayed webhook, and double-tap cases.

## Activation evidence

Before changing `TOPUP_GATEWAY_ENABLED` to `true`, retain the provider approval, sandbox test references, webhook verification result, and a successful production-readiness run. Then enable the mobile top-up action only after production callback verification succeeds.
