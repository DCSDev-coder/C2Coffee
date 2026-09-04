# C2 Coffee Admin Web

React + Vite admin panel.

## API base URL

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` for the API environment you intend to use. Production defaults to `https://api.c2coffeeandcandle.com` when the variable is not supplied.

Notes:

- `admin_web/src/lib/adminApi.js` already has refresh-token handling and formats expired-session errors as a sign-in prompt.
- In the current deployment, the Windows API container is exposed through IIS, so the public domain is the normal client target.
- The local Vite dev server commonly runs on `http://localhost:5173`, but it still calls the public API host.

## Asset and session flow

- Marketing posters and menu images are read from the API, not from the web app bundle.
- If a request fails after the app sits idle, the app should attempt a token refresh first and then ask the admin to sign in again if the refresh token is no longer valid.
