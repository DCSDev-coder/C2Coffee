# C2 Store App

This Flutter application is the outlet workstation for both Counter and
Barista operations. One installed device is activated against a tenant and
outlet, then staff choose the Counter or Barista workspace.

Build one Flutter project and produce Android and iOS variants from that shared
codebase. Android can be released first when the selected kiosk, printer, and
payment-terminal hardware is Android-based.

The default API is `https://api.c2coffeeandcandle.com`. Override it for a
different cafe deployment at build or run time, for example:

```bash
flutter run --dart-define=API_BASE_URL=https://api.example-cafe.com
flutter build apk --release --dart-define=API_BASE_URL=https://api.example-cafe.com
```

Use HTTPS for every production deployment. Do not point a physical device at
`localhost`; that address refers to the device itself.

## First-install login

1. A Super Admin or Operations Admin creates a device in Admin Web under
   **C2 Store Devices** and assigns it to an active outlet.
2. Admin Web displays a one-time activation code for 30 minutes.
3. The installed app posts that code to `POST /v1/counter/activate`.
4. The API returns a device token once.
5. Store the token with `flutter_secure_storage` (Android Keystore/iOS Keychain),
   never SharedPreferences, logs, analytics, screenshots, or source code.
6. On every app launch, call `GET /v1/counter/device` with the bearer token.
7. A `401` means the device was revoked, reset, or is no longer valid. Delete
   the local token and return to activation.

The device remains activated until an admin disables, revokes, or reissues its
activation. Reissuing activation invalidates the old credential immediately.

## Workspace and session boundaries

- The device credential owns the outlet binding and printer worker.
- Counter customer sessions last ten minutes, stay in memory, and are cleared
  after checkout, cancellation, timeout, or leaving the Counter workflow.
- Barista staff authenticate separately. Staff logout does not deactivate the
  device or stop its printer worker.
- Counter device, Barista staff, and customer credentials use separate secure
  storage or memory namespaces and are never interchangeable.

The durable printer worker starts after device verification and continues while
the user moves between workspaces. It claims only jobs assigned to the same
tenant, outlet, and workstation key.

## Migrating an outlet from the standalone Barista app

1. Install and activate C2 Store against the correct outlet.
2. Open **Barista Workspace > Workstation**, enter the outlet printer IP address
   and port, then save it. The activated device registers that printer against
   its own tenant and outlet.
3. Run a physical test print on the outlet Wi-Fi. The printer becomes active
   for new orders only after that test succeeds.
4. Confirm one real order prints once before removing the standalone
   Barista app.

The old Barista app and C2 Store have different package identities, so Android
secure storage does not transfer the old workstation code automatically. Keep
the standalone app available as a rollback during the pilot; do not let both
apps claim the same printer queue at the same time.

Direct ESC/POS network printing is currently enabled only on Android. The iOS
app builds successfully, but it will not claim or send direct printer jobs.

Firebase order push is intentionally not enabled in this merged package yet.
The Counter Android/iOS application must first be registered in Firebase with
its own package identifiers and configuration files. Five-second authorised
queue polling remains active in the Barista workspace in the meantime.

## Customer session

The device is permanently scoped to one deployment tenant and one outlet.
Customers identify themselves by phone number. The returned customer session
lasts ten minutes and must stay in memory only. Clear it and the cart after
checkout, cancellation, or idle timeout.

See [the backend API contract](../api/COUNTER_APP_API.md) for endpoints and
headers.

## Payment boundary

Counter orders use RM. Mobile orders use customer tokens. QR/card checkout must
not be enabled until the payment provider supplies a server-verifiable payment
callback. The counter client must never be trusted to declare a payment paid.

The current app can activate a device, load its outlet menu, identify a member,
and display that member's active RM-compatible vouchers. It deliberately does
not calculate a voucher discount, create a paid order, redeem a voucher, or show
a successful payment. Those actions require the server-side counter quote,
voucher reservation, pending-order, and verified payment-callback workflow.
