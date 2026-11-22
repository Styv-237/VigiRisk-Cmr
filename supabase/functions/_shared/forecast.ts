// COPIE GÉNÉRÉE de packages/core/src/forecast.ts par scripts/sync-shared.sh — ne pas modifier.
/**
 * Prévisions mises en cache : format normalisé, indépendant d'Open-Meteo, et calculs d'affichage.
 * Toutes les heures sont des chaînes ISO locales (fuseau Africa/Douala, UTC+1, sans heure d'été).
 */
import { describeWeather, weatherSeverity, type Lang } from './wmo.ts';

export interface HourlySeries {
  time: string[];
  temperature: (number | null)[];
  precipitation: (number | null)[];
  precipitationProbability: (number | null)[];
  weatherCode: (number | null)[];
}

export interface DailySeries {
  time: string[];
  weatherCode: (number | null)[];
  temperatureMax: (number | null)[];
  temperatureMin: (number | null)[];
  precipitationSum: (number | null)[];
}

export interface NormalizedForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  utcOffsetSeconds: number;
  hourly: HourlySeries;
  daily: DailySeries;
}

export class ForecastFormatError extends Error {}

function arr(obj: Record<string, unknown> | undefined, key: string, len: number): (number | null)[] {
  const v = obj?.[key];
  if (!Array.isArray(v) || v.length !== len) throw new ForecastFormatError(`Champ ${key} absent ou de longueur incorrecte`);
  return v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : null));
}

function times(obj: Record<string, unknown> | undefined): string[] {
  const t = obj?.time;
  if (!Array.isArray(t) || t.length === 0 || !t.every((x) => typeof x === 'string')) {
    throw new ForecastFormatError('Série temporelle absente');
  }
  return t as string[];
}

/** Valide et normalise une réponse Open-Meteo Forecast (un seul lieu). Rejette toute réponse incomplète : jamais de valeur inventée. */
export function parseOpenMeteoForecast(json: unknown): NormalizedForecast {
  if (!json || typeof json !== 'object') throw new ForecastFormatError('Réponse vide');
  const j = json as Record<string, unknown>;
  if (j.error) throw new ForecastFormatError(`Erreur Open-Meteo : ${String(j.reason ?? 'inconnue')}`);
  const h = j.hourly as Record<string, unknown> | undefined;
  const d = j.daily as Record<string, unknown> | undefined;
  const ht = times(h);
  const dt = times(d);
  return {
    latitude: Number(j.latitude),
    longitude: Number(j.longitude),
    timezone: String(j.timezone ?? 'Africa/Douala'),
    utcOffsetSeconds: Number(j.utc_offset_seconds ?? 3600),
    hourly: {
      time: ht,
      temperature: arr(h, 'temperature_2m', ht.length),
      precipitation: arr(h, 'precipitation', ht.length),
      precipitationProbability: arr(h, 'precipitation_probability', ht.length),
      weatherCode: arr(h, 'weather_code', ht.length),
    },
    daily: {
      time: dt,
      weatherCode: arr(d, 'weather_code', dt.length),
      temperatureMax: arr(d, 'temperature_2m_max', dt.length),
      temperatureMin: arr(d, 'temperature_2m_min', dt.length),
      precipitationSum: arr(d, 'precipitation_sum', dt.length),
    },
  };
}

/** Heure locale du lieu (ISO sans fuseau, « 2026-11-22T17:00 ») pour un instant donné. */
export function localHourKey(now: Date, utcOffsetSeconds: number): string {
  const local = new Date(now.getTime() + utcOffsetSeconds * 1000);
  return local.toISOString().slice(0, 13) + ':00';
}

/** Indice de l'heure en cours dans la série horaire, ou -1 si la prévision ne couvre pas l'instant. */
export function currentHourIndex(f: NormalizedForecast, now: Date): number {
  return f.hourly.time.indexOf(localHourKey(now, f.utcOffsetSeconds));
}

