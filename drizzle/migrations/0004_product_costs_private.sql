CREATE TABLE public.product_costs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  cost_price numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_costs TO authenticated;
GRANT ALL ON public.product_costs TO service_role;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "costs staff" ON public.product_costs FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
INSERT INTO public.product_costs(product_id, cost_price) SELECT id, cost_price FROM public.products WHERE cost_price IS NOT NULL;
UPDATE public.products SET cost_price = NULL WHERE cost_price IS NOT NULL;
COMMENT ON COLUMN public.products.cost_price IS 'DEPRECATED: publicly readable; use product_costs (staff-only)';