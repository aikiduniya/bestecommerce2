# Self-hosting release — START HERE

Release: 2026-10-23 · 38 database migrations (0000–0037) · Node 22+ (Node 24 for Supabase Storage)

You need no Lovable account or service. Everything runs on your own server, database, storage and domain.

## 1. What is in this package
| Folder / file | Purpose |
|---|---|
| `src/`, `public/`, `package.json`, `bun.lock`, config files | Complete store source code |
| `drizzle/migrations/*.sql` | All database migrations, applied in order |
| `scripts/selfhost/apply-migrations.sh` | Fresh install + every update (applies only new files) |
| `scripts/selfhost/seed-defaults.sql` | Default pages, FAQs, contact email template (safe to re-run) |
| `scripts/selfhost/remove-sample-data.sql` | Removes the 4 demo products / 3 brands |
| `scripts/selfhost/bare-metal/` | No-Docker setup: database roles, key generator, API gateway |
| `scripts/selfhost/build-node.sh` | Builds the Node.js server (`SELF_HOSTED=1`, no Lovable code) |
| `scripts/selfhost/deploy-vps.sh` | Update: backup → migrations → new release → health check → auto-rollback |
| `scripts/selfhost/rollback.sh` | Switch back to the previous release |
| `scripts/selfhost/backup.sh`, `db-export.sh`, `db-import.sh` | Backups, export and import |
| `scripts/selfhost/migrate-media.mjs` | Copy photos and rewrite their links |
| `scripts/selfhost/store.service`, `nginx.conf.example` | systemd service and nginx/SSL template |
| `.env.example` | Every setting, with an explanation |
| `docs/self-hosting/` | INSTALL, MIGRATION, CHECKLIST, DEPENDENCY-AUDIT, FEATURE-PARITY, QA-REPORT |

## 2. Server specifications
| Part | Minimum | Recommended |
|---|---|---|
| App server (Node 22+) | 1 vCPU, 1 GB RAM, 10 GB disk | 2 vCPU, 2 GB RAM |
| Database + auth + API + storage (bare metal) | 2 vCPU, 2 GB RAM, 20 GB SSD | 2 vCPU, 4 GB RAM, 40 GB SSD |
| Same stack using Supabase Docker | 2 vCPU, 4 GB RAM, 40 GB SSD | 4 vCPU, 8 GB RAM |
| OS | Ubuntu 22.04/24.04 LTS (any Linux with systemd works) | |
| Software | PostgreSQL 15+, Node 22+ (24 for Storage), nginx, certbot, git, psql/pg_dump of the **same major version** as the database | |

Shared hosting or cPanel without Node.js support **cannot** run the store.

## 3. Credentials you must create (all your own)
| Setting | Where it goes | Required |
|---|---|---|
| Domain + DNS (`www`, `api` records) | DNS provider | Yes |
| PostgreSQL superuser password + 3 service passwords | `00-bootstrap-roles.sql`, service configs | Yes |
| `JWT_SECRET` (≥32 chars) → `ANON_KEY`, `SERVICE_KEY` | `make-keys.mjs` → `.env` and services | Yes |
| `SMTP_ENCRYPTION_KEY` (`openssl rand -base64 32`) | `.env` — keep it forever, it unlocks saved SMTP/Stripe secrets | Yes |
| `DATABASE_URL` | `.env` (updates and backups) | Yes |
| `SITE_URL` | `.env` or Admin → Settings → Store | Yes |
| SMTP host/user/password | Login server env (sign-up and reset emails) + Admin → Email settings (store emails) | For email |
| Google login Client ID/Secret | Login server env, plus `VITE_OAUTH_MODE=supabase` | Optional (`VITE_GOOGLE_LOGIN=off` hides it) |
| Stripe keys + webhook secret | Admin → Payments (stays off until you test it and switch it on) | Optional |
| GA4 / GTM / Meta Pixel / Merchant Center IDs | Admin → SEO / Settings | Optional |
| S3/R2/MinIO keys | Storage env, if you don't use local disk | Optional |

## 4. Deployment order
1. **Server:** create a server with the specs above. Install PostgreSQL, Node, nginx and certbot (INSTALL.md §A).
2. **DNS:** point `www.yourstore.com` and `api.yourstore.com` at the server. Issue SSL certificates with certbot.
3. **Database roles:** edit the passwords, then `psql -f scripts/selfhost/bare-metal/00-bootstrap-roles.sql`.
4. **Keys:** `JWT_SECRET=$(openssl rand -hex 32) node scripts/selfhost/bare-metal/make-keys.mjs`.
5. **Auth server:** run `auth migrate`, then `auth serve` (INSTALL.md Option 3, step 3). Add SMTP, plus Google if you use it.
6. **Storage server:** start it (step 4); it creates its own tables.
7. **Store schema:** `DATABASE_URL=... scripts/selfhost/apply-migrations.sh`. This applies all migrations and the default content. Optional: `remove-sample-data.sql`.
8. **Data API:** start PostgREST (step 6), then the gateway (step 7). Put nginx in front as `api.yourstore.com`.
9. **Media bucket:** create the private `media` bucket (step 8).
10. **Configure:** `cp .env.example .env` and fill in the URLs and keys from step 4, `SMTP_ENCRYPTION_KEY`, `DATABASE_URL` and `SITE_URL`.
11. **Build and run:** `scripts/selfhost/build-node.sh`, then install `store.service` and the nginx site (INSTALL.md §E–F).
12. **Super Admin:** sign up on `/auth`, run the SQL in INSTALL.md §G to make that account admin, then turn on 2FA in Account → Security.
13. **Store setup in Admin:** store details and site URL, shipping, taxes, payments (COD), SMTP (send a test email), pages (publish), SEO IDs.
14. **Operations:** add a nightly cron job for `backup.sh` and copy the backups off the server.
15. **Updates later:** run `scripts/selfhost/deploy-vps.sh`. It backs up, applies new migrations, restarts and rolls back automatically if the site fails its check.

**Moving an existing Lovable store?** Follow MIGRATION.md instead of steps 7 and 12. After importing, run `BASELINE=1 scripts/selfhost/apply-migrations.sh` once.

## 5. Verified status
See QA-REPORT.md. All storefront, customer, staff and Super Admin modules, plus update, backup, restore, rollback and media migration, were tested on an independent stack. **Not tested** (need owner credentials or infrastructure): real email sending, Google sign-in, Stripe, analytics delivery, Docker/cPanel/real-domain SSL, and importing a real Lovable export.