export interface CurrentConditions {
  time: string;
  temperature: number | null;
  weatherCode: number | null;
  label: string;
  icon: ReturnType<typeof describeWeather>['icon'];
  todayMax: number | null;
  todayMin: number | null;
}

export function currentConditions(f: NormalizedForecast, now: Date, lang: Lang = 'fr'): CurrentConditions | null {
  const i = currentHourIndex(f, now);
  if (i < 0) return null;
  const today = f.hourly.time[i]!.slice(0, 10);
  const di = f.daily.time.indexOf(today);
  const code = f.hourly.weatherCode[i] ?? null;
  const w = describeWeather(code, lang);
  return {
    time: f.hourly.time[i]!,
    temperature: f.hourly.temperature[i] ?? null,
    weatherCode: code,
    label: w.label,
    icon: w.icon,
    todayMax: di >= 0 ? (f.daily.temperatureMax[di] ?? null) : null,
    todayMin: di >= 0 ? (f.daily.temperatureMin[di] ?? null) : null,
  };
}

export interface HourPoint {
  time: string;
  hour: number;
  temperature: number | null;
  precipitation: number | null;
  precipitationProbability: number | null;
  weatherCode: number | null;
}

/** Les `count` heures à partir de l'heure en cours (48 par défaut). */
export function nextHours(f: NormalizedForecast, now: Date, count = 48): HourPoint[] {
  const start = currentHourIndex(f, now);
  if (start < 0) return [];
  const out: HourPoint[] = [];
  for (let i = start; i < Math.min(start + count, f.hourly.time.length); i++) {
    const t = f.hourly.time[i]!;
    out.push({
      time: t,
      hour: Number(t.slice(11, 13)),
      temperature: f.hourly.temperature[i] ?? null,
      precipitation: f.hourly.precipitation[i] ?? null,
      precipitationProbability: f.hourly.precipitationProbability[i] ?? null,
      weatherCode: f.hourly.weatherCode[i] ?? null,
    });
  }
  return out;
}

function sum(values: (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null);
  if (known.length === 0) return null;
  return Math.round(known.reduce((a, b) => a + b, 0) * 10) / 10;
}

export interface RainTotals {
  /** Pluie des 24 dernières heures (modèle, pas une observation). null si la série ne remonte pas assez loin. */
  past24h: number | null;
  next24h: number | null;
  next7d: number | null;
}

export function rainTotals(f: NormalizedForecast, now: Date): RainTotals {
  const i = currentHourIndex(f, now);
  if (i < 0) return { past24h: null, next24h: null, next7d: null };
  const p = f.hourly.precipitation;
  const today = f.hourly.time[i]!.slice(0, 10);
  const di = f.daily.time.indexOf(today);
  return {
    past24h: i >= 24 ? sum(p.slice(i - 24, i)) : null,
    next24h: i + 24 <= p.length ? sum(p.slice(i, i + 24)) : null,
    next7d: di >= 0 && di + 7 <= f.daily.time.length ? sum(f.daily.precipitationSum.slice(di, di + 7)) : null,
  };
}

/** Seuils d'intensité horaire (mm/h), conventions OMM usuelles : faible < 2,5 ≤ modérée < 7,6 ≤ forte. */
export const RAIN_INTENSITY = { moderate: 2.5, heavy: 7.6 } as const;

export type RainIntensity = 'none' | 'light' | 'moderate' | 'heavy';

export function rainIntensity(mmPerHour: number | null): RainIntensity {
  if (mmPerHour == null || mmPerHour < 0.1) return 'none';
  if (mmPerHour < RAIN_INTENSITY.moderate) return 'light';
  if (mmPerHour < RAIN_INTENSITY.heavy) return 'moderate';
  return 'heavy';
}

/**
 * Typographie française : espaces insécables avant « : » et entre nombre et unité.
 * Phrase de synthèse des 12 prochaines heures, à la manière de l'app Météo :
 * « Pluie forte attendue vers 17 h. Cumul prévu sur 24 h : 38 mm. »
 */
