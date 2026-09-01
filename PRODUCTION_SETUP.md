# C2 Coffee Production and Local Test Setup

This file is the single reference for how the three apps connect during local development and in production.

## Service map

- `api` serves the backend and uploaded marketing/menu assets.
- `admin_web` talks to the API from the browser.
- `mobile_app` and `barista_app` talk to the API from Flutter.

## Production URLs

- API: `https://api.c2coffeeandcandle.com`
- Flutter mobile/barista API prefix: `https://api.c2coffeeandcandle.com/v1`
- Admin web API origin: `https://api.c2coffeeandcandle.com`

## Local Windows-hosted API testing

In the current Windows deployment, the Docker container binds to `127.0.0.1:8080` on the server and IIS exposes the public HTTPS domain.

That means:

- on the Windows server itself, use `http://127.0.0.1:8080`
- from your Mac, phone, or tablet, use the public API domain

The app clients are now locked to the public API host in code:

- Flutter mobile/barista: `https://api.c2coffeeandcandle.com/v1`
- Admin web: `https://api.c2coffeeandcandle.com`

## Build examples

### mobile_app

```bash
flutter run
flutter build apk
```

### barista_app

```bash
flutter run
flutter build apk
```

### admin_web

```bash
npm run dev
npm run build
```

## Asset rule

Uploaded posters and menu images must exist on the API host under:

`api/public/menu/uploads/`

If the API host changes, the file storage must move with it or the app will show broken images.

## Session rule

Admin web already attempts token refresh automatically. If refresh fails, the user must sign in again.
