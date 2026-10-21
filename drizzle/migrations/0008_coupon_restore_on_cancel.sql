create or replace function public.restock_cancelled_order() returns trigger language plpgsql security definer set search_path = public as $$
declare _it jsonb;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and not old.stock_restored then
    for _it in select * from jsonb_array_elements(new.items) loop
      if nullif(_it->>'variant_id','') is not null then
        update product_variants set stock = stock + (_it->>'qty')::int where id = (_it->>'variant_id')::uuid;
      end if;
      update products set stock = stock + (_it->>'qty')::int where id = (_it->>'product_id')::uuid;
    end loop;
    if new.coupon_code is not null then
      update coupons set used_count = greatest(used_count - 1, 0) where code = new.coupon_code;
    end if;
    new.stock_restored := true;
  end if;
  return new;
end $$;