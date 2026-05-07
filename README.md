# ABiT Consulting Website

## Environment variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_API_BASE_URL=
PORT=3000
SQLITE_PATH=data/abitcons.sqlite
```

- `VITE_GOOGLE_CLIENT_ID` enables real Google sign-in on `#account-access`.
- `VITE_GA_MEASUREMENT_ID` enables GA4 page view tracking, including hash route changes.
- `VITE_API_BASE_URL` can point the frontend at a separate API host. Leave it empty locally so Vite proxies `/api/*` to `http://127.0.0.1:3000`. Production builds default API requests to `https://abitcons.com`.
- `PORT` controls the Node backend server port.
- `SQLITE_PATH` controls where registration data is stored.

## Google OAuth production setup

Configure your Google Cloud OAuth app with the website domains used by this project.

### Authorized JavaScript origins

- `https://abitcons.com`
- `http://localhost:3000` (or your actual local dev port)

### Authorized redirect URI (only if popup/redirect callback is used)

- `https://abitcons.com/oauth-popup.html`

> Note: this project currently uses Google Identity Services token popup flow (`select_account`) directly from the main page, so the redirect URI is optional unless you enable redirect-based callbacks.

## Local development

The backend uses Node's built-in SQLite module, so run it on Node 22.5 or newer.

```bash
npm install
npm run server
npm run dev
```

Run the Vite dev server and backend server in separate terminals. Vite proxies `/api/*`
to `http://127.0.0.1:3000`.

## Build

```bash
npm run build
npm run start
```
