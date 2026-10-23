#!/usr/bin/env bash
# Restore a backup.sh set into an EMPTY database, all-or-nothing, then verify it against the backup MANIFEST.
# Usage: DATABASE_URL=<superuser URL of empty target db> AGE_IDENTITY=backup.key STORAGE_DIR=<empty dir> \
#        scripts/selfhost/restore.sh /srv/store/backups <TS>
# Optional: CONFIG_OUT (default ./restored-config-TS, mode 700). Exits non-zero on ANY error; prints RESTORE OK only when verified.
set -euo pipefail
die() { echo "RESTORE FAILED: $*" >&2; exit 1; }
: "${DATABASE_URL:?Set DATABASE_URL (empty target database, superuser)}"
DIR=${1:?backup dir}; TS=${2:?backup timestamp}
[ -f "${AGE_IDENTITY:-}" ] || die "AGE_IDENTITY must point to the private age key file"
command -v age >/dev/null || die "install age"
umask 077; WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
(cd "$DIR" && sha256sum --quiet -c "SHA256SUMS-$TS") || die "checksum mismatch / missing files"
M="$DIR/MANIFEST-$TS"; want() { grep "^$1=" "$M" | cut -d= -f2; }
dec() { age -d -i "$AGE_IDENTITY" -o "$WORK/$2" "$DIR/$1" || die "decrypting $1 (wrong key or tampered file)"; }

n=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAq -c "select count(*) from information_schema.tables where table_schema='public' and table_name in ('orders','products')") || die "cannot connect"
[ "$n" = "0" ] || die "target already has store tables — use an empty database"

dec "db-$TS.dump.age" db.dump
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c 'create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions' || die "extensions"
# One transaction: either everything is restored or nothing is. --clean replaces auth/storage objects
# pre-created by the auth/storage services.
pg_restore --no-owner --clean --if-exists --exit-on-error --single-transaction -d "$DATABASE_URL" "$WORK/db.dump" || die "pg_restore error (nothing was committed)"

for k in products orders users objects user_roles migrations; do
  case $k in products) q="public.products";; orders) q="public.orders";; users) q="auth.users";; objects) q="storage.objects";; user_roles) q="public.user_roles";; migrations) q="public._selfhost_migrations";; esac
  got=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAq -c "select count(*) from $q") || die "verify $q"
  [ "$got" = "$(want $k)" ] || die "$q has $got rows, backup had $(want $k)"
  echo "verified $q = $got"
done

if [ "$(want storage_files)" != "external" ]; then
  : "${STORAGE_DIR:?Set STORAGE_DIR}"; mkdir -p "$STORAGE_DIR"
  [ -z "$(ls -A "$STORAGE_DIR")" ] || die "STORAGE_DIR not empty"
  dec "storage-$TS.tar.age" storage.tar; tar -xf "$WORK/storage.tar" -C "$STORAGE_DIR" || die "extract files"
  got=$(find "$STORAGE_DIR" -type f | wc -l); [ "$got" = "$(want storage_files)" ] || die "files: $got restored, backup had $(want storage_files)"
  echo "verified files = $got"
fi
OUT=${CONFIG_OUT:-./restored-config-$TS}; mkdir -p "$OUT"; chmod 700 "$OUT"
dec "config-$TS.tar.age" config.tar; tar -xPf "$WORK/config.tar" --transform "s#^/#$(realpath "$OUT")/#" || die "extract config"
echo "config extracted to $OUT (copy .env back; SMTP_ENCRYPTION_KEY must stay identical)"
echo "RESTORE OK ($TS)"
