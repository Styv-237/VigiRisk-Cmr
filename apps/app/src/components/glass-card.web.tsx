import type { CSSProperties, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import classes from './glass-card.module.css';

type Props = { children?: ReactNode; style?: StyleProp<ViewStyle>; level?: 'card' | 'chrome'; decorative?: boolean };

/** Propriétés de placement à porter par le conteneur DOM (sinon la carte ne s'étire pas dans son parent). */
const OUTER = ['position', 'top', 'left', 'right', 'bottom', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'maxWidth', 'minWidth', 'minHeight', 'alignSelf', 'margin', 'marginTop', 'marginBottom', 'borderRadius', 'borderColor'] as const;

/** Version web : backdrop-filter natif du navigateur, repli opaque via @supports et prefers-reduced-transparency. */
export function GlassCard({ children, style, level = 'card', decorative = false }: Props) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) ((OUTER as readonly string[]).includes(k) ? outer : inner)[k] = v;
  if (typeof outer.width === 'number') outer.width = `${outer.width}px`;
  if (typeof outer.maxWidth === 'number') outer.maxWidth = `${outer.maxWidth}px`;
  if (typeof outer.minHeight === 'number') outer.minHeight = `${outer.minHeight}px`;
  if (typeof outer.borderRadius === 'number') outer.borderRadius = `${outer.borderRadius}px`;
  if (typeof outer.marginTop === 'number') outer.marginTop = `${outer.marginTop}px`;
  if (typeof outer.flex === 'number') {
    outer.flexGrow = outer.flex;
    outer.flexShrink = 1;
    outer.flexBasis = 0;
    delete outer.flex;
  }
  for (const k of ['top', 'left', 'right', 'bottom'] as const) if (typeof outer[k] === 'number') outer[k] = `${outer[k]}px`;
  outer.boxSizing = 'border-box';
  return (
    <div className={level === 'chrome' ? `${classes.glass} ${classes.chrome}` : classes.glass} style={outer as CSSProperties} aria-hidden={decorative || undefined}>
      <View style={[inner as ViewStyle, { flexGrow: 1 }]}>{children}</View>
    </div>
  );
}
