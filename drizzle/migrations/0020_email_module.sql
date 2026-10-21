CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.email_templates IS 'Editable transactional email templates. body supports {{placeholders}} rendered at send time. Seeded with the store default set.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read templates" ON public.email_templates FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage templates" ON public.email_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER email_templates_touch BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.email_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sender_name text NOT NULL DEFAULT '',
  sender_email text NOT NULL DEFAULT '',
  reply_to text,
  provider text NOT NULL DEFAULT 'none' CHECK (provider IN ('none','resend','smtp','sendgrid')),
  provider_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand_logo_url text,
  brand_color text,
  footer_text text,
  delivery_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.email_settings IS 'Email sender/branding/provider config. delivery_enabled stays false until a verified provider is configured; while false, sends are logged as queued_disabled and nothing leaves the system.';
INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read email settings" ON public.email_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins update email settings" ON public.email_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL UNIQUE,
  template_key text REFERENCES public.email_templates(key) ON DELETE SET NULL,
  recipient text NOT NULL DEFAULT 'customer' CHECK (recipient IN ('customer','admin')),
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.notification_rules IS 'Which template fires for which store event, and to whom.';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_rules TO authenticated;
GRANT ALL ON public.notification_rules TO service_role;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read notification rules" ON public.notification_rules FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins manage notification rules" ON public.notification_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.email_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_key text,
  event text,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued_disabled','sent','failed','retrying')),
  error text,
  attempts integer NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz
);
COMMENT ON TABLE public.email_logs IS 'Delivery log for every email the system tries to send. While delivery is disabled, rows are recorded as queued_disabled and can be retried once a provider is live.';
GRANT SELECT, INSERT, UPDATE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read email logs" ON public.email_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins update email logs (retry)" ON public.email_logs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.email_templates (key, name, subject, body) VALUES
 ('order_confirmation','Order confirmation','Your order {{order_number}} is confirmed','Hello {{customer_name}},

Thank you for your order {{order_number}} at {{store_name}}.

Items:
{{items_list}}

Total: {{order_total}}
Payment method: {{payment_method}}

We will notify you when your order ships.

{{store_name}}'),
 ('order_shipped','Order shipped','Your order {{order_number}} is on its way','Hello {{customer_name}},

Good news — your order {{order_number}} has shipped.

{{store_name}}'),
 ('order_cancelled','Order cancelled','Your order {{order_number}} was cancelled','Hello {{customer_name}},

Your order {{order_number}} has been cancelled. If payment was taken it will be refunded.

{{store_name}}'),
 ('cod_confirmation_needed','COD confirmation','Please confirm your COD order {{order_number}}','Hello {{customer_name}},

Your cash-on-delivery order {{order_number}} is waiting for confirmation.

{{store_name}}'),
 ('admin_new_order','Admin: new order','New order {{order_number}} ({{order_total}})','A new order was placed.

Order: {{order_number}}
Customer: {{customer_name}} ({{customer_email}})
Total: {{order_total}}
Payment: {{payment_method}}'),
 ('admin_low_stock','Admin: low stock','Low stock alert: {{product_name}}','Product "{{product_name}}" is low on stock ({{stock}} remaining).'),
 ('password_reset','Password reset','Reset your {{store_name}} password','Hello,

Use this link to reset your password: {{reset_link}}

If you did not request this, ignore this email.

{{store_name}}'),
 ('welcome','Welcome','Welcome to {{store_name}}','Hello {{customer_name}},

Welcome to {{store_name}}! Your account is ready.

{{store_name}}');

INSERT INTO public.notification_rules (event, template_key, recipient) VALUES
 ('order_placed','order_confirmation','customer'),
 ('order_placed_admin','admin_new_order','admin'),
 ('order_shipped','order_shipped','customer'),
 ('order_cancelled','order_cancelled','customer'),
 ('cod_confirmation_needed','cod_confirmation_needed','customer'),
 ('low_stock','admin_low_stock','admin'),
 ('password_reset','password_reset','customer'),
 ('welcome','welcome','customer');