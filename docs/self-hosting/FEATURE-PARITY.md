# Feature parity & update readiness (2026-10-23)

## Why parity is expected
The self-hosted build is the **same source code and the same 37 database migrations** as the Lovable version. No feature is removed or feature-flagged off. All business rules (prices, coupons, COD, stock, permissions, gift cards, loyalty, refunds) run inside the database, so they behave the same on any PostgreSQL that has the Supabase Auth/API/Storage services. Only three helpers are swapped in the self-hosted build: preview login storage, editor error reporting and the Lovable Google sign-in.

## Module audit
| Module | Self-hosted | Verified outside Lovable |
|---|---|---|
| Storefront: home builder, shop, search, product gallery, wishlist, compare, reviews/Q&A, CMS/blog/FAQ, languages/RTL, currencies | Same code | Home, shop, product page and crawler files: yes. Other parts: code check only |
| Cart, guest checkout, COD, tax, shipping, coupons, sales, automatic discounts, gift cards, loyalty | Same code (database rules) | COD order + cancel/restock: yes. Discounts/gift cards/loyalty: no |
| Customer account: orders, addresses, returns, tickets, 2FA, referrals | Same code | Sign-up, login, 2FA: yes |
| Staff permissions | Same code | Yes (catalog/orders/settings limits) |
| Super Admin: products/images, orders, customers, inventory, marketing, reports/CSV, SEO, theme, menus, pages, inbox, translations, email, payments, staff, activity log | Same code | Products + uploads, orders, staff: yes. Other parts: no |
| Stripe (card payments) | Same code; owner's own keys + webhook on own domain | No (kept off) |
| Contact form, sitemap, robots.txt, llms.txt, merchant feed, redirects | Same code; uses owner's site address | Sitemap/robots: yes |

## Behaves differently outside Lovable
1. **Google sign-in** uses the owner's own Google login keys (`VITE_OAUTH_MODE=supabase`), or it can be hidden. Not tested.
2. **Sign-up confirmation and password-reset emails** are sent by the owner's login server (its email-server settings), not by Lovable's managed email.
3. **Store emails (SMTP)** use the Node email library on the owner's server instead of the Cloudflare email path. Not tested.
4. **Photo resizing** is not used by the app, so there is no difference.
5. **Scheduled jobs:** none exist. Abandoned-cart reminders are sent manually from Admin, the same as on Lovable. Backups are a server cron job (`backup.sh`).
6. **Hosting:** Node on your own server instead of Cloudflare. Same pages, plus nginx/SSL that the owner sets up.

## Migration limitations
- Auth users, passwords, 2FA codes and roles move with a full database export (`db-export.sh`/`db-import.sh`). The **Lovable export itself has not been tested**.
- Encrypted secrets (Stripe, SMTP) need the **same encryption key** on the new server. Otherwise they must be entered again in Admin.
- Photos must be copied with `migrate-media.mjs` (not tested).
- Google sign-in users can only log in again once the owner's Google login is set up with the same email addresses.

## Update readiness
- Every database change is a numbered, plain-SQL file in `drizzle/migrations/`. Lovable's migration tool blocks destructive changes (dropping or renaming columns or tables, changing a column's type), so updates only add.
- `apply-migrations.sh` records each applied file and runs **only new files**, each in its own transaction. A failed file stops the update and changes nothing.
- `deploy-vps.sh` now runs: git pull → build → **database backup → new migrations** → switch release → health check → automatic rollback of the app on failure. Restore the database with `rollback.sh` if needed.
- Sites moved from Lovable: run `BASELINE=1 apply-migrations.sh` once after the import, so future updates apply only newer files.
- Status: update, backup, incremental migration, automatic rollback and restore were all run for real (QA-REPORT.md). Baseline mode was not run.

## Full QA
All modules and update/backup/restore/rollback/media operations were tested on the separate stack. See [QA-REPORT.md](QA-REPORT.md).

## Verdict
**Feature parity: complete by code.** Nothing is missing or disabled. **Proven by running it outside Lovable:** all modules (QA-REPORT.md), except services needing owner credentials. **Updates:** ready, using versioned migrations that only add, plus a backup before each update.
