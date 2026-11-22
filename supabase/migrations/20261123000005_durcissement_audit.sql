-- Durcissement issu de l'audit de l'étape 2.

-- 1. Déni de service : une recherche de 100 000 caractères occupait la base jusqu'au délai maximal.
--    La requête est tronquée à 64 caractères (le plus long nom de commune en compte moins de 25).
create or replace function public.search_areas(q text, max_results integer default 20)
returns table (pcode text, level smallint, name text, context text, score real)
language sql
stable
security invoker
set search_path = ''
as $$
  with n as (select public.vr_normalize(left(q, 64)) as q)
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

-- 2. Abus de bande passante : les géométries complètes (≈ 4,8 Mo par requête) étaient téléchargeables
--    par n'importe qui. L'API publique n'expose plus que les colonnes utiles à l'application.
revoke select on public.admin_areas from anon, authenticated;
grant select (pcode, level, parent_pcode, name_codab, name, name_en, name_search, area_sqkm, source) on public.admin_areas to anon, authenticated;

-- 3. commune_at a besoin des géométries : elle s'exécute avec les droits du propriétaire (lecture seule,
--    chemin de recherche vide, ne renvoie que le nom de la commune, jamais la géométrie).
create or replace function public.commune_at(lat double precision, lon double precision)
returns table (pcode text, name text, departement text, region text, distance_m double precision)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (select extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326) as g)
  select c.pcode, c.name, d.name, r.name,
         round(extensions.st_distance(c.geom::extensions.geography, p.g::extensions.geography)::numeric, -2)::double precision as distance_m
  from public.admin_areas c
  join public.admin_areas d on d.pcode = c.parent_pcode
  join public.admin_areas r on r.pcode = d.parent_pcode
  cross join p
  where c.level = 3
    and lat between -90 and 90 and lon between -180 and 180
    and extensions.st_dwithin(c.geom::extensions.geography, p.g::extensions.geography, 15000)
  order by extensions.st_contains(c.geom, p.g) desc, distance_m
  limit 1
$$;

revoke all on function public.commune_at(double precision, double precision) from public;
grant execute on function public.commune_at(double precision, double precision) to anon, authenticated;

-- 4. Clé étrangère sans index (avis de performance Supabase).
create index if not exists admin_areas_parent_idx on public.admin_areas (parent_pcode);
