# A-to-Z self-hosting installation guide

Target: one Linux VPS running the store (Node.js) + a Supabase-compatible backend (self-hosted Docker on the same or a second VPS, or supabase.com).

---

## A. Server requirements

| | Minimum | Recommended |
|---|---|---|
| OS | Ubuntu 22.04/24.04 LTS (any Linux with systemd) | Ubuntu 24.04 |
| App server | 1 vCPU, 1 GB RAM, 10 GB disk | 2 vCPU, 2 GB RAM |
| Self-hosted Supabase (Docker) | 2 vCPU, 4 GB RAM, 40 GB SSD | 4 vCPU, 8 GB RAM |
| Software | Node.js 20 or 22, npm/bun, git, nginx, certbot | + Docker 24+ (for self-hosted Supabase), `postgresql-client-15+` with zstd |
| Network | Ports 80 + 443 open; 22 restricted | Firewall (ufw), fail2ban |

### cPanel / shared hosting compatibility
* **Works only** if your cPanel offers **"Setup Node.js App"** (CloudLinux / Passenger) with Node 20+, SSH access, and enough memory (≥1 GB) to run `npm install`. Upload the built `.output/` folder and set the startup file to `server/index.mjs`.
* The **database cannot run on cPanel** (MySQL/MariaDB are incompatible). Use supabase.com or a self-hosted Supabase on a VPS.
* Plain PHP-only shared hosting: **not supported** (the store needs a running Node.js server for SSR, checkout and webhooks).
* Alternative without a server: build with the default `cloudflare-module` preset and deploy to your own Cloudflare account (`npx wrangler deploy`).

## B. Domain & DNS

1. Buy/own the domain. In DNS create:
   * `A  @    → <app VPS IPv4>` (and `AAAA` if IPv6)
   * `A  www  → <app VPS IPv4>` (or `CNAME www → yourstore.com`)
   * `A  api  → <Supabase VPS IP>` (only if self-hosting Supabase)
2. Lower TTL to 300 s a day before switching from Lovable.
3. Decide the primary form (`https://www.yourstore.com` **or** `https://yourstore.com`).

## C. Base server setup

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx certbot python3-certbot-nginx git ufw fail2ban postgresql-client zstd
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt -y install nodejs
sudo adduser --system --group --home /srv/store store
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

## D. Database, auth & storage (Supabase-compatible)

**Option 1 — supabase.com (simplest):** create a project, note *Project URL*, *anon/publishable key*, *service_role key*, DB connection string.

**Option 2 — self-hosted Supabase (Docker):**
```bash
git clone --depth 1 https://github.com/supabase/supabase /opt/supabase
cd /opt/supabase/docker && cp .env.example .env
# Edit .env: POSTGRES_PASSWORD, JWT_SECRET (≥32 chars), ANON_KEY, SERVICE_ROLE_KEY
# (generate keys from JWT_SECRET per Supabase self-hosting docs), SITE_URL, API_EXTERNAL_URL=https://api.yourstore.com,
# SMTP_* for auth emails, ENABLE_EMAIL_AUTOCONFIRM=false
docker compose pull && docker compose up -d
```
Put nginx + SSL in front of Kong (port 8000) at `api.yourstore.com`. Never expose port 5432 publicly.


