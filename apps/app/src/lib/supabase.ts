import { createClient } from '@supabase/supabase-js';

/**
 * Clé « publishable » : publique par conception (lecture seule sous RLS). Les écritures passent par les
 * fonctions serveur. Surcharges possibles via EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://yhdrtprdhlktvwqeusrf.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_v7Xx9BTotBnHDWhDqvoLQw_2jwFsVnu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Mode démonstration : uniquement en développement, explicitement demandé, et toujours signalé à l'écran. */
export const DEMO_MODE = __DEV__ && process.env.EXPO_PUBLIC_DEMO === '1';
