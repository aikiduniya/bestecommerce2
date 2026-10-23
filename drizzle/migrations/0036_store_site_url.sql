ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS site_url text;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS enforce_primary_host boolean NOT NULL DEFAULT false;
ALTER TABLE public.store_settings ADD CONSTRAINT store_settings_site_url_format CHECK (site_url IS NULL OR site_url ~ '^https?://[a-z0-9.-]+(:[0-9]+)?$');