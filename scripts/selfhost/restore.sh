#!/usr/bin/env bash
# Restore a backup.sh set into an EMPTY, initialised database (auth + storage services already set up once).
# Usage: DATABASE_URL=... STORAGE_DIR=... scripts/selfhost/restore.sh /srv/store/backups YYYYMMDD-HHMMSS
# Never run against the live database without a fresh backup.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL (target database)}"
DIR=${1:?backup dir}; TS=${2:?timestamp, e.g. 20261023-020000}
cd "$DIR"; sha256sum -c "SHA256SUMS-$TS"
psql "$DATABASE_URL" -tAq -c "select count(*) from information_schema.tables where table_schema='public' and table_name='orders'" | grep -q '^0$' \
  || { echo "Target already has store tables — restore into an empty database."; exit 1; }
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions'
# auth/storage tables already created by their services: replace their rows; public: full structure + data
pg_restore --no-owner --clean --if-exists -d "$DATABASE_URL" "db-$TS.dump" 2> /tmp/restore-$TS.err || true
grep -v -E "already exists|does not exist|must be owner" /tmp/restore-$TS.err || true
psql "$DATABASE_URL" -c "select (select count(*) from public.products) products, (select count(*) from public.orders) orders, (select count(*) from auth.users) users, (select count(*) from storage.objects) files, (select count(*) from public.user_roles where role='admin') admins;"

if [ -f "storage-$TS.tgz" ]; then : "${STORAGE_DIR:?Set STORAGE_DIR to restore files}"; mkdir -p "$STORAGE_DIR"; tar -xzf "storage-$TS.tgz" -C "$STORAGE_DIR"; echo "Files restored to $STORAGE_DIR"; fi
if [ -f "config-$TS.tgz.enc" ]; then
  : "${BACKUP_PASSPHRASE:?Set BACKUP_PASSPHRASE}"; openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "config-$TS.tgz.enc" -out "/tmp/config-$TS.tgz"; C="/tmp/config-$TS.tgz"
else C="config-$TS.tgz"; fi
[ -f "$C" ] && { mkdir -p "/tmp/config-$TS"; tar -xzPf "$C" --transform "s#^/#/tmp/config-$TS/#"; echo "Config extracted to /tmp/config-$TS (copy .env back; keep SMTP_ENCRYPTION_KEY identical)"; }
echo "Restore complete."
