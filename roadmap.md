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

## Phase 4B (next)
- [x] Coupon fix: cancellation restores coupon usage (guarded, no double-restore); usage-limit increment is atomic
- [x] Drag-and-drop homepage section builder (16 section types, reorder/duplicate/enable/disable, live storefront)
- [x] Navigation/menu editor (header + footer, nested dropdowns, storefront falls back to built-in when empty)
- [ ] Product-level flash sale prices with countdown; automatic (no-code) discounts
- [x] Dashboard upgrade: period comparison, top products, recent activity, quick actions, 30-day chart
- [x] Advanced reports: sales (date ranges, period comparison, product performance), COD, coupons, inventory — all with CSV export
- [x] Order timeline, internal notes, printable invoice
- [x] Collapsible admin sidebar, global admin search (Cmd+K), notifications center, bulk actions on products
- [ ] Email templates & notifications (needs email domain setup)
- [x] GA4 + Meta Pixel ecommerce events: view_item, add_to_cart, begin_checkout, purchase
- [x] Multi-currency display: admin-managed rates, storefront switcher, orders always charged in base currency
- [ ] Languages / translations (own stage)

## Phase 4B — Stage 3 (done, tested)
- [x] Flash sale prices on products + variants with optional start/end window; storefront shows sale price, struck original, Sale badge, live countdown; server charges the sale price only inside the window (expired sale billed full price in test)
- [x] Automatic (no-code) discounts: percent/fixed, whole store / category / collection / product, schedule, priority (one per order — highest priority then largest); enforced in checkout server-side, preview line at checkout, shown on order/invoice
- [x] Coupons stack on top of automatic discounts (coupon applies to the already-discounted amount)
- [ ] Email templates & notifications (needs email domain setup)
- [x] GA4 + Meta Pixel ecommerce events: view_item, add_to_cart, begin_checkout, purchase
- [x] Multi-currency display: admin-managed rates, storefront switcher, orders always charged in base currency
- [ ] Languages / translations (own stage)
- [x] Collapsible admin sidebar, global admin search (Cmd+K), notifications center, bulk actions on products
