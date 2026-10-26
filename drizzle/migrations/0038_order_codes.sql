ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_code text;

CREATE OR REPLACE FUNCTION public.generate_order_code(_created timestamptz DEFAULT now())
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _prefix text; _code text; _i int := 0;
begin
  select upper(left(regexp_replace(coalesce(store_name, ''), '[^A-Za-z]', '', 'g'), 3)) into _prefix from store_settings where id = 1;
  if _prefix is null or length(_prefix) < 3 then _prefix := rpad(coalesce(_prefix, ''), 3, 'X'); end if;
  loop
    _code := _prefix || '-' || to_char(_created at time zone 'UTC', 'YYMMDD') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from orders where order_code = _code);
    _i := _i + 1;
    if _i > 50 then _code := _code || lpad((floor(random() * 100))::int::text, 2, '0'); exit; end if;
  end loop;
  return _code;
end $$;
REVOKE EXECUTE ON FUNCTION public.generate_order_code(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_order_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if NEW.order_code is null then NEW.order_code := public.generate_order_code(coalesce(NEW.created_at, now())); end if;
  return NEW;
end $$;
DROP TRIGGER IF EXISTS trg_set_order_code ON public.orders;
CREATE TRIGGER trg_set_order_code BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_order_code();

UPDATE public.orders SET order_code = public.generate_order_code(created_at) WHERE order_code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_code_key ON public.orders(order_code);

CREATE OR REPLACE FUNCTION public.track_guest_order_code(_code text, _email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _n bigint; _r jsonb;
begin
  select order_number into _n from orders where upper(order_code) = upper(trim(_code));
  if _n is null then return null; end if;
  _r := public.track_guest_order(_n, _email);
  if _r is null then return null; end if;
  return _r || jsonb_build_object('order_code', upper(trim(_code)));
end $$;
GRANT EXECUTE ON FUNCTION public.track_guest_order_code(text, text) TO anon, authenticated;