# Roadmap

## Done
- Phases 1–2: storefront, auth, admin CRUD, variants, collections, media, categories, wishlist, recently viewed, shipping zones, search/filter/sort, cart, account, COD checkout (place_order server-validated).
- Phase 3: COD rules + fee + confirm/collect, staff roles/permissions (has_permission), activity log, admin Payments tab.
- Phase 4A: coupons, reviews/Q&A (pending-forced), CMS pages, blog, SEO + tracking settings, sitemap, merchant feed.
- Phase 4B: homepage builder (16 section types, drag reorder), nav menu editor, dashboard, reports + CSV, order timeline, internal notes, invoices, flash sales + automatic discounts, analytics events, ⌘K search, notifications bell, bulk product actions, multi-currency, multilingual UI + content translations + hreflang + RTL, email module (templates/rules/settings/logs/retry, delivery disabled until provider).
- Verification: COD regression PASS, coupons PASS, permissions PASS, mobile 390px PASS (storefront + admin), hydration fixed (mounted gating in StoreLayout), language URLs/RTL/hreflang PASS, emails admin PASS.

## Open
- Stripe: ON HOLD per owner — never ask for onboarding until requested; live card payments disabled.
- Email delivery: blocked until a verified provider is configured (module built, logs as queued_disabled).
- Gap analysis delivered; remaining spec items prioritized there (taxes, returns/RMA, guest checkout, import/export, support tickets, etc.).
- Print-to-PDF for invoices untested; tracking events not verified against real GA4/Meta dashboards.
