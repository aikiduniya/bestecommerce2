DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['categories','brands','collections'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS meta_title text, ADD COLUMN IF NOT EXISTS meta_description text, ADD COLUMN IF NOT EXISTS meta_keywords text, ADD COLUMN IF NOT EXISTS canonical_url text, ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS og_image_url text, ADD COLUMN IF NOT EXISTS image_alt text', t);
END LOOP; END $$;
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS page_seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS header_style text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS header_sticky boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS header_tone text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS nav_style text NOT NULL DEFAULT 'plain',
  ADD COLUMN IF NOT EXISTS footer_style text NOT NULL DEFAULT 'columns',
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS announcement_style text NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS container_width text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS section_spacing text NOT NULL DEFAULT 'comfortable',
  ADD COLUMN IF NOT EXISTS hero_height text NOT NULL DEFAULT 'tall',
  ADD COLUMN IF NOT EXISTS hero_overlay int NOT NULL DEFAULT 40 CHECK (hero_overlay BETWEEN 0 AND 90),
  ADD COLUMN IF NOT EXISTS product_grid_cols int NOT NULL DEFAULT 3 CHECK (product_grid_cols BETWEEN 2 AND 5);