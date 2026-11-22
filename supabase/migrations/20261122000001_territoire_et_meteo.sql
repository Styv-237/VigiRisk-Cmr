-- VigiRisk Cameroun — étape 2 : territoire (COD-AB) et cache des prévisions météo.
-- Principe : l'application ne lit que ce cache ; seules les fonctions serveur (rôle service_role) écrivent.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Normalisation identique à packages/core/src/names.ts (normalizeName) : sans accents, minuscules,
-- ponctuation ramenée à un espace. Marquée immutable pour servir dans un index.
create or replace function public.vr_normalize(s text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select btrim(regexp_replace(
           regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(s, ''))), '[^a-z0-9]+', ' ', 'g'),
           '\s+', ' ', 'g'))
$$;

-- Réglages applicatifs. `environment` = 'production' interdit toute donnée de démonstration.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value, is_public) values
  ('environment', '"development"', true),
  ('forecast_refresh_hours', '3', true),
  ('disclaimer_fr', '"Information indicative. En cas de danger, suivez les consignes des autorités."', true),
  ('disclaimer_en', '"Indicative information. In case of danger, follow the authorities'' instructions."', true);

-- Limites administratives COD-AB : 1 = région, 2 = département, 3 = commune (arrondissement).
create table public.admin_areas (
  pcode text primary key check (pcode ~ '^CM[0-9]{3,9}$'),
  level smallint not null check (level between 1 and 3),
  parent_pcode text references public.admin_areas (pcode),
  name_codab text not null,
  name text not null,
  name_en text,
  name_search text generated always as (public.vr_normalize(name)) stored,
  geom extensions.geometry (MultiPolygon, 4326) not null,
  anchor extensions.geometry (Point, 4326) not null,
  area_sqkm numeric,
  source text not null default 'COD-AB Cameroun (OCHA / INC), v01, valide au 2019-01-04, CC BY-IGO',
  constraint parent_level check ((level = 1) = (parent_pcode is null))
);

create index admin_areas_geom_idx on public.admin_areas using gist (geom);
create index admin_areas_level_idx on public.admin_areas (level);
create index admin_areas_name_trgm_idx on public.admin_areas using gin (name_search extensions.gin_trgm_ops);

-- Cache des prévisions par commune (point d'ancrage = point intérieur de la commune).
create table public.forecast_cache (
  commune_pcode text primary key references public.admin_areas (pcode) on delete cascade,
  fetched_at timestamptz not null,
  latitude double precision not null,
  longitude double precision not null,
  payload jsonb not null,
  source text not null default 'Open-Meteo.com (CC BY 4.0)',
  is_demo boolean not null default false
);

-- Journal des collectes (lisible uniquement par le service et l'administration).
create table public.ingest_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok_count integer not null default 0,
  error_count integer not null default 0,
  message text
);

-- Garde-fou : aucune donnée de démonstration en production.
create or replace function public.vr_forbid_demo_in_production()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_demo and coalesce((select value #>> '{}' from public.app_settings where key = 'environment'), 'production') = 'production' then
    raise exception 'Données de démonstration interdites en production (%).', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger forecast_cache_no_demo_in_prod
  before insert or update on public.forecast_cache
  for each row execute function public.vr_forbid_demo_in_production();

-- ---------- Sécurité : RLS sur chaque table ----------
alter table public.app_settings enable row level security;
alter table public.admin_areas enable row level security;
alter table public.forecast_cache enable row level security;
alter table public.ingest_runs enable row level security;

create policy "réglages publics lisibles par tous" on public.app_settings
  for select to anon, authenticated using (is_public);

create policy "limites lisibles par tous" on public.admin_areas
  for select to anon, authenticated using (true);

create policy "prévisions lisibles par tous" on public.forecast_cache
  for select to anon, authenticated using (true);

-- ingest_runs : aucune politique → invisible pour anon et authenticated.

revoke insert, update, delete, truncate on public.app_settings, public.admin_areas, public.forecast_cache, public.ingest_runs
  from anon, authenticated;

-- ---------- Fonctions de lecture pour l'application ----------

-- Commune qui contient un point GPS ; à défaut (bord de frontière, lac), la plus proche à moins de 15 km.
create or replace function public.commune_at(lat double precision, lon double precision)
returns table (pcode text, name text, departement text, region text, distance_m double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (select extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326) as g)
  select c.pcode, c.name, d.name, r.name,
         extensions.st_distance(c.geom::extensions.geography, p.g::extensions.geography) as distance_m
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

-- Recherche tolérante (accents, tirets, fautes légères) dans les régions, départements et communes.
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
         greatest(extensions.similarity(a.name_search, n.q),
                  case when a.name_search like n.q || '%' then 1 else 0 end)::real as score
  from public.admin_areas a
  left join public.admin_areas d on d.pcode = a.parent_pcode
  left join public.admin_areas r on r.pcode = d.parent_pcode
  cross join n
  where length(n.q) >= 2
    and (a.name_search like '%' || n.q || '%' or extensions.similarity(a.name_search, n.q) > 0.3)
  order by score desc, a.level desc, a.name
  limit least(greatest(max_results, 1), 50)
$$;

grant execute on function public.commune_at(double precision, double precision) to anon, authenticated;
grant execute on function public.search_areas(text, integer) to anon, authenticated;
grant execute on function public.vr_normalize(text) to anon, authenticated;