**Option 3 — bare metal, no Docker (this exact path was tested end-to-end on 2026-10-23):**
Components: PostgreSQL 15+, Supabase Auth (GoTrue) v2.180.0, PostgREST v14, Supabase Storage API v1.11 (Node 24, file backend), and the bundled one-file gateway.
```bash
# 1. Empty database + standard roles (edit the 3 passwords first)
createdb -U postgres postgres 2>/dev/null || true
psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f scripts/selfhost/bare-metal/00-bootstrap-roles.sql

# 2. JWT secret + API keys (keep the output secret)
export JWT_SECRET=$(openssl rand -hex 32)
node scripts/selfhost/bare-metal/make-keys.mjs > /srv/store/keys.env   # JWT_SECRET, ANON_KEY, SERVICE_KEY

# 3. Auth server (GoTrue) — binary from github.com/supabase/auth/releases, migrations from the same tag
git clone --depth 1 --branch v2.180.0 https://github.com/supabase/auth /opt/auth-src
export GOTRUE_DB_DRIVER=postgres GOTRUE_DB_MIGRATIONS_PATH=/opt/auth-src/migrations \
  DATABASE_URL='postgres://supabase_auth_admin:CHANGE_ME_AUTH_ADMIN@127.0.0.1:5432/postgres?sslmode=disable' \
  GOTRUE_JWT_SECRET=$JWT_SECRET GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  GOTRUE_JWT_ADMIN_ROLES=service_role API_EXTERNAL_URL=https://api.yourstore.com/auth/v1 \
  GOTRUE_SITE_URL=https://www.yourstore.com GOTRUE_URI_ALLOW_LIST='https://www.yourstore.com/**,https://yourstore.com/**' \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_MAILER_AUTOCONFIRM=false \
  GOTRUE_MFA_TOTP_ENROLL_ENABLED=true GOTRUE_MFA_TOTP_VERIFY_ENABLED=true \
  GOTRUE_SMTP_HOST=smtp.yourprovider.com GOTRUE_SMTP_PORT=587 GOTRUE_SMTP_USER=... GOTRUE_SMTP_PASS=... GOTRUE_SMTP_ADMIN_EMAIL=no-reply@yourstore.com
auth migrate && auth serve            # run under systemd in production
# Google (optional): GOTRUE_EXTERNAL_GOOGLE_ENABLED=true GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=... GOTRUE_EXTERNAL_GOOGLE_SECRET=...
#                    GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://api.yourstore.com/auth/v1/callback

# 4. Storage API (Node 24) — creates the storage schema on first start
git clone --depth 1 https://github.com/supabase/storage /opt/storage && cd /opt/storage
npm ci --ignore-scripts --engine-strict=false && npm rebuild fs-xattr && npm run build
SERVER_HOST=127.0.0.1 SERVER_PORT=5000 TENANT_ID=stub GLOBAL_S3_BUCKET=stub REGION=local \
AUTH_JWT_SECRET=$JWT_SECRET AUTH_JWT_ALGORITHM=HS256 ANON_KEY=... SERVICE_KEY=... \
DATABASE_URL=postgresql://supabase_storage_admin:CHANGE_ME_STORAGE_ADMIN@127.0.0.1:5432/postgres \
DB_INSTALL_ROLES=false DB_SUPER_USER=supabase_storage_admin STORAGE_BACKEND=file \
STORAGE_FILE_BACKEND_PATH=/srv/store/storage UPLOAD_FILE_SIZE_LIMIT=52428800 IMAGE_TRANSFORMATION_ENABLED=false \
node dist/start/server.js            # or STORAGE_BACKEND=s3 with your own S3/R2/MinIO bucket

# 5. Store schema (37 migrations) + optional starter-data cleanup
DATABASE_URL=postgresql://postgres:PASSWORD@127.0.0.1:5432/postgres scripts/selfhost/apply-migrations.sh
psql "$DATABASE_URL" -f scripts/selfhost/remove-sample-data.sql      # removes 4 demo products / 3 brands

# 6. Data API (PostgREST)
cat > /etc/postgrest.conf <<CONF
db-uri = "postgres://authenticator:CHANGE_ME_AUTHENTICATOR@127.0.0.1:5432/postgres"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-host = "127.0.0.1"
server-port = 3001
db-extra-search-path = "public,extensions"
CONF
postgrest /etc/postgrest.conf

# 7. One URL for the browser (/auth/v1, /rest/v1, /storage/v1) — put nginx+SSL in front as api.yourstore.com
GATEWAY_PORT=8000 node scripts/selfhost/bare-metal/gateway.mjs

# 8. Media bucket
curl -X POST https://api.yourstore.com/storage/v1/bucket -H "Authorization: Bearer $SERVICE_KEY" \
  -H 'content-type: application/json' -d '{"id":"media","name":"media","public":false}'
```
Then continue with §E using `VITE_SUPABASE_URL=SUPABASE_URL=https://api.yourstore.com`, `*_PUBLISHABLE_KEY=$ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY`.

**Create the schema** (Options 1–2, fresh install, empty database):
```bash
DATABASE_URL='postgresql://postgres:PASSWORD@db-host:5432/postgres' scripts/selfhost/apply-migrations.sh
```
This runs every file in `drizzle/migrations/` in order and records them, so later updates apply only new files.
For a migration **from Lovable**, do not run this — restore the export instead (MIGRATION.md).

**Storage:** create a private bucket named `media` (dashboard, or the curl in Option 3 step 8). The migrations contain its access rules.

**Starter data:** a fresh install contains 4 demo products and 3 brands; remove them with `psql "$DATABASE_URL" -f scripts/selfhost/remove-sample-data.sql`.

**Auth settings:** Site URL = your primary URL; Redirect URLs: `https://www.yourstore.com/auth`, `https://yourstore.com/auth`. Disable anonymous sign-ups. Enable TOTP MFA. Google (optional): create an OAuth client in Google Cloud (redirect `https://api.yourstore.com/auth/v1/callback`), enable the Google provider in Supabase Auth, and build with `VITE_OAUTH_MODE=supabase`.

## E. Application deployment

```bash
sudo -u store -H bash
cd /srv/store && git clone <your-repo-url> app && cd app
cp .env.example .env && nano .env      # fill real values (see .env.example)
scripts/selfhost/build-node.sh          # installs deps, builds .output/, installs nodemailer
```
Install the systemd service and nginx site:
```bash
sudo cp scripts/selfhost/store.service /etc/systemd/system/store.service
sudo systemctl daemon-reload && sudo systemctl enable --now store
sudo cp scripts/selfhost/nginx.conf.example /etc/nginx/sites-available/store
sudo sed -i 's/yourstore.com/<your domain>/g' /etc/nginx/sites-available/store
sudo ln -s /etc/nginx/sites-available/store /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
```
Later deployments: `scripts/selfhost/deploy-vps.sh` (pull → build → atomic switch → restart → health check → auto-rollback).

