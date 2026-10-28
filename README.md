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

## ABITask support portal deployment

The support login, workspace overview, task listing and task creation must use the
ABITask bridge (`ABIT_TASK_PORTAL_BRIDGE_URL`, default `https://abitask.abit.ai`).
The PHP support endpoints in `dist/api/` are deployed on the website's cPanel
host. Updating code on Dev-02 or pushing to GitHub does not by itself publish
these PHP files: confirm successful cPanel deployment before live testing.

Azure DevOps `Common / ABITCONS_WEBSITE` (pipeline ID `168`) now runs CI and
production cPanel Git deployment on each `main` push. Its hosted Ubuntu
runner avoids the obsolete Dev-02 agent's `NodeTool@0` runtime crash. CI runs
`npm ci`, `npm test`, `npm run build`, and verifies the generated `dist/` exactly
matches the committed files used by `.cpanel.yml` (ignoring host-specific
line endings). If this check fails, run
`npm run build` on Dev-02 and commit the generated `dist/` together with source.

Before production deployment, set `CPANEL_HOST`, `CPANEL_USER`,
and **secret** `CPANEL_TOKEN` in Azure DevOps > Common >
Pipelines > ABITCONS_WEBSITE > Edit > Variables. `CPANEL_REPO_ROOT` is optional:
the release discovers the unique matching cPanel Git repo by its exact GitHub remote URL. `CPANEL_PORT` defaults to 2083. Restrict access and do not commit or
print credentials. The deploy stage fails closed if variables are absent,
checks the cPanel Git repository is this website, verifies the deployed commit,
and runs the public support API smoke test. A successful build artifact alone
**does not** mean the production website has been deployed.

`.github/workflows/cpanel-deploy.yml` is now manual-only. Azure DevOps is
the automatic production release pipeline. The GitHub Actions fallback can
only be run after the GitHub account's billing restriction is resolved.
Manual fallback uses `.github/workflows/cpanel-deploy.yml` after billing is restored. If GitHub Actions
cannot start (e.g. organization billing issue), an authorized operator can
configure `CPANEL_HOST`, `CPANEL_USER`, `CPANEL_TOKEN`, and `CPANEL_REPO_ROOT`
**in the Dev-02 process environment** and run `npm run deploy:cpanel:dev02`.
Optional: `CPANEL_PORT` (default 2083). This fallback only deploys a clean,
pushed `main` branch after verifying the cPanel repository binding, and runs
a credential-free live support smoke test. Never commit hosting credentials.

Live authenticated acceptance (requires a valid ABITask test account) should
verify the user-to-client mapping, `#support-portal/CHT`, the ERPNext tasks and
statuses for project `PROJ-0015`, and a new ERP task created and shown back
in the same support workspace. Do not claim these tests passed based on the
credential-free smoke check alone.
