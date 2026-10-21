ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS robots_txt text,
  ADD COLUMN IF NOT EXISTS llms_txt text,
  ADD COLUMN IF NOT EXISTS bing_site_verification text;

CREATE TABLE public.redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path text NOT NULL UNIQUE CHECK (from_path LIKE '/%'),
  to_path text NOT NULL,
  status_code int NOT NULL DEFAULT 301 CHECK (status_code IN (301,302)),
  is_active boolean NOT NULL DEFAULT true,
  hits int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.redirects TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.redirects TO authenticated;
GRANT ALL ON public.redirects TO service_role;
ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active redirects" ON public.redirects FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage redirects" ON public.redirects FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));