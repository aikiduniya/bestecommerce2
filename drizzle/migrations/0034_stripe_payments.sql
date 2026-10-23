CREATE TABLE public.payment_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  stripe_enabled boolean NOT NULL DEFAULT false,
  stripe_mode text NOT NULL DEFAULT 'test' CHECK (stripe_mode IN ('test','live')),
  test_publishable_key text, live_publishable_key text,
  test_secret_enc text, live_secret_enc text,
  test_webhook_enc text, live_webhook_enc text,
  test_secret_set boolean GENERATED ALWAYS AS (test_secret_enc IS NOT NULL) STORED,
  live_secret_set boolean GENERATED ALWAYS AS (live_secret_enc IS NOT NULL) STORED,
  test_webhook_set boolean GENERATED ALWAYS AS (test_webhook_enc IS NOT NULL) STORED,
  live_webhook_set boolean GENERATED ALWAYS AS (live_webhook_enc IS NOT NULL) STORED,
  test_verified_at timestamptz, live_verified_at timestamptz,
  currencies text[] NOT NULL DEFAULT '{}',
  payment_methods text[] NOT NULL DEFAULT '{card}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, stripe_enabled, stripe_mode, test_publishable_key, live_publishable_key, test_secret_set, live_secret_set, test_webhook_set, live_webhook_set, test_verified_at, live_verified_at, currencies, payment_methods, updated_at) ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read payment settings" ON public.payment_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.payment_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  mode text NOT NULL DEFAULT 'test',
  kind text NOT NULL CHECK (kind IN ('checkout','payment','refund','webhook')),
  status text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text,
  stripe_session_id text, stripe_payment_intent text, stripe_refund_id text, stripe_event_id text,
  message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_transactions_order_idx ON public.payment_transactions(order_id);
CREATE INDEX payment_transactions_created_idx ON public.payment_transactions(created_at DESC);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order staff read transactions" ON public.payment_transactions FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'orders'));

CREATE TABLE public.stripe_events (
  event_id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_events TO service_role;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_total numeric NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_uidx ON public.orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.public_payment_options() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $f$
  select jsonb_build_object('stripe', coalesce((select stripe_enabled from payment_settings where id = 1), false))
$f$;
GRANT EXECUTE ON FUNCTION public.public_payment_options() TO anon, authenticated;

DROP FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text, integer);
CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer jsonb, _address jsonb, _zone_id uuid, _notes text DEFAULT NULL::text, _coupon text DEFAULT NULL::text, _gift_card text DEFAULT NULL::text, _points integer DEFAULT 0, _payment text DEFAULT 'cod'::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
declare
  _uid uuid := auth.uid();
  _s record; _z record; _p record; _v record;
  _it jsonb; _qty int; _price numeric; _subtotal numeric := 0; _ship numeric := 0;
  _lines jsonb := '[]'; _country text; _o record; _has_variants boolean; _fee numeric := 0;
  _cp jsonb; _disc numeric := 0; _code text;
  _ad jsonb; _auto_disc numeric := 0; _auto_name text;
  _tr record; _tax numeric := 0; _gt text;
  _g record; _gift_applied numeric := 0; _gift_code text;
  _bal int; _pts int := 0; _pts_val numeric := 0; _merch numeric; _total numeric;
