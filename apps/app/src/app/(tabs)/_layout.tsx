import * as Haptics from 'expo-haptics';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassCard } from '@/components/glass-card';
import { Icon } from '@/components/icons';
import { MIN_TOUCH, colors, fonts } from '@/theme/tokens';

type IconName = ComponentProps<typeof Icon>['name'];

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

// React 19 : `ref` est une prop ordinaire, transmise par {...props} (retirée du type : typage amont incohérent).
function TabButton({ icon, label, isFocused, ...props }: Omit<TabTriggerSlotProps, 'ref'> & { icon: IconName; label: string }) {
  return (
    <Pressable
      {...props}
      onPressIn={tap}
      accessibilityRole="tab"
      aria-selected={!!isFocused}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} color={isFocused ? colors.accent200 : colors.textSecondary} />
      <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// Le bouton central ouvre l'onglet « Signaler » : rôle d'onglet (une liste d'onglets ne contient que des onglets).
function ReportButton({ label, isFocused, ...props }: Omit<TabTriggerSlotProps, 'ref'> & { label: string }) {
  return (
    <Pressable
      {...props}
      onPressIn={() => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}
      accessibilityRole="tab"
      aria-selected={!!isFocused}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.report, pressed && { transform: [{ scale: 0.95 }] }]}>
      <Icon name="plus" color={colors.onAccent} size={26} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Barre d'onglets flottante en verre : Météo · Groupes · [+ Signaler] · Fil citoyen · Profil. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <TabSlot style={{ flex: 1 }} />
      {/* Expo Router n'enregistre comme onglets que les TabTrigger enfants DIRECTS de la TabList :
          le verre est donc un calque de fond, frère des déclencheurs, et non leur conteneur. */}
      <TabList asChild>
        <View style={StyleSheet.flatten([styles.bar, { bottom: Math.max(insets.bottom, 12) + 6 }])} accessibilityRole="tablist">
          <GlassCard level="chrome" style={StyleSheet.absoluteFill} decorative />
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="cloud" label={t('tabs.weather')} />
          </TabTrigger>
          <TabTrigger name="groupes" href="/groupes" asChild>
            <TabButton icon="groups" label={t('tabs.groups')} />
          </TabTrigger>
          <TabTrigger name="signaler" href="/signaler" asChild>
            <ReportButton label={t('tabs.report')} />
          </TabTrigger>
          <TabTrigger name="fil" href="/fil" asChild>
            <TabButton icon="people" label={t('tabs.feed')} />
          </TabTrigger>
          <TabTrigger name="profil" href="/profil" asChild>
            <TabButton icon="person" label={t('tabs.profile')} />
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxWidth: 520,
    marginHorizontal: 'auto',
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  tab: { minWidth: 56, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  tabLabelActive: { fontFamily: fonts.semibold, color: colors.accent200 },
  report: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent200,
    borderWidth: 1,
    borderColor: '#F2FAFF',
    shadowColor: colors.accent300,
    shadowOpacity: 0.65,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
