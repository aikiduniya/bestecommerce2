# Lovable dependency audit (2026-10-23)

## Fully independent (open source / standard, no Lovable account)
| Component | Notes |
|---|---|
| TanStack Start, React 19, Vite, Tailwind, Radix/shadcn, Recharts, dnd-kit, zod | Public npm |
| Nitro server output | `NITRO_PRESET=node-server` → `node .output/server/index.mjs` (tested) or Cloudflare with your own account |
| Database (PostgreSQL + RLS + PL/pgSQL business logic) | Supabase is open source; self-host via Docker or supabase.com. 38 SQL migrations in `drizzle/migrations` |
| Auth: email/password, email confirmation, TOTP 2FA, roles/staff | Supabase Auth (GoTrue), standard API |
| Storage: `media` bucket, uploads, signed URLs | Supabase Storage, standard API |
| Webhooks: Stripe `/api/public/stripe-webhook`, merchant feed, sitemap/robots/llms | Plain HTTP routes |
| SMTP | Owner's SMTP in Admin → Email Settings; `worker-mailer` (Cloudflare) / `nodemailer` (Node) |
| Stripe | Owner's keys in Admin → Payments (encrypted with `SMTP_ENCRYPTION_KEY`) |
| GA4 / GTM / Meta Pixel / Merchant Center / Search Console / Tawk.to / WhatsApp | Owner IDs in Super Admin |
| Domain / canonical / sitemap URLs | Admin Primary URL → `SITE_URL` → request domain |
| Cron / queues | None used (Stripe expiry via webhook) |
| `@lovable.dev/vite-tanstack-config` | Public npm build preset (MIT-style, no account, no network calls). Kept: removing it breaks Lovable editing |

## Lovable-dependent components found
| Component | Status |
|---|---|
| Google sign-in via `@lovable.dev/cloud-auth-js` (Lovable OAuth broker) | **Replaced** for self-hosting: `VITE_OAUTH_MODE=supabase` uses standard Supabase Google provider with owner's Google client; `VITE_GOOGLE_LOGIN=off` hides it. Broker code loads only in Lovable mode |
| `previewAuthStorage.ts` (auto-generated) | Inert outside Lovable hostnames; uses normal localStorage |
| `lovable-error-reporting.ts` | No-op unless the Lovable editor injects `window.__lovableEvents` |
| `cron-auth.ts` (`LOVABLE_CRON_SECRET`) | Generated file, **not used** anywhere |
| Hardcoded `*.lovable.app` URLs | **Removed** (previous step) |
| Lovable AI Gateway / `LOVABLE_API_KEY` | Not used |

## Remaining external services & owner credentials
| Service | Required? | Credentials (where) |
|---|---|---|
| Supabase-compatible backend | Yes | URL, anon key, service-role key (env) |
| Encryption key | Yes | `SMTP_ENCRYPTION_KEY` (env) |
| Domain + SSL | Yes | DNS / certbot |
| SMTP provider | For emails | Admin → Email Settings |
| Stripe | Optional | Admin → Payments |
| Google OAuth client | Optional | Supabase Auth settings |
| Analytics/Pixel/Tawk | Optional | Super Admin |

## Cannot run without Lovable
Nothing in the application code. Data **export** from the current Lovable Cloud project must be started from Lovable once (Database → Export data); encrypted SMTP/Stripe secrets must be re-entered.

## Self-hosted production build
`SELF_HOSTED=1` (set by `scripts/selfhost/build-node.sh`) swaps `previewAuthStorage`, `lovable-error-reporting` and the Lovable OAuth module for empty stand-ins in `src/selfhost-stubs/`. Verified: the built `.output/` contains **zero** references to `lovable.app`, `lovableproject`, `__lovableEvents`, `cloud-auth-js`, or the Lovable Cloud project. Lovable editor/preview builds are unchanged (they never set the flag).

## Verification — fresh independent stack (2026-10-23)
Stack: new PostgreSQL 15.17 cluster, Supabase Auth 2.180.0, PostgREST 14.1, Supabase Storage 1.11.2 (file backend), bundled gateway, store built from a clean source copy with `SELF_HOSTED=1 NITRO_PRESET=node-server` and run with `node`. Own JWT secret, keys and encryption key. Production database not used at any point.

| Test | Result |
|---|---|
| All 37 store migrations on the empty database | PASS (0 errors) |
| Sign-up of 3 accounts → all get `customer` | PASS |
| Super Admin creation with the documented SQL | PASS |
| 2FA: enrol with authenticator code, admin dashboard demands code on next login, correct code opens it | PASS (after 2 fixes below) |
| Staff: grant via Admin → Staff; no role → cannot edit products/settings; "Catalog manager" → can edit products, cannot edit orders; staff cannot make itself admin; shopper cannot read payment secrets | PASS |
| Product created in admin with image upload to own storage; image shown on product page | PASS |
| COD checkout as shopper → order #1, stock 5 → 4 | PASS |
| Admin cancels order → stock back to 5, restore flag set | PASS |
| Sitemap / robots.txt use the configured site URL | PASS |
| Starter-data cleanup script | PASS |
| SMTP sending via nodemailer | **NOT TESTED** (no SMTP server/credentials) |
| Google sign-in with own Google client | **NOT TESTED** (no Google credentials) |
| Stripe | Not tested — kept disabled as instructed |
| Docker / supabase.com variants, cPanel, real domain + SSL | **NOT TESTED** (bare-metal stack on localhost only) |
| Restoring a real Lovable export / media migration script | **NOT TESTED** (no production data moved, by instruction) |

### Issues found and fixed
1. 2FA QR code image was broken with current Supabase Auth (it already returns a data URL) — fixed; also affected the Lovable-hosted site.
2. An abandoned 2FA setup blocked any retry ("friendly name already exists") — unverified factors are now cleared before enrolling.
3. Fresh installs contain 4 demo products — `scripts/selfhost/remove-sample-data.sql` added.

## Final answer
**YES for the tested core** — a new user can download the source and run the store (sign-up, admin, 2FA, staff, products, image uploads, inventory, COD checkout, order management) on their own server, database and storage with no Lovable account or service. **Not yet verified:** live SMTP sending, Google sign-in, Stripe, and Docker/cPanel/real-domain deployments.
