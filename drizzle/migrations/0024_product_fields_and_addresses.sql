ALTER TABLE public.products
  ADD COLUMN barcode text,
  ADD COLUMN specifications jsonb not null default '{}'::jsonb,
  ADD COLUMN weight_grams integer,
  ADD COLUMN related_ids uuid[] not null default '{}';

CREATE TABLE public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  label text not null default 'Home',
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  postal text,
  country text not null,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON public.addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());