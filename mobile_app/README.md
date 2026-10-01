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

Production builds reject Billplz sandbox checkout URLs. Only local sandbox QA
builds may opt in with `--dart-define=ALLOW_BILLPLZ_SANDBOX=true`.

## Asset flow

Poster and menu images are loaded from the API asset routes. If an image returns 404, verify that the file exists on the API host under `api/public/menu/uploads/` and that the API runtime can read it.
