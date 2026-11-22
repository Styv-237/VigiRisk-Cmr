import { describe, expect, it } from 'vitest';
import {
  ForecastFormatError,
  buildForecastUrl,
  chunk,
  communeDisplayName,
  currentConditions,
  describeWeather,
  freshness,
  localHourKey,
  nextDays,
  nextHours,
  normalizeName,
  parseOpenMeteoForecast,
  rainHeadline,
  rainIntensity,
  rainTotals,
  splitMultiLocation,
} from '../src';

/**
 * Jeu d'essai SYNTHÉTIQUE (tests uniquement), au format exact d'une réponse Open-Meteo :
 * 1 jour passé + 10 jours, pas horaire, fuseau Africa/Douala (UTC+1).
 * Pluie : 1 mm/h pendant les 24 h passées, puis un pic à 17 h le 22/11 (9 mm/h, orage).
 */
function fixture(overrides: Partial<{ precip: (h: number) => number; code: (h: number) => number }> = {}) {
  const start = Date.UTC(2026, 10, 21, 0, 0); // 21/11 00:00 heure locale (représentée en UTC naïf)
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const precipitation: number[] = [];
  const precipitation_probability: number[] = [];
  const weather_code: number[] = [];
  for (let h = 0; h < 11 * 24; h++) {
    const d = new Date(start + h * 3_600_000);
    time.push(d.toISOString().slice(0, 16));
    const hod = d.getUTCHours();
    temperature_2m.push(19 + 8 * Math.sin(((hod - 8) / 24) * 2 * Math.PI));
    const p = overrides.precip ? overrides.precip(h) : h < 24 ? 1 : h === 24 + 17 ? 9 : h === 24 + 16 ? 3 : 0;
    precipitation.push(p);
    precipitation_probability.push(p > 0 ? 80 : 10);
    weather_code.push(overrides.code ? overrides.code(h) : h === 24 + 17 ? 95 : p > 0 ? 61 : 2);
  }
  const days = Array.from({ length: 11 }, (_, k) => new Date(start + k * 86_400_000).toISOString().slice(0, 10));
  return {
    latitude: 3.875,
    longitude: 11.5,
    utc_offset_seconds: 3600,
    timezone: 'Africa/Douala',
    hourly: { time, temperature_2m, precipitation, precipitation_probability, weather_code },
    daily: {
      time: days,
      weather_code: days.map(() => 80),
      temperature_2m_max: days.map(() => 27),
      temperature_2m_min: days.map(() => 19),
      precipitation_sum: days.map((_, k) => (k === 0 ? 24 : 12)),
    },
  };
}

// 22/11/2026 14:30 heure de Douala = 13:30 UTC
const NOW = new Date(Date.UTC(2026, 10, 22, 13, 30));

describe('parseOpenMeteoForecast', () => {
  it('normalise une réponse complète', () => {
    const f = parseOpenMeteoForecast(fixture());
    expect(f.hourly.time).toHaveLength(264);
    expect(f.daily.time).toHaveLength(11);
    expect(f.timezone).toBe('Africa/Douala');
  });

  it('refuse une réponse d’erreur d’Open-Meteo au lieu d’inventer des valeurs', () => {
    expect(() => parseOpenMeteoForecast({ error: true, reason: 'Daily API request limit exceeded' })).toThrow(ForecastFormatError);
  });

  it('refuse une série tronquée', () => {
    const j = fixture();
    j.hourly.precipitation = j.hourly.precipitation.slice(0, 10);
    expect(() => parseOpenMeteoForecast(j)).toThrow(/precipitation/);
  });

  it('convertit les valeurs manquantes en null', () => {
    const j = fixture() as unknown as { hourly: { temperature_2m: unknown[] } };
    j.hourly.temperature_2m[38] = null;
    const f = parseOpenMeteoForecast(j);
    expect(f.hourly.temperature[38]).toBeNull();
  });
});

