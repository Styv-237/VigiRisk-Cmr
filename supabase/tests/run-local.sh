#!/usr/bin/env bash
# Applique les migrations sur une base Postgres 16 + PostGIS + pgTAP locale jetable, puis lance les tests pgTAP.
# Prérequis (Ubuntu) : postgresql-16 postgresql-16-postgis-3 postgresql-16-pgtap.
# Variables : PGHOST/PGPORT/PGUSER si besoin (par défaut : cluster local, utilisateur postgres).
set -euo pipefail
cd "$(dirname "$0")/.."

DB=vigirisk_test_$$
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)
if [ "$(id -u)" = 0 ] && [ -z "${PGUSER:-}" ]; then RUN=(sudo -u postgres); else RUN=(); fi

"${RUN[@]}" createdb "$DB"
trap '"${RUN[@]}" dropdb --if-exists "$DB"' EXIT

"${RUN[@]}" "${PSQL[@]}" -d "$DB" -c "create schema if not exists extensions"
"${RUN[@]}" "${PSQL[@]}" -d "$DB" < tests/bootstrap-local.sql
for f in migrations/*.sql; do
  case "$f" in *_remote_only.sql) echo "· ignoré en local : $f"; continue;; esac
  echo "· migration $f"
  "${RUN[@]}" "${PSQL[@]}" -d "$DB" < "$f"
done
"${RUN[@]}" "${PSQL[@]}" -d "$DB" -c "grant usage on schema extensions to anon, authenticated, service_role"

status=0
for t in tests/*.test.sql; do
  echo "· tests $t"
  out=$("${RUN[@]}" psql -X -q -t -A -d "$DB" < "$t" 2>&1) || status=1
  echo "$out"
  if echo "$out" | grep -qE '^not ok|Looks like you failed|ERROR'; then status=1; fi
done
exit $status
