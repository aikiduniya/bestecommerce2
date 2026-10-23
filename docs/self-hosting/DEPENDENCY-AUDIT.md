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

## Verification
| Test | Result |
|---|---|
| Clean source copy built outside Lovable build mode (Node preset, `VITE_OAUTH_MODE=supabase`) | PASS |
| Node server: `/`, `/auth`, `/shop`, `/cart`, `/checkout`, `/pages/contact`, `/sitemap.xml`, merchant feed, `/admin` | PASS (HTTP 200) |
| Built browser code contacts no Lovable service when self-hosted | PASS (only inert hostname checks remain) |
| Fresh install of all migrations on an empty independent Supabase | **NOT TESTED** (no independent database available) |
| Sign-up, login, 2FA, upload, COD order on an independent database | **NOT TESTED** (the test server used the existing Lovable Cloud database) |
| Google login with own client | **NOT TESTED** |

## Final answer
**NO — not yet verified.** The code has no required Lovable dependency, and the app server runs outside Lovable, but a full fresh installation on an independent database/storage with functional tests has not been performed.
