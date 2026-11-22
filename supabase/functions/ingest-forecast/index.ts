// Collecte planifiée des prévisions Open-Meteo pour les 360 communes, mise en cache dans forecast_cache.
// Appelée par pg_cron (toutes les 3 h) avec l'en-tête `x-internal-token`.
// Une commune dont la réponse est invalide garde son cache précédent : aucune valeur n'est inventée.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { buildForecastUrl, chunk, FORECAST_BATCH_SIZE, splitMultiLocation } from '../_shared/openmeteo.ts';
import { parseOpenMeteoForecast } from '../_shared/forecast.ts';

type Point = { pcode: string; latitude: number; longitude: number };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: tok } = await db.from('app_settings').select('value').eq('key', 'internal_token').single();
  if (!tok || req.headers.get('x-internal-token') !== tok.value) return new Response('Accès refusé', { status: 403 });

  const apiKey = Deno.env.get('OPEN_METEO_API_KEY') || undefined; // facultatif (offre payante)
  const { data: points, error } = await db.from('forecast_points').select('pcode, latitude, longitude').order('pcode');
  if (error || !points) return Response.json({ error: error?.message ?? 'aucun point' }, { status: 500 });

  const { data: run } = await db.from('ingest_runs').insert({ job: 'ingest-forecast' }).select('id').single();
  let ok = 0;
  const errors: string[] = [];

  for (const batch of chunk(points as Point[], FORECAST_BATCH_SIZE)) {
    try {
      const res = await fetch(buildForecastUrl(batch, apiKey), { headers: { 'User-Agent': 'VigiRisk-Cameroun/0.1' } });
      const json = await res.json();
      if (!res.ok || (json && !Array.isArray(json) && json.error)) {
        throw new Error(`Open-Meteo ${res.status} : ${json?.reason ?? 'réponse invalide'}`);
      }
      const list = splitMultiLocation(json, batch.length);
      const fetchedAt = new Date().toISOString();
      const items = [];
      for (let i = 0; i < batch.length; i++) {
        try {
          const payload = parseOpenMeteoForecast(list[i]);
          items.push({ commune_pcode: batch[i]!.pcode, fetched_at: fetchedAt, latitude: batch[i]!.latitude, longitude: batch[i]!.longitude, payload });
        } catch (e) {
          errors.push(`${batch[i]!.pcode} : ${(e as Error).message}`);
        }
      }
      if (items.length) {
        const { data, error: upErr } = await db.rpc('admin_upsert_forecasts', { items });
        if (upErr) throw new Error(upErr.message);
        ok += data as number;
      }
    } catch (e) {
      errors.push(`lot ${batch[0]!.pcode}… : ${(e as Error).message}`);
      // Quota dépassé : inutile d'insister sur les lots suivants.
      if (/limit exceeded/i.test((e as Error).message)) break;
    }
  }

  if (run) {
    await db.from('ingest_runs').update({
      finished_at: new Date().toISOString(),
      ok_count: ok,
      error_count: errors.length,
      message: errors.slice(0, 20).join('\n') || null,
    }).eq('id', run.id);
  }
  return Response.json({ ok, errors: errors.length, details: errors.slice(0, 5) }, { status: errors.length && !ok ? 502 : 200 });
});
