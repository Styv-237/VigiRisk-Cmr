// Web : @font-face en WOFF2 (sous-ensemble latin, ~18 Ko par graisse) avec font-display: swap.
// Le rendu n'attend pas les polices : le texte s'affiche aussitôt avec la police de repli.
import '@/theme/fonts.css';

export function useAppFonts(): boolean {
  return true;
}
