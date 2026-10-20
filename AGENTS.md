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
