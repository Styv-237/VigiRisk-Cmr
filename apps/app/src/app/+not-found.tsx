import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/glass-card';
import { ScreenBackground } from '@/components/screen-background';
import { colors, fonts, type } from '@/theme/tokens';

/** Page introuvable (lien cassé ou ancien) : message bilingue et retour à l'accueil, sans plan du site exposé. */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <ScreenBackground />
      <View style={styles.inner}>
        <GlassCard style={{ padding: 20, gap: 12 }}>
          <Text style={type.cardTitle} accessibilityRole="header">
            {t('notFound.title')}
          </Text>
          <Text style={type.body}>{t('notFound.body')}</Text>
          <Link href="/" replace asChild>
            <Pressable accessibilityRole="link" style={styles.button}>
              <Text style={styles.buttonText}>{t('notFound.home')}</Text>
            </Pressable>
          </Link>
        </GlassCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg0 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  button: { minHeight: 48, borderRadius: 24, backgroundColor: colors.accent200, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onAccent },
});
