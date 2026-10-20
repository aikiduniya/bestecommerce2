ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS cod_countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cod_min_order numeric,
  ADD COLUMN IF NOT EXISTS cod_max_order numeric,
  ADD COLUMN IF NOT EXISTS cod_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_excluded_zones uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cod_requires_confirmation boolean NOT NULL DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cod_allowed boolean NOT NULL DEFAULT true;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cod_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_status text NOT NULL DEFAULT 'unfulfilled';

CREATE TABLE public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  staff_role_id uuid REFERENCES public.staff_roles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.activity_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.staff_roles, public.staff_members, public.activity_log TO service_role;
GRANT USAGE ON SEQUENCE public.activity_log_id_seq TO service_role;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1 FROM public.staff_members m JOIN public.staff_roles r ON r.id = m.staff_role_id
    JOIN public.user_roles ur ON ur.user_id = m.user_id AND ur.role = 'staff'
    WHERE m.user_id = _user_id AND m.is_active AND _perm = ANY(r.permissions))
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR (public.has_role(_user_id, 'staff') AND EXISTS (
    SELECT 1 FROM public.staff_members m WHERE m.user_id = _user_id AND m.is_active))
$$;

CREATE POLICY "staff roles read" ON public.staff_roles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff roles admin" ON public.staff_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff members read" ON public.staff_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "staff members admin" ON public.staff_members FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "activity admin read" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "prod staff" ON public.products;
DROP POLICY IF EXISTS "variant staff" ON public.product_variants;
DROP POLICY IF EXISTS "cat staff" ON public.categories;
DROP POLICY IF EXISTS "brand staff" ON public.brands;
DROP POLICY IF EXISTS "col staff" ON public.collections;
DROP POLICY IF EXISTS "pc staff" ON public.product_collections;
DROP POLICY IF EXISTS "media staff" ON public.media;
DROP POLICY IF EXISTS "costs staff" ON public.product_costs;
CREATE POLICY "prod perm" ON public.products FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "variant perm" ON public.product_variants FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "cat perm" ON public.categories FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "brand perm" ON public.brands FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "col perm" ON public.collections FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "pc perm" ON public.product_collections FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "media perm" ON public.media FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "costs perm" ON public.product_costs FOR ALL TO authenticated USING (public.has_permission(auth.uid(),'catalog')) WITH CHECK (public.has_permission(auth.uid(),'catalog'));
DROP POLICY IF EXISTS "orders own read" ON public.orders;
DROP POLICY IF EXISTS "orders staff write" ON public.orders;
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_permission(auth.uid(),'orders'));
CREATE POLICY "orders perm write" ON public.orders FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(),'orders')) WITH CHECK (public.has_permission(auth.uid(),'orders'));
DROP POLICY IF EXISTS "media staff insert" ON storage.objects;
DROP POLICY IF EXISTS "media staff delete" ON storage.objects;
DROP POLICY IF EXISTS "media staff read" ON storage.objects;
CREATE POLICY "media perm read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='media' AND public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "media perm insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='media' AND public.has_permission(auth.uid(),'catalog'));
CREATE POLICY "media perm delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='media' AND public.has_permission(auth.uid(),'catalog'));

CREATE OR REPLACE FUNCTION public.guard_user_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if old.role = 'admin' and (select count(*) from user_roles where role='admin') <= 1 then
    raise exception 'Cannot remove the last Super Admin';
  end if;
  return coalesce(new, old);
end $$;
CREATE TRIGGER guard_user_roles BEFORE UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles();

CREATE OR REPLACE FUNCTION public.log_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _n jsonb; _o jsonb;
begin
  _n := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  _o := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  insert into activity_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name,
    coalesce(_n->>'id', _o->>'id', _n->>'user_id', _o->>'user_id'),
    jsonb_strip_nulls(jsonb_build_object('name', coalesce(_n->>'name', _o->>'name'), 'role', coalesce(_n->>'role', _o->>'role'),
      'status', _n->>'status', 'payment_status', _n->>'payment_status', 'order_number', coalesce(_n->>'order_number', _o->>'order_number'))));
  return coalesce(new, old);
end $$;
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_categories AFTER INSERT OR UPDATE OR DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_brands AFTER INSERT OR UPDATE OR DELETE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_collections AFTER INSERT OR UPDATE OR DELETE ON public.collections FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_shipping_zones AFTER INSERT OR UPDATE OR DELETE ON public.shipping_zones FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_store_settings AFTER UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_staff_members AFTER INSERT OR UPDATE OR DELETE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_staff_roles AFTER INSERT OR UPDATE OR DELETE ON public.staff_roles FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER audit_orders AFTER UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.log_activity();
REVOKE EXECUTE ON FUNCTION public.log_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_user_roles() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_staff(_email text, _role text, _staff_role_id uuid, _active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare _uid uuid;
begin
  if not has_role(auth.uid(), 'admin') then raise exception 'Only the Super Admin can manage staff'; end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email));
  if _uid is null then raise exception 'No account with that email. Ask them to sign up first.'; end if;
  if _role not in ('admin','staff','customer') then raise exception 'Invalid role'; end if;
  if _uid = auth.uid() and _role <> 'admin' then raise exception 'You cannot remove your own Super Admin access'; end if;
  if _role = 'customer' then
    delete from user_roles where user_id = _uid and role in ('admin','staff');
    delete from staff_members where user_id = _uid;
  else
    insert into user_roles(user_id, role) values (_uid, _role::app_role) on conflict do nothing;
    if _role = 'staff' then delete from user_roles where user_id=_uid and role='admin'; end if;
    if _role = 'admin' then delete from user_roles where user_id=_uid and role='staff'; end if;
    insert into staff_members(user_id, email, staff_role_id, is_active) values (_uid, lower(trim(_email)), _staff_role_id, _active)
      on conflict (user_id) do update set staff_role_id = excluded.staff_role_id, is_active = excluded.is_active;
  end if;
  return _uid;
end $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_staff(text,text,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_staff(text,text,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid,text) TO authenticated;

INSERT INTO public.staff_roles(name, permissions) VALUES
 ('Catalog manager', ARRAY['catalog']), ('Order manager', ARRAY['orders','customers']), ('Store manager', ARRAY['catalog','orders','customers'])
ON CONFLICT DO NOTHING;