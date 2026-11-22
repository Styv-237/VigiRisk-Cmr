-- Planification (Supabase uniquement : pg_cron et pg_net). Collecte des prévisions toutes les 3 h, à h+07
-- (évite les minutes rondes très chargées). Le jeton interne est lu au moment de l'appel, jamais écrit en clair ici.
select cron.schedule(
  'ingest-forecast-3h',
  '7 */3 * * *',
  $job$
  select net.http_post(
    url := 'https://yhdrtprdhlktvwqeusrf.supabase.co/functions/v1/ingest-forecast',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-token', (select value #>> '{}' from public.app_settings where key = 'internal_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 145000);
  $job$
);

-- Purge des journaux techniques au-delà de 30 jours.
select cron.schedule(
  'purge-journaux',
  '23 3 * * *',
  $job$
  delete from public.ingest_runs where started_at < now() - interval '30 days';
  delete from net._http_response where created < now() - interval '7 days';
  $job$
);
