-- Flash sale pricing on products and variants
ALTER TABLE public.products
  ADD COLUMN sale_price numeric,
  ADD COLUMN sale_starts_at timestamptz,
  ADD COLUMN sale_ends_at timestamptz;

ALTER TABLE public.product_variants
  ADD COLUMN sale_price numeric;

-- Effective selling price: sale price wins while the product's sale window is active.
CREATE OR REPLACE FUNCTION public.effective_price(_p products, _v product_variants DEFAULT NULL)
RETURNS numeric
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  select case
    when _p.sale_starts_at is not null and _p.sale_starts_at > now() then coalesce(_v.price, _p.price)
    when _p.sale_ends_at is not null and _p.sale_ends_at < now() then coalesce(_v.price, _p.price)
    else coalesce(_v.sale_price, _p.sale_price, _v.price, _p.price)
  end
$$;

-- Automatic (no-code) discounts
CREATE TABLE public.automatic_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('percent','fixed')),
  value numeric NOT NULL CHECK (value > 0),
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all','category','collection','product')),
  target_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automatic_discounts TO authenticated;
GRANT ALL ON public.automatic_discounts TO service_role;
ALTER TABLE public.automatic_discounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage automatic discounts" ON public.automatic_discounts
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'marketing'))
  WITH CHECK (public.has_permission(auth.uid(), 'marketing'));

-- Orders record the automatic discount applied
ALTER TABLE public.orders
  ADD COLUMN auto_discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN auto_discount_name text;

