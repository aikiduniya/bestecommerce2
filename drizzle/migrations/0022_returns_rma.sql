CREATE TABLE public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid,
  email text not null,
  items jsonb not null default '[]'::jsonb,
  reason text not null,
  status text not null default 'requested',
  admin_note text,
  restocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.return_requests TO authenticated;
GRANT ALL ON public.return_requests TO service_role;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own returns" ON public.return_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Staff manage returns" ON public.return_requests FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'orders')) WITH CHECK (public.has_permission(auth.uid(), 'orders'));
CREATE POLICY "Staff delete returns" ON public.return_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER touch_return_requests BEFORE UPDATE ON public.return_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Guest/customer return submission: validates order number + email, order must be delivered
CREATE OR REPLACE FUNCTION public.submit_return(_order_number bigint, _email text, _items jsonb, _reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o orders%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE order_number = _order_number AND lower(customer_email) = lower(_email);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Order not found for that email.');
  END IF;
  IF o.status <> 'delivered' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Returns can only be requested for delivered orders.');
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Select at least one item to return.');
  END IF;
  IF EXISTS (SELECT 1 FROM return_requests r WHERE r.order_id = o.id AND r.status IN ('requested','approved','received')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A return request is already in progress for this order.');
  END IF;
  INSERT INTO return_requests (order_id, user_id, email, items, reason)
  VALUES (o.id, o.user_id, lower(_email), _items, left(_reason, 1000));
  INSERT INTO order_events (order_id, kind, message, actor_id)
  VALUES (o.id, 'return', 'Return requested by customer', o.user_id);
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_return(bigint, text, jsonb, text) TO anon, authenticated;

-- Staff processing: approve/reject/receive/refund, optional restock on refund
CREATE OR REPLACE FUNCTION public.process_return(_id uuid, _action text, _note text, _restock boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r return_requests%ROWTYPE;
  new_status text;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'orders') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No permission.');
  END IF;
  SELECT * INTO r FROM return_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Return not found.');
  END IF;
  new_status := CASE _action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'receive' THEN 'received'
    WHEN 'refund' THEN 'refunded'
    ELSE NULL END;
  IF new_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown action.');
  END IF;
  IF _action = 'approve' AND r.status <> 'requested' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only requested returns can be approved.');
  END IF;
  IF _action = 'receive' AND r.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only approved returns can be marked received.');
  END IF;
  IF _action = 'refund' AND r.status NOT IN ('approved','received') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Approve or receive the return before refunding.');
  END IF;
  UPDATE return_requests SET status = new_status, admin_note = nullif(left(coalesce(_note,''), 1000), ''), updated_at = now() WHERE id = _id;
  IF _action = 'refund' AND _restock AND NOT r.restocked THEN
    UPDATE products p SET stock = p.stock + (it.qty)::int
    FROM jsonb_to_recordset(r.items) AS it(id uuid, qty int)
    WHERE p.id = it.id;
    UPDATE return_requests SET restocked = true WHERE id = _id;
  END IF;
  INSERT INTO order_events (order_id, kind, message, actor_id)
  VALUES (r.order_id, 'return', 'Return ' || new_status || coalesce(' — ' || nullif(_note,''), ''), auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.process_return(uuid, text, text, boolean) TO authenticated;