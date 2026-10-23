# Migration: Lovable → custom domain + independent server & database

Goal: move products, customers, orders, images, settings and admin access with zero data loss and minimal downtime. **Do a full rehearsal on a staging domain first.** Nothing in this guide deletes data from Lovable; keep Lovable running until the new stack is verified.

## Phase 0 — Custom domain only (optional first step, no data moves)
1. Lovable → Project Settings → Domains → Connect domain (or keep it for your VPS later).
2. Admin → Settings → Store → **Primary website URL** = `https://www.yourstore.com`. Sitemap, canonical, feeds, emails switch instantly.
3. After SSL is active on both hosts, enable *Redirect www / non-www*.
4. Search Console: add the new property, submit `/sitemap.xml`. Merchant Center: update feed URL.

## Phase 1 — Prepare the new stack (no downtime)
1. Provision VPS + Supabase (INSTALL.md §A–D). **Do not run `apply-migrations.sh` normally** — the export contains the schema. After the import, run it once as `BASELINE=1 scripts/selfhost/apply-migrations.sh` (export taken from the same source version) so future updates apply only newer files.
2. Generate a new `SMTP_ENCRYPTION_KEY` (`openssl rand -base64 32`).
3. Deploy the app on a staging host (e.g. `new.yourstore.com`) pointing at the new Supabase (INSTALL.md §E–F).

## Phase 2 — Freeze & export (start of maintenance window)
1. Admin → Settings → **Maintenance mode ON** (stops new orders). Note the last order number.
2. Lovable → **Cloud → Database → Settings → Export data → Database → Start export**. Wait for the email, download the archive from **Cloud → Storage**. (Limits: ≤15 GB DB, one export per 24 h.)
3. Download all files of the `media` bucket from **Cloud → Storage** into `./media-export/` (keep folder structure).
4. Record counts for verification:
```sql
select (select count(*) from products) products, (select count(*) from orders) orders,
       (select count(*) from auth.users) users, (select count(*) from media) media,
       (select count(*) from user_roles where role='admin') admins;
```

## Phase 3 — Import database
```bash
export DATABASE_URL='postgresql://postgres:PASSWORD@new-db-host:5432/postgres'
scripts/selfhost/db-import.sh ./lovable-export.dump
```
The script restores `public` (all store data) and the `auth.users` / `auth.identities` / MFA rows (accounts, password hashes, 2FA) into an initialised Supabase without overwriting Supabase-managed schemas, then re-applies grants. Read its output; conflicts are reported, not ignored.

## Phase 4 — Media
```bash
OLD_STORAGE_URL=https://<old-ref>.supabase.co  NEW_SUPABASE_URL=https://api.yourstore.com \
NEW_SERVICE_ROLE_KEY=... DATABASE_URL=... MEDIA_DIR=./media-export \
node scripts/selfhost/migrate-media.mjs --dry-run      # review
node scripts/selfhost/migrate-media.mjs                # upload + rewrite URLs
```
It uploads every file to the new `media` bucket (same paths) and rewrites old storage URLs found in text/JSON columns of all `public` tables (products, variants, media, settings, banners, pages, blog…) to new public-signed URLs. It prints a per-table count and leaves a JSON log for rollback.

## Phase 5 — Secrets & integrations
* Admin → Email Settings: re-enter SMTP passwords, test each profile (old encrypted values are unreadable with the new key).
* Admin → Payments: Stripe stays **off**; when you activate it, enter keys again and register the webhook on the new domain.
* Supabase Auth: Site URL, redirect URLs, SMTP for auth emails; Google OAuth if wanted (README §3).

## Phase 6 — Verify on staging host
- [ ] Counts from Phase 2 match exactly.
- [ ] Sign in with your admin account (same email & password; 2FA prompt appears) → `/admin` loads.
- [ ] Product pages show all images; zoom/lightbox work.
- [ ] Orders list, customer list, order numbers continue (next order = last + 1).
- [ ] Place a COD test order → stock decreases → cancel → stock restored → delete only that test order.
- [ ] `/sitemap.xml`, `/robots.txt`, canonical tags show the primary domain.

## Phase 7 — Cut-over
1. Switch DNS `A @` and `www` to the VPS (TTL already 300). Run certbot for the real domains.
2. Admin → Settings: Primary website URL confirmed; Maintenance mode **OFF**.
3. Disconnect the domain from Lovable (Project Settings → Domains) once traffic arrives at the VPS.
4. Keep the Lovable project and its data **untouched for at least 30 days** as a fallback.

## Rollback
* Before cut-over: nothing changed for customers — just stop.
* After cut-over: point DNS back to Lovable, turn maintenance off there. Orders placed on the new stack in between must be re-entered manually (export them first from Admin → Orders → CSV).

## What does not carry over automatically
Active sessions (everyone signs in again), encrypted SMTP/Stripe secrets, Auth provider config, Google sign-in broker, analytics IDs are in settings (they do carry over).
