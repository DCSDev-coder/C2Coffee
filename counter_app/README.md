# C2 Counter App Integration

This directory is the handoff boundary for the Flutter counter application.
The UI application is intentionally not scaffolded here yet; its backend is
implemented in `../api`.

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
   **Counter Devices** and assigns it to an active outlet.
2. Admin Web displays a one-time activation code for 30 minutes.
3. The installed app posts that code to `POST /v1/counter/activate`.
4. The API returns a device token once.
5. Store the token with `flutter_secure_storage` (Android Keystore/iOS Keychain),
   never SharedPreferences, logs, analytics, screenshots, or source code.
6. On every app launch, call `GET /v1/counter/device` with the bearer token.
7. A `401` means the device was revoked, reset, or is no longer valid. Delete
   the local token and return to activation.

Staff do not log in daily. The device remains logged in until an admin disables,
revokes, or reissues its activation. Reissuing activation invalidates the old
credential immediately.

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
