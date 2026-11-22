# VigiRisk Cameroun

Météo, vigilance crues et réseau social de vigilance citoyenne pour le Cameroun, porté par le **CEEREMA** (Centre d'études et d'expertise sur les risques, l'environnement, la mobilité et l'aménagement).

Application mobile (iOS, Android) et web à partir d'une seule base de code : Expo SDK 58, Expo Router, TypeScript, Supabase.

> Information indicative. En cas de danger, suivez les consignes des autorités.

## État d'avancement

| Étape | Contenu | État |
|---|---|---|
| 0 | Plan, modèle de données, vérification des API et bibliothèques | ✅ [`docs/00-plan-etape-0.md`](docs/00-plan-etape-0.md) |
| 1 | Système de design et maquettes (2 variantes) | ✅ variante A retenue : [`design/canvas/`](design/canvas/) |
| 2 | Accueil, recherche de commune, prévisions météo réelles (mobile et web) | ✅ cette branche |
| 3 | Cours d'eau, hydrogrammes, vigilance indicative | ⏳ |
| 4–10 | Voir le plan | ⏳ |

Décisions prises avec CEEREMA : [`docs/01-decisions.md`](docs/01-decisions.md).

## Organisation du dépôt

```
apps/app/                Application Expo (iOS, Android, web)
  src/app/               Écrans (Expo Router) : (tabs)/index = accueil, communes = recherche, sources
  src/components/        Verre liquide (GlassCard), fond animé, pictogrammes SVG, écrans « bientôt »
  src/lib/               Client Supabase, requêtes + cache hors ligne, traductions FR/EN
  src/theme/tokens.ts    Jetons du système de design
packages/core/           Logique pure et testée : codes WMO, lecture Open-Meteo, cumuls, phrase de synthèse, noms
supabase/migrations/     Schéma, RLS, fonctions SQL (les fichiers *_remote_only.sql ne tournent que sur Supabase)
supabase/functions/      Fonctions Edge : admin-import-codab, ingest-forecast ; _shared = copie de packages/core
supabase/tests/          Tests pgTAP (RLS, permissions, recherche, localisation)
scripts/                 Import COD-AB, synchronisation du code partagé, démonstration web
docs/                    Plan, décisions, captures
```

## Démarrer

Prérequis : Node 22, pnpm 10.

```bash
pnpm install
```

```bash
cd apps/app && npx expo start
```

Puis `w` pour le web, ou scannez le QR code avec un **build de développement** (l'app utilise des modules natifs hors Expo Go : effet de verre, flou, localisation).

L'app lit le projet Supabase `vigirisk-cmr` avec sa clé **publishable** (publique par conception, lecture seule sous RLS). Pour un autre projet : `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_KEY`.

### Mode démonstration

`EXPO_PUBLIC_DEMO=1` (développement uniquement) affiche un bandeau « DONNÉES DE DÉMONSTRATION » et autorise la lecture des lignes `is_demo`. En production, ces lignes sont ignorées par l'app **et refusées par la base** (déclencheur SQL quand `app_settings.environment = 'production'`).

### Export web

```bash
cd apps/app && npx expo export --platform web
```

Le site statique est produit dans `apps/app/dist`.

## Tests

```bash
pnpm --filter @vigirisk/core test
```

23 tests Vitest : lecture Open-Meteo, refus des réponses incomplètes, conditions actuelles, 48 h, 10 jours, cumuls, intensités, phrase de synthèse FR/EN, fraîcheur du cache, noms de communes, requêtes sous quota, identité des copies pour les fonctions Edge.

```bash
pnpm test:db
```

35 tests pgTAP sur un Postgres 16 + PostGIS + pgTAP local (paquets Ubuntu `postgresql-16-postgis-3` et `postgresql-16-pgtap`) :
- RLS active sur chaque table ;
- lecture publique des limites et des prévisions ;
- aucune écriture pour `anon` et `authenticated` ;
- journal des collectes et jeton interne invisibles au public ;
- données de démonstration refusées en production ;
- localisation (`commune_at`) et recherche tolérante (`search_areas`).

```bash
cd apps/app && npx tsc --noEmit
```

Démonstration web automatisée (Playwright), serveur web lancé :

```bash
node scripts/demo-web.cjs ./captures
```

## Données et collecte

| Source | Usage | Licence |
|---|---|---|
| Open-Meteo Forecast | prévisions horaires (48 h) et journalières (10 j), cumuls | CC BY 4.0, usage non commercial |
| COD-AB Cameroun (OCHA / INC, v01 au 2019-01-04) | 10 régions, 58 départements, 360 communes | CC BY-IGO |

- **Import COD-AB** : fonction Edge `admin-import-codab` (téléchargement HDX, simplification ≈ 55 m en base). Relance possible à tout moment, l'import est idempotent.
- **Collecte météo** : `pg_cron` appelle `ingest-forecast` toutes les 3 h (à h+07) pour les 360 communes. Ce sont 8 requêtes de 50 lieux, à 8 variables par lieu, soit environ 2 900 appels Open-Meteo par jour. Une réponse invalide laisse le cache précédent en place : aucune valeur n'est inventée.
- Les fonctions Edge sont protégées par un jeton interne stocké dans `app_settings` (privé), que seules les tâches de la base envoient.
- Déploiement des fonctions : `bash scripts/sync-shared.sh`, puis `supabase functions deploy <nom>`.
