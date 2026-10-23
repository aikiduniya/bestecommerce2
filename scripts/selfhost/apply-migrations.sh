#!/usr/bin/env bash
# FRESH INSTALL ONLY: apply drizzle/migrations/*.sql in order to an empty Supabase database.
# Tracks applied files in public._selfhost_migrations so re-runs apply only new files.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL=postgresql://postgres:PASSWORD@host:5432/postgres}"
cd "$(dirname "$0")/../.."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "create table if not exists public._selfhost_migrations(name text primary key, applied_at timestamptz default now()); revoke all on public._selfhost_migrations from anon, authenticated;"
for f in $(ls drizzle/migrations/*.sql | sort); do
  n=$(basename "$f")
  done_=$(psql "$DATABASE_URL" -tAq -c "select 1 from public._selfhost_migrations where name='$n'")
  [ "$done_" = "1" ] && continue
  echo "Applying $n"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$f" -c "insert into public._selfhost_migrations(name) values ('$n')"
done
echo "Schema up to date."
