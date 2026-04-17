#!/usr/bin/env bash
# Regenerate functions_export.sql and triggers_export.sql from the live DB.
# Produces output in the exact format of the originals:
#   - functions_export.sql: back-to-back `CREATE OR REPLACE FUNCTION ...` blocks
#   - triggers_export.sql:  one `CREATE TRIGGER ...;` per line
#
# Usage:
#   ./scripts/regenerate-sql-exports.sh                 # auto-detect local Docker container
#   DB_CONTAINER=my_db_container ./scripts/regenerate-sql-exports.sh
#   PGHOST=... PGUSER=... PGDATABASE=... PGPASSWORD=... ./scripts/regenerate-sql-exports.sh --direct
#
# Requires psql available either inside the detected Docker container, or on PATH when using --direct.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTIONS_FILE="$REPO_ROOT/functions_export.sql"
TRIGGERS_FILE="$REPO_ROOT/triggers_export.sql"

FUNCTIONS_SQL=$(cat <<'SQL'
SELECT pg_get_functiondef(p.oid) || E'\n'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_depend d
  ON d.objid = p.oid
 AND d.deptype = 'e'          -- depends on an extension
WHERE n.nspname = 'public'
  AND p.prokind = 'f'          -- regular functions (not aggregates/procedures/window)
  AND d.objid IS NULL          -- exclude extension-owned functions
ORDER BY p.proname, p.oid;
SQL
)

TRIGGERS_SQL=$(cat <<'SQL'
SELECT pg_get_triggerdef(t.oid) || ';'
FROM pg_trigger t
JOIN pg_class c     ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal       -- exclude FK / constraint internal triggers
ORDER BY c.relname, t.tgname;
SQL
)

run_psql() {
  local query="$1"
  if [[ "${MODE:-docker}" == "direct" ]]; then
    psql -X -At -v ON_ERROR_STOP=1 -c "$query"
  else
    docker exec -i -e PGPASSWORD="${PGPASSWORD:-postgres}" "$DB_CONTAINER" \
      psql -X -At -v ON_ERROR_STOP=1 \
        -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" \
        -c "$query"
  fi
}

detect_container() {
  # Prefer explicit env var
  if [[ -n "${DB_CONTAINER:-}" ]]; then
    return
  fi
  # Standard Supabase local Docker container name patterns
  local candidates
  candidates=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -E '^(supabase[-_]db|supabase_db_)' || true)
  local count
  count=$(echo "$candidates" | grep -c . || true)
  if [[ "$count" -eq 1 ]]; then
    DB_CONTAINER="$candidates"
  elif [[ "$count" -gt 1 ]]; then
    echo "ERROR: multiple Supabase DB containers found:" >&2
    echo "$candidates" >&2
    echo "Set DB_CONTAINER=<name> to disambiguate." >&2
    exit 1
  else
    echo "ERROR: no Supabase DB container detected. Is Docker running?" >&2
    echo "Set DB_CONTAINER=<name> or use --direct with PG* env vars." >&2
    exit 1
  fi
}

MODE="docker"
if [[ "${1:-}" == "--direct" ]]; then
  MODE="direct"
  export MODE
else
  detect_container
  echo "Using Docker container: $DB_CONTAINER"
fi

echo "Regenerating $FUNCTIONS_FILE ..."
run_psql "$FUNCTIONS_SQL" > "$FUNCTIONS_FILE"

echo "Regenerating $TRIGGERS_FILE ..."
run_psql "$TRIGGERS_SQL" > "$TRIGGERS_FILE"

FN_COUNT=$(grep -c '^CREATE OR REPLACE FUNCTION' "$FUNCTIONS_FILE" || true)
TRG_COUNT=$(grep -c '^CREATE TRIGGER'          "$TRIGGERS_FILE"  || true)

echo ""
echo "Done."
echo "  Functions: $FN_COUNT  ($FUNCTIONS_FILE)"
echo "  Triggers:  $TRG_COUNT  ($TRIGGERS_FILE)"
echo ""
echo "Diff against previous committed versions:"
(cd "$REPO_ROOT" && git diff --stat -- functions_export.sql triggers_export.sql) || true