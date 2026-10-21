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

## Barista workspace and printer

1. Install and activate C2 Store against the correct outlet.
2. Open **Barista Workspace > Workstation**, enter the outlet printer IP address
   and port, then save it. The activated device registers that printer against
   its own tenant and outlet.
3. Run a physical test print on the outlet Wi-Fi. The printer becomes active
   for new orders only after that test succeeds.
4. Confirm one real order prints once before putting the workstation into live
   service.

Direct ESC/POS network printing is currently enabled only on Android. The iOS
app builds successfully, but it will not claim or send direct printer jobs.

Firebase order push is intentionally not enabled in this merged package yet.
The Counter Android/iOS application must first be registered in Firebase with
its own package identifiers and configuration files. Five-second authorised
queue polling remains active in the Barista workspace in the meantime.

## Android updates from cPanel

On the **Choose workspace** page, open the settings icon and select **Update**.
The app reads this HTTPS manifest by default:

`https://www.c2coffeeandcandle.com/download/counterdownload/latest.json`

Override it during a build only when another deployment owns its update files:

```bash
flutter build apk --release \
  --dart-define=COUNTER_UPDATE_MANIFEST_URL=https://example.com/updates/c2-store/latest.json
```

Every release must have a larger build number in `pubspec.yaml`, for example
`1.0.1+2`. Build it with the same Android release signing key as the installed
app. Android rejects an APK signed by another key even if the manifest and
checksum are valid.

On Windows, prepare the two cPanel files after the release build:

```powershell
flutter build apk --release
powershell -ExecutionPolicy Bypass -File scripts\prepare_cpanel_update.ps1
```

Upload everything from `build\cpanel-update` into:

`public_html/download/counterdownload/`

Upload the versioned APK first and `latest.json` last. This prevents a device
from seeing a release before its APK is available. The app accepts only HTTPS
APK URLs, verifies the SHA-256 after Android downloads it, and then opens the
system installer. The first update requires the operator to allow C2 Store to
install apps from this source.

The same folder serves the unlisted staff download page at
`https://www.c2coffeeandcandle.com/download/counterdownload`. The page is
excluded from site navigation and marked `noindex`, but possession of the link
is still the access boundary; it is not password authentication.

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
