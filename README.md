# ABiT Consulting Website

## Environment variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

- `VITE_GOOGLE_CLIENT_ID` enables real Google sign-in on `#account-access`.
- `VITE_GA_MEASUREMENT_ID` enables GA4 page view tracking, including hash route changes.

## Google OAuth production setup

Configure your Google Cloud OAuth app with the website domains used by this project.

### Authorized JavaScript origins

- `https://abitcons.com`
- `http://localhost:3000` (or your actual local dev port)

### Authorized redirect URI (only if popup/redirect callback is used)

- `https://abitcons.com/oauth-popup.html`

> Note: this project currently uses Google Identity Services token popup flow (`select_account`) directly from the main page, so the redirect URI is optional unless you enable redirect-based callbacks.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
