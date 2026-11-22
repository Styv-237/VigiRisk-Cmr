#!/usr/bin/env bash
# Copie la logique partagée (packages/core) vers supabase/functions/_shared pour les fonctions Edge (Deno).
# Ne pas modifier les copies : modifier packages/core puis relancer ce script. Un test vérifie qu'elles sont identiques.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in names wmo forecast openmeteo; do
  { echo "// COPIE GÉNÉRÉE de packages/core/src/$f.ts par scripts/sync-shared.sh — ne pas modifier."; cat "packages/core/src/$f.ts"; } > "supabase/functions/_shared/$f.ts"
done
