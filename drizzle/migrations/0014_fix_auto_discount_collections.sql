CREATE OR REPLACE FUNCTION public.automatic_discount(_items jsonb, _subtotal numeric)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  _d record; _best record; _disc numeric; _best_disc numeric := 0; _eligible numeric;
begin
  for _d in
    select * from automatic_discounts
    where is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at >= now())
    order by priority desc, created_at asc
  loop
    if _d.scope = 'all' then
      _eligible := _subtotal;
    else
      select coalesce(sum((it->>'price')::numeric * (it->>'qty')::int), 0) into _eligible
      from jsonb_array_elements(_items) it
      join products p on p.id = (it->>'product_id')::uuid
      where (_d.scope = 'product' and p.id = _d.target_id)
         or (_d.scope = 'category' and p.category_id = _d.target_id)
         or (_d.scope = 'collection' and exists (
              select 1 from product_collections pc
              where pc.product_id = p.id and pc.collection_id = _d.target_id));
    end if;
    if _eligible > 0 then
      _disc := case when _d.kind = 'percent'
        then round(_eligible * _d.value / 100, 2)
        else least(_d.value, _eligible) end;
      if _disc > _best_disc then
        _best_disc := _disc;
        _best := _d;
      end if;
    end if;
  end loop;
  if _best is null then return null; end if;
  return jsonb_build_object('name', _best.name, 'discount', _best_disc);
end $$;