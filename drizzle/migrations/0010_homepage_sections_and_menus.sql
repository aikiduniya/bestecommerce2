create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text,
  subtitle text,
  config jsonb not null default '{}',
  sort_order int not null default 0,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.homepage_sections to anon;
grant select, insert, update, delete on public.homepage_sections to authenticated;
grant all on public.homepage_sections to service_role;
alter table public.homepage_sections enable row level security;
create policy "Public read enabled sections" on public.homepage_sections for select to anon, authenticated using (is_enabled or public.is_staff(auth.uid()));
create policy "Content staff manage sections" on public.homepage_sections for all to authenticated using (public.has_permission(auth.uid(), 'content')) with check (public.has_permission(auth.uid(), 'content'));

create trigger homepage_sections_touch before update on public.homepage_sections for each row execute function public.touch_updated_at();

create table public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  items jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
grant select on public.navigation_menus to anon;
grant select, insert, update, delete on public.navigation_menus to authenticated;
grant all on public.navigation_menus to service_role;
alter table public.navigation_menus enable row level security;
create policy "Public read menus" on public.navigation_menus for select to anon, authenticated using (true);
create policy "Content staff manage menus" on public.navigation_menus for all to authenticated using (public.has_permission(auth.uid(), 'content')) with check (public.has_permission(auth.uid(), 'content'));

create trigger navigation_menus_touch before update on public.navigation_menus for each row execute function public.touch_updated_at();

insert into public.navigation_menus (handle, items) values ('header', '[]'), ('footer', '[]');