# C2 Coffee Mobile App

Flutter mobile client for customers.

## API base URL

The C2 build defaults to the production API endpoint:

- `https://api.c2coffeeandcandle.com/v1`

Examples:

```bash
flutter run
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.c2coffeeandcandle.com/v1
flutter build ios --release \
  --dart-define=API_BASE_URL=https://api.c2coffeeandcandle.com/v1
```

Every separately deployed cafe must supply its own HTTPS `/v1` endpoint using
`API_BASE_URL`. Invalid, credential-bearing, or unversioned URLs are rejected.

Production builds accept only HTTPS checkout URLs on CHIP-owned
`chip-in.asia` hosts. Payment creation and confirmation happen through the C2
API; the CHIP secret key must never be included in a Flutter build.

## Customer app update notices

The app checks this HTTPS manifest after launch, when returning to the
foreground, and periodically while open:

`https://www.c2coffeeandcandle.com/download/mobile/latest.json`

Copy `deployment/mobile-update/latest.json.example` to the cPanel download
location as `latest.json` only after the corresponding iOS and Android versions
are available in their stores. Increase `build_number` for every release. The
app compares that value with the installed build and opens the correct store
listing when the customer chooses **Update now**. Keep the manifest valid JSON
and serve it over HTTPS.

## Asset flow

Poster and menu images are loaded from the API asset routes. If an image returns 404, verify that the file exists on the API host under `api/public/menu/uploads/` and that the API runtime can read it.

## Project layout

- `lib/` contains the customer application source.
- `assets/images/` contains packaged customer-app fallbacks and interface assets.
- `assets/fonts/` contains only the font files declared in `pubspec.yaml`.
- `android/`, `ios/`, and `web/` contain Flutter platform projects.
- `test/` contains automated tests.
- `play_store_assets/` and `testflight_screenshots_*` are release-listing assets; they are not runtime application code.

Generated folders such as `build/`, `.dart_tool/`, Android Gradle caches, IDE
metadata, Flutter crash logs, and Finder metadata must not be committed. Run
`flutter clean` when generated build output needs to be removed.
