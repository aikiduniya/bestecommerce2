# Roadmap

## Current task
- [x] Fix public-code checkout redirects, tracking and Stripe success. 59 tests PASS (7 files, isolated transports); preview build OK; browser tracking prefill PASS with no runtime errors. No migrations/data/credential changes.
- [ ] Actual COD placement → delivered email → database-backed tracking verification on owner installation: no independent disposable backend available here; mocked flow tested, not a live order. Real card charge also untested; no Stripe settings changed.
- [x] Connect confirmed Stripe payments to customer/admin email notifications; reserve existing logs, prevent concurrent duplicates and isolate delivery failures. 25 automated tests PASS; build OK. No schema, credentials, COD checkout or UI changes.
- [ ] Real Stripe → SMTP → delivery-log verification on the owner's configured installation: blocked here because the connected database has no Stripe orders, delivery disabled, untested/disabled SMTP profiles and no support email. Tests used isolated database/SMTP doubles, not a real card charge or inbox delivery.

## Done
- Phases 1–2: storefront, auth, admin CRUD, variants, collections, media, categories, wishlist, recently viewed, shipping zones, search/filter/sort, cart, account, COD checkout (place_order server-validated).
- Phase 3: COD rules + fee + confirm/collect, staff roles/permissions (has_permission), activity log, admin Payments tab.
- Phase 4A: coupons, reviews/Q&A (pending-forced), CMS pages, blog, SEO + tracking settings, sitemap, merchant feed.
- Phase 4B: homepage builder (16 section types, drag reorder), nav menu editor, dashboard, reports + CSV, order timeline, internal notes, invoices, flash sales + automatic discounts, analytics events, ⌘K search, notifications bell, bulk product actions, multi-currency, multilingual UI + content translations + hreflang + RTL, email module (templates/rules/settings/logs/retry, delivery disabled until provider).
- Verification: COD regression PASS, coupons PASS, permissions PASS, mobile 390px PASS (storefront + admin), hydration fixed, language URLs/RTL/hreflang PASS, emails admin PASS.
- Phase 5 Stage 1: guest checkout (no sign-in, guest_token, track page + footer link), tax management (tax_rates, inclusive/exclusive, server-side in place_order, Taxes admin tab, tax on order/invoice pages), 2FA (TOTP enroll/verify/remove on account Security tab, admin gate challenges aal1 staff). All browser-tested PASS; test data cleaned.

## Phase 5 stages
- Stage 2: Returns/refunds (RMA) — customer/guest return requests, admin approve/reject/refund + restock.
- Stage 3: Product fields (specs, GTIN, related products), saved address book, guest cart merge.
- Stage 4: Marketing (back-in-stock alerts, abandoned-cart tracking), reports (by category/country, profitability).
- Stage 5: Security/admin (cookie consent, CSV import/export, support tickets).

## Open / blocked
- Stripe: ON HOLD per owner — never ask for onboarding until requested; live card payments disabled.
- Email delivery: owner reports SMTP working on their installation; connected database still has delivery disabled and no tested/enabled profiles (read-only check 2026-10-24). Do not change credentials/settings; live delivery verification remains pending there.
- Print-to-PDF for invoices untested; tracking events not verified against real GA4/Meta dashboards.

