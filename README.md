# ABiT Consulting Website

## Environment variables

Copy `.env.example` to `.env` and configure:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_API_BASE_URL=
PORT=3000
SQLITE_PATH=data/abitcons.sqlite
SESSION_TTL_HOURS=168
ODOO_ENV_PATH=
ODOO_URL=
ODOO_DB=
ODOO_USERNAME=
ODOO_PASSWORD=
ODOO_HELPDESK_TEAM_ID=
ODOO_MATCH_COMPANY_NAME=false
WHATSAPP_PROVIDER=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
META_WA_TOKEN=
META_WA_PHONE_NUMBER_ID=
```

- `VITE_GA_MEASUREMENT_ID` enables GA4 page view tracking. Production builds already use the public GA4 measurement ID in `.env.production`; override it in `.env` only if you need a different property locally.
- `VITE_API_BASE_URL` can point the frontend at a separate API host. Leave it empty locally so Vite proxies `/api/*` to `http://127.0.0.1:3000`. Production builds use same-origin `/api/*` by default.
- `PORT` controls the Node backend server port.
- `SQLITE_PATH` stores short-lived website sessions for users who successfully authenticate against Odoo.
- `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, and `ODOO_PASSWORD` connect the portal to Odoo. Customer users sign in with their own Odoo username/password; the service account is used server-side to read helpdesk/project data for the matched customer partner.
- `ODOO_HELPDESK_TEAM_ID` is optional and assigns newly created support tickets to a specific Odoo helpdesk team.
- `ODOO_MATCH_COMPANY_NAME=true` optionally lets the portal match records by company name when partner/email matching is not enough.
- `WHATSAPP_PROVIDER` can be `twilio` or `meta`; the matching `TWILIO_*` or `META_WA_*` values enable optional WhatsApp recovery notifications.
- Static/PHP hosting can use the fallback endpoints copied from `public/api/*.php`. Set `ABIT_PORTAL_DATA_DIR` on the host to store session metadata outside the web root; if it is unset, the PHP fallback writes to `../abit_portal_data` relative to the deployed web root.

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
