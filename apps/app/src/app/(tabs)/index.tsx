import * as Location from 'expo-location';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  currentConditions,
  describeWeather,
  formatMm,
  freshness,
  nextDays,
  nextHours,
  rainHeadline,
  rainTotals,
  type NormalizedForecast,
} from '@vigirisk/core';
import { GlassCard } from '@/components/glass-card';
import { Icon, WeatherIcon } from '@/components/icons';
import { ScreenBackground } from '@/components/screen-background';
import { communeAt, useForecast, usePlace, type CachedForecast } from '@/lib/data';
import { DEMO_MODE } from '@/lib/supabase';
import { MIN_TOUCH, colors, fonts, type } from '@/theme/tokens';

function useAgo() {
  const { t } = useTranslation();
  return (d: Date) => {
    const min = Math.round((Date.now() - d.getTime()) / 60_000);
    if (min < 2) return t('time.justNow');
    if (min < 60) return t('time.minutes', { n: min });
    return t('time.hours', { n: Math.round(min / 60) });
  };
}

const round = (v: number | null | undefined) => (v == null ? '–' : String(Math.round(v)));

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'fr';
  const insets = useSafeAreaInsets();
  const { place } = usePlace();
  const q = useForecast(place?.pcode);
  const now = new Date();
  const current = q.data ? currentConditions(q.data.forecast, now, lang) : null;

  return (
    <View style={styles.flex}>
      <ScreenBackground weather={current?.icon} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 130 }]}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.accent200} />}>
        <View style={styles.column}>
          {DEMO_MODE && <Text style={styles.demo}>{t('demo')}</Text>}
          {!place ? (
            <ChoosePlace />
          ) : q.isPending && q.fetchStatus !== 'idle' ? (
            <View style={{ marginTop: 120, alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.accent200} />
              <Text style={type.secondary}>{t('home.loading')}</Text>
            </View>
          ) : q.data ? (
            <Forecast data={q.data} lang={lang} />
          ) : (
            <View style={{ gap: 16 }}>
              <PlaceHeader />
              <GlassCard style={styles.card}>
                <Text style={type.body}>{q.isError ? t('home.offline') : t('home.noData')}</Text>
                <Pressable style={styles.secondaryButton} onPress={() => q.refetch()} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>{t('home.retry')}</Text>
                </Pressable>
              </GlassCard>
            </View>
          )}
          <Text style={styles.disclaimer}>{t('disclaimer')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PlaceHeader({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation();
  const { place } = usePlace();
  if (!place) return null;
  return (
    <Pressable
      onPress={() => router.push('/communes')}
      accessibilityRole="button"
      accessibilityHint={t('home.change')}
      style={styles.header}>
      <View style={styles.positionRow}>
        <Icon name={place.origin === 'gps' ? 'pin' : 'search'} size={13} color={colors.accent200} strokeWidth={2.2} />
        <Text style={[type.label, { color: colors.accent200 }]}>{place.origin === 'gps' ? t('home.myPosition') : t('home.chosenCommune')}</Text>
      </View>
      <Text style={type.place} accessibilityRole="header">
        {place.name}
      </Text>
      {!!place.departement && <Text style={[type.secondary, { fontSize: 15 }]}>{[place.departement, place.region].filter(Boolean).join(' · ')}</Text>}
      {children}
    </Pressable>
  );
}

function Forecast({ data, lang }: { data: CachedForecast; lang: 'fr' | 'en' }) {
  const { t } = useTranslation();
  const ago = useAgo();
  const f: NormalizedForecast = data.forecast;
  const now = new Date();
  const c = currentConditions(f, now, lang);
  const hours = useMemo(() => nextHours(f, now, 48), [f, now.getHours()]); // eslint-disable-line react-hooks/exhaustive-deps
  const days = nextDays(f, now, 10);
  const totals = rainTotals(f, now);
  const headline = rainHeadline(f, now, lang);
  const fetchedAt = new Date(data.fetchedAt);
  const fresh = freshness(fetchedAt, now);
  const weekMin = Math.min(...days.map((d) => d.min ?? Infinity));
  const weekMax = Math.max(...days.map((d) => d.max ?? -Infinity));

  return (
    <View style={{ gap: 14 }}>
      <PlaceHeader>
        <Text style={type.temperature} accessibilityLabel={`${round(c?.temperature)} degrés`}>
          {round(c?.temperature)}°
        </Text>
        <Text style={styles.condition}>{c?.label ?? '–'}</Text>
        <Text style={[type.secondary, { fontSize: 15 }]}>{t('home.maxMin', { max: round(c?.todayMax), min: round(c?.todayMin) })}</Text>
      </PlaceHeader>

      {fresh === 'stale' && (
        <GlassCard style={[styles.card, { borderColor: 'rgba(245,196,81,0.4)' }]}>
          <Text style={type.secondary}>{t('home.stale', { ago: ago(fetchedAt) })}</Text>
        </GlassCard>
      )}

      <GlassCard style={styles.card}>
        {!!headline && <Text style={[type.secondary, { color: colors.text, opacity: 0.85 }]}>{headline}</Text>}
        <View style={styles.divider} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} accessibilityLabel={t('home.hourly')} focusable tabIndex={0}>
          {hours.map((h, i) => {
            const w = describeWeather(h.weatherCode, lang);
            return (
              <View key={h.time} style={styles.hour} accessible accessibilityLabel={`${i === 0 ? t('home.now') : t('home.hourShort', { h: h.hour })}, ${w.label}, ${round(h.temperature)}°, ${h.precipitationProbability ?? '–'} %`}>
                <Text style={[styles.hourText, i === 0 && { fontFamily: fonts.semibold }]}>{i === 0 ? t('home.now') : t('home.hourShort', { h: h.hour })}</Text>
                <WeatherIcon name={w.icon} />
                <Text style={styles.prob}>{h.precipitationProbability != null && h.precipitationProbability >= 20 ? `${h.precipitationProbability} %` : ' '}</Text>
                <Text style={styles.hourTemp}>{round(h.temperature)}°</Text>
              </View>
            );
          })}
        </ScrollView>
      </GlassCard>

      <View style={styles.twoCols}>
        <GlassCard style={[styles.card, styles.half]}>
          <View style={styles.positionRow}>
            <Icon name="waves" size={14} />
            <Text style={type.label}>{t('home.floodTitle')}</Text>
          </View>
          <Text style={[type.secondary, { marginTop: 8 }]}>{t('home.comingStep', { step: 3 })}</Text>
        </GlassCard>
        <GlassCard style={[styles.card, styles.half]}>
          <View style={styles.positionRow}>
            <Icon name="people" size={14} />
            <Text style={type.label}>{t('home.nearTitle')}</Text>
          </View>
          <Text style={[type.secondary, { marginTop: 8 }]}>{t('home.comingStep', { step: 6 })}</Text>
        </GlassCard>
      </View>

      <GlassCard style={styles.card}>
        <Text style={[type.label, { marginBottom: 4 }]}>{t('home.tenDays')}</Text>
        {days.map((d, i) => {
          const w = describeWeather(d.weatherCode, lang);
          const span = weekMax - weekMin || 1;
          const left = d.min == null ? 0 : ((d.min - weekMin) / span) * 100;
          const right = d.max == null ? 0 : ((weekMax - d.max) / span) * 100;
          const dayName = i === 0 ? t('home.today') : (t('days', { returnObjects: true }) as string[])[new Date(`${d.date}T12:00:00Z`).getUTCDay()];
          return (
            <View key={d.date} style={styles.day} accessible accessibilityLabel={`${dayName}, ${w.label}, ${round(d.min)}° – ${round(d.max)}°${d.precipitation ? `, ${formatMm(d.precipitation, lang)}` : ''}`}>
              <Text style={[styles.dayName, i === 0 && { fontFamily: fonts.semibold }]}>{dayName}</Text>
              <View style={{ width: 52, alignItems: 'center' }}>
                <WeatherIcon name={w.icon} size={22} />
                {!!d.precipitation && d.precipitation >= 1 && <Text style={styles.dayRain}>{formatMm(d.precipitation, lang)}</Text>}
              </View>
              <Text style={[type.secondary, styles.dayMin]}>{round(d.min)}°</Text>
              <View style={styles.rangeTrack}>
                <View style={[styles.rangeFill, { left: `${left}%`, right: `${right}%` }]} />
              </View>
              <Text style={styles.dayMax}>{round(d.max)}°</Text>
            </View>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={type.label}>{t('home.rainTotals')}</Text>
        <View style={styles.totals}>
          {[
            [totals.past24h, t('home.past24')],
            [totals.next24h, t('home.next24')],
            [totals.next7d, t('home.next7')],
          ].map(([v, label]) => (
            <View key={label as string} style={styles.total}>
              <Text style={styles.totalValue}>{v == null ? '–' : formatMm(v as number, lang)}</Text>
              <Text style={type.small}>{label as string}</Text>
            </View>
          ))}
        </View>
        <Text style={type.small}>{t('home.modelNote')}</Text>
      </GlassCard>

      <Link href="/sources" asChild>
        <Pressable accessibilityRole="link" style={styles.sourceLink}>
          <Text style={type.small}>{t('home.source', { ago: ago(fetchedAt) })}</Text>
          <Text style={[type.small, { color: colors.accent200 }]}>{t('home.sources')} →</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function ChoosePlace() {
  const { t } = useTranslation();
  const { setPlace } = usePlace();
  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'outside'>('idle');

  async function locate() {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setStatus('denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const p = await communeAt(pos.coords.latitude, pos.coords.longitude);
      // Seule la commune est conservée : les coordonnées GPS ne sont ni stockées ni envoyées ailleurs.
      if (!p) return setStatus('outside');
      setPlace(p);
    } catch {
      setStatus('denied');
    }
  }

  return (
    <GlassCard style={[styles.card, { marginTop: 80, gap: 14 }]}>
      <Text style={type.cardTitle} accessibilityRole="header">
        {t('home.chooseTitle')}
      </Text>
      <Text style={type.secondary}>{t('home.chooseBody')}</Text>
      {status === 'denied' && <Text style={[type.secondary, { color: colors.vigilance.yellow }]}>{t('home.locationDenied')}</Text>}
      {status === 'outside' && <Text style={[type.secondary, { color: colors.vigilance.yellow }]}>{t('home.outside')}</Text>}
      <Pressable style={styles.primaryButton} onPress={locate} disabled={status === 'locating'} accessibilityRole="button">
        <Icon name="locate" size={18} color={colors.onAccent} strokeWidth={2} />
        <Text style={styles.primaryButtonText}>{status === 'locating' ? t('home.locating') : t('home.useLocation')}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => router.push('/communes')} accessibilityRole="button">
        <Text style={styles.secondaryButtonText}>{t('home.chooseCommune')}</Text>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg0 },
  content: { paddingHorizontal: 16 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 14 },
  demo: { fontFamily: fonts.bold, fontSize: 12, color: '#1A1405', backgroundColor: colors.vigilance.yellow, padding: 8, borderRadius: 10, textAlign: 'center' },
  header: { alignItems: 'center', gap: 2, paddingBottom: 8 },
  positionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  condition: { fontFamily: fonts.medium, fontSize: 19, color: colors.text },
  card: { padding: 14, gap: 10 },
  divider: { height: 1, backgroundColor: colors.divider },
  hour: { width: 48, alignItems: 'center', gap: 6 },
  hourText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  prob: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accent300, minHeight: 16 },
  hourTemp: { fontFamily: fonts.regular, fontSize: 18, color: colors.text },
  twoCols: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, minHeight: 110 },
  day: { flexDirection: 'row', alignItems: 'center', minHeight: MIN_TOUCH, gap: 8 },
  dayName: { width: 48, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  dayRain: { fontFamily: fonts.semibold, fontSize: 10, color: colors.accent300 },
  dayMin: { width: 34, textAlign: 'right', fontSize: 15 },
  dayMax: { width: 34, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  rangeTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(205,235,255,0.12)' },
  rangeFill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: colors.accent300 },
  totals: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { flex: 1, alignItems: 'center', gap: 2 },
  totalValue: { fontFamily: fonts.light, fontSize: 24, color: colors.text },
  sourceLink: { minHeight: MIN_TOUCH, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, flexWrap: 'wrap', gap: 6 },
  disclaimer: { ...type.small, textAlign: 'center', marginTop: 4 },
  primaryButton: { minHeight: 48, borderRadius: 24, backgroundColor: colors.accent200, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onAccent },
  secondaryButton: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
