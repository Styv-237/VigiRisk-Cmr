/**
 * Construction des requêtes Open-Meteo Forecast pour la collecte planifiée.
 *
 * Open-Meteo (offre gratuite, usage non commercial) compte une requête comme plusieurs appels au-delà de
 * 10 variables ou de 2 semaines de données par lieu. On se limite donc à 9 variables et 11 jours (1 passé + 10).
 * L'heure actuelle est lue dans la série horaire : pas de bloc `current`, qui coûterait des variables en plus.
 */
export const FORECAST_HOURLY_VARS = ['temperature_2m', 'precipitation', 'precipitation_probability', 'weather_code'] as const;
export const FORECAST_DAILY_VARS = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'] as const;

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_ATTRIBUTION = 'Données météo : Open-Meteo.com (CC BY 4.0)';

/** Taille maximale d'un lot de coordonnées par requête HTTP (garde l'URL courte et la réponse raisonnable). */
export const FORECAST_BATCH_SIZE = 50;

export interface LatLon {
  latitude: number;
  longitude: number;
}

export function buildForecastUrl(points: LatLon[], apiKey?: string): string {
  if (points.length === 0) throw new Error('Aucun point à interroger');
  if (points.length > FORECAST_BATCH_SIZE) throw new Error(`Lot trop grand (${points.length} > ${FORECAST_BATCH_SIZE})`);
  const base = apiKey ? 'https://customer-api.open-meteo.com/v1/forecast' : OPEN_METEO_FORECAST_URL;
  const params = new URLSearchParams({
    latitude: points.map((p) => p.latitude.toFixed(4)).join(','),
    longitude: points.map((p) => p.longitude.toFixed(4)).join(','),
    hourly: FORECAST_HOURLY_VARS.join(','),
    daily: FORECAST_DAILY_VARS.join(','),
    timezone: 'Africa/Douala',
    past_days: '1',
    forecast_days: '10',
  });
  if (apiKey) params.set('apikey', apiKey);
  return `${base}?${params.toString()}`;
}

/** Open-Meteo renvoie un objet pour un lieu, un tableau pour plusieurs : on ramène toujours à un tableau. */
export function splitMultiLocation(json: unknown, expected: number): unknown[] {
  const list = Array.isArray(json) ? json : [json];
  if (list.length !== expected) throw new Error(`Réponse Open-Meteo : ${list.length} lieux reçus, ${expected} attendus`);
  return list;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
