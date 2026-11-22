# VigiRisk Cameroun — Étape 0 : plan, modèle de données, vérifications, questions

Porteur : CEEREMA · Date : 21 novembre 2026 · Statut : **à valider, aucun code de production écrit**

> **Mise à jour du 22/11/2026** : plusieurs points de ce plan (floutage automatique, service serveur de traitement d’image, mini-cartes générées côté serveur, authentification par SMS) sont remplacés par les décisions de [`01-decisions.md`](01-decisions.md), qui font foi.

---

## 0. Préalable : ce qui manque

- **Maquettes** : le brief parle de captures jointes, mais **aucun fichier n'est arrivé** dans cette session. Merci de les déposer (glisser-déposer dans la conversation ou dans `vigirisk/docs/maquettes/`) avant l'étape 1.
- **Réseau de l'environnement** : `open-meteo.com`, `flood-api.open-meteo.com`, `data.humdata.org` et `tiles.openfreemap.org` sont **bloqués** depuis ce conteneur. Je n'ai donc pas pu appeler les API en direct ; la vérification s'appuie sur la documentation publiée (recherche web) et sur le registre npm. À l'étape 2, je vous proposerai d'ajouter ces hôtes à l'environnement (via une demande d'autorisation, rien n'est changé sans votre accord).

---

## 1. Vérification des bibliothèques et API (21/11/2026)

### 1.1 Bibliothèques (versions relevées sur npm)

| Élément | Version actuelle | Verdict |
|---|---|---|
| Expo SDK | **58** (`expo` 58.0.26) | ✅ À utiliser |
| React Native | 0.88.1 (fourni par le SDK 58) | ✅ |
| Expo Router | 58.0.32 | ✅ (routes typées, export web) |
| react-native-web | 0.21.4 | ✅ |
| Reanimated | 4.8.0 (+ `react-native-worklets` 0.14) | ✅ Reanimated 4 exige la nouvelle architecture et le paquet worklets séparé |
| **expo-glass-effect** | 58.0.5 | ✅ **Existe**. `GlassView` = Liquid Glass natif **iOS 26+ uniquement** ; vérifier `isLiquidGlassAvailable()` avant usage (certaines bêtas iOS 26 plantaient). Ailleurs : simple `View` → c'est à nous de fournir le repli |
| expo-blur | 58.0.6 | ✅ Repli iOS < 26. **Android** : flou coûteux sur l'entrée de gamme → repli verre « opaque teinté » par défaut, flou activé seulement sur appareils performants |
| Skia | 2.14.0 | ⚠️ Excellent sur mobile, mais sur le **web il charge CanvasKit (~3 Mo wasm)**. Proposition : fonds animés en Reanimated + SVG sur mobile, CSS sur le web ; Skia seulement si une variante l'exige, et jamais sur le web |
| victory-native | 43.1.0 | ⚠️ Basé sur Skia → même problème web. **Alternative retenue** : hydrogrammes et graphiques en `react-native-svg` 15.16 + `d3-shape` (léger, identique mobile/web, accessible) |
| MapLibre React Native | 11.5.1 | ⚠️ Fonctionne (Expo ≥ 54), mais ajoute ~10 Mo de SDK natif pour une mini-carte. **Non retenu** (voir 1.3) |
| maplibre-gl (web) | 6.19.0 | Non nécessaire si mini-cartes en image |
| supabase-js | 2.119.2 | ✅ |
| expo-notifications | 58.1.9 | ✅ (service push Expo, gratuit) |
| expo-location / expo-sqlite / expo-localization / expo-image-manipulator | 58.x | ✅ |
| TanStack Query | 5.108.2 | ✅ cache persistant hors ligne |
| i18next / react-i18next | 27.2.3 / 18.0.3 | ✅ |
| zustand | 5.1.0 | ✅ état local léger |
| sharp / onnxruntime-node / pmtiles / maplibre-gl-native | 0.35 / 1.31 / 4.5 / 6.4 | ✅ pour le worker serveur (voir 1.4) |

### 1.2 API et données