begin
  select * into _s from store_settings where id = 1;
  if _payment not in ('cod','stripe') then raise exception 'Invalid payment method'; end if;
  if _payment = 'cod' and not _s.cod_enabled then raise exception 'Cash on Delivery is currently unavailable'; end if;
  if _payment = 'stripe' and not exists (select 1 from payment_settings where id = 1 and stripe_enabled) then raise exception 'Card payments are currently unavailable'; end if;
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
    if _payment = 'cod' and not _p.cod_allowed then raise exception '% is not available for Cash on Delivery', _p.name; end if;
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
  if _payment = 'cod' then
  if cardinality(_s.cod_countries) > 0 and not (_country = any(_s.cod_countries)) then
    raise exception 'Cash on Delivery is not available in %', _country;
  end if;
  if _z.id = any(_s.cod_excluded_zones) then raise exception 'Cash on Delivery is not available with % shipping', _z.name; end if;
  if _s.cod_min_order is not null and _subtotal < _s.cod_min_order then raise exception 'Cash on Delivery requires a minimum order of %', _s.cod_min_order; end if;
  if _s.cod_max_order is not null and _subtotal > _s.cod_max_order then raise exception 'Cash on Delivery is limited to orders up to %', _s.cod_max_order; end if;
  _fee := coalesce(_s.cod_fee, 0);
  end if;
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

  if _points is not null and _points > 0 then
    if _uid is null then raise exception 'Sign in to redeem points'; end if;
    if not _s.loyalty_enabled then raise exception 'Loyalty points are not active'; end if;
    if _points < _s.loyalty_min_redeem then raise exception 'Minimum redemption is % points', _s.loyalty_min_redeem; end if;
    select coalesce(sum(points), 0) into _bal from loyalty_transactions where user_id = _uid;
    if _points > _bal then raise exception 'You only have % points', _bal; end if;
    _pts := _points;
    _pts_val := round(_pts * _s.loyalty_redeem_value, 2);
  end if;

  _merch := greatest(_subtotal - _auto_disc - _disc - _pts_val, 0);

  if _s.tax_enabled then
    select * into _tr from tax_rates
     where is_active and (country = _country or country = '*')
     order by case when country = _country then 0 else 1 end, priority desc
     limit 1;
    if found and _tr.rate > 0 then
      if _s.tax_inclusive then
        _tax := round((_merch + _ship + _fee) * _tr.rate / (100 + _tr.rate), 2);
      else
        _tax := round((_merch + case when _tr.applies_to_shipping then _ship else 0 end + _fee) * _tr.rate / 100, 2);
      end if;
    end if;
  end if;

  _total := _merch + _ship + _fee + case when _s.tax_enabled and not _s.tax_inclusive then _tax else 0 end;

  if nullif(trim(coalesce(_gift_card,'')),'') is not null then
    select * into _g from gift_cards where upper(code) = upper(trim(_gift_card)) and is_active for update;
    if not found then raise exception 'Gift card not found'; end if;
    if _g.expires_at is not null and _g.expires_at < now() then raise exception 'This gift card has expired'; end if;
    if _g.balance <= 0 then raise exception 'This gift card has no balance left'; end if;
    _gift_applied := least(_g.balance, _total);
    update gift_cards set balance = balance - _gift_applied where id = _g.id;
    _gift_code := _g.code;
    _total := _total - _gift_applied;
  end if;

  if _payment = 'stripe' and _total <= 0 then raise exception 'This order has nothing left to pay by card — please choose Cash on Delivery'; end if;

  _gt := case when _uid is null then gen_random_uuid()::text end;

  insert into orders (user_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_total, tax_total, total, currency, payment_method, shipping_zone_id, notes, payment_fee, cod_confirmed_at, discount_total, coupon_code, auto_discount_total, auto_discount_name, guest_token, gift_card_code, gift_card_applied, points_redeemed, points_discount)
  values (_uid, trim(_customer->>'name'), trim(_customer->>'email'), nullif(trim(_customer->>'phone'),''), _address, _lines, _subtotal, _ship, _tax, _total, _s.currency, _payment, _z.id, nullif(trim(_notes),''), _fee, case when _payment <> 'cod' or _s.cod_requires_confirmation then null else now() end, _disc, _code, _auto_disc, _auto_name, _gt, _gift_code, _gift_applied, _pts, _pts_val)
  returning * into _o;

  if _pts > 0 then
    insert into loyalty_transactions (user_id, order_id, points, kind, note) values (_uid, _o.id, -_pts, 'redeem', 'Redeemed on order #' || _o.order_number);
  end if;

  if _uid is not null then
    update cart_snapshots set recovered_order_id = _o.id where user_id = _uid and recovered_order_id is null;
  end if;

  return jsonb_build_object('id', _o.id, 'order_number', _o.order_number, 'guest_token', _o.guest_token);
end $f$;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text, integer, text) TO anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text, integer, text) TO authenticated;