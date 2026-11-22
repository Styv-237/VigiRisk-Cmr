import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/glass-card';
import { Icon } from '@/components/icons';
import { ScreenBackground } from '@/components/screen-background';
import { communeContext, communesUnder, useAreaSearch, usePlace, type AreaHit } from '@/lib/data';
import { MIN_TOUCH, colors, fonts, type } from '@/theme/tokens';

/** Recherche de commune (tolérante aux accents et variantes). Une région ou un département ouvre la liste de ses communes. */
export default function CommuneSearch() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { setPlace } = usePlace();
  const [q, setQ] = useState('');
  const [drill, setDrill] = useState<{ title: string; items: AreaHit[] } | null>(null);
  const [drillError, setDrillError] = useState(false);
  const search = useAreaSearch(q);
  const levelLabel = (l: number) => (l === 1 ? t('search.region') : l === 2 ? t('search.departement') : t('search.commune'));

  async function choose(hit: AreaHit) {
    if (hit.level < 3) {
      try {
        setDrill({ title: hit.name, items: await communesUnder(hit.pcode) });
      } catch {
        setDrillError(true);
      }
      return;
    }
    const ctx = hit.context ? { departement: hit.context.split(' · ')[0], region: hit.context.split(' · ')[1] } : await communeContext(hit.pcode);
    setPlace({ pcode: hit.pcode, name: hit.name, departement: ctx?.departement, region: ctx?.region, origin: 'manual' });
    router.back();
  }

  const items = drill ? drill.items : (search.data ?? []);

  return (
    <View style={styles.flex}>
      <ScreenBackground />
      <View style={[styles.inner, { paddingTop: insets.top + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={type.screenTitle} accessibilityRole="header">
            {drill ? drill.title : t('search.title')}
          </Text>
          <Pressable onPress={() => (drill ? setDrill(null) : router.back())} accessibilityRole="button" accessibilityLabel={t('search.close')} style={styles.close}>
            <Icon name="close" color={colors.text} />
          </Pressable>
        </View>
        {!drill && (
          <GlassCard style={styles.searchBox}>
            <View style={styles.searchRow}>
              <Icon name="search" size={18} color={colors.accent100} />
              <TextInput
                value={q}
                onChangeText={(v) => {
                  setQ(v);
                  setDrillError(false);
                }}
                autoFocus
                autoCorrect={false}
                placeholder={t('search.placeholder')}
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel={t('search.placeholder')}
                style={styles.input}
                returnKeyType="search"
              />
            </View>
          </GlassCard>
        )}
        {drillError && !drill && <Text style={[type.secondary, { marginTop: 12, color: colors.vigilance.yellow }]}>{t('search.error')}</Text>}
        {!drill && q.trim().length < 2 && <Text style={[type.secondary, { marginTop: 12 }]}>{t('search.hint')}</Text>}
        {!drill && search.isFetching && <ActivityIndicator color={colors.accent200} style={{ marginTop: 16 }} />}
        {!drill && search.isSuccess && items.length === 0 && <Text style={[type.secondary, { marginTop: 12 }]}>{t('search.empty', { q })}</Text>}
        {!drill && search.isError && !search.isFetching && (
          <View style={{ marginTop: 12, gap: 10 }} accessibilityLiveRegion="polite">
            <Text style={[type.secondary, { color: colors.vigilance.yellow }]}>{t('search.error')}</Text>
            <Pressable onPress={() => void search.refetch()} accessibilityRole="button" style={styles.retry}>
              <Text style={type.bodyStrong}>{t('search.retry')}</Text>
            </Pressable>
          </View>
        )}
        <FlatList
          data={items}
          keyExtractor={(i) => i.pcode}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 12 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => choose(item)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={type.bodyStrong}>{item.name}</Text>
                <Text style={type.small}>{[levelLabel(item.level), item.context].filter(Boolean).join(' · ')}</Text>
              </View>
              <Icon name="chevron" size={18} />
            </Pressable>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg0 },
  inner: { flex: 1, paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  close: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  searchBox: { borderRadius: 18 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 52 },
  // Focus visible mais sobre (WCAG 2.4.7) : liseré glacier à la place du contour par défaut du navigateur.
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.text, minHeight: 44, outlineColor: colors.accent300, outlineWidth: 1, borderRadius: 10, paddingHorizontal: 6 },
  retry: { minHeight: MIN_TOUCH, borderRadius: 22, borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 18 },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 8 },
});
