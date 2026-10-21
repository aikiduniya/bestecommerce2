ALTER TABLE public.pages ADD COLUMN IF NOT EXISTS image_url text, ADD COLUMN IF NOT EXISTS image_alt text, ADD COLUMN IF NOT EXISTS is_draft_sample boolean NOT NULL DEFAULT false;

CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  subject text CHECK (subject IS NULL OR char_length(subject) <= 150),
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 5000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','open','replied','closed','spam')),
  is_read boolean NOT NULL DEFAULT false,
  admin_reply text,
  replied_at timestamptz,
  replied_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_messages_created_idx ON public.contact_messages (created_at DESC);
CREATE INDEX contact_messages_email_idx ON public.contact_messages (lower(email), created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read inquiries" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'customers'));
CREATE POLICY "Staff update inquiries" ON public.contact_messages FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'customers')) WITH CHECK (public.has_permission(auth.uid(), 'customers'));
CREATE POLICY "Admin delete inquiries" ON public.contact_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Public submission with validation + rate limit (3 per email / 10 total per 10 minutes)
CREATE OR REPLACE FUNCTION public.submit_contact(_name text, _email text, _phone text, _subject text, _message text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  _name := btrim(coalesce(_name,'')); _email := lower(btrim(coalesce(_email,''))); _message := btrim(coalesce(_message,''));
  _phone := nullif(btrim(coalesce(_phone,'')),''); _subject := nullif(btrim(coalesce(_subject,'')),'');
  IF char_length(_name) < 1 OR char_length(_name) > 100 THEN RAISE EXCEPTION 'Please enter your name'; END IF;
  IF _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' OR char_length(_email) > 255 THEN RAISE EXCEPTION 'Please enter a valid email'; END IF;
  IF char_length(_message) < 5 OR char_length(_message) > 5000 THEN RAISE EXCEPTION 'Message must be 5–5000 characters'; END IF;
  IF (SELECT count(*) FROM contact_messages WHERE lower(email) = _email AND created_at > now() - interval '10 minutes') >= 3
     OR (SELECT count(*) FROM contact_messages WHERE created_at > now() - interval '1 minute') >= 10 THEN
    RAISE EXCEPTION 'Too many messages — please try again in a few minutes';
  END IF;
  INSERT INTO contact_messages(name,email,phone,subject,message) VALUES (_name,_email,left(_phone,40),left(_subject,150),_message) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.submit_contact(text,text,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_contact(text,text,text,text,text) TO anon, authenticated;

CREATE TABLE public.faq_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.faq_categories(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  show_on_home boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_categories, public.faqs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_categories, public.faqs TO authenticated;
GRANT ALL ON public.faq_categories, public.faqs TO service_role;
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads faq categories" ON public.faq_categories FOR SELECT USING (true);
CREATE POLICY "Content staff manage faq categories" ON public.faq_categories FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'content')) WITH CHECK (public.has_permission(auth.uid(), 'content'));
CREATE POLICY "Anyone reads published faqs" ON public.faqs FOR SELECT USING (is_published OR public.has_permission(auth.uid(), 'content'));
CREATE POLICY "Content staff manage faqs" ON public.faqs FOR ALL TO authenticated USING (public.has_permission(auth.uid(), 'content')) WITH CHECK (public.has_permission(auth.uid(), 'content'));

CREATE TABLE public.smtp_profiles (
  purpose text PRIMARY KEY CHECK (purpose IN ('general','contact','orders','security')),
  host text,
  port int NOT NULL DEFAULT 587 CHECK (port BETWEEN 1 AND 65535),
  encryption text NOT NULL DEFAULT 'starttls' CHECK (encryption IN ('starttls','ssl','none')),
  username text,
  password_encrypted text,
  sender_name text,
  sender_email text,
  is_enabled boolean NOT NULL DEFAULT false,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (purpose, host, port, encryption, username, sender_name, sender_email, is_enabled, last_test_at, last_test_ok, last_test_error, updated_at) ON public.smtp_profiles TO authenticated;
GRANT ALL ON public.smtp_profiles TO service_role;
ALTER TABLE public.smtp_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads smtp profiles" ON public.smtp_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.smtp_profiles(purpose) VALUES ('general'),('contact'),('orders'),('security') ON CONFLICT DO NOTHING;

ALTER TABLE public.notification_rules ADD COLUMN IF NOT EXISTS smtp_profile text NOT NULL DEFAULT 'general' CHECK (smtp_profile IN ('general','contact','orders','security'));
UPDATE public.notification_rules SET smtp_profile = 'orders' WHERE event LIKE 'order%' OR event LIKE 'cod%';
UPDATE public.notification_rules SET smtp_profile = 'security' WHERE event = 'password_reset';
ALTER TABLE public.email_logs ADD COLUMN IF NOT EXISTS smtp_profile text;

CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' AND char_length(email) <= 255),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone subscribes" ON public.newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff read subscribers" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_permission(auth.uid(), 'customers'));
CREATE POLICY "Admin delete subscribers" ON public.newsletter_subscribers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_message text,
  ADD COLUMN IF NOT EXISTS whatsapp_position text NOT NULL DEFAULT 'right' CHECK (whatsapp_position IN ('left','right')),
  ADD COLUMN IF NOT EXISTS whatsapp_mobile boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tawk_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tawk_property_id text,
  ADD COLUMN IF NOT EXISTS tawk_widget_id text,
  ADD COLUMN IF NOT EXISTS contact_notify_email text,
  ADD COLUMN IF NOT EXISTS contact_address text,
  ADD COLUMN IF NOT EXISTS contact_hours text,
  ADD COLUMN IF NOT EXISTS newsletter_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS newsletter_text text;