describe('heure locale et conditions actuelles', () => {
  it('calcule l’heure locale de Douala (UTC+1)', () => {
    expect(localHourKey(NOW, 3600)).toBe('2026-11-22T14:00');
  });

  it('lit les conditions de l’heure en cours et les extrêmes du jour', () => {
    const c = currentConditions(parseOpenMeteoForecast(fixture()), NOW)!;
    expect(c.time).toBe('2026-11-22T14:00');
    expect(c.todayMax).toBe(27);
    expect(c.todayMin).toBe(19);
    expect(c.label).toBe('Partiellement nuageux');
  });

  it('renvoie null si le cache ne couvre pas l’instant (cache périmé)', () => {
    const f = parseOpenMeteoForecast(fixture());
    expect(currentConditions(f, new Date(Date.UTC(2026, 11, 20)))).toBeNull();
    expect(nextHours(f, new Date(Date.UTC(2026, 11, 20)))).toEqual([]);
  });

  it('donne 48 heures à partir de maintenant', () => {
    const h = nextHours(parseOpenMeteoForecast(fixture()), NOW);
    expect(h).toHaveLength(48);
    expect(h[0]!.hour).toBe(14);
    expect(h[3]!.precipitation).toBe(9);
  });

  it('donne 10 jours à partir d’aujourd’hui', () => {
    const d = nextDays(parseOpenMeteoForecast(fixture()), NOW);
    expect(d).toHaveLength(10);
    expect(d[0]!.date).toBe('2026-11-22');
  });
});

describe('cumuls de pluie', () => {
  it('somme les 24 h passées et à venir et les 7 jours', () => {
    const t = rainTotals(parseOpenMeteoForecast(fixture()), NOW);
    // 24 h passées : de 14 h le 21 à 13 h le 22 → 10 h à 1 mm (14 h–23 h le 21), le reste à 0
    expect(t.past24h).toBe(10);
    expect(t.next24h).toBe(12); // 3 + 9
    expect(t.next7d).toBe(84); // 7 × 12
  });

  it('n’invente pas un cumul passé quand la série commence trop tard', () => {
    const t = rainTotals(parseOpenMeteoForecast(fixture()), new Date(Date.UTC(2026, 10, 20, 23, 30)));
    expect(t.past24h).toBeNull();
  });
});

describe('intensité et phrase de synthèse', () => {
  it('classe les intensités horaires selon les seuils OMM', () => {
    expect(rainIntensity(null)).toBe('none');
    expect(rainIntensity(0.05)).toBe('none');
    expect(rainIntensity(1)).toBe('light');
    expect(rainIntensity(2.5)).toBe('moderate');
    expect(rainIntensity(7.6)).toBe('heavy');
  });

  it('annonce le pic de pluie avec l’orage et le cumul', () => {
    const f = parseOpenMeteoForecast(fixture());
    expect(rainHeadline(f, NOW)).toBe('Pluie forte et orage attendue vers 17\u00a0h. Cumul prévu sur 24\u00a0h\u00a0: 12\u00a0mm.');
    expect(rainHeadline(f, NOW, 'en')).toBe('Heavy rain and thunderstorm expected around 5 pm. Expected 24\u00a0h total: 12\u00a0mm.');
  });

  it('dit clairement quand aucune pluie n’est attendue', () => {
    const f = parseOpenMeteoForecast(fixture({ precip: () => 0, code: () => 1 }));
    expect(rainHeadline(f, NOW)).toBe('Pas de pluie significative prévue dans les 12 prochaines heures. Cumul prévu sur 24\u00a0h\u00a0: 0\u00a0mm.');
  });
});

describe('fraîcheur du cache', () => {
  const fetched = new Date(Date.UTC(2026, 10, 22, 10, 0));
  it('fraîche, vieillissante, périmée', () => {
    expect(freshness(fetched, new Date(fetched.getTime() + 3 * 3_600_000))).toBe('fresh');
    expect(freshness(fetched, new Date(fetched.getTime() + 5 * 3_600_000))).toBe('aging');
    expect(freshness(fetched, new Date(fetched.getTime() + 7 * 3_600_000))).toBe('stale');
  });
});

