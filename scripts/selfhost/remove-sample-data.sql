-- FRESH INSTALL ONLY: remove the 4 starter products and 3 starter brands created by migration 0000.
-- Categories (Watches, Fashion, Electronics, Beauty, Home) are kept; edit them in Admin → Categories.
-- Products that already appear in an order are left untouched.
delete from public.products p
where p.slug in ('heritage-chronograph','cashmere-overcoat','studio-headphones','ceramic-table-lamp')
  and not exists (select 1 from public.order_items oi where oi.product_id = p.id);
delete from public.brands b
where b.slug in ('maison-atelier','nordform','lumen')
  and not exists (select 1 from public.products p where p.brand_id = b.id);
