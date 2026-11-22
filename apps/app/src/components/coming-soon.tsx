import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from './glass-card';
import { ScreenBackground } from './screen-background';
import { colors, type } from '@/theme/tokens';

/** Écran d'attente des onglets livrés aux étapes suivantes (aucun contenu fictif affiché). */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <ScreenBackground />
      <View style={[styles.inner, { paddingTop: insets.top + 24 }]}>
        <Text style={type.screenTitle} accessibilityRole="header">
          {title}
        </Text>
        <GlassCard style={{ padding: 16, gap: 6 }}>
          <Text style={type.label}>{t('soon.title')}</Text>
          <Text style={type.body}>{body}</Text>
        </GlassCard>
        <Text style={[type.small, { textAlign: 'center' }]}>{t('disclaimer')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg0 },
  inner: { paddingHorizontal: 16, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
