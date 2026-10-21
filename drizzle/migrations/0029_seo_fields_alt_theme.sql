ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_alts text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS meta_keywords text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS og_image_url text;
ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS meta_keywords text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS og_image_url text;
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS meta_keywords text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS robots_noindex boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS og_image_url text,
  ADD COLUMN IF NOT EXISTS cover_alt text;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS alt_text text;
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS hero_image_alt text,
  ADD COLUMN IF NOT EXISTS theme_preset text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS button_style text NOT NULL DEFAULT 'square' CHECK (button_style IN ('square','rounded','pill')),
  ADD COLUMN IF NOT EXISTS card_style text NOT NULL DEFAULT 'minimal' CHECK (card_style IN ('minimal','framed','elevated')),
  ADD COLUMN IF NOT EXISTS background_color text,
  ADD COLUMN IF NOT EXISTS surface_color text;