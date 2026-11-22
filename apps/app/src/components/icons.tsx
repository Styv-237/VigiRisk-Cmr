import { Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { WeatherIcon as WeatherIconName } from '@vigirisk/core';
import { colors } from '@/theme/tokens';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Pictogrammes décoratifs : masqués des lecteurs d'écran (le texte voisin porte le sens). */
const HIDDEN = Platform.OS === 'web' ? ({ 'aria-hidden': true } as object) : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const };

const CLOUD = 'M7 15h10a3.5 3.5 0 0 0 .5-7A5 5 0 0 0 7.8 7 3.8 3.8 0 0 0 7 15z';

/** Pictogrammes météo au trait, dessinés en SVG (identiques sur mobile et web). Décoratifs : le libellé texte porte le sens. */
export function WeatherIcon({ name, size = 24, color = colors.accent100, strokeWidth = 1.7 }: IconProps & { name: WeatherIconName }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...HIDDEN}>
      {name === 'clear' && (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" {...p} />
        </>
      )}
      {name === 'partly-cloudy' && (
        <>
          <Circle cx={9} cy={9} r={3} {...p} />
          <Path d="M9 3v1M3 9h1M4.8 4.8l.7.7" {...p} />
          <Path d="M10 18h8a3 3 0 0 0 .4-6 4 4 0 0 0-7.5 1" {...p} />
        </>
      )}
      {(name === 'cloudy' || name === 'unknown') && <Path d={CLOUD} {...p} />}
      {name === 'fog' && <Path d="M4 9h16M6 13h12M4 17h16" {...p} />}
      {(name === 'drizzle' || name === 'rain' || name === 'showers' || name === 'heavy-rain') && (
        <>
          <Path d={CLOUD} {...p} />
          <Path d={name === 'drizzle' ? 'M10 18v1M14 18v1' : name === 'heavy-rain' ? 'M8 18l-1 3M12 18l-1 3M16 18l-1 3' : 'M9 18l-1 2M13 18l-1 2M17 18l-1 2'} {...p} />
        </>
      )}
      {name === 'storm' && (
        <>
          <Path d="M7 14h10a3.5 3.5 0 0 0 .5-7A5 5 0 0 0 7.8 6 3.8 3.8 0 0 0 7 14z" {...p} />
          <Path d="M12 14l-2 4h3l-2 4" {...p} stroke={colors.vigilance.yellow} />
        </>
      )}
    </Svg>
  );
}

export function Icon({ name, size = 24, color = colors.textSecondary, strokeWidth = 1.8 }: IconProps & { name: 'cloud' | 'groups' | 'plus' | 'people' | 'person' | 'pin' | 'search' | 'chevron' | 'waves' | 'warning' | 'close' | 'locate' | 'info' }) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const d: Record<typeof name, string[]> = {
    cloud: ['M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.3 4.5 4.5 0 0 0 7 18z'],
    groups: ['M4 5h11v8H8l-4 3z', 'M15 9h5v8l-3-2h-6v-2'],
    plus: ['M12 5v14M5 12h14'],
    people: ['M9 5a3 3 0 1 1 0 6a3 3 0 1 1 0-6z', 'M3 19c0-3 3-5 6-5s6 2 6 5', 'M17 6.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z', 'M16 14c3 0 5 2 5 5'],
    person: ['M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z', 'M4 21c0-4 4-6 8-6s8 2 8 6'],
    pin: ['M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z', 'M12 6.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z'],
    search: ['M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14z', 'M20 20l-4-4'],
    chevron: ['M9 6l6 6-6 6'],
    waves: ['M3 9c3-2 6 2 9 0s6-2 9 0M3 15c3-2 6 2 9 0s6-2 9 0'],
    warning: ['M12 3l10 18H2z', 'M12 10v5M12 18v.5'],
    close: ['M6 6l12 12M18 6L6 18'],
    locate: ['M12 3v3M12 18v3M3 12h3M18 12h3', 'M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z'],
    info: ['M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z', 'M12 11v5M12 8v.5'],
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...HIDDEN}>
      {d[name].map((path) => (
        <Path key={path} d={path} {...p} />
      ))}
    </Svg>
  );
}