## F. SSL

```bash
sudo certbot --nginx -d yourstore.com -d www.yourstore.com
sudo systemctl list-timers | grep certbot   # auto-renew is installed
```
Then in **Admin → Settings → Store**: set *Primary website URL*, save, and (after HTTPS works on both hosts) turn on *Redirect www / non-www*.

## G. First admin account

1. Open `https://yourstore.com/auth` and sign up (every signup becomes **customer** — by design).
2. Promote that user once, directly in the database (SQL editor or `psql`):
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@yourstore.com'
on conflict do nothing;
```
3. Sign out/in, open `/admin`, enable 2FA under Account → Security. Further staff are added only from Admin → Staff.

## H. SMTP

Admin → Email Settings: fill each profile (General, Contact, Orders, Security): host, port, SSL/STARTTLS, username, password, sender. Click **Send test email** — a profile can only be enabled after a successful test. Ensure SPF, DKIM and DMARC DNS records exist for the sender domain. Supabase Auth emails (confirm signup/reset password) use the SMTP settings of your Supabase instance (`SMTP_*` in its `.env` or dashboard).

## I. Stripe webhooks (when you decide to enable card payments)

1. Admin → Payments: enter publishable + secret keys (test first), save, **Test connection**.
2. Stripe Dashboard → Developers → Webhooks → *Add endpoint*: URL shown in Admin → Payments (`https://<primary domain>/api/public/stripe-webhook`). Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`.
3. Paste the signing secret (`whsec_…`) into Admin → Payments, then switch Stripe on. If the domain changes, update the endpoint URL in Stripe.

## J. Storage

Files live in the `media` bucket. Uploads go through the admin Media library. Back up the Docker volume `supabase/docker/volumes/storage` (self-hosted) or use the storage API. Images can be served via a CDN by pointing it at the storage URL.

## K. Cron jobs

The store needs **no** scheduled jobs. Recommended crontab (`crontab -e` as `store`):
```cron
15 2 * * *  /srv/store/app/scripts/selfhost/backup.sh >> /var/log/store-backup.log 2>&1
```
Optional: `curl -fsS https://yourstore.com/sitemap.xml >/dev/null` hourly as an uptime check.

## L. Backups

`scripts/selfhost/backup.sh` creates a compressed `pg_dump` (custom format, includes `auth` users) + storage tarball, keeps 14 days, optional off-site copy with `rclone`. Test a restore monthly on a staging DB with `scripts/selfhost/db-import.sh`.

## M. Security

* `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_ENCRYPTION_KEY`, DB password: server only, `chmod 600 .env`, never `VITE_`.
* Keep RLS enabled on every table (migrations do this). Never grant `admin` except via the SQL in §G or Admin → Staff.
* nginx config includes HSTS, rate limits for `/auth` and `/api/`. Keep `ufw` on, SSH keys only, `fail2ban`.
* Postgres port never public; Supabase Studio behind VPN/basic-auth.
* `npm audit` monthly; `sudo unattended-upgrades` on.

## N. Updates

```bash
cd /srv/store/app && scripts/selfhost/deploy-vps.sh
DATABASE_URL=... scripts/selfhost/apply-migrations.sh   # only if new files in drizzle/migrations
```
Always back up before applying migrations. Migrations are additive (no drops/renames) so the previous release keeps working during rollout.

## O. Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `systemctl status store`, `journalctl -u store -n 100`; port in `.env` matches nginx `proxy_pass` |
| Blank page / "This page didn't load" | `VITE_SUPABASE_URL` / key were missing **at build time** → rebuild |
| `permission denied for table …` | Missing GRANTs — re-run migrations; don't disable RLS |
| `Expected 3 parts in JWT` | Using an `sb_publishable_` key with an old Supabase — use the matching anon key |
| Sitemap shows wrong domain | Admin → Settings → Primary website URL; `SITE_URL`; nginx sends `X-Forwarded-Host`/`-Proto` |
| Redirect loop | Turn off *Redirect www / non-www*; ensure nginx passes `X-Forwarded-Proto https` |
| SMTP "Cannot find package nodemailer" | `cd .output/server && npm i nodemailer` (build script does this) |
| Webhook 400 Invalid signature | Wrong `whsec_` secret, or proxy altering body (don't gzip/modify POST bodies) |
| Users can't log in after migration | Auth `Site URL`/redirect URLs; JWT secret of new instance; users must sign in again (old sessions invalid) |
| Images broken after migration | Run `migrate-media.mjs`; bucket `media` exists; storage URL reachable |

## P. Rollback

* **App:** `deploy-vps.sh` keeps the last 5 releases in `/srv/store/releases`. `scripts/selfhost/rollback.sh` points `current` to the previous release and restarts.
* **Database:** restore the pre-deploy dump: `scripts/selfhost/db-import.sh backups/<file>.dump` (onto a fresh DB, then switch `SUPABASE_URL`) — never restore over a live DB without a fresh backup.
* **Domain migration:** while Lovable hosting is still published, switching DNS back to Lovable's records restores the old site within the TTL.
