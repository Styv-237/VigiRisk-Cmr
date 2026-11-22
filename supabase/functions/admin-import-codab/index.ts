// Import des limites administratives COD-AB Cameroun depuis HDX (OCHA / INC, CC BY-IGO).
// Appel : POST, en-tête `x-internal-token` = app_settings.internal_token (connu de la seule base).
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { unzipSync, strFromU8 } from 'npm:fflate@0.8.3';
import { communeDisplayName } from '../_shared/names.ts';

const CODAB_URL =
  'https://data.humdata.org/dataset/b13f08ef-92ee-4446-9b0a-e219f5c25415/resource/2248ac6d-9675-47de-90d3-1e7ce6e601b1/download/cmr_admin_boundaries.geojson.zip';

type Feature = { properties: Record<string, unknown>; geometry: unknown };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const { data: tok } = await db.from('app_settings').select('value').eq('key', 'internal_token').single();
  if (!tok || req.headers.get('x-internal-token') !== tok.value) return new Response('Accès refusé', { status: 403 });

  const res = await fetch(CODAB_URL);
  if (!res.ok) return Response.json({ error: `HDX a répondu ${res.status}` }, { status: 502 });
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()), {
    filter: (f) => /^cmr_admin[123]\.geojson$/.test(f.name.split('/').pop() ?? ''),
  });

  const report: Record<string, number> = {};
  for (const level of [1, 2, 3]) {
    const name = Object.keys(files).find((f) => f.endsWith(`cmr_admin${level}.geojson`));
    if (!name) return Response.json({ error: `cmr_admin${level}.geojson absent de l'archive` }, { status: 502 });
    const features = (JSON.parse(strFromU8(files[name]!)) as { features: Feature[] }).features;
    const items = features.map((f) => {
      const p = f.properties;
      const codab = String(p[`adm${level}_name1`] ?? p[`adm${level}_name`]);
      return {
        pcode: p[`adm${level}_pcode`],
        level,
        parent_pcode: level > 1 ? p[`adm${level - 1}_pcode`] : null,
        name_codab: codab,
        name: level === 3 ? communeDisplayName(codab) : codab,
        name_en: level === 1 ? p.adm1_name : null,
        area_sqkm: p.area_sqkm ?? null,
        geometry: f.geometry,
      };
    });
    let n = 0;
    for (let i = 0; i < items.length; i += 20) {
      const { data, error } = await db.rpc('admin_import_areas', { items: items.slice(i, i + 20) });
      if (error) return Response.json({ error: error.message, level, at: i }, { status: 500 });
      n += data as number;
    }
    report[`niveau_${level}`] = n;
  }
  await db.from('ingest_runs').insert({
    job: 'admin-import-codab',
    finished_at: new Date().toISOString(),
    ok_count: Object.values(report).reduce((a, b) => a + b, 0),
    message: JSON.stringify(report),
  });
  return Response.json({ ok: true, ...report });
});
