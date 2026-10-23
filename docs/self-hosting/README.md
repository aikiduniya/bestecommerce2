# Self-hosting & portability — overview

| Document | Purpose |
|---|---|
| [INSTALL.md](./INSTALL.md) | A-to-Z installation on a VPS (and cPanel compatibility notes) |
| [MIGRATION.md](./MIGRATION.md) | Move from Lovable hosting + Lovable Cloud to your own domain, server and database without data loss |
| [DEPENDENCY-AUDIT.md](./DEPENDENCY-AUDIT.md) | Full Lovable dependency audit + verdict |
| [CHECKLIST.md](./CHECKLIST.md) | Production deployment checklist |
| [`../../.env.example`](../../.env.example) | Example environment (no real credentials) |
| [`../../scripts/selfhost/`](../../scripts/selfhost/) | Build, deploy, backup, restore, migration and media scripts |

## 1. Actual technology stack

| Layer | What the project really uses | Portable? |
|---|---|---|
| Framework | TanStack Start v1 (React 19, SSR + server functions), Vite 8, Tailwind CSS v4 | Yes |
| Server runtime | Nitro output. Lovable publishes to **Cloudflare Workers** (`cloudflare-module`). Self-host builds with `NITRO_PRESET=node-server` → plain **Node.js ≥ 20** HTTP server (`.output/server/index.mjs`) | Yes — tested (see §4) |
| Database | **PostgreSQL 15+ with the Supabase stack** (PostgREST data API, Row-Level Security, `auth` schema, `storage` schema). 38 SQL migrations in `drizzle/migrations/` | Yes, to **self-hosted Supabase** (Docker) or supabase.com. **Not** to plain Postgres/MySQL without rewriting data access |
| Business logic | PL/pgSQL functions in the database: `place_order`, `effective_price`, `coupon_discount`, `restock_cancelled_order`, `has_role`, `has_permission`, gift cards, loyalty, referrals | Moves with the database |
| Authentication | Supabase Auth (GoTrue): email + password, TOTP 2FA. Google button uses Lovable's managed OAuth broker | Email/password + 2FA: yes. **Google sign-in: must be reconfigured** (see §3) |
| File storage | Supabase Storage bucket `media` (product images, banners, logos). Database rows store full image URLs | Files: manual copy. URLs: rewritten by `scripts/selfhost/migrate-media.mjs` |
| Email | Per-purpose SMTP profiles (Admin → Email Settings). Cloudflare: `worker-mailer`; Node: `nodemailer` (auto-selected) | Yes — install `nodemailer` on the server |
| Payments | Stripe REST API with your own keys (Admin → Payments) + webhook `/api/public/stripe-webhook`. Currently **disabled** | Yes |
| Background jobs | **None required.** Unpaid Stripe sessions expire through Stripe's `checkout.session.expired` webhook. Abandoned-cart reminders are sent manually by admin. Only backups need cron | Yes |
| Crawler files | `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/api/public/merchant-feed` generated live from the database | Yes |

## 2. Domain independence (implemented)

* **Admin → Settings → Store → Primary website URL** (`store_settings.site_url`). Saved normalised to `https://host` (no path, no slash).
* Origin priority everywhere: **Admin Primary URL → `SITE_URL` env → the domain the visitor actually opened** (proxy `X-Forwarded-Host/Proto` honoured).
* Used by: sitemap.xml, robots.txt (`Sitemap:` line), llms.txt, merchant feed, canonical tags, hreflang, `og:url`, JSON-LD (Organization/WebSite/Breadcrumb/Product/Article), Stripe success/cancel URLs, the webhook URL shown in Admin → Payments, abandoned-cart email links, SEO audit.
* **www / non-www + HTTPS**: optional switch "Redirect www / non-www to the primary URL" sends a 301 from the twin host and from plain `http` on the primary host. Unrelated hosts (e.g. the Lovable preview) are never redirected, so a domain change cannot lock you out. Turn it on only after DNS + SSL are live.
* No source file contains a hardcoded hosting domain (checked with `rg "lovable\.app" src`; only the auto-generated Lovable auth helper references Lovable zones for the editor preview).
* Admin redirects (Admin → SEO → Redirects) are domain-relative and keep working after a domain change.

## 3. What still depends on Lovable / cannot migrate automatically

| Item | Why | What to do |
|---|---|---|
| Google sign-in button | Lovable broker only when `VITE_OAUTH_MODE` is unset | Set `VITE_OAUTH_MODE=supabase`, create a Google OAuth client and enable Google in your Supabase Auth — or `VITE_GOOGLE_LOGIN=off` |
| Build config package | `@lovable.dev/vite-tanstack-config` (npm, open package) | Works outside Lovable; it only pins Cloudflare **inside** Lovable's sandbox. No action |
| Error reporting helper | `src/lib/lovable-error-reporting.ts` posts to the Lovable editor only when embedded | Harmless when self-hosted |
| Database export | Lovable Cloud has no direct DB password | Use **Database → Export data** in Lovable (compressed `pg_dump` archive incl. auth users + password hashes) |
| Storage files | Not included in the DB export | Download from Lovable **Storage**, upload to your bucket, run `migrate-media.mjs` |
| Encrypted SMTP / Stripe secrets | Encrypted with `SMTP_ENCRYPTION_KEY`, whose value Lovable does not reveal | Re-enter SMTP passwords (and Stripe keys, if ever added) in the new admin |
| Auth provider settings, email templates of Supabase Auth, API keys | Not part of the export | Reconfigure in your Supabase |
| Active login sessions | Tokens are tied to the old project | Users (and admins) simply sign in again — passwords are preserved |
| Supabase-specific SQL | Migrations use `auth.users`, `auth.uid()`, roles `anon/authenticated/service_role`, `storage.objects` | Use a Supabase-compatible database; plain Postgres / MySQL / cPanel databases are **not supported** |

## 4. Portability test results (performed 2026-10-23)

| Test | Result |
|---|---|
| Unit tests for URL normalisation / priority / www-twin detection (`src/lib/site-url.test.ts`) | PASS (4/4) |
| Clean copy of source (no `node_modules`, no build output) built with `NITRO_PRESET=node-server` outside Lovable's build mode | PASS after a fix: the Cloudflare-only SMTP library broke Node builds; it is now externalised and Node uses `nodemailer` |
| Built server started with plain `node .output/server/index.mjs` (port 3999, `SITE_URL=https://shop.example.com`) | PASS: `/`, `/shop`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/api/public/merchant-feed` → 200, all absolute URLs used `https://shop.example.com`, canonical + hreflang correct |
| Stripe webhook on Node server with unsigned body | PASS: rejected (400 Invalid signature) |
| Fresh independent stack: migrations, signup, admin, 2FA, staff, uploads, COD, order cancel | PASS — see DEPENDENCY-AUDIT.md |
| Data export → import, media migration, admin login on new DB | **NOT TESTED** — requires your export and your own server; no live data was moved |
| cPanel | **NOT TESTED** |

The complete independent stack (own PostgreSQL, auth, storage, API) was installed from zero and the core store flows passed. SMTP sending, Google sign-in, Stripe and Docker/cPanel variants remain unverified.
- [FEATURE-PARITY.md](FEATURE-PARITY.md) — module-by-module parity, differences outside Lovable, update process
