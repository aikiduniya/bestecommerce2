# Self-hosting QA report — 2026-10-23

Environment: separate test stack (PostgreSQL 15, Supabase Auth 2.180, PostgREST 14, Supabase Storage 1.11 with file storage, the bundled gateway, the store built with `SELF_HOSTED=1` on Node). Disposable test accounts and data only. The live store was not touched. Stripe stayed off.

## Modules (113 checks)
| Area | Result |
|---|---|
| All 33 Super Admin pages open with no errors (owner signed in with 2FA) | PASS |
| Settings save; staff blocked from settings | PASS |
| Coupons: create, preview, discount charged by the server (12.00 on 120), usage counted | PASS |
| Gift cards: create, check, balance used up at checkout | PASS |
| Loyalty: points earned on delivery, redeemed at checkout, deducted | PASS |
| Referrals: code issued, applied by another account | PASS |
| Returns: submit, approve, refund + restock, second refund does not restock again | PASS |
| Reviews / Q&A: forced to pending, hidden until approved, approved review + answer shown | PASS |
| Blog post, CMS page publish → page, footer link, sitemap | PASS |
| FAQs, homepage builder section shown on home | PASS |
| Multilingual: Urdu URL shows translated name, page right-to-left, hreflang tags, /ur/ in sitemap | PASS |
| SEO: product SEO title, Product schema, Google verification tag, robots.txt, llms.txt, merchant feed, 301 redirect | PASS |
| Theme preset saved and applied | PASS |
| Marketing: automatic discount, newsletter signup, contact form | PASS |
| Support tickets: customer creates, admin replies, customer sees reply | PASS |
| Tax rates: admin add/edit/delete; shopper blocked | PASS (after fix 1) |
| Media library alt text | PASS (after fix 1) |
| Customer account: Orders, Wishlist, Addresses, Rewards, Support, Security tabs | PASS |
| Staff (catalog manager): opens products, kept out of settings and pages | PASS |
| Reports page with live figures | PASS |

## Operations
| Test | Result |
|---|---|
| Update with `deploy-vps.sh`: backup → only the new migration (0037) applied → build → switch → health check | PASS |
| Data identical before/after update (products, users, 2FA, orders + totals, roles, staff, settings, coupons, gift cards, points, pages, translations, uploaded files checksum) | PASS |
| Broken release deployed on purpose → health check failed → automatic rollback, site stayed up | PASS |
| Restore backup into a brand-new database → all counts, roles, 2FA, settings identical; file archive checksum identical | PASS |
| Media migration (`migrate-media.mjs`): file uploaded, old-domain links in products + blog rewritten, new link serves the image | PASS |
| Starter content script runs twice with no duplicates | PASS |

## Fixed during QA
1. **Tax rates and media alt text could not be saved on a fresh install** (missing database permission that only the Lovable database had). Added as versioned migration 0037. This changes nothing on the live store, which already had the permission.
2. **Fresh installs had no legal pages, FAQ categories or contact-form email template** (the live store received them outside migrations). Added `scripts/selfhost/seed-defaults.sql`, which runs automatically and can be re-run safely.
3. **Update script could break `node_modules`** when installing the email library. The build now installs it only inside `.output/server`.
4. **Update/rollback scripts needed systemd.** Added `RESTART_CMD` and `NO_PULL` options.

## Notes
- Back up and restore with PostgreSQL client tools of the **same major version as the server** (a newer `pg_restore` works but prints 2 harmless warnings; an older one cannot read newer dumps).
- Storefront button/label wording in other languages comes from Admin → Settings → Translations. Product content translations were tested.

## PENDING (need owner credentials or infrastructure)
- SMTP email sending (store emails and login emails) — no mail server credentials.
- Google sign-in — no Google login keys.
- Stripe card payments — kept off as instructed.
- GA4 / GTM / Meta Pixel delivery — no real IDs.
- Docker / supabase.com hosting, cPanel, real domain + SSL — only tested on a bare-metal localhost stack.
- Export of the real Lovable database — not run, by instruction.
