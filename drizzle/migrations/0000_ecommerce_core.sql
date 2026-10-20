create type public.app_role as enum ('admin','staff','customer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','staff')) $$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'customer');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_role after insert on auth.users for each row execute function public.handle_new_user_role();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'Maison',
  tagline text default 'Curated essentials, delivered worldwide',
  logo_url text,
  favicon_url text,
  support_email text,
  support_phone text,
  currency text not null default 'USD',
  primary_color text default '#1c1917',
  accent_color text default '#b08d57',
  announcement text default 'Free worldwide shipping on orders over $150',
  announcement_enabled boolean not null default true,
  cod_enabled boolean not null default true,
  stripe_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  seo_title text,
  seo_description text,
  updated_at timestamptz not null default now()
);
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
create policy "settings public read" on public.store_settings for select to anon, authenticated using (true);
create policy "settings admin update" on public.store_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger t_settings before update on public.store_settings for each row execute function public.touch_updated_at();
insert into public.store_settings (id) values (1);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sku text unique,
  short_description text,
  description text,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  price numeric(12,2) not null default 0,
  compare_at_price numeric(12,2),
  cost_price numeric(12,2),
  stock int not null default 0,
  low_stock_threshold int not null default 5,
  images text[] not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','active','archived')),
  is_featured boolean not null default false,
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_products before update on public.products for each row execute function public.touch_updated_at();

grant select on public.categories, public.brands, public.products to anon, authenticated;
grant insert, update, delete on public.categories, public.brands, public.products to authenticated;
grant all on public.categories, public.brands, public.products to service_role;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
create policy "cat read" on public.categories for select to anon, authenticated using (is_active or public.is_staff(auth.uid()));
create policy "cat staff" on public.categories for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "brand read" on public.brands for select to anon, authenticated using (is_active or public.is_staff(auth.uid()));
create policy "brand staff" on public.brands for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "prod read" on public.products for select to anon, authenticated using (status = 'active' or public.is_staff(auth.uid()));
create policy "prod staff" on public.products for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity,
  user_id uuid,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null default '{}',
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'USD',
  payment_method text not null default 'cod',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','refunded','failed')),
  status text not null default 'pending' check (status in ('pending','processing','shipped','delivered','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger t_orders before update on public.orders for each row execute function public.touch_updated_at();
grant select, insert, update, delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders own read" on public.orders for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "orders staff write" on public.orders for update to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "orders staff delete" on public.orders for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "orders own insert" on public.orders for insert to authenticated with check (user_id = auth.uid());

insert into public.categories (name, slug, sort_order) values
 ('Watches','watches',1),('Fashion','fashion',2),('Electronics','electronics',3),('Beauty','beauty',4),('Home','home',5);
insert into public.brands (name, slug) values ('Maison Atelier','maison-atelier'),('Nordform','nordform'),('Lumen','lumen');
insert into public.products (name, slug, sku, short_description, price, compare_at_price, stock, status, is_featured, category_id, brand_id)
select 'Heritage Chronograph','heritage-chronograph','WAT-001','Swiss-inspired steel chronograph',420,520,14,'active',true,(select id from public.categories where slug='watches'),(select id from public.brands where slug='maison-atelier')
union all select 'Cashmere Overcoat','cashmere-overcoat','FAS-001','Double-faced Italian cashmere',690,null,3,'active',true,(select id from public.categories where slug='fashion'),(select id from public.brands where slug='nordform')
union all select 'Studio Headphones','studio-headphones','ELE-001','Wireless, noise cancelling',299,349,42,'active',false,(select id from public.categories where slug='electronics'),(select id from public.brands where slug='lumen')
union all select 'Ceramic Table Lamp','ceramic-table-lamp','HOM-001','Hand-glazed stoneware base',180,null,0,'draft',false,(select id from public.categories where slug='home'),null;