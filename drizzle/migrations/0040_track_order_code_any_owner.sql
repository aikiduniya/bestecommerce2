CREATE OR REPLACE FUNCTION public.track_guest_order_code(_code text, _email text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare _o record;
begin
  -- Order code + checkout email identify the order for both guest and signed-in customers.
  select * into _o from orders where upper(order_code) = upper(trim(_code)) and lower(customer_email) = lower(trim(_email));
  if not found then return null; end if;
  return jsonb_build_object('order_number', _o.order_number, 'order_code', _o.order_code, 'status', _o.status, 'payment_status', _o.payment_status,
    'fulfillment_status', _o.fulfillment_status, 'items', _o.items, 'subtotal', _o.subtotal, 'shipping_total', _o.shipping_total,
    'tax_total', _o.tax_total, 'payment_fee', _o.payment_fee, 'discount_total', _o.discount_total, 'total', _o.total,
    'currency', _o.currency, 'created_at', _o.created_at, 'customer_name', _o.customer_name,
    'tracking_number', _o.tracking_number, 'tracking_url', _o.tracking_url, 'payment_method', _o.payment_method);
end $function$;