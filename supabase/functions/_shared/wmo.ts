// COPIE GÉNÉRÉE de packages/core/src/wmo.ts par scripts/sync-shared.sh — ne pas modifier.
/**
 * Codes météo WMO (table 4677 simplifiée) utilisés par Open-Meteo.
 * Source : https://open-meteo.com/en/docs (section « WMO Weather interpretation codes »).
 */
export type WeatherIcon =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'showers'
  | 'storm'
  | 'unknown';

export type Lang = 'fr' | 'en';

interface WmoEntry {
  icon: WeatherIcon;
  fr: string;
  en: string;
}

const TABLE: Record<number, WmoEntry> = {
  0: { icon: 'clear', fr: 'Ciel dégagé', en: 'Clear sky' },
  1: { icon: 'partly-cloudy', fr: 'Plutôt dégagé', en: 'Mainly clear' },
  2: { icon: 'partly-cloudy', fr: 'Partiellement nuageux', en: 'Partly cloudy' },
  3: { icon: 'cloudy', fr: 'Couvert', en: 'Overcast' },
  45: { icon: 'fog', fr: 'Brouillard', en: 'Fog' },
  48: { icon: 'fog', fr: 'Brouillard givrant', en: 'Rime fog' },
  51: { icon: 'drizzle', fr: 'Bruine légère', en: 'Light drizzle' },
  53: { icon: 'drizzle', fr: 'Bruine', en: 'Drizzle' },
  55: { icon: 'drizzle', fr: 'Bruine dense', en: 'Dense drizzle' },
  56: { icon: 'drizzle', fr: 'Bruine verglaçante', en: 'Freezing drizzle' },
  57: { icon: 'drizzle', fr: 'Bruine verglaçante dense', en: 'Dense freezing drizzle' },
  61: { icon: 'rain', fr: 'Pluie faible', en: 'Light rain' },
  63: { icon: 'rain', fr: 'Pluie modérée', en: 'Moderate rain' },
  65: { icon: 'heavy-rain', fr: 'Pluie forte', en: 'Heavy rain' },
  66: { icon: 'rain', fr: 'Pluie verglaçante', en: 'Freezing rain' },
  67: { icon: 'heavy-rain', fr: 'Pluie verglaçante forte', en: 'Heavy freezing rain' },
  71: { icon: 'cloudy', fr: 'Neige faible', en: 'Light snow' },
  73: { icon: 'cloudy', fr: 'Neige', en: 'Snow' },
  75: { icon: 'cloudy', fr: 'Neige forte', en: 'Heavy snow' },
  77: { icon: 'cloudy', fr: 'Grains de neige', en: 'Snow grains' },
  80: { icon: 'showers', fr: 'Averses', en: 'Rain showers' },
  81: { icon: 'showers', fr: 'Averses modérées', en: 'Moderate showers' },
  82: { icon: 'heavy-rain', fr: 'Averses violentes', en: 'Violent showers' },
  85: { icon: 'cloudy', fr: 'Averses de neige', en: 'Snow showers' },
  86: { icon: 'cloudy', fr: 'Fortes averses de neige', en: 'Heavy snow showers' },
  95: { icon: 'storm', fr: 'Orage', en: 'Thunderstorm' },
  96: { icon: 'storm', fr: 'Orage avec grêle', en: 'Thunderstorm with hail' },
  99: { icon: 'storm', fr: 'Orage violent avec grêle', en: 'Severe thunderstorm with hail' },
};

export function describeWeather(code: number | null | undefined, lang: Lang = 'fr'): { icon: WeatherIcon; label: string } {
  const entry = code == null ? undefined : TABLE[code];
  if (!entry) return { icon: 'unknown', label: lang === 'fr' ? 'Donnée indisponible' : 'Data unavailable' };
  return { icon: entry.icon, label: entry[lang] };
}

/** Code qui pèse le plus pour la vigilance : orage > pluie forte > averses > pluie > bruine > le reste. */
export function weatherSeverity(code: number | null | undefined): number {
  const icon = describeWeather(code).icon;
  const order: WeatherIcon[] = ['unknown', 'clear', 'partly-cloudy', 'cloudy', 'fog', 'drizzle', 'rain', 'showers', 'heavy-rain', 'storm'];
  return order.indexOf(icon);
}
