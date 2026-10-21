
-- ============ GIFT CARDS ============
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  initial_balance numeric NOT NULL CHECK (initial_balance > 0),
  balance numeric NOT NULL CHECK (balance >= 0),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_cards TO authenticated;
GRANT ALL ON public.gift_cards TO service_role;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage gift cards" ON public.gift_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.check_gift_card(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
declare _g record;
begin
  select * into _g from gift_cards where upper(code) = upper(trim(_code)) and is_active;
  if not found then raise exception 'Gift card not found'; end if;
  if _g.expires_at is not null and _g.expires_at < now() then raise exception 'This gift card has expired'; end if;
  if _g.balance <= 0 then raise exception 'This gift card has no balance left'; end if;
  return jsonb_build_object('code', _g.code, 'balance', _g.balance);
end $f$;
GRANT EXECUTE ON FUNCTION public.check_gift_card(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_gift_card(text) TO authenticated;

-- ============ LOYALTY POINTS ============
ALTER TABLE public.store_settings ADD COLUMN loyalty_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_settings ADD COLUMN loyalty_earn_rate numeric NOT NULL DEFAULT 1;
ALTER TABLE public.store_settings ADD COLUMN loyalty_redeem_value numeric NOT NULL DEFAULT 0.01;
ALTER TABLE public.store_settings ADD COLUMN loyalty_min_redeem integer NOT NULL DEFAULT 0;
ALTER TABLE public.store_settings ADD COLUMN referral_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_settings ADD COLUMN referral_reward_points integer NOT NULL DEFAULT 100;

CREATE TABLE public.loyalty_transactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  order_id uuid,
  points integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('earn','redeem','refund','referral','adjust')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.loyalty_transactions TO authenticated;
GRANT ALL ON public.loyalty_transactions TO service_role;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own loyalty" ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ REFERRALS ============
CREATE TABLE public.referral_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own referral code" ON public.referral_codes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.referral_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referee_id uuid NOT NULL UNIQUE,
  order_id uuid,
  rewarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_uses TO authenticated;
GRANT ALL ON public.referral_uses TO service_role;
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own referrals" ON public.referral_uses FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.my_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
declare _c text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select code into _c from referral_codes where user_id = auth.uid();
  if found then return _c; end if;
  loop
    _c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into referral_codes (user_id, code) values (auth.uid(), _c);
      return _c;
    exception when unique_violation then end;
  end loop;
end $f$;
GRANT EXECUTE ON FUNCTION public.my_referral_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_referral_code(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
declare _r record; _s record;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into _s from store_settings where id = 1;
  if not _s.referral_enabled then raise exception 'Referrals are not active'; end if;
  select * into _r from referral_codes where upper(code) = upper(trim(_code));
  if not found then raise exception 'Referral code not found'; end if;
  if _r.user_id = auth.uid() then raise exception 'You cannot use your own referral code'; end if;
  if exists(select 1 from referral_uses where referee_id = auth.uid()) then raise exception 'A referral code is already linked to your account'; end if;
  if exists(select 1 from orders where user_id = auth.uid()) then raise exception 'Referral codes can only be added before your first order'; end if;
  insert into referral_uses (referrer_id, referee_id) values (_r.user_id, auth.uid());
  return true;
end $f$;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(text) TO authenticated;

-- ============ ABANDONED CARTS ============
CREATE TABLE public.cart_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric NOT NULL DEFAULT 0,
  recovered_order_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_snapshots TO authenticated;
GRANT ALL ON public.cart_snapshots TO service_role;
ALTER TABLE public.cart_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own cart snapshot" ON public.cart_snapshots FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read all cart snapshots" ON public.cart_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ ORDER COLUMNS ============
ALTER TABLE public.orders ADD COLUMN gift_card_code text;
ALTER TABLE public.orders ADD COLUMN gift_card_applied numeric NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN points_redeemed integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN points_discount numeric NOT NULL DEFAULT 0;

-- ============ PLACE ORDER (gift cards + points) ============
DROP FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text);
CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer jsonb, _address jsonb, _zone_id uuid, _notes text DEFAULT NULL::text, _coupon text DEFAULT NULL::text, _gift_card text DEFAULT NULL::text, _points integer DEFAULT 0)
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

  -- Loyalty points redemption (signed-in customers only; validated against real balance)
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

  -- Gift card (reduces amount due; balance deducted atomically)
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

  _gt := case when _uid is null then gen_random_uuid()::text end;

  insert into orders (user_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_total, tax_total, total, currency, payment_method, shipping_zone_id, notes, payment_fee, cod_confirmed_at, discount_total, coupon_code, auto_discount_total, auto_discount_name, guest_token, gift_card_code, gift_card_applied, points_redeemed, points_discount)
  values (_uid, trim(_customer->>'name'), trim(_customer->>'email'), nullif(trim(_customer->>'phone'),''), _address, _lines, _subtotal, _ship, _tax, _total, _s.currency, 'cod', _z.id, nullif(trim(_notes),''), _fee, case when _s.cod_requires_confirmation then null else now() end, _disc, _code, _auto_disc, _auto_name, _gt, _gift_code, _gift_applied, _pts, _pts_val)
  returning * into _o;

  if _pts > 0 then
    insert into loyalty_transactions (user_id, order_id, points, kind, note) values (_uid, _o.id, -_pts, 'redeem', 'Redeemed on order #' || _o.order_number);
  end if;

  -- Recovered cart snapshot
  if _uid is not null then
    update cart_snapshots set recovered_order_id = _o.id where user_id = _uid and recovered_order_id is null;
  end if;

  return jsonb_build_object('id', _o.id, 'order_number', _o.order_number, 'guest_token', _o.guest_token);
