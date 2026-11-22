import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';

import type { NormalizedForecast } from '@vigirisk/core';
import { DEMO_MODE, supabase } from './supabase';

export interface Place {
  pcode: string;
  name: string;
  departement?: string | null;
  region?: string | null;
  /** 'gps' : rattachée à la position ; 'manual' : choisie dans la recherche. */
  origin: 'gps' | 'manual';
}

export interface CachedForecast {
  pcode: string;
  fetchedAt: Date;
  source: string;
  isDemo: boolean;
  forecast: NormalizedForecast;
}

const PLACE_KEY = 'vigirisk.place.v1';

export async function loadPlace(): Promise<Place | null> {
  try {
    const raw = await AsyncStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export async function savePlace(place: Place): Promise<void> {
  try {
    await AsyncStorage.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {
    // stockage indisponible : la commune sera redemandée au prochain lancement
  }
}

export const PlaceContext = createContext<{ place: Place | null; setPlace: (p: Place) => void; ready: boolean }>({
  place: null,
  setPlace: () => {},
  ready: false,
});
export const usePlace = () => useContext(PlaceContext);

/** Prévision en cache pour une commune. En production, une ligne de démonstration est ignorée. */
export function useForecast(pcode: string | undefined) {
  return useQuery({
    queryKey: ['forecast', pcode],
    enabled: !!pcode,
    staleTime: 15 * 60_000,
    gcTime: 7 * 24 * 3_600_000, // conservé hors ligne une semaine
    queryFn: async (): Promise<CachedForecast | null> => {
      const { data, error } = await supabase
        .from('forecast_cache')
        .select('commune_pcode, fetched_at, payload, source, is_demo')
        .eq('commune_pcode', pcode!)
        .maybeSingle();
      if (error) throw error;
      if (!data || (data.is_demo && !DEMO_MODE)) return null;
      return {
        pcode: data.commune_pcode,
        fetchedAt: new Date(data.fetched_at),
        source: data.source,
        isDemo: data.is_demo,
        forecast: data.payload as NormalizedForecast,
      };
    },
  });
}

export interface AreaHit {
  pcode: string;
  level: 1 | 2 | 3;
  name: string;
  context: string | null;
}

export function useAreaSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['search', term.toLowerCase()],
    enabled: term.length >= 2,
    staleTime: 24 * 3_600_000,
    queryFn: async (): Promise<AreaHit[]> => {
      const { data, error } = await supabase.rpc('search_areas', { q: term, max_results: 25 });
      if (error) throw error;
      return (data ?? []) as AreaHit[];
    },
  });
}

/** Communes d'un département ou d'une région (quand l'utilisateur choisit un niveau supérieur). */
export async function communesUnder(pcode: string): Promise<AreaHit[]> {
  const { data, error } = await supabase
    .from('admin_areas')
    .select('pcode, level, name')
    .eq('level', 3)
    .like('pcode', `${pcode}%`)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, context: null })) as AreaHit[];
}

export async function communeAt(lat: number, lon: number): Promise<Place | null> {
  const { data, error } = await supabase.rpc('commune_at', { lat, lon });
  if (error) throw error;
  const row = (data as { pcode: string; name: string; departement: string; region: string }[] | null)?.[0];
  return row ? { pcode: row.pcode, name: row.name, departement: row.departement, region: row.region, origin: 'gps' } : null;
}

export async function communeContext(pcode: string): Promise<{ departement: string; region: string } | null> {
  const { data } = await supabase.from('admin_areas').select('pcode, name').in('pcode', [pcode.slice(0, 8), pcode.slice(0, 5)]);
  if (!data) return null;
  return {
    departement: data.find((d) => d.pcode.length === 8)?.name ?? '',
    region: data.find((d) => d.pcode.length === 5)?.name ?? '',
  };
}
