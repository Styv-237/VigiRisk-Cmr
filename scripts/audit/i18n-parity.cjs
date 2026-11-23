// Vérifie que fr.json et en.json ont exactement les mêmes clés, et que toutes les clés t('…') utilisées existent.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../../apps/app/src');
const fr = require(path.join(dir, 'lib/locales/fr.json'));
const en = require(path.join(dir, 'lib/locales/en.json'));
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const kf = new Set(keys(fr)), ke = new Set(keys(en));
const onlyFr = [...kf].filter((k) => !ke.has(k)), onlyEn = [...ke].filter((k) => !kf.has(k));
const used = new Set();
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) return walk(p);
  if (/\.tsx?$/.test(e.name)) for (const m of fs.readFileSync(p, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
});
walk(dir);
const missing = [...used].filter((k) => !kf.has(k) && !kf.has(k + '.0') && !Object.prototype.hasOwnProperty.call(fr, k));
console.log(`clés fr=${kf.size} en=${ke.size} utilisées=${used.size}`);
if (onlyFr.length || onlyEn.length || missing.length) {
  console.log('Uniquement fr :', onlyFr, '\nUniquement en :', onlyEn, '\nUtilisées mais absentes :', missing);
  process.exit(1);
}
console.log('Parité FR/EN : OK');
