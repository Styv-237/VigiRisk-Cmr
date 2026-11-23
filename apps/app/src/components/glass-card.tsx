import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useEffect, useState } from 'react';

import { colors, radius } from '@/theme/tokens';

/** decorative : simple calque de fond, ignoré par les lecteurs d'écran. */
type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; level?: 'card' | 'chrome'; decorative?: boolean };

/** Réglage système « Réduire la transparence » (iOS) : on passe au verre opaque. */
function useReduceTransparency() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const LIQUID = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * Carte « verre liquide ». Cascade de rendu (voir docs/00-plan-etape-0.md §6) :
 * iOS 26+ : GlassView natif · iOS < 26 : BlurView · Android : teinte opaque (pas de flou, coûteux sur
 * l'entrée de gamme) · Web : backdrop-filter (glass-card.web.tsx). Le contraste du texte ne dépend jamais du fond.
 */
export function GlassCard({ children, style, level = 'card', decorative = false }: Props) {
  const reduce = useReduceTransparency();
  const r = level === 'chrome' ? radius.xl : radius.lg;
  const frame = [styles.base, { borderRadius: r }, level === 'chrome' && styles.chrome, style];
  const a11y = decorative ? ({ accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const) : {};

  if (reduce || Platform.OS === 'android') {
    return (
      <View style={[frame, styles.solid]} {...a11y}>
        {children}
      </View>
    );
  }
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle="regular" tintColor="rgba(11,26,51,0.35)" style={frame} {...a11y}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[frame, styles.clip]} {...a11y}>
      <BlurView tint="dark" intensity={45} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.veil]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.glassBorder,
  },
  chrome: { borderColor: 'rgba(205,235,255,0.22)' },
  solid: { backgroundColor: colors.glassFillSolid },
  clip: { overflow: 'hidden' },
  veil: { backgroundColor: colors.glassFill },
});
