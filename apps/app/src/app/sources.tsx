import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/glass-card';
import { Icon } from '@/components/icons';
import { ScreenBackground } from '@/components/screen-background';
import { useForecast, usePlace } from '@/lib/data';
import { MIN_TOUCH, colors, type } from '@/theme/tokens';

/** Page « Méthodes et sources » : sources, licences, dates de mise à jour et limites. */
export default function Sources() {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { place } = usePlace();
  const q = useForecast(place?.pcode);
  const sections = ['forecast', 'boundaries', 'limits'] as const;
  return (
    <View style={styles.flex}>
      <ScreenBackground />
      <ScrollView contentContainerStyle={[styles.inner, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.titleRow}>
          <Text style={type.screenTitle} accessibilityRole="header">
            {t('sourcesPage.title')}
          </Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('search.close')} style={styles.close}>
            <Icon name="close" color={colors.text} />
          </Pressable>
        </View>
        {sections.map((s) => (
          <GlassCard key={s} style={styles.card}>
            <Text style={type.cardTitle}>{t(`sourcesPage.${s}Title`)}</Text>
            <Text style={type.body}>{t(`sourcesPage.${s}Body`)}</Text>
          </GlassCard>
        ))}
        {q.data && (
          <Text style={type.small}>
            {t('sourcesPage.lastUpdate', { date: q.data.fetchedAt.toLocaleString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'Africa/Douala' }) })}
          </Text>
        )}
        <Text style={type.small}>{t('disclaimer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg0 },
  inner: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: 640, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 16, gap: 8 },
});
