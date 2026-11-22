#!/usr/bin/env bash
# Prépare les lots SQL d'import COD-AB pour Supabase (géométries simplifiées, ~50 m, topologie préservée).
# Usage : scripts/import-codab.sh <dossier_geojson> <dossier_sortie>
# Les lots produits (out/codab_XX.sql) s'appliquent dans l'ordre sur la base Supabase (SQL editor, psql ou MCP).
set -euo pipefail
SRC=$1; OUT=$2; mkdir -p "$OUT"
HERE=$(cd "$(dirname "$0")" && pwd)
DB=vigirisk_codab_$$
if [ "$(id -u)" = 0 ] && [ -z "${PGUSER:-}" ]; then RUN=(sudo -u postgres); else RUN=(); fi

python3 "$HERE/names.py"
python3 -I "$HERE/import_codab.py" "$SRC" > "$OUT/raw.sql"

"${RUN[@]}" createdb "$DB"
trap '"${RUN[@]}" dropdb --if-exists "$DB"' EXIT
"${RUN[@]}" psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "create schema extensions"
"${RUN[@]}" psql -X -q -v ON_ERROR_STOP=1 -d "$DB" < "$HERE/../supabase/tests/bootstrap-local.sql"
"${RUN[@]}" psql -X -q -v ON_ERROR_STOP=1 -d "$DB" < "$HERE/../supabase/migrations/20261122000001_territoire_et_meteo.sql"
"${RUN[@]}" psql -X -q -v ON_ERROR_STOP=1 -d "$DB" < "$OUT/raw.sql"

# Simplification : 0.0005° ≈ 55 m à l'équateur, largement suffisant pour rattacher un point à sa commune.
"${RUN[@]}" psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -c "
  update public.admin_areas set geom = extensions.st_multi(extensions.st_makevalid(extensions.st_simplifypreservetopology(geom, 0.0005)));
  select level, count(*), round(sum(extensions.st_npoints(geom))::numeric) as points from public.admin_areas group by level order by level;"

for level in 1 2 3; do
  "${RUN[@]}" psql -X -q -t -A -d "$DB" -c "
    select format(
      'insert into public.admin_areas (pcode, level, parent_pcode, name_codab, name, name_en, geom, anchor, area_sqkm) values (%L, %s, %L, %L, %L, %L, extensions.st_geomfromtext(%L, 4326), extensions.st_geomfromtext(%L, 4326), %s) on conflict (pcode) do update set name = excluded.name, geom = excluded.geom, anchor = excluded.anchor;',
      pcode, level, parent_pcode, name_codab, name, name_en,
      extensions.st_astext(geom, 5), extensions.st_astext(anchor, 5), coalesce(area_sqkm::text, 'null'))
    from public.admin_areas where level = $level order by pcode" > "$OUT/level$level.sql"
done
# Découpe en lots d'environ 700 Ko (limite de taille des requêtes de l'API Supabase).
cat "$OUT/level1.sql" "$OUT/level2.sql" "$OUT/level3.sql" | split -C 700000 -d -a 2 --additional-suffix=.sql - "$OUT/codab_"
ls -la "$OUT"/codab_*.sql
