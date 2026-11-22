# VigiRisk Cameroun

Météo, vigilance crues et réseau social de vigilance citoyenne pour le Cameroun, porté par le **CEEREMA** (Centre d'études et d'expertise sur les risques, l'environnement, la mobilité et l'aménagement).

Application mobile (iOS, Android) et web à partir d'une seule base de code : Expo SDK 58, Expo Router, TypeScript, Supabase.

## État d'avancement

| Étape | Contenu | État |
|---|---|---|
| 0 | Plan, modèle de données, vérification des API et bibliothèques | ✅ livré : [`docs/00-plan-etape-0.md`](docs/00-plan-etape-0.md) |
| 1 | Système de design et maquettes (2 variantes) | 🟡 en revue : [`design/canvas/`](design/canvas/) |
| 2 | Accueil, recherche de commune, prévisions réelles | ⏳ |
| 3–10 | Voir le plan | ⏳ |

Les décisions prises avec CEEREMA sont tenues dans [`docs/01-decisions.md`](docs/01-decisions.md).

## Contenu du dépôt

- `docs/` : plan d'architecture, modèle de données, journal des décisions.
- `design/maquettes-initiales.pdf` : maquettes fournies en amont par CEEREMA.
- `design/canvas/` : sources des planches de l'étape 1 (format `.dc.html`, ouvertes dans le canevas de design en ligne). Les données qui y figurent sont **fictives et marquées « Exemple »**.

## Sources de données prévues

- Prévisions : Open-Meteo (CC BY 4.0, usage non commercial).
- Débits : Open-Meteo Flood API, données GloFAS du Copernicus Emergency Management Service.
- Limites administratives : COD-AB Cameroun (OCHA / INC).
- Quartiers et fond de carte : © contributeurs OpenStreetMap (ODbL), tuiles OpenFreeMap.

> Information indicative. En cas de danger, suivez les consignes des autorités.