## Phase 5 log
- Stage 1 (guest checkout, tax, 2FA): DONE + tested
- Stage 2 (returns/RMA): DONE + tested
- Stage 3 (product fields barcode/specs/weight/related, address book, checkout address picker): DONE + tested 2026-10-21
- Stage 4 (tracking numbers, packing slip, save-for-later, search autocomplete): DONE + browser-tested 2026-10-21
- Stage 5 (reports: sales-by-category + profitability tabs with CSV; cookie consent banner + settings; back-in-stock alerts + admin list; product CSV import/export; customers CSV export; support tickets customer+admin with replies): DONE + browser-tested 2026-10-21. Fix during testing: stock_alerts upsert→insert (anon has INSERT only).
- Phase 6 (2026-10-21): DONE + browser-tested. Gift cards (admin create/deactivate, checkout redemption, atomic balance deduction, refund on cancel); loyalty points (admin settings, earn on delivery, redeem at checkout, refund on cancel, account ledger); referrals (per-user code, one-time apply, reward on friend's first delivered order); product comparison (compare button, /compare table, footer link); abandoned carts (signed-in checkout snapshots, admin list, reminder emails logged while delivery disabled). Verified: $420 order − $100 gift card = $320 charged, card balance 0, refund to 100 on cancel; 320 pts earned on delivery, 100 redeemed, refunded on cancel; stock 42→41→42. Mobile 390px PASS. Security scan: 5 findings, all intentional public-read/insert for storefront content. All test data cleaned; 0 orders; loyalty/referrals left disabled (owner enables in Admin → Loyalty).
- Final audit (2026-10-21): GO. Security scan clean (5 intentional public-read findings dismissed with reasons). DB integrity: 0 negative stock, 0 total mismatches, 0 orphans/dupes, RLS on all tables. Live tests: guest COD order placed + track page PASS, admin dashboard/products/orders PASS, mobile 390px PASS (fixed product-page button-row overflow). SEO head() on all content routes. Build OK. Test data removed: 0 orders, stock 42. Blockers: Stripe + email delivery await owner setup.

## Upgrade brief (luxury theme + SEO)
- [x] Stage 1: dynamic robots/llms/sitemap, redirects, verification, audit
- [x] Stage 2: per-item SEO fields, alt text everywhere, Product/Breadcrumb/Article/Organization schema, noindex on private pages
- [x] Stage 3: theme presets + live preview, Heritage Green applied
- [x] Stage 4: dashboard date range filter

## Upgrade brief — completion pass
- [x] Admin luxury redesign (shell, headers, KPI tiles on dashboard/products/orders/customers/reports, tables)
- [x] Layout tab: header, nav, announcement, banner height/strength, width, spacing, grid, footer
- [x] Category/brand/collection SEO + alt text; shop/blog page SEO
- [x] Tested: SEO save/reload, canonical, JSON-LD, sitemap noindex, robots, llms, redirects, mobile/tablet

## Brief 8 — CMS, contact, SMTP, social, header/footer, banner, gallery
- [ ] S1 DB: page images, contact inbox, FAQs, SMTP profiles, social/WhatsApp/Tawk settings
- [ ] S2 Legal/CMS draft pages + footer/sitemap
- [ ] S3 Contact form + admin inbox
- [ ] S4 FAQ admin + homepage FAQ/About/Contact sections
- [ ] S5 SMTP admin (encrypted, test, per-notification assignment)
- [ ] S6 Social links, WhatsApp, Tawk
- [ ] S7 Header/footer redesign (mega menu, newsletter, socials)
- [ ] S8 Banner slider (multiple slides, desktop/mobile images) — reference image not uploaded
- [ ] S9 Product gallery lightbox/zoom
- [ ] S10 Testing

## Engineering audit & remediation (Oct 25 brief)
- [x] Webhook idempotency: only unique-violation = duplicate; other insert errors → 500 retry
- [x] Notification reservation failure leaves visible retryable log (was silent)
- [x] Guest COD notifications: new public notifyOrderPlaced (guest-token/owner verified, DB-built vars, idempotent)
- [x] sendNotification restricted to staff (was any signed-in user)
- [x] Webhook expiry cancel guarded against paid race; checkout session-link errors checked
- [x] Skipped sends now logged; delivery-on-without-transport fails loudly
- [x] SMTP profile connection changes invalidate last test; contact claim after recipient check
- [x] "SMTP (coming soon)" label corrected
- [x] Tests: 43/43 (stripe, webhook idempotency, notifications, COD guest flow)
- [ ] Production deploy of this build to cPanel (owner action; old restored build is the likely root cause of missing Stripe emails)
- [ ] Real Stripe test-mode payment + SMTP delivery verification on production
