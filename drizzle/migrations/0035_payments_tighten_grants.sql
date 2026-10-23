REVOKE ALL ON public.payment_settings FROM anon, authenticated;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;
REVOKE ALL ON public.payment_transactions FROM anon, authenticated;
GRANT SELECT (id, stripe_enabled, stripe_mode, test_publishable_key, live_publishable_key, test_secret_set, live_secret_set, test_webhook_set, live_webhook_set, test_verified_at, live_verified_at, currencies, payment_methods, updated_at) ON public.payment_settings TO authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;