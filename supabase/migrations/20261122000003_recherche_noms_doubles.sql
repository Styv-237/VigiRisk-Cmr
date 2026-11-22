-- La recherche doit trouver « Yaoundé VII » en tapant « yaounde 7 » (nom COD-AB « Yaounde 7e ») comme « yaounde vii ».
-- On indexe donc le nom d'usage ET le nom COD-AB.
drop index if exists public.admin_areas_name_trgm_idx;
alter table public.admin_areas drop column name_search;
alter table public.admin_areas
  add column name_search text generated always as (public.vr_normalize(name || ' ' || name_codab)) stored;
create index admin_areas_name_trgm_idx on public.admin_areas using gin (name_search extensions.gin_trgm_ops);

create or replace function public.search_areas(q text, max_results integer default 20)
returns table (pcode text, level smallint, name text, context text, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (select public.vr_normalize(q) as q)
  select a.pcode, a.level, a.name,
         concat_ws(' · ', d.name, r.name) as context,
         greatest(
           case when a.name_search like n.q || '%' then 1.0
                when a.name_search like '%' || n.q || '%' then 0.9
                else 0 end,
           extensions.word_similarity(n.q, a.name_search)
         )::real as score
  from public.admin_areas a
  left join public.admin_areas d on d.pcode = a.parent_pcode
  left join public.admin_areas r on r.pcode = d.parent_pcode
  cross join n
  where length(n.q) >= 2
    and (a.name_search like '%' || n.q || '%' or extensions.word_similarity(n.q, a.name_search) > 0.5)
  order by score desc, a.level desc, a.name
  limit least(greatest(max_results, 1), 50)
$$;

grant execute on function public.search_areas(text, integer) to anon, authenticated;