end $f$;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, jsonb, uuid, text, text, text, integer) TO authenticated;

-- ============ CANCEL ROLLBACK (stock + coupon + gift card + points) ============
CREATE OR REPLACE FUNCTION public.restock_cancelled_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
begin
  if NEW.status = 'cancelled' and OLD.status <> 'cancelled' and not NEW.stock_restored then
    update products p set stock = p.stock + (it->>'qty')::int
    from jsonb_array_elements(NEW.items) it where p.id = (it->>'product_id')::uuid;
    update product_variants v set stock = v.stock + (it->>'qty')::int
    from jsonb_array_elements(NEW.items) it where it->>'variant_id' is not null and v.id = (it->>'variant_id')::uuid;
    if NEW.coupon_code is not null then
      update coupons set used_count = greatest(used_count - 1, 0) where code = NEW.coupon_code;
    end if;
    if NEW.gift_card_applied > 0 and NEW.gift_card_code is not null then
      update gift_cards set balance = balance + NEW.gift_card_applied where code = NEW.gift_card_code;
    end if;
    if NEW.points_redeemed > 0 and NEW.user_id is not null then
      insert into loyalty_transactions (user_id, order_id, points, kind, note) values (NEW.user_id, NEW.id, NEW.points_redeemed, 'refund', 'Points returned — order #' || NEW.order_number || ' cancelled');
    end if;
    NEW.stock_restored := true;
  end if;
  return NEW;
end $f$;

-- ============ LOYALTY EARN + REFERRAL REWARD ON DELIVERY ============
CREATE OR REPLACE FUNCTION public.loyalty_earn_on_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
declare _s record; _ru record; _pts int;
begin
  if NEW.status = 'delivered' and OLD.status <> 'delivered' and NEW.user_id is not null then
    select * into _s from store_settings where id = 1;
    if _s.loyalty_enabled and _s.loyalty_earn_rate > 0 then
      _pts := floor(NEW.total * _s.loyalty_earn_rate);
      if _pts > 0 then
        insert into loyalty_transactions (user_id, order_id, points, kind, note) values (NEW.user_id, NEW.id, _pts, 'earn', 'Earned from order #' || NEW.order_number);
      end if;
    end if;
    if _s.referral_enabled then
      select * into _ru from referral_uses where referee_id = NEW.user_id and not rewarded limit 1;
      if found then
        update referral_uses set rewarded = true, order_id = NEW.id where id = _ru.id;
        if _s.referral_reward_points > 0 then
          insert into loyalty_transactions (user_id, order_id, points, kind, note) values (_ru.referrer_id, NEW.id, _s.referral_reward_points, 'referral', 'Referral reward — a friend placed their first order');
        end if;
      end if;
    end if;
  end if;
  return NEW;
end $f$;
DROP TRIGGER IF EXISTS loyalty_earn_on_delivery ON public.orders;
CREATE TRIGGER loyalty_earn_on_delivery AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.loyalty_earn_on_delivery();

-- ============ ABANDONED CART EMAIL TEMPLATE ============
INSERT INTO public.email_templates (key, name, subject, body, is_enabled) VALUES
('abandoned_cart', 'Abandoned cart reminder', 'You left something behind at {{store_name}}', 'Hi {{customer_name}},

You left items in your cart at {{store_name}}:

{{items_list}}

Cart total: {{cart_total}}

Complete your order: {{cart_url}}

{{footer_text}}', true)
ON CONFLICT (key) DO NOTHING;
INSERT INTO public.notification_rules (event, template_key, recipient, is_enabled) VALUES
('abandoned_cart', 'abandoned_cart', 'customer', true)
ON CONFLICT (event) DO NOTHING;
