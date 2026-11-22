import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { WeatherIcon } from '@vigirisk/core';
import { colors } from '@/theme/tokens';

const RAINY: WeatherIcon[] = ['drizzle', 'rain', 'showers', 'heavy-rain', 'storm'];

/**
 * Fond d'écran : dégradé nuit, halos bleus (matière pour le verre) et pluie animée quand il pleut.
 * L'animation ne touche qu'une transformation (thread UI, 60 i/s) et s'arrête si « Réduire les animations » est actif.
 */
export function ScreenBackground({ weather }: { weather?: WeatherIcon }) {
  const reduceMotion = useReducedMotion();
  const raining = weather != null && RAINY.includes(weather);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={[colors.bgTop, colors.bg1, colors.bg0]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <Halo color={colors.accent400} opacity={0.32} style={{ left: -150, top: -130, width: 460, height: 460 }} />
      <Halo color={colors.accent300} opacity={0.16} style={{ right: -180, top: 380, width: 460, height: 460 }} />
      {raining && !reduceMotion && <Rain heavy={weather === 'heavy-rain' || weather === 'storm'} />}
    </View>
  );
}

function Rain({ heavy }: { heavy: boolean }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: heavy ? 700 : 1100, easing: Easing.linear }), -1, false);
  }, [heavy, t]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: t.value * 120 }, { rotate: '12deg' }] }));
  const count = heavy ? 70 : 40;
  // Positions pseudo-aléatoires stables (pas de Math.random au rendu).
  const drops = Array.from({ length: count }, (_, i) => ({ x: ((i * 97) % 100) / 100, y: ((i * 61) % 100) / 100, h: 14 + ((i * 7) % 12) }));
  return (
    <Animated.View style={[{ position: 'absolute', left: -40, top: -140, width: width + 80, height: height + 280 }, style]}>
      {drops.map((d, i) => (
        <View key={i} style={{ position: 'absolute', left: d.x * (width + 80), top: d.y * (height + 280), width: 1, height: d.h, backgroundColor: 'rgba(205,235,255,0.16)' }} />
      ))}
    </Animated.View>
  );
}

/** Halo lumineux diffus : dégradé radial SVG (rendu identique iOS, Android et web, sans filtre de flou coûteux). */
function Halo({ color, opacity, style }: { color: string; opacity: number; style: object }) {
  const id = `h${color.slice(1)}`;
  return (
    <Svg style={StyleSheet.flatten([{ position: 'absolute' as const }, style])} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}