| Source | Constat | Conséquence |
|---|---|---|
| **Open-Meteo Forecast** | Gratuit **uniquement non commercial**, sans clé, ~10 000 appels/jour. Usage commercial = abonnement avec clé (prix non confirmé : 15 à 29 €/mois selon les sources, site inaccessible d'ici). Données sous **CC BY 4.0** (attribution obligatoire). | **Question Q1** : statut de CEEREMA. Architecture prévue avec clé facultative ; collecte par lots de coordonnées pour rester sous le quota. |
| **Open-Meteo Flood** | `flood-api.open-meteo.com/v1/flood`, maille ~5 km, renvoie le **plus grand cours d'eau dans un rayon de 5 km** autour du point. Historique depuis 1984, prévisions jusqu'à ~7 mois (saisonnier), ensemble de membres disponible. **Utilise GloFAS v4** alors que **Copernicus a rendu GloFAS v5 opérationnel le 15/07/2026**. | Afficher la version du modèle sur « Méthodes et sources ». Attribution « Copernicus Emergency Management Service » + licence CEMS. |
| **Limite physique de GloFAS** | Le modèle n'est fiable que pour les **grands bassins**. Mfoundi et Mefou (petits bassins urbains de Yaoundé) sont très probablement **mal ou pas représentés** ; le Mayo-Tsanaga aussi (cours d'eau intermittent). | **Question Q6** : les garder avec un avertissement « non modélisé de façon fiable », ou ne les afficher qu'avec les signalements citoyens et les bulletins officiels. |
| **Percentiles P90/P98/P99,5** | L'API ne fournit pas de percentiles climatologiques par point. | Nous les **calculons nous-mêmes** une fois par point à partir de la réanalyse 1984→aujourd'hui (≈15 000 valeurs journalières), stockés en base, recalculés chaque année. Méthode documentée et testée. |
| **NASA GPM IMERG V07** | Early (~4 h de latence) et Late (~14 h) via GES DISC (OPeNDAP, HTTPS, S3), **compte Earthdata obligatoire**. | Étape ultérieure, comme prévu. Le calcul de la cohérence pluie ↔ signalement utilisera d'abord la pluie Open-Meteo (modèle), puis IMERG. |
| **COD-AB Cameroun (HDX)** | Niveaux ADM0 à ADM3, source INC via OCHA, fichier de 2019, revu en octobre 2024. 10 régions (ADM1). **ADM3 = arrondissements**, pas exactement les communes (Douala, Yaoundé, etc. ont des communes d'arrondissement et une communauté urbaine). | **Question Q5** : règle de correspondance arrondissement ↔ commune. Import par script vers PostGIS avec les P-codes. |
| **Quartiers (OSM)** | `place=quarter/neighbourhood/suburb` : couverture inégale, surtout des points (pas de contours). | Le quartier = point + rayon, pas un polygone ; complété par les demandes validées. ODbL : attribution OSM. |
| **ONACC** | Pas d'API. | Saisie admin ou compte partenaire, avec PDF source obligatoire. |
| **Fond de carte** | OpenFreeMap : gratuit, sans clé ni limite, mais « en l'état », sans garantie ; le style sombre est un fork **non listé** dans leur guide (risque de disparition). | **Retenu : Protomaps** — un extrait PMTiles du Cameroun hébergé par nous (aucune dépendance tierce à l'exécution), thème sombre Protomaps, attribution © OpenStreetMap. |
| **SMS (authentification)** | Supabase Auth supporte Twilio, Twilio Verify, MessageBird, Vonage, Textlocal, **et un « Send SMS Hook »** permettant n'importe quel fournisseur (agrégateur local camerounais, Orange/MTN via partenaire). | **Question Q2** (coût). Le hook permet de changer de fournisseur sans toucher à l'app. |
| **Loi n° 2024/017 du 23 décembre 2024** | Crée l'**APDP** (Autorité de protection des données personnelles) ; entrée en vigueur des obligations et sanctions le **23 juin 2026** ; statut du décret d'application **non confirmé**. | Voir §7, liste pour le juriste. |
| **Hébergement Supabase** | Pas de région en Afrique centrale à ma connaissance (à confirmer) ; régions UE les plus proches. | Transfert de données hors du Cameroun → **question juridique Q8**. |

### 1.3 Mini-cartes : solution proposée
Une **image statique générée côté serveur** à la création/mise à jour d'un incident (fond sombre Protomaps + cercle ±150 m), stockée dans Supabase Storage, servie en cache CDN. La **même image** sert de carte de partage WhatsApp. Avantages : 0 Mo de SDK carte dans l'app, fonctionne hors ligne une fois chargée, identique sur mobile et web, aucune clé d'API. Limite : pas de zoom interactif (assumé, conforme à « pas de section carte »).

