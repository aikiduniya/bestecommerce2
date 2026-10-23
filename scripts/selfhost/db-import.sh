#!/usr/bin/env bash
# Restore a Lovable Cloud export (or backup.sh dump) into an INITIALISED Supabase database.
# Restores store data (public schema) + user accounts (auth.users/identities/MFA) without touching Supabase-managed objects.
# Usage: DATABASE_URL=... scripts/selfhost/db-import.sh path/to/export(.dump|.zst|.tar)
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
SRC=${1:?export file}
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
case "$SRC" in *.zst) zstd -dq "$SRC" -o "$WORK/in.dump"; SRC="$WORK/in.dump";; esac
echo "== Listing archive"; pg_restore -l "$SRC" > "$WORK/all.list"

echo "== 1/3 public schema (structure + data)"
psql "$DATABASE_URL" -tAq -c "select count(*) from information_schema.tables where table_schema='public' and table_name='orders'" | grep -q '^0$' \
  || { echo "public.orders already exists — restore into an EMPTY project (or drop public objects yourself after a backup)."; exit 1; }
pg_restore --no-owner --no-privileges --schema=public -d "$DATABASE_URL" "$SRC" 2> "$WORK/public.err" || true
grep -v -E "already exists|does not exist" "$WORK/public.err" || true

echo "== 2/3 auth accounts (data only)"
for t in users identities mfa_factors; do
  pg_restore --no-owner --data-only --disable-triggers --schema=auth --table=$t -d "$DATABASE_URL" "$SRC" 2>> "$WORK/auth.err" || true
done
grep -v "already exists" "$WORK/auth.err" || true

echo "== 3/3 grants + verification"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role, authenticated;
grant execute on all functions in schema public to anon, authenticated, service_role;
SQL
echo "NOTE: per-table anon/authenticated grants come from the archive; if a page errors with 'permission denied', re-run the GRANT lines of the matching drizzle/migrations file."
psql "$DATABASE_URL" -c "select (select count(*) from public.products) products, (select count(*) from public.orders) orders, (select count(*) from auth.users) users, (select count(*) from public.user_roles where role='admin') admins;"
