create or replace function public.best_seller_ids(_limit int default 8) returns table(product_id uuid) language sql stable security definer set search_path = public as $$
  select (it->>'product_id')::uuid as product_id
  from orders, lateral jsonb_array_elements(items) as it
  where status <> 'cancelled'
  group by 1
  order by sum((it->>'qty')::int) desc
  limit greatest(_limit, 1)
$$;
grant execute on function public.best_seller_ids(int) to anon, authenticated;