### 1.4 Traitement des images : solution proposée
Les fonctions Edge Supabase (Deno, mémoire et CPU limités) **ne peuvent pas exécuter de manière fiable** des modèles de détection. Proposition : **un petit worker conteneurisé** (Node + onnxruntime + sharp), sur une petite VM ou un service à la demande (≈5 à 15 €/mois au démarrage), qui lit une file `pgmq` dans Postgres :

1. Le téléphone compresse la photo (≤1600 px, JPEG ~75 %) et envoie séparément les champs EXIF utiles (date, position), puis l'original va dans un **bucket privé de quarantaine**.
2. Le worker lit l'EXIF, détecte **visages** (YuNet ou SCRFD, ONNX, léger) et **plaques** (YOLO ONNX sous licence MIT, `open-image-models`), floute largement (marge +20 %), **réencode sans aucune métadonnée**, calcule l'**empreinte perceptuelle** (pHash) et génère la mini-carte.
3. Il publie la version floutée dans le bucket public et **supprime l'original** (ou le conserve chiffré N jours pour la modération : **question Q4**).

Alternative plus précise mais plus lourde : EgoBlur (Meta, Apache 2.0, Faster R-CNN, ~1 à 3 s/image sur CPU).
**Limites, à connaître** : visages de profil, très petits, flous ou partiellement masqués, et plaques non standard peuvent **échapper à la détection** (taux de manqués de quelques % à >10 % selon les conditions). Aucune solution automatique n'est sûre à 100 % : d'où la pré-modération des comptes neufs et l'outil « flouter une zone » à la main pour les modérateurs. L'EXIF envoyé par le téléphone **peut être falsifié** : il n'est qu'un signal de crédibilité parmi d'autres. **Vidéo** : le floutage image par image coûte cher → **question Q3**.

---

## 2. Architecture

```
┌──────────────────────── Une seule base de code (monorepo pnpm) ───────────────────────┐
│ apps/app      Expo SDK 58 + Expo Router (iOS, Android, Web)                            │
│   (tabs)  meteo · groupes · signaler · fil · profil                                    │
│   (admin) /admin, /partenaires  → web uniquement, protégé par rôle                     │
│ packages/ui         système de design : jetons, GlassCard, TabBar, fonds animés         │
│ packages/core       logique pure testée : vigilance, crédibilité, fiabilité, filtres   │
│                     de modération, arrondi de position, regroupement (Vitest)          │
│ packages/i18n       fr / en                                                            │
│ supabase/           migrations SQL, politiques RLS, tests pgTAP, seeds DEV, Edge Fns   │
│ workers/media       floutage, EXIF, pHash, mini-cartes (Docker)                        │
│ scripts/import      COD-AB → PostGIS, quartiers OSM, points de suivi cours d'eau       │
└────────────────────────────────────────────────────────────────────────────────────────┘

Supabase
 ├ Postgres 15+ : PostGIS, pg_cron, pg_net, pgmq, pgTAP ; RLS sur toutes les tables
 ├ Auth : téléphone + OTP (Send SMS Hook → fournisseur choisi)
 ├ Storage : media-quarantine (privé) · media-public · maps · bulletins (PDF)
 ├ Realtime : Broadcast depuis triggers (canaux par commune, groupe, incident) avec autorisation RLS
 └ Edge Functions : ingest-forecast (toutes les 2 h), ingest-flood (1×/jour, GloFAS est quotidien),
                    compute-vigilance, cluster-incidents, notify (Expo Push), export-open-data,
                    account-export, account-delete
```

