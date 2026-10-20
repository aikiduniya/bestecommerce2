alter table public.store_settings add column if not exists font_display text not null default 'Cormorant Garamond';
alter table public.store_settings add column if not exists font_body text not null default 'Manrope';
alter table public.store_settings add column if not exists hero_image_url text;
alter table public.store_settings add column if not exists hero_eyebrow text default 'New season';
alter table public.store_settings add column if not exists hero_cta text default 'Shop the collection';

alter table public.products add column if not exists options jsonb not null default '[]';

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  options jsonb not null default '{}',
  sku text,
  price numeric(12,2),
  compare_at_price numeric(12,2),
  stock int not null default 0 check (stock >= 0),
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.product_variants(product_id);
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant all on public.product_variants to service_role;
alter table public.product_variants enable row level security;
create policy "variant read" on public.product_variants for select to anon, authenticated using (
  public.is_staff(auth.uid()) or exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy "variant staff" on public.product_variants for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

alter table public.products add constraint products_stock_nonneg check (stock >= 0) not valid;

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  show_on_home boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create table public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  primary key (product_id, collection_id)
);
grant select on public.collections, public.product_collections to anon, authenticated;
grant insert, update, delete on public.collections, public.product_collections to authenticated;
grant all on public.collections, public.product_collections to service_role;
alter table public.collections enable row level security;
alter table public.product_collections enable row level security;
create policy "col read" on public.collections for select to anon, authenticated using (is_active or public.is_staff(auth.uid()));
create policy "col staff" on public.collections for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "pc read" on public.product_collections for select to anon, authenticated using (true);
create policy "pc staff" on public.product_collections for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  path text not null,
  filename text,
  mime_type text,
  size_bytes bigint,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.media to authenticated;
grant all on public.media to service_role;
alter table public.media enable row level security;
create policy "media staff" on public.media for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.wishlists (
  user_id uuid not null,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
grant select, insert, delete on public.wishlists to authenticated;
grant all on public.wishlists to service_role;
alter table public.wishlists enable row level security;
create policy "wish own" on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.shipping_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  countries text[] not null default '{}',
  rate numeric(12,2) not null default 0,
  free_over numeric(12,2),
  estimated_days text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.shipping_zones to anon, authenticated;
grant insert, update, delete on public.shipping_zones to authenticated;
grant all on public.shipping_zones to service_role;
alter table public.shipping_zones enable row level security;
create policy "zone read" on public.shipping_zones for select to anon, authenticated using (is_active or public.is_staff(auth.uid()));
create policy "zone staff" on public.shipping_zones for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

alter table public.orders add column if not exists shipping_zone_id uuid references public.shipping_zones(id) on delete set null;
alter table public.orders add column if not exists stock_restored boolean not null default false;

drop policy if exists "orders own insert" on public.orders;
revoke insert on public.orders from authenticated;

create or replace function public.place_order(_items jsonb, _customer jsonb, _address jsonb, _zone_id uuid, _notes text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _s record; _z record; _p record; _v record;
  _it jsonb; _qty int; _price numeric; _subtotal numeric := 0; _ship numeric := 0;
  _lines jsonb := '[]'; _country text; _o record; _has_variants boolean;
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
  _ship := case when _z.free_over is not null and _subtotal >= _z.free_over then 0 else _z.rate end;

  insert into orders (user_id, customer_name, customer_email, customer_phone, shipping_address, items, subtotal, shipping_total, total, currency, payment_method, shipping_zone_id, notes)
  values (_uid, trim(_customer->>'name'), trim(_customer->>'email'), nullif(trim(_customer->>'phone'),''), _address, _lines, _subtotal, _ship, _subtotal + _ship, _s.currency, 'cod', _z.id, nullif(trim(_notes),''))
  returning * into _o;
  return jsonb_build_object('id', _o.id, 'order_number', _o.order_number);
end $$;
revoke all on function public.place_order(jsonb, jsonb, jsonb, uuid, text) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, jsonb, uuid, text) to authenticated;

create or replace function public.restock_cancelled_order() returns trigger language plpgsql security definer set search_path = public as $$
declare _it jsonb;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and not old.stock_restored then
    for _it in select * from jsonb_array_elements(new.items) loop
      if nullif(_it->>'variant_id','') is not null then
        update product_variants set stock = stock + (_it->>'qty')::int where id = (_it->>'variant_id')::uuid;
      end if;
      update products set stock = stock + (_it->>'qty')::int where id = (_it->>'product_id')::uuid;
    end loop;
    new.stock_restored := true;
  end if;
  return new;
end $$;
create trigger t_orders_restock before update on public.orders for each row execute function public.restock_cancelled_order();

create policy "media public read" on storage.objects for select using (bucket_id = 'media');
create policy "media staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_staff(auth.uid()));
create policy "media staff delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_staff(auth.uid()));

insert into public.shipping_zones (name, countries, rate, free_over, estimated_days, sort_order) values ('Worldwide standard', '{}', 15, 150, '5–10 business days', 1);