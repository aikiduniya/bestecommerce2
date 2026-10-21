-- Checkout preview of the automatic discount for the current cart (server is still the source of truth in place_order).
CREATE OR REPLACE FUNCTION public.check_automatic_discount(_items jsonb, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null then return null; end if;
  return automatic_discount(_items, _subtotal);
end $$;
GRANT EXECUTE ON FUNCTION public.check_automatic_discount(jsonb, numeric) TO authenticated;