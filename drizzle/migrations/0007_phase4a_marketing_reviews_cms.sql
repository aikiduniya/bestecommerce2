-- Settings: SEO + tracking integrations
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS ga4_id text,
  ADD COLUMN IF NOT EXISTS gtm_id text,
  ADD COLUMN IF NOT EXISTS meta_pixel_id text,
  ADD COLUMN IF NOT EXISTS merchant_center_id text,
  ADD COLUMN IF NOT EXISTS google_site_verification text,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS reviews_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reviews_require_approval boolean NOT NULL DEFAULT true;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code text;

-- Coupons
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  kind text NOT NULL DEFAULT 'percent' CHECK (kind IN ('percent','fixed','free_shipping')),
  value numeric NOT NULL DEFAULT 0 CHECK (value >= 0),
  min_subtotal numeric,
  max_uses integer,
  per_user_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon perm" ON public.coupons FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'marketing')) WITH CHECK (public.has_permission(auth.uid(),'marketing'));

CREATE OR REPLACE FUNCTION public.coupon_discount(_code text, _subtotal numeric, _ship numeric, _uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare _c record; _used int; _d numeric := 0;
begin
  select * into _c from coupons where code = upper(trim(_code));
  if not found or not _c.is_active then raise exception 'This coupon code is not valid'; end if;
  if _c.starts_at is not null and now() < _c.starts_at then raise exception 'This coupon is not active yet'; end if;
  if _c.ends_at is not null and now() > _c.ends_at then raise exception 'This coupon has expired'; end if;
  if _c.max_uses is not null and _c.used_count >= _c.max_uses then raise exception 'This coupon has reached its usage limit'; end if;
  if _c.min_subtotal is not null and _subtotal < _c.min_subtotal then raise exception 'This coupon requires a minimum order of %', _c.min_subtotal; end if;
  if _c.per_user_limit is not null and _uid is not null then
    select count(*) into _used from orders where user_id = _uid and coupon_code = _c.code and status <> 'cancelled';
    if _used >= _c.per_user_limit then raise exception 'You have already used this coupon'; end if;
  end if;
  if _c.kind = 'percent' then _d := round(_subtotal * least(_c.value,100) / 100, 2);
  elsif _c.kind = 'fixed' then _d := least(_c.value, _subtotal);
  else _d := 0; end if;
  return jsonb_build_object('code', _c.code, 'kind', _c.kind, 'discount', _d, 'free_shipping', _c.kind = 'free_shipping');
end $$;
REVOKE ALL ON FUNCTION public.coupon_discount(text,numeric,numeric,uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_coupon(_code text, _subtotal numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then raise exception 'Please sign in to use a coupon'; end if;
  return public.coupon_discount(_code, _subtotal, 0, auth.uid());
end $$;
REVOKE ALL ON FUNCTION public.check_coupon(text,numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_coupon(text,numeric) TO authenticated;

-- place_order with coupon
DROP FUNCTION IF EXISTS public.place_order(jsonb, jsonb, jsonb, uuid, text);
CREATE FUNCTION public.place_order(_items jsonb, _customer jsonb, _address jsonb, _zone_id uuid, _notes text DEFAULT NULL, _coupon text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  _uid uuid := auth.uid();
  _s record; _z record; _p record; _v record;
  _it jsonb; _qty int; _price numeric; _subtotal numeric := 0; _ship numeric := 0;
  _lines jsonb := '[]'; _country text; _o record; _has_variants boolean; _fee numeric := 0;
  _cp jsonb; _disc numeric := 0; _code text;
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
      _price := coalesce(_v.price, _p.price);
      update product_variants set stock = stock - _qty where id = _v.id;
      update products set stock = greatest(stock - _qty, 0) where id = _p.id;
      _lines := _lines || jsonb_build_object('product_id', _p.id, 'variant_id', _v.id, 'name', _p.name, 'options', _v.options,
        'sku', coalesce(_v.sku, _p.sku), 'price', _price, 'qty', _qty, 'image', coalesce(_v.image_url, _p.images[1]));
    else
      if _p.stock < _qty then raise exception 'Only % left of %', _p.stock, _p.name; end if;
      _price := _p.price;
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

  if nullif(trim(coalesce(_coupon,'')),'') is not null then
    _cp := coupon_discount(_coupon, _subtotal, _ship, _uid);
    _code := _cp->>'code';
    _disc := (_cp->>'discount')::numeric;
    if (_cp->>'free_shipping')::boolean then _ship := 0; end if;
    update coupons set used_count = used_count + 1 where code = _code;
  end if;

  insert into orders (user_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_total, total, currency, payment_method, shipping_zone_id, notes, payment_fee, cod_confirmed_at, discount_total, coupon_code)
  values (_uid, trim(_customer->>'name'), trim(_customer->>'email'), nullif(trim(_customer->>'phone'),''), _address, _lines, _subtotal, _ship, greatest(_subtotal - _disc, 0) + _ship + _fee, _s.currency, 'cod', _z.id, nullif(trim(_notes),''), _fee, case when _s.cod_requires_confirmation then null else now() end, _disc, _code)
  returning * into _o;
  return jsonb_build_object('id', _o.id, 'order_number', _o.order_number);
end $function$;
REVOKE ALL ON FUNCTION public.place_order(jsonb,jsonb,jsonb,uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb,jsonb,jsonb,uuid,text,text) TO authenticated;

-- Reviews
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 3000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  verified_purchase boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review public read" ON public.reviews FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR user_id = auth.uid() OR public.has_permission(auth.uid(),'content'));
CREATE POLICY "review own insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "review own delete" ON public.reviews FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_permission(auth.uid(),'content'));
CREATE POLICY "review moderate" ON public.reviews FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'content')) WITH CHECK (public.has_permission(auth.uid(),'content'));

-- Customer questions
CREATE TABLE public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL,
  question text NOT NULL CHECK (char_length(question) BETWEEN 3 AND 1000),
  answer text,
  answered_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_questions TO authenticated;
GRANT ALL ON public.product_questions TO service_role;
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q public read" ON public.product_questions FOR SELECT TO anon, authenticated
  USING (status = 'published' OR user_id = auth.uid() OR public.has_permission(auth.uid(),'content'));
CREATE POLICY "q own insert" ON public.product_questions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "q moderate" ON public.product_questions FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'content')) WITH CHECK (public.has_permission(auth.uid(),'content'));
CREATE POLICY "q delete" ON public.product_questions FOR DELETE TO authenticated USING (public.has_permission(auth.uid(),'content'));

-- Force safe values on customer submissions
CREATE OR REPLACE FUNCTION public.guard_review_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _s record;
begin
  if public.has_permission(auth.uid(),'content') then return new; end if;
  select reviews_enabled, reviews_require_approval into _s from store_settings where id = 1;
  if TG_TABLE_NAME = 'reviews' then
    if not _s.reviews_enabled then raise exception 'Reviews are currently closed'; end if;
    new.status := case when _s.reviews_require_approval then 'pending' else 'approved' end;
    new.verified_purchase := exists(select 1 from orders o, jsonb_array_elements(o.items) i
      where o.user_id = new.user_id and o.status <> 'cancelled' and (i->>'product_id')::uuid = new.product_id);
  else
    new.status := 'pending'; new.answer := null; new.answered_at := null;
  end if;
  new.created_at := now();
  return new;
end $$;
CREATE TRIGGER reviews_guard BEFORE INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.guard_review_insert();
CREATE TRIGGER questions_guard BEFORE INSERT ON public.product_questions FOR EACH ROW EXECUTE FUNCTION public.guard_review_insert();

-- CMS pages
CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  seo_title text,
  seo_description text,
  is_published boolean NOT NULL DEFAULT false,
  show_in_footer boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pages read" ON public.pages FOR SELECT TO anon, authenticated USING (is_published OR public.has_permission(auth.uid(),'content'));
CREATE POLICY "pages perm" ON public.pages FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'content')) WITH CHECK (public.has_permission(auth.uid(),'content'));

-- Blog
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  body text NOT NULL DEFAULT '',
  cover_image text,
  author text,
  tags text[] NOT NULL DEFAULT '{}',
  seo_title text,
  seo_description text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts read" ON public.blog_posts FOR SELECT TO anon, authenticated USING (is_published OR public.has_permission(auth.uid(),'content'));
CREATE POLICY "posts perm" ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'content')) WITH CHECK (public.has_permission(auth.uid(),'content'));

CREATE TRIGGER pages_touch BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER posts_touch BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER coupons_log AFTER INSERT OR UPDATE OR DELETE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER pages_log AFTER INSERT OR UPDATE OR DELETE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER posts_log AFTER INSERT OR UPDATE OR DELETE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.log_activity();
