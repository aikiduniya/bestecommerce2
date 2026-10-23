<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- All store branding/content/config lives in `store_settings` and related tables; never hardcode business content (admin must control it).
- Roles live in `user_roles` (admin/staff/customer) with `has_role`/`is_staff` security-definer checks; every signup gets `customer` via trigger — admin/staff can only be granted by an existing admin (RLS on user_roles).
- Admin pages live under `src/routes/_authenticated/admin.*` and read/write via the browser client protected by RLS.
- Admin write access is enforced by RLS via `has_permission(uid, perm)` (perms: catalog, orders, customers; admin has all); settings/shipping/staff/activity are admin-only. Staff are managed only through the `admin_set_staff` RPC. Why: permissions must hold server-side, not just in the menu.
- COD rules live in `store_settings` and are enforced inside `place_order`; the checkout UI only mirrors them for messaging. Why: totals and eligibility must never be trusted from the browser.

- Coupons are validated and applied only inside `place_order` (via `coupon_discount`); `check_coupon` is a preview for the checkout UI. Why: discounts must never be trusted from the browser.
- Customer-submitted reviews/questions are forced to pending (and verified-buyer computed) by a BEFORE INSERT trigger. Why: customers must not self-approve or fake badges.
- Admin-written CMS/blog text is rendered as plain text via `Prose` (no raw HTML). Why: prevents script injection through content.
- Homepage is driven by `homepage_sections` rows when any exist (storefront falls back to the built-in layout in `LegacyHome` when the table is empty); section configs are JSONB keyed by section type in `src/lib/sections.ts`. Why: admin controls the homepage without code changes.
- Header/footer menus come from `navigation_menus` (handles `header`/`footer`); empty items array means the storefront uses its built-in links. Menu URLs are admin-entered strings rendered as plain anchors. Why: no hardcoded navigation content.
- Coupon usage is incremented atomically in `place_order` (WHERE used_count < max_uses) and decremented by `restock_cancelled_order` on cancellation, guarded by `stock_restored`. Why: usage limits must hold under concurrent checkouts and cancelled orders must free the coupon.
- Sale prices (`products.sale_price` + start/end window, `product_variants.sale_price`) and automatic discounts (`automatic_discounts` table) are resolved only inside `place_order` via `effective_price(...)` and `automatic_discount(...)`; `check_automatic_discount` and `src/lib/sale.ts` are UI previews that must mirror the SQL. Why: the charged price must never come from the browser.
- robots.txt, llms.txt and sitemap.xml are server routes generated live from the database (admin overrides in `store_settings`); never add static copies in `public/`. Why: crawler files must follow content changes automatically.
- Redirects (`redirects` table) are applied in `src/server.ts` only when a request would 404. Why: real pages always win and lookups stay off the hot path.
- Theme presets live in `src/lib/theme.ts` and only write look-and-feel columns on `store_settings`; `StoreTheme` maps them to CSS variables (`--btn-radius`, `data-card`). Why: switching themes must never touch content.
- Storefront layout options (header/footer/nav/banner/width/spacing/grid) are `store_settings` columns applied by `StoreTheme` as `html[data-*]` attributes + CSS in `src/styles.css`; components only add hook classes (`store-header`, `hero-pad`, `hero-img`). Why: admin layout changes must not require code edits.
- Category/brand/collection SEO lives on their own rows and is rendered by the shop route head via `taxoHead`; fixed pages use `store_settings.page_seo[key]` via `pageSeoOf`. Why: every public page's SEO is admin-controlled.
- Stripe is bring-your-own-keys entered in Admin → Payments: secrets encrypted server-side (payment_settings *_enc, never granted to clients); card orders go through `place_order(_payment='stripe')`, are paid only via verified webhook/session check in `stripe.server.ts` (amount+currency matched, idempotent via stripe_events), and expired sessions cancel the order to restock. Why: card totals and paid status must never be trusted from the browser.
- Absolute URLs always come from the site origin resolver (`src/lib/site-url.ts`: Admin `store_settings.site_url` → `SITE_URL` env → request origin); SSR heads use the live `SITE` binding set in the root loader, server routes use `originOf(req)`. Why: the store must work on any domain/host; never hardcode a hosting domain.
- Self-hosting docs/scripts live in `docs/self-hosting/` and `scripts/selfhost/`; Node builds use `NITRO_PRESET=node-server`, and Node SMTP uses runtime-loaded `nodemailer` while `cloudflare:sockets` stays external. Why: the same source must build for Cloudflare and plain Node.
- Self-hosted builds set `SELF_HOSTED=1`, which aliases Lovable-only helpers to `src/selfhost-stubs/` via a Vite plugin in `vite.config.ts`; Lovable builds never set it. Why: production self-hosted bundles must contain no Lovable code while the editor keeps working.
- Standalone release ZIPs are produced only by `scripts/selfhost/make-release.sh`, which swaps in `scripts/selfhost/standalone/` files and strips all Lovable packages/helpers from the staged copy. Why: the editor project keeps Lovable tooling while the download has none.