describe('codes WMO', () => {
  it('traduit en français et en anglais', () => {
    expect(describeWeather(95)).toEqual({ icon: 'storm', label: 'Orage' });
    expect(describeWeather(95, 'en').label).toBe('Thunderstorm');
    expect(describeWeather(1234).icon).toBe('unknown');
  });
});

describe('noms de lieux', () => {
  it('normalise les variantes d’orthographe', () => {
    expect(normalizeName('Mvog-Ada')).toBe('mvog ada');
    expect(normalizeName('  MVOG  ADA ')).toBe('mvog ada');
    expect(normalizeName('Mvög_Adà')).toBe('mvog ada');
    expect(normalizeName("Nkol'Eton")).toBe('nkol eton');
  });

  it('donne le nom d’usage des communes COD-AB', () => {
    expect(communeDisplayName('Yaounde 7e')).toBe('Yaoundé VII');
    expect(communeDisplayName('Douala 1er')).toBe('Douala I');
    expect(communeDisplayName('Douala 5e')).toBe('Douala V');
    expect(communeDisplayName('Bamenda 2nd')).toBe('Bamenda II');
    expect(communeDisplayName('Ngaoundere 3e')).toBe('Ngaoundéré III');
    expect(communeDisplayName('Akom 2')).toBe('Akom 2');
    expect(communeDisplayName('Mbalmayo')).toBe('Mbalmayo');
    expect(communeDisplayName('Sangmelima')).toBe('Sangmélima');
  });
});

describe('requêtes Open-Meteo', () => {
  it('reste sous 10 variables et 2 semaines par lieu', () => {
    const url = new URL(buildForecastUrl([{ latitude: 3.8667, longitude: 11.5167 }]));
    const vars = [...url.searchParams.get('hourly')!.split(','), ...url.searchParams.get('daily')!.split(',')];
    expect(vars.length).toBeLessThanOrEqual(10);
    expect(Number(url.searchParams.get('forecast_days')) + Number(url.searchParams.get('past_days'))).toBeLessThanOrEqual(14);
    expect(url.searchParams.get('timezone')).toBe('Africa/Douala');
  });

  it('regroupe les coordonnées et refuse les lots trop grands', () => {
    const pts = Array.from({ length: 120 }, (_, i) => ({ latitude: 4 + i / 100, longitude: 11 }));
    expect(chunk(pts, 50).map((c) => c.length)).toEqual([50, 50, 20]);
    expect(() => buildForecastUrl(pts)).toThrow(/Lot trop grand/);
    expect(new URL(buildForecastUrl(pts.slice(0, 2))).searchParams.get('latitude')).toBe('4.0000,4.0100');
  });

  it('utilise l’URL client et la clé si une clé est fournie', () => {
    const url = buildForecastUrl([{ latitude: 4, longitude: 11 }], 'KEY');
    expect(url.startsWith('https://customer-api.open-meteo.com/')).toBe(true);
  });

  it('ramène toujours la réponse à un tableau et vérifie le nombre de lieux', () => {
    expect(splitMultiLocation({ a: 1 }, 1)).toHaveLength(1);
    expect(() => splitMultiLocation([{}, {}], 3)).toThrow(/2 lieux reçus, 3 attendus/);
  });
});

describe('copies pour les fonctions Edge', () => {
  it('sont identiques aux sources (lancer scripts/sync-shared.sh sinon)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const f of ['names', 'wmo', 'forecast', 'openmeteo']) {
      const src = readFileSync(resolve(__dirname, `../src/${f}.ts`), 'utf8');
      const copy = readFileSync(resolve(__dirname, `../../../supabase/functions/_shared/${f}.ts`), 'utf8');
      expect(copy.split('\n').slice(1).join('\n')).toBe(src);
    }
  });
});
