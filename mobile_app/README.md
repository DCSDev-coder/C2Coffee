# C2 Coffee Mobile App

Flutter mobile client for customers.

## API base URL

`lib/services/api_config.dart` uses the production API endpoint:

- `https://api.c2coffeeandcandle.com/v1`

Examples:

```bash
flutter run
flutter build apk
flutter build ios
```

## Asset flow

Poster and menu images are loaded from the API asset routes. If an image returns 404, verify that the file exists on the API host under `api/public/menu/uploads/` and that the API runtime can read it.