**Principes**
- L'app **ne lit que le cache Supabase**, jamais Open-Meteo directement → quota maîtrisé, attribution et horodatage de la source sur chaque donnée.
- Prévisions mises en cache **par commune** (≈360 chefs-lieux), en lots de coordonnées : ~360 points × 12 collectes/jour, soit **~4 300 appels/jour** (Open-Meteo compte davantage d'appels au-delà d'un certain nombre de variables ou de jours : à affiner et à mesurer). La position GPS est ramenée à la commune la plus proche (pas de requête par utilisateur).
- **Hors ligne** : file d'envoi en SQLite (signalements, photos, confirmations), rejouée au retour du réseau avec une clé d'idempotence ; dernières prévisions persistées ; mode économie de données (images basse définition, pas d'auto-chargement vidéo, fond animé coupé).
- **Mode DEV** : seeds fictifs marqués `is_demo = true` + bandeau « DONNÉES DE DÉMONSTRATION » ; en production une contrainte SQL **interdit** `is_demo` et l'app refuse de démarrer si le drapeau est actif.
- **Messagerie privée (V2)** : tables `conversations` et `messages` prévues mais non créées ; elle exigera signalement, blocage, limites anti-harcèlement et une décision de votre part.

---

## 3. Modèle de données (PostgreSQL / PostGIS)

Conventions : `id uuid`, `created_at timestamptz`, géométries en SRID 4326. Positions exactes **dans des tables séparées** à accès restreint.

### Territoire
- `admin_areas` (id, level 1|2|3, pcode, name_fr, name_en, parent_id, geom MultiPolygon, source, source_date)
- `communes` (id, admin3_id, name, chef_lieu Point, region_id) ← correspondance Q5
- `neighbourhoods` (id, commune_id, name, name_normalized, aliases text[], centroid Point, radius_m, source 'osm'|'request', osm_id, status)

### Météo et hydrologie
- `forecast_cache` (commune_id, fetched_at, model, run_at, current jsonb, hourly jsonb 48 h, daily jsonb 10 j, source_attribution) — une ligne par commune, historique court
- `rivers` (id, name, basin)
- `gauge_points` (id, river_id, name, location Point, glofas_reliable bool, active, notes)
- `discharge_forecast` (gauge_id, run_date, day, median, p25, p75, min, max, members jsonb?)
- `discharge_climatology` (gauge_id, period_start, period_end, p50, p90, p98, p995, n_days, computed_at)
- `vigilance_thresholds` (gauge_id nullable = défaut, yellow_pct 'p90', orange 'p98', red 'p995', updated_by)
- `vigilance_indicative` (gauge_id, computed_at, level, max_day, ratio, method_version)
- `official_bulletins` (id, issuer_org_id, title_fr/en, body, level, areas uuid[], valid_from, valid_to, pdf_path, pinned, status, published_by)

### Comptes et confiance
- `profiles` (id = auth.users.id, pseudonym, avatar_path, commune_id, language, birth_year?, created_at, status 'active'|'restricted'|'suspended'|'banned', premod bool)
- `profile_private` (id, phone_e164 (copie Auth), exact_home? **non collecté**) — RLS : propriétaire + admin
- `consents` (user_id, kind 'charter'|'privacy'|'notifications'|'location', version, accepted_at, revoked_at)
- `badges` (user_id, kind 'citizen'|'reliable'|'observer'|'partner', granted_by, granted_at, revoked_at)
- `organizations` (id, kind 'commune'|'onacc'|'protection_civile'|'pompiers'|'ceerema', name, territory_ids uuid[])
- `org_members` (org_id, user_id, role 'editor'|'manager')
- `reliability_scores` (user_id, score 0..1, components jsonb, computed_at) — privé, jamais public
- `follows` (user_id, target_kind 'user'|'commune'|'river'|'group', target_id)

### Signalements et incidents
- `incidents` (id, category, status, commune_id, neighbourhood_id, public_area Point (arrondi + décalé), radius_m 150, started_at, last_activity_at, credibility, verified_at, map_image_path, reject_reason_code)
- `reports` (id, incident_id, author_id, kind 'report'|'update'|'post'|'bulletin', category, water_level 'none'|'ankle'|'knee'|'waist'|'above', update_type 'rising'|'falling'|'reopened', observed_at, description, moderation_state 'pending'|'published'|'hidden'|'removed', client_idempotency_key)
- `report_locations` (report_id, exact Point, accuracy_m, exif_point, exif_time) — **RLS : modération + partenaires habilités du territoire**, accès journalisé
- `media` (id, report_id, kind, state 'quarantine'|'processing'|'ready'|'rejected', public_path, phash bit(64), faces_blurred int, plates_blurred int, width, height)
- `incident_events` (incident_id, kind 'status'|'report'|'official_reply', actor_id, payload, at) — chronologie
- `confirmations` (incident_id, user_id, kind 'confirm'|'not_current', distance_m, at, counted bool) — unique (incident_id, user_id, kind)
- `comments` (id, report_id|incident_id, parent_id (1 niveau, contrainte), author_id, body, moderation_state)
- `reactions` (target, user_id, kind 'useful'), `saves` (user_id, incident_id)
- `categories` (code, label_fr, label_en, icon, active) — gérées par l'admin

### Groupes
- `groups` (id, kind 'region'|'commune'|'neighbourhood', admin_area_id | neighbourhood_id, name, rules_md, member_count)
- `group_members` (group_id, user_id, role 'member'|'moderator', notif 'all'|'mentions_official'|'none', last_read_at)
- `group_messages` (id, group_id, author_id, body, media_id, reply_to, is_official, pinned, moderation_state)
- `group_incident_links` (group_id, incident_id) — alimentée par trigger
- `group_requests` (id, requester_id, commune_id, proposed_name, normalized, near_duplicates uuid[], status, decided_by, reason)
- `useful_contacts` (group_id, label, phone_public, org_id) — contacts institutionnels uniquement

### Modération et conformité
- `abuse_reports` (id, reporter_id, target_kind, target_id, reason_code, note, status)
- `moderation_queue` (id, source 'new_account'|'abuse'|'auto_filter'|'group_hidden'|'group_request'|'appeal', target, priority, due_at, assigned_to, state)
- `moderation_decisions` (id, queue_id, moderator_id, action, reason_code, note, at) — **append-only**
- `appeals` (id, decision_id, user_id, body, status)
- `reason_codes` (code, label_fr, label_en, visible_to_author)
- `rate_limits` (user_id, kind, window_start, count)
- `sensitive_access_log` (actor_id, table, row_id, purpose, at) — append-only
- `data_requests` (user_id, kind 'export'|'delete', status, file_path, expires_at)
- `app_settings` (key, value) — seuils, rayon de confirmation, fenêtre temporelle, âge minimum, durées de conservation, limites quotidiennes

### Notifications
- `push_tokens` (user_id, token, platform, locale), `notification_prefs` (user_id, kind, enabled, quiet_start, quiet_end), `notification_log`

### Règles clés (implémentées en SQL + `packages/core`, toutes testées)
- **Position publique** : arrondi sur une grille de ~150 m + décalage pseudo-aléatoire stable par incident (empêche de retrouver le point exact en recoupant plusieurs signalements).
- **Confirmation comptée** si distance(utilisateur, zone) ≤ R (par défaut 1 km) et Δt ≤ T (par défaut 6 h), un vote par compte, pas l'auteur. La position de l'utilisateur sert au calcul puis n'est **pas** conservée (seule la distance l'est).
- **Regroupement** : nouveau signalement de même catégorie (ou catégorie compatible) à ≤ 300 m et ≤ 12 h d'un incident actif → rattaché ; sinon nouvel incident. Paramétrable.
- **Vigilance indicative** : niveau = max sur l'horizon de la comparaison de la **médiane d'ensemble** (et en option du P75) prévue avec P90/P98/P99,5 du même point ; « pas de donnée » ≠ « vert ».
- **Crédibilité** = combinaison pondérée et bornée (fiabilité de l'auteur, confirmations de proximité, cohérence avec la pluie sur 24 h et avec la vigilance, cohérence EXIF) ; seuil de vérification automatique **désactivé par défaut** (Q10).

---

## 4. Sécurité (RLS) — résumé
- Lecture publique : incidents publiés, rapports publiés, groupes, messages publiés, bulletins actifs, cache météo.
- Écriture : uniquement par l'utilisateur authentifié, consentement à la charte en vigueur requis (vérifié en SQL), limites de débit dans les triggers.
- Contenu `pending` visible seulement par son auteur et la modération.
- `report_locations`, `profile_private`, `reliability_scores`, `sensitive_access_log` : jamais lisibles par le public ; accès partenaire limité à son territoire (intersection PostGIS), et chaque lecture est journalisée via une fonction `security definer`.
- Rôles : `citizen`, `group_moderator` (par groupe), `observer`, `partner_editor`, `moderator`, `admin` — stockés en tables, exposés dans les claims JWT via un Custom Access Token Hook.
- Tests pgTAP : chaque table × chaque rôle × chaque opération.

---

## 5. Découpage en étapes (avec démo et tests à chaque fin d'étape)

| # | Contenu | Démo | Tests |
|---|---|---|---|
| 1 | Système de design (jetons, verre, typographie, barre d'onglets, fonds animés) ; **2 variantes** Accueil / Fil / Groupes, rendues en web | Page web statique + Expo web | contraste WCAG AA automatisé sur les jetons |
| 2 | Monorepo, Supabase local, import COD-AB, ingestion Open-Meteo, Accueil + recherche de commune | App web + Android (Expo Go/dev build) | vigilance pluie, parsing, RLS cache |
| 3 | Cours d'eau, climatologie, hydrogrammes 30 j, vigilance indicative, admin des seuils | Liste + hydrogrammes réels | percentiles, niveaux, cas « pas de donnée » |
| 4 | Auth téléphone, profil, charte, âge minimum, consentements, export et suppression de compte, politique FR/EN | Parcours d'inscription complet | RLS profils, suppression en cascade |
| 5 | Signalement structuré, file hors ligne, worker média (floutage, EXIF, pHash), position approximative, mini-carte | Signalement en mode avion → envoi au retour | arrondi, idempotence, EXIF supprimé |
| 6 | Fil temps réel (À proximité / Abonnements / Officiel), interactions, regroupement, statuts | 2 appareils en temps réel | géorepérage des confirmations, regroupement |
| 7 | Groupes (création auto, demandes de quartier + doublons, discussions, modérateurs locaux) | Groupe Mvog-Ada | normalisation des noms, droits des modérateurs |
| 8 | Modération, fiabilité, anti-abus, espace partenaires, export open data | Tableau de bord web | filtres, restrictions, RLS partenaires |
| 9 | Notifications, plages de silence, accessibilité, performances Android d'entrée de gamme | Profilage sur appareil bas de gamme | règles de silence (sauf rouge) |
| 10 | Publication web / Play / App Store + votre liste d'actions | — | e2e Playwright web |

---

## 6. Proposition de système de design (aperçu, détaillé à l'étape 1)
- **Jetons** : `bg.0 #050B18`, `bg.1 #0B1A33`, `accent.100 #CDEBFF`, `accent.200 #9FD8FF`, `accent.300 #7CC7FF`, `accent.400 #5BB8F5`, `text.primary rgba(255,255,255,.93)`, `text.secondary rgba(205,235,255,.78)`, vigilance `green #4ADE80`, `yellow #F5C451`, `orange #FF9F43`, `red #FF5C5C` + **libellé et pictogramme toujours présents**.
- **Verre** : 3 niveaux (`glass.subtle`, `glass.card`, `glass.chrome` pour la barre d'onglets). Cascade : `GlassView` natif (iOS 26+ si `isLiquidGlassAvailable`) → `BlurView` (iOS plus ancien, Android performant) → fond teinté plus opaque (Android d'entrée de gamme, « réduire la transparence ») → `backdrop-filter: blur(28px) saturate(160%)` sur le web. **Règle de contraste** : le texte posé sur du verre a toujours un voile minimal calculé pour garantir 4,5:1 sur le pire fond possible.
- **Typographie** : Inter (variable), température en Inter 200 à 96 px ; chiffres tabulaires.
- **Badges de source** : « Officiel » (plein, bouclier), « Indicatif · modèle » (contour pointillé), « Citoyen » (contour simple) — formes différentes, pas seulement des couleurs.

---

## 7. À vérifier avec un juriste (loi n° 2024/017, APDP)
1. Formalités préalables auprès de l'APDP (déclaration ou autorisation), notamment pour la **géolocalisation**, les **photos de lieux** (personnes et plaques incidentes) et le traitement par un organisme de recherche.
2. **Transfert hors du Cameroun** (hébergement Supabase en UE, service push Expo/Apple/Google, fournisseur SMS) : conditions, liste des pays « adéquats » publiée par l'APDP, clauses contractuelles.
3. Statut et publication du **décret d'application**.
4. **Âge minimum** et consentement parental.
5. Désignation éventuelle d'un **délégué à la protection des données**.
6. Durées de conservation par catégorie (comptes, positions exactes, médias originaux, journaux de modération).
7. Responsabilité éditoriale de CEEREMA sur les contenus citoyens ; statut juridique des « réponses officielles » des partenaires ; conventions avec l'ONACC, les communes et la Protection civile.
8. Licence de réutilisation de l'export open data (ODbL pour ce qui dérive d'OSM ? CC BY ?).
9. Mentions des licences tierces : CC BY 4.0 (Open-Meteo), CEMS (GloFAS), ODbL (OSM), conditions COD-AB.
