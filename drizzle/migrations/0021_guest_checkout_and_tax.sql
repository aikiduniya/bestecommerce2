CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text NOT NULL DEFAULT '*',
  rate numeric NOT NULL DEFAULT 0,
  applies_to_shipping boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tax_rates TO anon;
GRANT SELECT ON public.tax_rates TO authenticated;
GRANT ALL ON public.tax_rates TO service_role;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active tax rates" ON public.tax_rates FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY "admins manage tax rates" ON public.tax_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.store_settings ADD COLUMN tax_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_settings ADD COLUMN tax_inclusive boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_settings ADD COLUMN tax_label text NOT NULL DEFAULT 'Tax';

ALTER TABLE public.orders ADD COLUMN tax_total numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN guest_token text;

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
  _tr record; _tax numeric := 0; _gt text;
begin
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
      _price := effective_price(_p.price, _p.sale_price, _p.sale_starts_at, _p.sale_ends_at, _v.price, _v.sale_price);
      update product_variants set stock = stock - _qty where id = _v.id;
      update products set stock = greatest(stock - _qty, 0) where id = _p.id;
      _lines := _lines || jsonb_build_object('product_id', _p.id, 'variant_id', _v.id, 'name', _p.name, 'options', _v.options,
        'sku', coalesce(_v.sku, _p.sku), 'price', _price, 'qty', _qty, 'image', coalesce(_v.image_url, _p.images[1]));
    else
      if _p.stock < _qty then raise exception 'Only % left of %', _p.stock, _p.name; end if;
      _price := effective_price(_p.price, _p.sale_price, _p.sale_starts_at, _p.sale_ends_at);
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

  if _s.tax_enabled then
    select * into _tr from tax_rates
     where is_active and (country = _country or country = '*')
     order by case when country = _country then 0 else 1 end, priority desc
     limit 1;
    if found and _tr.rate > 0 then
      if _s.tax_inclusive then
        _tax := round((greatest(_subtotal - _auto_disc - _disc, 0) + _ship + _fee) * _tr.rate / (100 + _tr.rate), 2);
      else
        _tax := round((greatest(_subtotal - _auto_disc - _disc, 0) + case when _tr.applies_to_shipping then _ship else 0 end + _fee) * _tr.rate / 100, 2);
      end if;
    end if;
  end if;

  _gt := case when _uid is null then gen_random_uuid()::text end;

  insert into orders (user_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_total, tax_total, total, currency, payment_method, shipping_zone_id, notes, payment_fee, cod_confirmed_at, discount_total, coupon_code, auto_discount_total, auto_discount_name, guest_token)
  values (_uid, trim(_customer->>'name'), trim(_customer->>'email'), nullif(trim(_customer->>'phone'),''), _address, _lines, _subtotal, _ship, _tax, greatest(_subtotal - _auto_disc - _disc, 0) + _ship + _fee + case when _s.tax_enabled and not _s.tax_inclusive then _tax else 0 end, _s.currency, 'cod', _z.id, nullif(trim(_notes),''), _fee, case when _s.cod_requires_confirmation then null else now() end, _disc, _code, _auto_disc, _auto_name, _gt)
  returning * into _o;
  return jsonb_build_object('id', _o.id, 'order_number', _o.order_number, 'guest_token', _o.guest_token);
end $function$;

CREATE OR REPLACE FUNCTION public.track_guest_order(_order_number bigint, _email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _o record;
begin
  select * into _o from orders where order_number = _order_number and user_id is null and lower(customer_email) = lower(trim(_email));
  if not found then return null; end if;
  return jsonb_build_object('order_number', _o.order_number, 'status', _o.status, 'payment_status', _o.payment_status,
    'fulfillment_status', _o.fulfillment_status, 'items', _o.items, 'subtotal', _o.subtotal, 'shipping_total', _o.shipping_total,
    'tax_total', _o.tax_total, 'payment_fee', _o.payment_fee, 'discount_total', _o.discount_total, 'total', _o.total,
    'currency', _o.currency, 'created_at', _o.created_at, 'customer_name', _o.customer_name);
end $function$;

GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_guest_order(bigint, text) TO anon;
GRANT EXECUTE ON FUNCTION public.track_guest_order(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_coupon(text, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.check_automatic_discount(jsonb, numeric) TO anon;