// COPIE GÉNÉRÉE de packages/core/src/names.ts par scripts/sync-shared.sh — ne pas modifier.
/**
 * Noms de lieux : normalisation pour la recherche et les doublons, et nom d'usage des communes.
 */

/** Forme de comparaison : sans accents, minuscules, tirets/apostrophes/espaces multiples ramenés à un espace. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[’'`´\-_./]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Accents absents du fichier COD-AB 2019 pour des noms dont l'orthographe d'usage est certaine.
 * Liste volontairement courte : à relire et compléter par CEEREMA (table `commune_name_overrides` en base).
 */
export const ACCENT_FIXES: Record<string, string> = {
  Yaounde: 'Yaoundé',
  Ngaoundere: 'Ngaoundéré',
  Edea: 'Édéa',
  Eseka: 'Éséka',
  Ebolowa: 'Ébolowa',
  Belabo: 'Bélabo',
  'Betare-Oya': 'Bétaré-Oya',
  Kaele: 'Kaélé',
  Lomie: 'Lomié',
  Sangmelima: 'Sangmélima',
  Tchollire: 'Tcholliré',
  Tignere: 'Tignère',
  'Galim-Tignere': 'Galim-Tignère',
  Bangangte: 'Bangangté',
  Doume: 'Doumé',
  Zoetele: 'Zoétélé',
  'Nanga-Eboko': 'Nanga-Éboko',
  Meiganga: 'Meïganga',
  Kousseri: 'Kousséri',
  Tokombere: 'Tokombéré',
};

/**
 * Nom d'usage d'une commune à partir du nom COD-AB :
 * « Yaounde 7e » → « Yaoundé VII », « Douala 1er » → « Douala I », « Bamenda 2nd » → « Bamenda II ».
 */
export function communeDisplayName(codabName: string): string {
  const m = codabName.trim().match(/^(.*?)\s+(\d{1,2})(?:er|e|ème|st|nd|rd|th)$/i);
  const base = m ? m[1]! : codabName.trim();
  const fixed = ACCENT_FIXES[base] ?? base;
  if (!m) return fixed;
  const n = Number(m[2]);
  return `${fixed} ${ROMAN[n] ?? n}`;
}
