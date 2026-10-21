-- Order timeline: customer-visible history of what happened to an order
CREATE TABLE public.order_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'event',
  message text NOT NULL,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON public.order_events (order_id, created_at);
GRANT SELECT, INSERT ON public.order_events TO authenticated;
GRANT ALL ON public.order_events TO service_role;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read own order events" ON public.order_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_events.order_id AND o.user_id = auth.uid()));
CREATE POLICY "staff read all order events" ON public.order_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'orders'));
CREATE POLICY "staff add order events" ON public.order_events FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'orders'));

-- Internal admin notes on orders: staff-only, never visible to customers
CREATE TABLE public.order_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_notes_order_idx ON public.order_notes (order_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.order_notes TO authenticated;
GRANT ALL ON public.order_notes TO service_role;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read order notes" ON public.order_notes FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'orders'));
CREATE POLICY "staff add order notes" ON public.order_notes FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'orders'));
CREATE POLICY "staff delete order notes" ON public.order_notes FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'orders'));

-- Automatically record timeline entries when an order is placed or its status fields change
CREATE OR REPLACE FUNCTION public.log_order_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_events (order_id, kind, message)
    VALUES (NEW.id, 'placed', 'Order placed · ' || upper(NEW.payment_method) || ' · total ' || NEW.total || ' ' || NEW.currency);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_events (order_id, kind, message, actor_id)
    VALUES (NEW.id, 'status', 'Status changed: ' || OLD.status || ' → ' || NEW.status, auth.uid());
  END IF;
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.order_events (order_id, kind, message, actor_id)
    VALUES (NEW.id, 'payment', 'Payment status: ' || OLD.payment_status || ' → ' || NEW.payment_status, auth.uid());
  END IF;
  IF NEW.fulfillment_status IS DISTINCT FROM OLD.fulfillment_status THEN
    INSERT INTO public.order_events (order_id, kind, message, actor_id)
    VALUES (NEW.id, 'fulfillment', 'Fulfilment: ' || OLD.fulfillment_status || ' → ' || NEW.fulfillment_status, auth.uid());
  END IF;
  IF NEW.cod_confirmed_at IS NOT NULL AND OLD.cod_confirmed_at IS NULL THEN
    INSERT INTO public.order_events (order_id, kind, message, actor_id)
    VALUES (NEW.id, 'cod', 'COD order confirmed by store', auth.uid());
  END IF;
  IF NEW.cod_collected_at IS NOT NULL AND OLD.cod_collected_at IS NULL THEN
    INSERT INTO public.order_events (order_id, kind, message, actor_id)
    VALUES (NEW.id, 'cod', 'COD cash collected', auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_events_on_insert AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_events();
CREATE TRIGGER order_events_on_update AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_events();