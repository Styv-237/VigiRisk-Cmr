-- Tests pgTAP : RLS, garde-fou « pas de démo en production », fonctions de recherche et de localisation.
-- Les géométries ci-dessous sont des carrés SYNTHÉTIQUES de test, annulés en fin de transaction.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(24);

-- Jeu d'essai (en tant que propriétaire, hors RLS)
insert into public.admin_areas (pcode, level, parent_pcode, name_codab, name, geom, anchor) values
  ('CM900', 1, null, 'Testregion', 'Région Test',
     st_multi(st_makeenvelope(11.0, 3.0, 12.0, 4.0, 4326)), st_setsrid(st_makepoint(11.5, 3.5), 4326)),
  ('CM900001', 2, 'CM900', 'Testdep', 'Département Test',
     st_multi(st_makeenvelope(11.0, 3.0, 12.0, 4.0, 4326)), st_setsrid(st_makepoint(11.5, 3.5), 4326)),
  ('CM900001001', 3, 'CM900001', 'Yaounde 7e', 'Yaoundé VII',
     st_multi(st_makeenvelope(11.40, 3.80, 11.50, 3.90, 4326)), st_setsrid(st_makepoint(11.45, 3.85), 4326)),
  ('CM900001002', 3, 'CM900001', 'Mvog-Ada', 'Mvog-Ada',
     st_multi(st_makeenvelope(11.50, 3.80, 11.60, 3.90, 4326)), st_setsrid(st_makepoint(11.55, 3.85), 4326));

insert into public.ingest_runs (job, ok_count) values ('test', 1);
insert into public.app_settings (key, value, is_public) values ('secret_test', '"x"', false);

-- 1–4 : RLS active partout
select ok((select relrowsecurity from pg_class where oid = 'public.admin_areas'::regclass), 'RLS active sur admin_areas');
select ok((select relrowsecurity from pg_class where oid = 'public.forecast_cache'::regclass), 'RLS active sur forecast_cache');
select ok((select relrowsecurity from pg_class where oid = 'public.ingest_runs'::regclass), 'RLS active sur ingest_runs');
select ok((select relrowsecurity from pg_class where oid = 'public.app_settings'::regclass), 'RLS active sur app_settings');

-- 5–6 : normalisation identique au code TypeScript
select is(public.vr_normalize('  Mvög_Adà '), 'mvog ada', 'vr_normalize retire accents et ponctuation');
select is(public.vr_normalize('Nkol''Eton'), 'nkol eton', 'vr_normalize traite l’apostrophe');

-- 7–8 : demo interdite en production, permise en développement
update public.app_settings set value = '"production"' where key = 'environment';
select throws_ok(
  $$ insert into public.forecast_cache (commune_pcode, fetched_at, latitude, longitude, payload, is_demo)
     values ('CM900001001', now(), 3.85, 11.45, '{}', true) $$,
  '23514', null, 'is_demo refusé quand environment = production');
update public.app_settings set value = '"development"' where key = 'environment';
select lives_ok(
  $$ insert into public.forecast_cache (commune_pcode, fetched_at, latitude, longitude, payload, is_demo)
     values ('CM900001001', now(), 3.85, 11.45, '{"demo":true}', true) $$,
  'is_demo accepté en développement');

-- ---------- Visiteur anonyme ----------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::int from public.admin_areas where pcode like 'CM900%'), 4, 'anon lit les limites administratives');
select is((select count(*)::int from public.forecast_cache where commune_pcode = 'CM900001001'), 1, 'anon lit le cache météo');
select is((select count(*)::int from public.ingest_runs), 0, 'anon ne voit pas le journal des collectes');
select is((select count(*)::int from public.app_settings where key = 'secret_test'), 0, 'anon ne voit pas les réglages privés');
select is((select count(*)::int from public.app_settings where key = 'environment'), 1, 'anon voit les réglages publics');
select throws_ok(
  $$ insert into public.forecast_cache (commune_pcode, fetched_at, latitude, longitude, payload)
     values ('CM900001002', now(), 3.85, 11.55, '{}') $$,
  '42501', null, 'anon ne peut pas écrire dans le cache météo');
select throws_ok($$ delete from public.admin_areas $$, '42501', null, 'anon ne peut pas supprimer de limites');

-- Localisation et recherche
select is((select pcode from public.commune_at(3.85, 11.45)), 'CM900001001', 'commune_at : point à l’intérieur');
select is((select region from public.commune_at(3.85, 11.45)), 'Région Test', 'commune_at : renvoie la région');
select is((select pcode from public.commune_at(3.85, 11.65)), 'CM900001002', 'commune_at : point hors limites mais à moins de 15 km');
select is((select count(*)::int from public.commune_at(10.0, 20.0)), 0, 'commune_at : rien au-delà de 15 km');
select is((select pcode from public.search_areas('yaounde 7') limit 1), 'CM900001001', 'search_areas ignore les accents');
select is((select pcode from public.search_areas('mvog ada') limit 1), 'CM900001002', 'search_areas : variante sans tiret');
select is((select count(*)::int from public.search_areas('y')), 0, 'search_areas : au moins 2 caractères');

-- ---------- Utilisateur connecté ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000001"}';
select throws_ok($$ update public.admin_areas set name = 'x' $$, '42501', null, 'authenticated ne peut pas modifier les limites');

-- ---------- Service (fonctions de collecte) ----------
reset role;
set local role service_role;
select lives_ok(
  $$ insert into public.forecast_cache (commune_pcode, fetched_at, latitude, longitude, payload)
     values ('CM900001002', now(), 3.85, 11.55, '{}')
     on conflict (commune_pcode) do update set fetched_at = excluded.fetched_at $$,
  'service_role écrit dans le cache météo');

reset role;
select * from finish();
rollback;
