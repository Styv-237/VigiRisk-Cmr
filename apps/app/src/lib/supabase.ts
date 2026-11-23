import { createClient } from '@supabase/supabase-js';

/**
 * Clé « publishable » : publique par conception (lecture seule sous RLS). Les écritures passent par les
 * fonctions serveur. Surcharges possibles via EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://yhdrtprdhlktvwqeusrf.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_v7Xx9BTotBnHDWhDqvoLQw_2jwFsVnu';

/** Délai maximal d'une requête : sur un réseau 2G saturé, une requête sans délai peut rester bloquée des minutes. */
export const REQUEST_TIMEOUT_MS = 12_000;

/** fetch avec délai maximal, qui respecte aussi le signal d'annulation éventuel de l'appelant. */
export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), REQUEST_TIMEOUT_MS);
  const outer = init.signal;
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchWithTimeout },
});

/** Mode démonstration : uniquement en développement, explicitement demandé, et toujours signalé à l'écran. */
export const DEMO_MODE = __DEV__ && process.env.EXPO_PUBLIC_DEMO === '1';
