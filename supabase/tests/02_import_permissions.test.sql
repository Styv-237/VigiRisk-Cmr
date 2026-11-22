-- Tests pgTAP : les fonctions d'import et d'écriture ne sont accessibles qu'au service ; le jeton interne reste privé.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(8);

select ok(exists (select 1 from public.app_settings where key = 'internal_token' and not is_public and length(value #>> '{}') = 48),
          'jeton interne créé, privé, 24 octets aléatoires');

set local role anon;
select throws_ok($$ select public.admin_import_areas('[]') $$, '42501', null, 'anon ne peut pas importer de limites');
select throws_ok($$ select public.admin_upsert_forecasts('[]') $$, '42501', null, 'anon ne peut pas écrire de prévisions');
select throws_ok($$ select * from public.forecast_points $$, '42501', null, 'anon ne lit pas les points de collecte');
select is((select count(*)::int from public.app_settings where key = 'internal_token'), 0, 'anon ne voit pas le jeton interne');

reset role;
set local role authenticated;
select throws_ok($$ select public.admin_import_areas('[]') $$, '42501', null, 'authenticated ne peut pas importer de limites');

reset role;
set local role service_role;
select is(public.admin_import_areas(jsonb_build_array(jsonb_build_object(
  'pcode', 'CM901', 'level', 1, 'name_codab', 'Test', 'name', 'Test',
  'geometry', '{"type":"Polygon","coordinates":[[[10,3],[11,3],[11,4],[10,4],[10,3]]]}'::jsonb))), 1,
  'service_role importe une entité');
select is(public.admin_upsert_forecasts(jsonb_build_array(jsonb_build_object(
  'commune_pcode', 'CM901', 'fetched_at', now(), 'latitude', 3.5, 'longitude', 10.5, 'payload', '{}'::jsonb))), 1,
  'service_role écrit une prévision');

reset role;
select * from finish();
rollback;
