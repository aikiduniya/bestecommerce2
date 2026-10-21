CREATE TABLE public.content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product','variant','category','brand','collection','page','blog_post')),
  entity_id uuid NOT NULL,
  lang text NOT NULL CHECK (lang ~ '^[a-z]{2}$'),
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, lang)
);
COMMENT ON TABLE public.content_translations IS 'Per-language content translations. fields holds translated columns per entity type (e.g. name, description, seo_title, seo_description, slug). Missing fields/languages fall back to the base row.';
CREATE INDEX content_translations_entity_idx ON public.content_translations (entity_type, entity_id);
GRANT SELECT ON public.content_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_translations TO authenticated;
GRANT ALL ON public.content_translations TO service_role;
ALTER TABLE public.content_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read translations" ON public.content_translations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Catalog/content staff manage translations" ON public.content_translations FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'catalog') OR public.has_permission(auth.uid(), 'content'))
  WITH CHECK (public.has_permission(auth.uid(), 'catalog') OR public.has_permission(auth.uid(), 'content'));
CREATE TRIGGER content_translations_touch BEFORE UPDATE ON public.content_translations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();