export function rainHeadline(f: NormalizedForecast, now: Date, lang: Lang = 'fr'): string | null {
  const hours = nextHours(f, now, 12);
  if (hours.length === 0) return null;
  const totals = rainTotals(f, now);
  let peak: HourPoint | null = null;
  for (const h of hours) {
    const better =
      peak == null ||
      (h.precipitation ?? 0) > (peak.precipitation ?? 0) ||
      ((h.precipitation ?? 0) === (peak.precipitation ?? 0) && weatherSeverity(h.weatherCode) > weatherSeverity(peak.weatherCode));
    if (better) peak = h;
  }
  const intensity = rainIntensity(peak?.precipitation ?? null);
  const total = totals.next24h;
  const totalText =
    total == null ? '' : lang === 'fr' ? ` Cumul prévu sur 24\u00a0h\u00a0: ${formatMm(total, lang)}.` : ` Expected 24\u00a0h total: ${formatMm(total, lang)}.`;
  if (intensity === 'none' || peak == null) {
    return (lang === 'fr' ? 'Pas de pluie significative prévue dans les 12 prochaines heures.' : 'No significant rain expected in the next 12 hours.') + totalText;
  }
  const isStorm = describeWeather(peak.weatherCode).icon === 'storm';
  const labelsFr: Record<Exclude<RainIntensity, 'none'>, string> = { light: 'Pluie faible', moderate: 'Pluie modérée', heavy: 'Pluie forte' };
  const labelsEn: Record<Exclude<RainIntensity, 'none'>, string> = { light: 'Light rain', moderate: 'Moderate rain', heavy: 'Heavy rain' };
  const what = lang === 'fr' ? labelsFr[intensity] + (isStorm ? ' et orage' : '') : labelsEn[intensity] + (isStorm ? ' and thunderstorm' : '');
  const when = lang === 'fr' ? `vers ${peak.hour}\u00a0h` : `around ${formatHourEn(peak.hour)}`;
  return lang === 'fr' ? `${what} attendue ${when}.${totalText}` : `${what} expected ${when}.${totalText}`;
}

export function formatMm(v: number, lang: Lang = 'fr'): string {
  const rounded = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  const s = lang === 'fr' ? String(rounded).replace('.', ',') : String(rounded);
  // Espace insécable : le nombre et l'unité ne sont jamais séparés à la ligne.
  return `${s}\u00a0mm`;
}

function formatHourEn(h: number): string {
  if (h === 0) return '12 am';
  if (h === 12) return '12 pm';
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export interface DayPoint {
  date: string;
  weatherCode: number | null;
  max: number | null;
  min: number | null;
  precipitation: number | null;
}

/** Les `count` jours à partir d'aujourd'hui (10 par défaut). */
export function nextDays(f: NormalizedForecast, now: Date, count = 10): DayPoint[] {
  const today = localHourKey(now, f.utcOffsetSeconds).slice(0, 10);
  const start = f.daily.time.indexOf(today);
  if (start < 0) return [];
  return f.daily.time.slice(start, start + count).map((date, k) => ({
    date,
    weatherCode: f.daily.weatherCode[start + k] ?? null,
    max: f.daily.temperatureMax[start + k] ?? null,
    min: f.daily.temperatureMin[start + k] ?? null,
    precipitation: f.daily.precipitationSum[start + k] ?? null,
  }));
}

export type Freshness = 'fresh' | 'aging' | 'stale';

/** Fraîcheur du cache : la collecte passe toutes les 3 h ; au-delà de 6 h, l'écran le signale. */
export function freshness(fetchedAt: Date, now: Date): Freshness {
  const hours = (now.getTime() - fetchedAt.getTime()) / 3_600_000;
  if (hours <= 3.5) return 'fresh';
  if (hours <= 6) return 'aging';
  return 'stale';
}
