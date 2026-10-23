#!/usr/bin/env bash
# Apply drizzle/migrations/*.sql in order (fresh install AND every update; already-applied files are skipped).
# All pending files run in ONE transaction: if any statement fails, nothing is applied and the database
# stays exactly as before (exit code 1).
# Compatibility rule (expand/contract): pending migrations must be backward compatible so the PREVIOUS
# app release keeps working on the new schema (that is what makes app rollback safe). Destructive
# statements are refused unless ALLOW_BREAKING=1 (then a rollback also needs a database restore).
# After restoring a Lovable export, run once with BASELINE=1 to mark existing files as applied.
# CHECK_ONLY=1 lists pending files and runs the compatibility check without applying anything.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/postgres}"
cd "$(dirname "$0")/../.."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "create table if not exists public._selfhost_migrations(name text primary key, applied_at timestamptz default now()); revoke all on public._selfhost_migrations from anon, authenticated;"
if [ "${BASELINE:-}" = "1" ]; then
  for f in $(ls drizzle/migrations/*.sql | sort); do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "insert into public._selfhost_migrations(name) values ('$(basename "$f")') on conflict do nothing"; done
  echo "Baseline recorded — future runs apply only newer files."; exit 0
fi
APPLIED=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAq -c "select name from public._selfhost_migrations")
PENDING=(); for f in $(ls drizzle/migrations/*.sql | sort); do grep -qxF "$(basename "$f")" <<<"$APPLIED" || PENDING+=("$f"); done
if [ ${#PENDING[@]} -eq 0 ]; then echo "No pending migrations."
else
  echo "Pending: ${PENDING[*]##*/}"
  BREAK=""; [ -z "$APPLIED" ] || BREAK=$(grep -n -i -E '\b(drop[[:space:]]+(table|column|schema|view|function|type)|rename[[:space:]]+(to|column)|truncate|alter[[:space:]]+column[^;]*[[:space:]]type[[:space:]]|set[[:space:]]+not[[:space:]]+null)\b' "${PENDING[@]}" | grep -v -E ':[0-9]+:[[:space:]]*--' || true)
  if [ -n "$BREAK" ]; then
    echo "Backward-INCOMPATIBLE statements found:"; echo "$BREAK"
    [ "${ALLOW_BREAKING:-}" = "1" ] || { echo "Refusing (set ALLOW_BREAKING=1 only with a verified backup; app rollback will then need a DB restore)."; exit 3; }
    echo "BREAKING_MIGRATION=1"
  fi
  [ "${CHECK_ONLY:-}" = "1" ] && exit 0
  ARGS=(); for f in "${PENDING[@]}"; do ARGS+=(-f "$f" -c "insert into public._selfhost_migrations(name) values ('$(basename "$f")')"); done
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction "${ARGS[@]}" \
    || { echo "MIGRATION FAILED — transaction rolled back, database unchanged."; exit 1; }
  echo "Applied ${#PENDING[@]} migration(s)."
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f scripts/selfhost/seed-defaults.sql   # idempotent default content
echo "Schema up to date."
