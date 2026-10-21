# Roadmap

## Phase 1 — Admin foundation (done)
## Phase 2 — Catalog & storefront (done, verified)

## Phase 3
- [x] Advanced COD: countries, min/max, fee, product + shipping restrictions, confirmation, collection, COD report
- [x] Staff: custom roles, granular permissions (catalog/orders/customers), enable/disable, Super Admin assignment, activity log, permission-based menu, server-side enforcement
- [x] Order fulfilment status, COD fee on orders, payment filters
- [ ] Built-in Stripe card payments — ON HOLD by owner (do not ask again until requested)
- [x] Order timeline (auto-logged status/payment/fulfilment events), internal staff-only notes, printable invoice/PDF
- [ ] Refunds/transactions (with Stripe)
- [ ] Admin dashboard upgrade: collapsible sidebar, global search, notifications, bulk actions (charts done)
- [ ] Staff invite emails + login activity (needs email sending setup)
- [ ] Remaining tests: Google sign-in, email signup/password reset emails (need real inbox), tablet layout

## Phase 4A (done, tested)
- [x] Coupons & promotions: percent / fixed / free shipping, min order, total + per-customer limits, start/end schedule (flash campaigns), server-enforced in checkout
- [x] Reviews (moderation, verified buyer) + customer Q&A with admin answers
- [x] CMS pages (footer links) + blog with per-item SEO
- [x] SEO: homepage SEO + Search Console verification, share image, sitemap.xml, Google Merchant product feed
- [x] GA4 / GTM / Meta Pixel / Merchant Center ID settings; tracking loads on storefront only
- [x] Staff permissions: marketing, content

## Phase 4B
- [x] Coupon fix: cancellation restores coupon usage (guarded, no double-restore); usage-limit increment is atomic
- [x] Drag-and-drop homepage section builder (16 section types, reorder/duplicate/enable/disable, live storefront)
- [x] Navigation/menu editor (header + footer, nested dropdowns, storefront falls back to built-in when empty)
- [x] Flash sale prices with countdown + automatic (no-code) discounts, coupons stack on top
- [x] Dashboard upgrade: period comparison, top products, recent activity, quick actions, 30-day chart
- [x] Advanced reports: sales (date ranges, period comparison, product performance), COD, coupons, inventory — all with CSV export
- [x] Order timeline, internal notes, printable invoice
- [x] Collapsible admin sidebar, global admin search (Cmd+K), notifications center, bulk actions on products
- [ ] Email templates & notifications (needs email domain setup)
- [x] GA4 + Meta Pixel ecommerce events: view_item, add_to_cart, begin_checkout, purchase
- [x] Multi-currency display: admin-managed rates, storefront switcher, orders always charged in base currency
- [x] Languages / translations: admin-managed languages (10-language catalog, RTL support), per-language storefront text editor with English fallback, header/mobile language switcher, html lang+dir

## Phase 4B completion work order (in progress)
- [ ] Multilingual content: content_translations table (done), admin translations editor, storefront field fallback, language-prefixed URLs, hreflang tags, RTL
- [ ] Email templates & notifications module: email_templates/email_settings/notification_rules/email_logs tables (done), admin UI (templates+preview, rules, sender/provider settings, logs+retry), send pipeline (delivery disabled until provider verified)
- [ ] Mobile responsiveness tests: language/currency switchers, homepage builder, admin dashboard, checkout
- [ ] Regression: COD checkout, totals, inventory, coupons, permissions
- [ ] Gap analysis vs MASTER_PROMPT
