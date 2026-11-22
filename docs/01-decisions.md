# Journal des décisions

Chaque décision est datée. Elle modifie le plan `00-plan-etape-0.md` quand les deux divergent.

## 22/11/2026 — Réponses de CEEREMA à l'étape 0

| # | Sujet | Décision | Conséquence technique |
|---|---|---|---|
| D1 | Open-Meteo | **Usage non commercial** | Offre gratuite, sans clé, ~10 000 appels/jour. Quota surveillé : collecte par commune et par lots. Le champ de clé API reste prévu en option. |
| D2 | SMS d'authentification | **Aucun budget pour l'instant** | Pas de connexion par code SMS en V1. Proposition à valider : voir Q-A ci-dessous. |
| D3 | Floutage | **Pas de floutage automatique**, ni des photos ni des vidéos. Les conditions d'utilisation rendent l'utilisateur responsable de ne pas exposer de visages sans accord. | Aucun service serveur de traitement d'image. Les métadonnées EXIF sont supprimées **sur le téléphone** par réencodage, après lecture de la date et de la position. Motif d'abus « visage ou plaque visible » et retrait rapide par la modération. La mention « Visages et plaques floutés automatiquement » des maquettes initiales est remplacée. |
| D4 | Conservation des originaux | Sans objet : aucun original n'est conservé côté serveur | Une seule version, compressée, sans EXIF. |
| D5 | Communes et groupes | Groupes de commune au niveau de la commune (ex. « Commune de Douala V »), à partir de COD-AB ADM3. Le créateur choisit librement le nom d'un groupe de quartier. **Aucun doublon** : un nom proche d'un groupe existant redirige vers celui-ci. | Normalisation (accents, tirets, espaces, casse) + similarité `pg_trgm` + proximité géographique ; redirection avant la soumission. La validation par l'administration est conservée, comme le prévoit le brief (point à reconfirmer, voir Q-C). |
| D6 | Petits cours d'eau (Mfoundi, Mefou, Mayo-Tsanaga) | À ma main | Affichés dans la liste avec la mention « Non modélisé de façon fiable », **sans niveau de vigilance indicatif** ; seuls les signalements citoyens et les bulletins officiels y sont rattachés. |
| D7 | Service de traitement d'image | Aucun | Mini-cartes rendues **dans l'app** (MapLibre sur mobile et web, style sombre maison sur les tuiles OpenFreeMap, aucune clé). Carte de partage WhatsApp générée sur le téléphone par capture de vue. |
| D8 | Validation juridique et politique | Non requise par CEEREMA | La liste du §7 du plan reste une recommandation, non bloquante. |
| D9 | Âge minimum, rayons, fenêtres | Pas de réponse | Valeurs par défaut conservées, toutes paramétrables : âge 16 ans, confirmation ≤ 1 km et ≤ 6 h, regroupement ≤ 300 m et ≤ 12 h, position publique à ±150 m. |
| D10 | Vérification automatique | **Désactivée** | Vérification humaine uniquement ; l'indice de crédibilité sert à trier la file. |
| D11 | Comptes et dépôt | Supabase gratuit, **nouveau projet** ; dépôt `Styv-237/VigiRisk-Cmr` ; plugin Expo pour Claude installé | Le projet Supabase sera créé à l'étape 2 (région proposée : eu-west-3, Paris). |

## Questions ouvertes

- **Q-A (authentification sans SMS)** — proposition : code à usage unique par **e-mail**, envoyé via un SMTP gratuit, plus **Google** (et **Apple** sur iOS, exigé par l'App Store dès qu'une connexion tierce est proposée). Le numéro de téléphone devient facultatif ; la vérification par SMS est réactivable plus tard sans changer l'app, grâce au Send SMS Hook de Supabase. Pour compenser l'absence de vérification par téléphone : pré-modération des comptes neufs et limites de publication.
- **Q-B (design)** — quelle variante retenir pour l'accueil, le fil citoyen et l'écran Groupes, ou quel mélange des deux.
- **Q-C (groupes de quartier)** — une demande d'un utilisateur est-elle publiée immédiatement (doublons bloqués automatiquement), ou validée d'abord par l'administration ?

## Point d'attention (non bloquant)

Une clause rendant l'utilisateur seul responsable ne décharge pas entièrement l'hébergeur : CEEREMA reste responsable du traitement des images publiées au sens de la loi n° 2024/017. En pratique : un bouton « Signaler : visage ou plaque visible » sur chaque photo, un retrait sous un délai court fixé dans la charte, et la pré-modération des comptes neufs.

## 22/11/2026 — Réponses aux questions de l'étape 1

| # | Sujet | Décision | Conséquence technique |
|---|---|---|---|
| D12 | Authentification (Q-A) | **Accepté** : code par e-mail + Google, et Apple sur iOS. Pas de SMS tant qu'il n'y a pas de budget. | Étape 4 : Supabase Auth (OTP e-mail via SMTP gratuit, OAuth Google/Apple). Le Send SMS Hook pourra être branché plus tard. Pré-modération des comptes neufs. |
| D13 | Design (Q-B) | **Variante A** pour l'accueil, le fil citoyen et l'écran Groupes. | Implémentée à l'étape 2 pour l'accueil. |
| D14 | Groupes de quartier (Q-C) | **Validation par un administrateur** avant publication. Les doublons sont détectés à la saisie et redirigés vers le groupe existant. | Étape 7 : file `group_requests` dans la modération. |

## 22/11/2026 — Constats de l'étape 2

- **Quota Open-Meteo partagé par adresse IP.** Depuis le conteneur de développement, l'API répondait « Daily API request limit exceeded », car l'IP de sortie est partagée. Depuis Supabase, la première collecte des 360 communes a réussi sans erreur. Mais les IP des fonctions Edge sont elles aussi partagées : si le quota est un jour atteint par d'autres, la collecte échouera et l'app affichera « prévisions anciennes » au-delà de 6 h. Recommandation : demander à Open-Meteo une clé gratuite pour usage non commercial ou humanitaire. Le code accepte déjà une clé via la variable `OPEN_METEO_API_KEY`.
- **Noms COD-AB sans accents** (« Yaounde 7e »). On affiche le nom d'usage (« Yaoundé VII ») et on garde le nom COD-AB pour la recherche : « yaounde 7 », « Yaoundé VII » et « yaounde vii » trouvent tous la commune. Les corrections d'accents (20 noms) sont à relire par CEEREMA : `packages/core/src/names.ts`.
- **Position GPS** : seule la commune est conservée sur le téléphone. Les coordonnées ne sont ni stockées ni transmises, en dehors de l'appel unique qui trouve la commune.
