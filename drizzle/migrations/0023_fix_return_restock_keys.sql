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
    -- restock variant lines
    UPDATE product_variants v SET stock = v.stock + (it.qty)::int
    FROM jsonb_to_recordset(r.items) AS it(product_id uuid, variant_id uuid, qty int)
    WHERE v.id = it.variant_id;
    -- restock non-variant lines
    UPDATE products p SET stock = p.stock + (it.qty)::int
    FROM jsonb_to_recordset(r.items) AS it(product_id uuid, variant_id uuid, qty int)
    WHERE p.id = it.product_id AND it.variant_id IS NULL;
    UPDATE return_requests SET restocked = true WHERE id = _id;
  END IF;
  INSERT INTO order_events (order_id, kind, message, actor_id)
  VALUES (r.order_id, 'return', 'Return ' || new_status || coalesce(' — ' || nullif(_note,''), ''), auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.process_return(uuid, text, text, boolean) TO authenticated;