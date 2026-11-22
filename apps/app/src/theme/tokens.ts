import { Platform } from 'react-native';

/** Jetons du système de design VigiRisk (étape 1, variante A validée). Source unique des couleurs et rayons. */
export const colors = {
  bg0: '#050B18',
  bg1: '#0B1A33',
  bgTop: '#0E2242',
  accent100: '#CDEBFF',
  accent200: '#9FD8FF',
  accent300: '#7CC7FF',
  accent400: '#5BB8F5',
  text: 'rgba(255,255,255,0.93)',
  textSecondary: 'rgba(205,235,255,0.78)',
  onAccent: '#06142B',
  glassFill: 'rgba(160,210,255,0.08)',
  glassFillSolid: '#12264A',
  glassBorder: 'rgba(205,235,255,0.16)',
  glassHighlight: 'rgba(255,255,255,0.14)',
  divider: 'rgba(205,235,255,0.12)',
  vigilance: {
    green: '#4ADE80',
    yellow: '#F5C451',
    orange: '#FF9F43',
    red: '#FF5C5C',
  },
} as const;

export const radius = { sm: 14, md: 20, lg: 24, xl: 28, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Cibles tactiles minimales (WCAG / HIG). */
export const MIN_TOUCH = 44;

// Web : pile de repli pendant le chargement des polices (font-display: swap) ; mobile : nom exact de la police embarquée.
const fallback = Platform.OS === 'web' ? ", system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" : '';
export const fonts = {
  thin: `Inter_200ExtraLight${fallback}`,
  light: `Inter_300Light${fallback}`,
  regular: `Inter_400Regular${fallback}`,
  medium: `Inter_500Medium${fallback}`,
  semibold: `Inter_600SemiBold${fallback}`,
  bold: `Inter_700Bold${fallback}`,
} as const;

export const type = {
  temperature: { fontFamily: fonts.thin, fontSize: 104, lineHeight: 108, letterSpacing: -4, color: colors.text },
  screenTitle: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 41, color: colors.text },
  place: { fontFamily: fonts.medium, fontSize: 34, lineHeight: 41, color: colors.text },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 25, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  secondary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 19, color: colors.textSecondary },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: colors.textSecondary,
  },
} as const;