-- Best active automatic discount for a set of items + subtotal.
-- Returns jsonb: {name, discount}. Only one automatic discount applies (highest priority, then largest discount).
CREATE OR REPLACE FUNCTION public.automatic_discount(_items jsonb, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _d record; _best record; _disc numeric; _best_disc numeric := 0; _eligible numeric;
begin
  for _d in
    select * from automatic_discounts
    where is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    order by priority desc, created_at asc
  loop
    if _d.scope = 'all' then
      _eligible := _subtotal;
    else
      select coalesce(sum((it->>'price')::numeric * (it->>'qty')::int), 0) into _eligible
      from jsonb_array_elements(_items) it
      join products p on p.id = (it->>'product_id')::uuid
      where (_d.scope = 'product' and p.id = _d.target_id)
         or (_d.scope = 'category' and p.category_id = _d.target_id)
         or (_d.scope = 'collection' and exists (
              select 1 from collection_products cp
              where cp.product_id = p.id and cp.collection_id = _d.target_id));
    end if;
    if _eligible > 0 then
      _disc := case when _d.kind = 'percent'
        then round(_eligible * _d.value / 100, 2)
        else least(_d.value, _eligible) end;
      if _disc > _best_disc then
        _best_disc := _disc;
        _best := _d;
      end if;
    end if;
  end loop;
  if _best is null then return null; end if;
  return jsonb_build_object('name', _best.name, 'discount', _best_disc);
end $$;

-- place_order: charge effective (sale) prices and apply automatic discounts server-side
CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer jsonb, _address jsonb, _zone_id uuid, _notes text DEFAULT NULL::text, _coupon text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _uid uuid := auth.uid();
  _s record; _z record; _p record; _v record;
  _it jsonb; _qty int; _price numeric; _subtotal numeric := 0; _ship numeric := 0;
  _lines jsonb := '[]'; _country text; _o record; _has_variants boolean; _fee numeric := 0;
  _cp jsonb; _disc numeric := 0; _code text;
  _ad jsonb; _auto_disc numeric := 0; _auto_name text;
begin
  if _uid is null then raise exception 'Please sign in to place an order'; end if;
  select * into _s from store_settings where id = 1;
  if not _s.cod_enabled then raise exception 'Cash on Delivery is currently unavailable'; end if;
  if _s.maintenance_mode and not is_staff(_uid) then raise exception 'Store is in maintenance mode'; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then raise exception 'Your cart is empty'; end if;
  if coalesce(trim(_customer->>'name'),'') = '' or coalesce(trim(_customer->>'email'),'') = '' then raise exception 'Name and email are required'; end if;
  if coalesce(trim(_address->>'line1'),'') = '' or coalesce(trim(_address->>'city'),'') = '' or coalesce(trim(_address->>'country'),'') = '' then raise exception 'Complete shipping address is required'; end if;
  _country := upper(trim(_address->>'country'));

  for _it in select * from jsonb_array_elements(_items) loop
    _qty := (_it->>'qty')::int;
    if _qty is null or _qty < 1 or _qty > 100 then raise exception 'Invalid quantity'; end if;
    select * into _p from products where id = (_it->>'product_id')::uuid and status = 'active' for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;
    if not _p.cod_allowed then raise exception '% is not available for Cash on Delivery', _p.name; end if;
    select exists(select 1 from product_variants where product_id = _p.id and is_active) into _has_variants;
    if _has_variants then
      if nullif(_it->>'variant_id','') is null then raise exception 'Please choose options for %', _p.name; end if;
      select * into _v from product_variants where id = (_it->>'variant_id')::uuid and product_id = _p.id and is_active for update;
      if not found then raise exception 'Selected option for % is unavailable', _p.name; end if;
      if _v.stock < _qty then raise exception 'Only % left of %', _v.stock, _p.name; end if;
      _price := effective_price(_p, _v);
      update product_variants set stock = stock - _qty where id = _v.id;
      update products set stock = greatest(stock - _qty, 0) where id = _p.id;
      _lines := _lines || jsonb_build_object('product_id', _p.id, 'variant_id', _v.id, 'name', _p.name, 'options', _v.options,
        'sku', coalesce(_v.sku, _p.sku), 'price', _price, 'qty', _qty, 'image', coalesce(_v.image_url, _p.images[1]));
    else
      if _p.stock < _qty then raise exception 'Only % left of %', _p.stock, _p.name; end if;
      _price := effective_price(_p);
      update products set stock = stock - _qty where id = _p.id;
      _lines := _lines || jsonb_build_object('product_id', _p.id, 'variant_id', null, 'name', _p.name, 'options', '{}'::jsonb,
        'sku', _p.sku, 'price', _price, 'qty', _qty, 'image', _p.images[1]);
    end if;
    _subtotal := _subtotal + _price * _qty;
  end loop;

  select * into _z from shipping_zones where id = _zone_id and is_active;
  if not found then raise exception 'Please choose a shipping method'; end if;
  if cardinality(_z.countries) > 0 and not (_country = any(_z.countries) or '*' = any(_z.countries)) then
    raise exception 'This shipping method does not deliver to %', _country;
  end if;
  if cardinality(_s.cod_countries) > 0 and not (_country = any(_s.cod_countries)) then
    raise exception 'Cash on Delivery is not available in %', _country;
  end if;
  if _z.id = any(_s.cod_excluded_zones) then raise exception 'Cash on Delivery is not available with % shipping', _z.name; end if;
  if _s.cod_min_order is not null and _subtotal < _s.cod_min_order then raise exception 'Cash on Delivery requires a minimum order of %', _s.cod_min_order; end if;
  if _s.cod_max_order is not null and _subtotal > _s.cod_max_order then raise exception 'Cash on Delivery is limited to orders up to %', _s.cod_max_order; end if;
  _fee := coalesce(_s.cod_fee, 0);
  _ship := case when _z.free_over is not null and _subtotal >= _z.free_over then 0 else _z.rate end;

  _ad := automatic_discount(_lines, _subtotal);
  if _ad is not null then
    _auto_disc := (_ad->>'discount')::numeric;
    _auto_name := _ad->>'name';
  end if;

  if nullif(trim(coalesce(_coupon,'')),'') is not null then
    _cp := coupon_discount(_coupon, greatest(_subtotal - _auto_disc, 0), _ship, _uid);
    _code := _cp->>'code';
    _disc := (_cp->>'discount')::numeric;
    if (_cp->>'free_shipping')::boolean then _ship := 0; end if;
    update coupons set used_count = used_count + 1 where code = _code and (max_uses is null or used_count < max_uses);
    if not found then raise exception 'This coupon has reached its usage limit'; end if;
  end if;

  insert into orders (user_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_total, total, currency, payment_method, shipping_zone_id, notes, payment_fee, cod_confirmed_at, discount_total, coupon_code, auto_discount_total, auto_discount_name)
  values (_uid, trim(_customer->>'name'), trim(_customer->>'email'), nullif(trim(_customer->>'phone'),''), _address, _lines, _subtotal, _ship, greatest(_subtotal - _auto_disc - _disc, 0) + _ship + _fee, _s.currency, 'cod', _z.id, nullif(trim(_notes),''), _fee, case when _s.cod_requires_confirmation then null else now() end, _disc, _code, _auto_disc, _auto_name)
  returning * into _o;
  return jsonb_build_object('id', _o.id, 'order_number', _o.order_number);
end $function$;