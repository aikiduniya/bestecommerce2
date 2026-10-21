# Roadmap

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
- Email delivery: blocked until a verified provider is configured (module built, logs as queued_disabled).
- Print-to-PDF for invoices untested; tracking events not verified against real GA4/Meta dashboards.

## Phase 5 log
- Stage 1 (guest checkout, tax, 2FA): DONE + tested
- Stage 2 (returns/RMA): DONE + tested
- Stage 3 (product fields barcode/specs/weight/related, address book, checkout address picker): DONE + tested 2026-10-21
- Stage 4 (tracking numbers, packing slip, save-for-later, search autocomplete): DONE + browser-tested 2026-10-21
- Stage 5 (reports: sales-by-category + profitability tabs with CSV; cookie consent banner + settings; back-in-stock alerts + admin list; product CSV import/export; customers CSV export; support tickets customer+admin with replies): DONE + browser-tested 2026-10-21. Fix during testing: stock_alerts upsert→insert (anon has INSERT only).
- Phase 6 (2026-10-21): DONE + browser-tested. Gift cards (admin create/deactivate, checkout redemption, atomic balance deduction, refund on cancel); loyalty points (admin settings, earn on delivery, redeem at checkout, refund on cancel, account ledger); referrals (per-user code, one-time apply, reward on friend's first delivered order); product comparison (compare button, /compare table, footer link); abandoned carts (signed-in checkout snapshots, admin list, reminder emails logged while delivery disabled). Verified: $420 order − $100 gift card = $320 charged, card balance 0, refund to 100 on cancel; 320 pts earned on delivery, 100 redeemed, refunded on cancel; stock 42→41→42. Mobile 390px PASS. Security scan: 5 findings, all intentional public-read/insert for storefront content. All test data cleaned; 0 orders; loyalty/referrals left disabled (owner enables in Admin → Loyalty).
