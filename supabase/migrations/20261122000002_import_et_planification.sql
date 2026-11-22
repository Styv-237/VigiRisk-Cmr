-- Import des limites COD-AB et planification des collectes.

create extension if not exists pgcrypto with schema extensions;
-- pg_net et pg_cron existent sur Supabase, pas sur le Postgres local de test : création conditionnelle.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
  end if;
end
$$;

-- Jeton interne (privé) : seules les tâches planifiées de la base le connaissent et l'envoient aux fonctions Edge.
insert into public.app_settings (key, value, is_public)
values ('internal_token', to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')), false)
on conflict (key) do nothing;

-- Import d'un lot d'entités GeoJSON COD-AB. Réservé au rôle service_role (fonction Edge d'import).
-- Simplification ≈ 55 m, topologie préservée par entité.
create or replace function public.admin_import_areas(items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.admin_areas (pcode, level, parent_pcode, name_codab, name, name_en, geom, anchor, area_sqkm)
  select i ->> 'pcode',
         (i ->> 'level')::smallint,
         nullif(i ->> 'parent_pcode', ''),
         i ->> 'name_codab',
         i ->> 'name',
         nullif(i ->> 'name_en', ''),
         extensions.st_multi(extensions.st_collectionextract(extensions.st_makevalid(
           extensions.st_simplifypreservetopology(extensions.st_setsrid(extensions.st_geomfromgeojson(i -> 'geometry'), 4326), 0.0005)), 3)),
         extensions.st_pointonsurface(extensions.st_setsrid(extensions.st_geomfromgeojson(i -> 'geometry'), 4326)),
         nullif(i ->> 'area_sqkm', '')::numeric
  from jsonb_array_elements(items) as i
  on conflict (pcode) do update
    set name = excluded.name, name_en = excluded.name_en, geom = excluded.geom,
        anchor = excluded.anchor, area_sqkm = excluded.area_sqkm, parent_pcode = excluded.parent_pcode;
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.admin_import_areas(jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_areas(jsonb) to service_role;

-- Écriture du cache météo par lot (fonction Edge de collecte, rôle service_role).
create or replace function public.admin_upsert_forecasts(items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  insert into public.forecast_cache (commune_pcode, fetched_at, latitude, longitude, payload, source)
  select i ->> 'commune_pcode', (i ->> 'fetched_at')::timestamptz, (i ->> 'latitude')::float8,
         (i ->> 'longitude')::float8, i -> 'payload', coalesce(i ->> 'source', 'Open-Meteo.com (CC BY 4.0)')
  from jsonb_array_elements(items) as i
  on conflict (commune_pcode) do update
    set fetched_at = excluded.fetched_at, latitude = excluded.latitude, longitude = excluded.longitude,
        payload = excluded.payload, source = excluded.source, is_demo = false;
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function public.admin_upsert_forecasts(jsonb) from public, anon, authenticated;
grant execute on function public.admin_upsert_forecasts(jsonb) to service_role;

-- Points de collecte : point intérieur de chaque commune.
create or replace view public.forecast_points
with (security_invoker = true) as
select pcode, extensions.st_y(anchor) as latitude, extensions.st_x(anchor) as longitude
from public.admin_areas
where level = 3;

revoke all on public.forecast_points from anon, authenticated;
grant select on public.forecast_points to service_role;
