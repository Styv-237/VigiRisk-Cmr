# Rapport d'audit qualité, sécurité et ergonomie — VigiRisk Cameroun, étape 2

- **Date** : 23 novembre 2026
- **Version auditée** : branche `etape-2`, avant puis après corrections (commit final indiqué en fin de rapport)
- **Périmètre** : ce qui existe aujourd'hui, c'est-à-dire l'accueil météo, la recherche de commune, la localisation GPS, la page « Méthodes et sources », la barre d'onglets, la base Supabase (limites COD-AB, cache météo, collecte planifiée) et les fonctions Edge. Les modules prévus aux étapes 3 à 10 (cours d'eau, comptes, signalements, fil, groupes, modération, notifications, administration) **n'existent pas encore**. Ils sont marqués NON TESTÉ, avec la raison.
- **Règles suivies** : aucune donnée réelle modifiée sans nécessité ; les seules écritures en production sont les migrations de durcissement, une tâche pg_cron de test (supprimée) et deux collectes météo manuelles, non destructives. Aucun test destructif.

## 1. Synthèse

| | Avant audit | Après corrections |
|---|---|---|
| Tests de bout en bout (navigateur réel, build de production) | 38/48 au premier passage, avec plusieurs faux positifs du script lui-même | **48/49** (seul échec : budget 3G lente, voir F02) |
| Tests unitaires (logique météo) | 23/23 | 23/23 |
| Tests base de données (pgTAP : RLS, permissions, recherche, localisation) | 35/35 | **38/38** (3 tests ajoutés) |
| Sondes de sécurité sur l'API réelle (clé publique) | 3 failles moyennes | 0 faille ouverte côté API |
| Typage TypeScript, parité des traductions FR/EN | OK | OK (68 clés de chaque côté) |
| Bundles natifs Android et iOS (Hermes) | non vérifié | compilent (5,0 Mo et 4,8 Mo) |

**L'audit a trouvé deux anomalies critiques, toutes deux corrigées** :
- l'app plantait pour tout utilisateur qui revenait avec des prévisions en cache ;
- les onglets ne fonctionnaient pas du tout.

Aucune n'avait été détectée par les tests de l'étape 2, qui ne couvraient ni le retour d'un utilisateur ni le clic sur les onglets. La batterie de bout en bout ajoutée ici les couvre désormais.

**Verdict** (détail en §9) :
- pour le périmètre de l'étape 2 : **PRÊTE SOUS RÉSERVE DE CORRECTIONS** ;
- pour l'application complète décrite dans le cahier des charges : **NON PRÊTE**.

## 2. Méthode et outils

| Domaine | Outil et méthode |
|---|---|
| Fonctionnel, parcours de bout en bout | Playwright + Chromium sur le **build web de production** servi en local ; 29 scénarios (`scripts/audit/e2e-web.cjs`) |
| Responsive | 10 tailles de 320×640 à 1920×1080, un contexte neuf par taille (émulation téléphone jusqu'à 480 px). Contrôles : débordement horizontal, onglets visibles sans chevauchement, contenu centré ; captures d'écran relues à l'œil |
| Accessibilité | axe-core 4 (WCAG 2.0/2.1/2.2 A et AA) sur 3 écrans ; navigation au clavier ; « réduire les animations » ; zoom texte 200 % |
| Performances | Chargement à froid (réseau rapide et 3G lente émulée à 400 kb/s et 400 ms), LCP, CLS, octets transférés, mémoire JS ; endurance de 3 minutes |
| Sécurité | Sondes HTTP contre l'API réelle avec la clé publique : lecture, écriture, suppression, appels de fonctions privées, injection, requêtes géantes, schémas internes, fonctions Edge sans jeton ou avec un faux jeton, inscription. Avis de sécurité Supabase, `pnpm audit`, recherche de secrets dans le dépôt |
| Base de données | pgTAP sur Postgres 16 + PostGIS local ; requêtes d'intégrité sur la base réelle ; vérification de pg_cron |
| Mobile natif | `expo export` Android + iOS (compilation Hermes complète, contenu des ressources) |

Tous les scripts sont dans le dépôt et relançables. Les commandes sont en fin de rapport.

## 3. Anomalies et vulnérabilités

Niveaux de gravité :
- **CRITIQUE** : bloque la mise en production ;
- **ÉLEVÉ** : problème majeur ;
- **MOYEN** : contournable ;
- **FAIBLE** : mineur.

| # | Gravité | Anomalie | Cause réelle | Statut |
|---|---|---|---|---|
| 1 | **CRITIQUE** | Au retour sur l'app, avec des prévisions en cache, l'écran plante (`t.getTime is not a function`) ; seule une page vide s'affiche. Touche **tous les utilisateurs récurrents**, hors ligne compris. | La date de mise à jour était un objet `Date` ; le cache persistant (JSON) la restitue sous forme de texte. | **CORRIGÉ** : date stockée en texte ISO, convertie à l'affichage. Tests A09, A17, A27. |
| 2 | **CRITIQUE** | Les onglets Groupes, Fil citoyen, Signaler, Profil et Météo ne changeaient pas d'écran : boutons décoratifs. Concerne le web **et** le mobile (même code de routage). | Expo Router n'enregistre comme onglets que les déclencheurs **enfants directs** de la liste d'onglets ; les miens étaient imbriqués dans la carte de verre. | **CORRIGÉ** : verre en calque de fond, déclencheurs enfants directs. Tests A12 à A16 (adresse + écran + état sélectionné). |
| 3 | **ÉLEVÉ** | La page débordait de 180 px à droite : sur téléphone, le navigateur dézoomait tout le contenu, qui paraissait décalé et plus petit. | Halo lumineux décoratif positionné hors écran (`right: -180`) dans un conteneur sans rognage. | **CORRIGÉ** (`overflow: hidden`). 10/10 tailles validées, centrage compris. |
| 4 | **ÉLEVÉ** | En 3G lente, les prévisions n'apparaissaient pas en moins de **120 s**. | L'import racine des polices embarquait les 18 variantes d'Inter, et l'app attendait le chargement de 6 polices TTF (≈ 2 Mo) avant d'afficher quoi que ce soit. | **CORRIGÉ en partie** : sous-ensembles latins WOFF2 (6 × 18 Ko) sans blocage d'affichage sur le web, import poids par poids sur mobile. Résultat : **16,4 s** et 680 Ko transférés (contre 1 538 Ko). Reste au-dessus du budget de 15 s, voir n° 11. |
| 5 | **ÉLEVÉ** | Sans réseau, l'écran restait environ 25 s sur « Chargement » ; sur un réseau 2G qui ne répond pas, il pouvait rester bloqué plusieurs minutes. | Deux couches de nouvelles tentatives empilées (client Supabase : 3 essais ; React Query : 2 essais) et aucun délai maximal par requête. | **CORRIGÉ** : délai de 12 s par requête, une seule relance (React Query), message « Hors connexion » et bouton « Réessayer ». Test A28. |
| 6 | **MOYEN** | Une recherche de 100 000 caractères occupait la base jusqu'à son délai maximal : vecteur de déni de service. | Requête non bornée. | **CORRIGÉ** : tronquée à 64 caractères, réponse en 0,7 s. Test pgTAP et sonde réelle. |
| 7 | **MOYEN** | N'importe qui pouvait télécharger toutes les géométries communales (4,8 Mo par requête). Environ un millier de requêtes épuisent le quota de transfert mensuel de l'offre gratuite. | Droits de lecture sur toute la table. | **CORRIGÉ** : l'API publique n'expose plus que les colonnes utiles ; la localisation passe par une fonction sécurisée qui ne renvoie que le nom. Sonde réelle : refus 401. |
| 8 | **MOYEN** | Recherche sans réseau : liste vide silencieuse ; erreur silencieuse en ouvrant une région. | États d'erreur non gérés. | **CORRIGÉ** : message et bouton « Réessayer ». Test A29. |
| 9 | **MOYEN** | Page introuvable en anglais (« Unmatched Route ») avec un lien vers le plan technique du site. | Écran 404 par défaut d'Expo Router. | **CORRIGÉ** : page 404 bilingue avec retour à l'accueil ; `/_sitemap` non exposé. Tests A24 et A24b. |
| 10 | **MOYEN** | Inscriptions par e-mail **ouvertes** sur Supabase Auth, alors que l'app n'a pas encore de comptes. Pas d'accès aux données (aucune table modifiable par un compte), mais création de comptes fantômes et envoi d'e-mails de confirmation possibles. | Réglage Supabase par défaut. | **À FAIRE (vous)** : tableau de bord Supabase → Authentication → Sign In / Providers → désactiver « Allow new users to sign up » jusqu'à l'étape 4. |
| 11 | **MOYEN** | Chargement web à froid en 3G lente : 16,4 s (budget fixé à 15 s). | ≈ 580 Ko de JavaScript compressé (React Native Web, Expo Router, Supabase, Reanimated). | **À CORRIGER** (étape 9) : service worker (PWA) pour des visites suivantes instantanées et hors ligne ; compression Brotli chez l'hébergeur (≈ −15 %) ; découpage du code. Sur mobile natif, sans objet : le code est dans l'app installée. |
| 12 | **MOYEN** | **Aucune sauvegarde automatique** sur l'offre Supabase gratuite, et mise en pause après 7 jours de faible activité. | Limite de l'offre. | **À FAIRE** : risque faible aujourd'hui (tout se reconstruit : migrations, réimport COD-AB, collecte), **élevé dès l'étape 4** avec les comptes. Prévoir un `supabase db dump` hebdomadaire hors site, ou l'offre Pro. |
| 13 | **MOYEN** | Quota Open-Meteo gratuit compté par IP partagée (constaté épuisé depuis le conteneur de développement). | Offre gratuite sans clé. | **À FAIRE (vous)** : demander une clé non commerciale ; le code l'accepte déjà (`OPEN_METEO_API_KEY`). Les collectes de production réussissent (360/360). |
| 14 | **MOYEN** | Pas de mentions légales ni de politique de confidentialité, alors que l'app web stocke la commune choisie dans le navigateur et envoie une fois les coordonnées GPS pour trouver la commune. | Prévu à l'étape 4. | **À FAIRE** avant toute ouverture publique. Texte court possible dès maintenant (finalité, absence de stockage des coordonnées, licences). |
| 15 | **MOYEN** | Icônes et écran de démarrage d'Expo par défaut. | Modèle de départ. | **À FAIRE** : identité visuelle CEEREMA, bloquant pour la publication sur les stores. |
| 16 | FAIBLE | Langue du document `en` alors que l'interface est en français ; message sans JavaScript en anglais ; pas de description ni de balises de partage. | Gabarit HTML par défaut. | **CORRIGÉ** : `lang` dynamique, gabarit FR, description, Open Graph. Test A26. |
| 17 | FAIBLE | Accessibilité de la barre d'onglets : rôle de liste absent, bouton « + » de rôle « bouton » dans la liste, état sélectionné non exposé sur le web, rangée horaire défilante inaccessible au clavier. | Rôles ARIA incomplets. | **CORRIGÉ** : 0 violation axe-core sur les 3 écrans ; Tab atteint les 5 onglets avec un focus visible. |
| 18 | FAIBLE | « 24 h : 0,7 mm » coupé à la ligne avant le deux-points. | Espaces ordinaires. | **CORRIGÉ** : espaces insécables (typographie française). |
| 19 | FAIBLE | Clé étrangère sans index (avis de performance Supabase). | — | **CORRIGÉ**. Les deux index « inutilisés » le sont faute de trafic : à conserver. |
| 20 | FAIBLE | Le jeton interne des fonctions Edge est comparé sans temps constant. | — | **NON CORRIGÉ, accepté** : jeton aléatoire de 192 bits, attaque temporelle irréaliste à travers Internet. À reprendre au prochain redéploiement. |
| 21 | FAIBLE | Les fonctions Edge déployées contiennent une copie réduite du code partagé : risque d'écart avec le dépôt. | Déploiement fait via l'API de gestion. | **À FAIRE** : redéployer avec `supabase functions deploy` depuis le dépôt. |
| 22 | FAIBLE | `pnpm audit` : une vulnérabilité modérée (minimatch, via @expo/fingerprint). | Outil de build Expo, absent du code livré. | Non exploitable à l'exécution ; corrigée par la prochaine mise à jour d'Expo. |

Le premier passage contenait aussi des **faux positifs de mon propre script de test** : il comptait comme réussis des tests qui renvoyaient un message d'échec, et vérifiait certains onglets sur un texte qui figurait aussi sur l'accueil. Le script a été corrigé et rendu plus strict (adresse, écran et état sélectionné vérifiés) avant les passages suivants.

## 4. Résultats détaillés par domaine (les 15 domaines demandés)

Statuts : RÉUSSI, ÉCHOUÉ, À CORRIGER, NON TESTÉ, BLOQUÉ.

| # | Domaine | Statut | Détail |
|---|---|---|---|
| 01 | Fonctionnalités | RÉUSSI | 29 scénarios de bout en bout : premier lancement, recherche (accents, chiffres romains, sans résultat, injection), région → communes, accueil complet, 48 h, persistance au rechargement, retour depuis la recherche, sources, 5 onglets, GPS accordé, refusé ou hors Cameroun, liens directs, 404, anglais. Aucun bouton décoratif restant. |
| 02 | UI / UX | RÉUSSI | Fidèle à la variante A ; états de chargement, d'erreur et de contenu vide présents ; captures relues. |
| 03 | Responsive | RÉUSSI | 10/10 tailles, de 320 à 1920 px. |
| 04 | Compatibilité | **À CORRIGER** | Chromium testé. **Non testés** : Safari / WebKit et Firefox (moteurs non installés ici), vrais appareils. |
| 05 | Authentification | NON TESTÉ | Pas encore développée (étape 4). Inscriptions ouvertes par défaut : voir n° 10. |
| 06 | Sécurité | RÉUSSI (sous réserve des n° 10 et 14) | Aucune écriture possible avec la clé publique ; fonctions privées refusées ; schémas internes non exposés ; jeton interne invisible ; fonctions Edge refusées sans jeton ; injection SQL neutre (requêtes paramétrées) ; XSS neutre (React échappe le texte) ; aucun secret dans le dépôt. **Non testés** : en-têtes HTTP de sécurité et HTTPS (pas encore d'hébergement, voir §6). |
| 07 | Base de données | RÉUSSI (sous réserve du n° 12) | 428 entités, 0 orpheline, 0 géométrie invalide, 0 doublon, 360/360 communes avec prévision ; pg_cron opérationnel (17 exécutions de test réussies, tâche supprimée ensuite) ; 38 tests pgTAP ; base de 23 Mo. |
| 08 | API et intégrations | RÉUSSI | Open-Meteo : 360/360 communes à chaque collecte manuelle ; HDX : import 428/428 ; délais et nouvelles tentatives maîtrisés. |
| 09 | Performances | **À CORRIGER** | Réseau rapide : prêt en 1,5 s, LCP 1,45 s, CLS 0,035, 680 Ko, 17 Mo de mémoire. 3G lente : 16,4 s (n° 11). Endurance : 1 332 cycles en 3 min, mémoire stable (18 → 18 Mo). |
| 10 | Accessibilité | RÉUSSI (web) | 0 violation axe-core WCAG 2.2 AA ; clavier ; focus visible ; « réduire les animations » respecté ; zoom 200 % sans débordement ; cibles ≥ 44 px. **Non testés** : VoiceOver et TalkBack sur appareil. |
| 11 | Notifications | NON TESTÉ | Pas encore développées (étape 9). |
| 12 | Fichiers et médias | NON TESTÉ | Pas encore développés (étape 5). |
| 13 | Administration | NON TESTÉ | Pas encore développée (étapes 8–9). Aucun bouton d'administration exposé. |
| 14 | Conformité | **À CORRIGER** | Pas de politique de confidentialité ni de mentions légales (n° 14). Pas de cookies, pas de traceur, polices servies localement (aucun appel à Google Fonts), coordonnées GPS non stockées. Licences citées : Open-Meteo CC BY 4.0, COD-AB CC BY-IGO, Inter OFL. |
| 15 | Déploiement | **NON TESTÉ** | Pas encore d'hébergement web ni de build pour les stores. Voir §6. |

### Mobile natif

| Test | Statut | Détail |
|---|---|---|
| Compilation Android et iOS (Hermes) | RÉUSSI | 1 893 et 1 793 modules ; les 6 polices Inter utilisées sont embarquées, et non plus les 18. |
| Installation, premier lancement, autorisation de localisation, arrière-plan, fermeture forcée, interruptions, batterie | **BLOQUÉ** | Aucun appareil ni émulateur dans cet environnement. À faire sur un build de développement EAS, sur un Android d'entrée de gamme et sur un iPhone. |
| Effet de verre natif (iOS 26), flou (iOS < 26), repli opaque (Android) | BLOQUÉ | Idem : vérification visuelle sur appareil nécessaire. |

## 5. Corrections effectuées

Code de l'application :
- **Cache** : date stockée en texte ISO (`src/lib/data.ts`, accueil, sources).
- **Barre d'onglets** : restructurée ; rôles `tablist` et `tab` ; `aria-selected`.
- **Fond d'écran** : rognage des halos (`overflow: hidden`).
- **Polices** :
  - web : sous-ensembles WOFF2 (`public/fonts`, licence OFL jointe), `font-display: swap`, polices de repli, préchargement des deux principales ;
  - mobile : import poids par poids (`src/lib/fonts.ts`, `fonts.web.ts`).
- **Réseau** : délai de 12 s par requête, une seule couche de nouvelles tentatives (`src/lib/supabase.ts`, `src/lib/data.ts`, `_layout.tsx`).
- **États** : chargement avec texte, erreurs de recherche et de région avec « Réessayer ».
- **Page 404** bilingue (`+not-found.tsx`).
- **Gabarit HTML** : `lang="fr"` puis langue dynamique, description, Open Graph, message sans JavaScript bilingue (`public/index.html`).
- **Rangée horaire** atteignable au clavier.
- **Typographie** : espaces insécables (`packages/core`).

Base de données (migration `20261123000005_durcissement_audit.sql`, appliquée et vérifiée sur la base réelle) :
- recherche bornée à 64 caractères ;
- géométries retirées de l'API publique ;
- `commune_at` sécurisée ;
- index sur `parent_pcode`.

Tests :
- `scripts/audit/e2e-web.cjs` : 49 tests de bout en bout ;
- `scripts/audit/i18n-parity.cjs` : parité des traductions ;
- 3 tests pgTAP supplémentaires.

## 6. Avant toute mise en ligne publique du site web

L'hébergement n'est pas encore choisi. Quel qu'il soit, il faudra configurer :
- le **renvoi des routes inconnues vers `index.html`** (application monopage), indispensable pour que `/communes`, `/sources`, etc. fonctionnent en accès direct ;
- **HTTPS** et les en-têtes `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` et une `Content-Security-Policy` qui n'autorise que `self` et `https://yhdrtprdhlktvwqeusrf.supabase.co` ;
- la compression **Brotli**, et un cache long et immuable pour `/_expo/static/*` et `/fonts/*` (noms de fichiers versionnés).

Je pourrai préparer cette configuration dès que vous aurez choisi l'hébergeur (EAS Hosting, Vercel, Netlify…).

## 7. Ce qui reste à faire, par ordre de priorité

1. Fermer les inscriptions Supabase jusqu'à l'étape 4 (n° 10), **5 minutes, vous**.
2. Demander une clé Open-Meteo non commerciale (n° 13), **vous**.
3. Rédiger une politique de confidentialité courte et des mentions légales (n° 14), **vous ou un juriste, je peux proposer un texte**.
4. Mettre en place une sauvegarde hebdomadaire hors site avant l'étape 4 (n° 12).
5. Tester sur de vrais appareils, Android d'entrée de gamme et iPhone (build de développement EAS), et sur Safari et Firefox.
6. Créer l'identité visuelle (icône, écran de démarrage) pour les stores (n° 15).
7. Ajouter un service worker et ajuster l'hébergement pour la 3G (n° 11), prévu à l'étape 9.

## 8. Comment relancer l'audit

```bash
pnpm --filter @vigirisk/core test
```

```bash
pnpm test:db
```

```bash
pnpm test:i18n
```

```bash
cd apps/app && npx expo export --platform web && npx serve -s dist -l 8092
```

```bash
AUDIT_URL=http://localhost:8092 node scripts/audit/e2e-web.cjs audit-out
```

`AUDIT_ONLY=C` ne relance que les tests responsive. Les captures et `resultats.json` sont écrits dans `audit-out/`.

## 9. Verdict

**Périmètre de l'étape 2 (accueil météo public, en lecture seule) : PRÊTE SOUS RÉSERVE DE CORRECTIONS.**

Les deux anomalies critiques et les trois élevées sont corrigées et revérifiées. L'API publique ne laisse ni écrire, ni lire de données privées. Les parcours, le responsive et l'accessibilité web passent intégralement. Restent avant une ouverture au public :
- fermer les inscriptions ;
- publier une politique de confidentialité ;
- obtenir une clé Open-Meteo ;
- configurer l'hébergement (§6) ;
- tester sur de vrais téléphones.

**Application complète (cahier des charges VigiRisk) : NON PRÊTE POUR LA PRODUCTION.** Les étapes 3 à 10 restent à construire (vigilance crues, comptes, signalements, fil, groupes, modération, notifications, administration). Chacune devra repasser cet audit, avec en plus les tests d'authentification, de permissions entre utilisateurs, de modération et de notifications.
