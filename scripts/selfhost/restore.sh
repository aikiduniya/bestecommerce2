#!/usr/bin/env bash
# Staged, all-or-nothing restore of a backup.sh set. Nothing becomes active until EVERYTHING is validated:
#   1. checksums + decrypt + validate all archives in a private temp dir   (nothing touched)
#   2. restore DB into a STAGING database (single transaction) and verify counts against MANIFEST
#   3. extract photos and config into STAGING folders and verify file counts / .env presence
#   4. activate: rename staging DB -> TARGET_DB, move staging folders into place (undone if any step fails)
# Any failure: staging DB dropped, staging folders removed, target untouched, exit 1. "RESTORE OK" only after activation.
# Usage: ADMIN_URL=postgresql://postgres:PW@host:5432/postgres TARGET_DB=store_restored \
#        AGE_IDENTITY=backup.key STORAGE_DIR=/new/dir CONFIG_OUT=/new/config-dir \
#        scripts/selfhost/restore.sh /srv/store/backups <TS>
# TARGET_DB, STORAGE_DIR and CONFIG_OUT must NOT exist yet (restore never overwrites).
set -euo pipefail
die() { echo "RESTORE FAILED: $*" >&2; exit 1; }
: "${ADMIN_URL:?Set ADMIN_URL (superuser URL of the maintenance db, e.g. .../postgres)}"
: "${TARGET_DB:?Set TARGET_DB (new database name)}"; : "${STORAGE_DIR:?Set STORAGE_DIR}"; : "${CONFIG_OUT:?Set CONFIG_OUT}"
DIR=${1:?backup dir}; TS=${2:?backup timestamp}
[[ "$TARGET_DB" =~ ^[a-z_][a-z0-9_]*$ ]] || die "TARGET_DB must be a simple lowercase name"
[ -f "${AGE_IDENTITY:-}" ] || die "AGE_IDENTITY must point to the private age key file"
command -v age >/dev/null || die "install age"
dburl() { local b="${ADMIN_URL%%\?*}"; echo "${b%/*}/$1${ADMIN_URL#"$b"}"; }
SQL() { psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -tAq -c "$1"; }
STAGE_DB="${TARGET_DB}_staging_${TS//-/_}"; STAGE_FILES="$STORAGE_DIR.staging-$TS"; STAGE_CFG="$CONFIG_OUT.staging-$TS"
ACTIVE=0; DB_RENAMED=0; FILES_MOVED=0
umask 077; WORK=$(mktemp -d)
cleanup() {
  rc=$?
  if [ $ACTIVE -eq 0 ]; then
    [ $FILES_MOVED -eq 1 ] && mv "$STORAGE_DIR" "$STAGE_FILES" 2>/dev/null
    [ $DB_RENAMED -eq 1 ] && SQL "alter database \"$TARGET_DB\" rename to \"$STAGE_DB\"" >/dev/null 2>&1
    SQL "drop database if exists \"$STAGE_DB\" with (force)" >/dev/null 2>&1 || echo "WARNING: drop staging database $STAGE_DB manually" >&2
    rm -rf "$STAGE_FILES" "$STAGE_CFG"
    [ $rc -ne 0 ] && echo "Restore aborted — nothing activated, staging cleaned up." >&2
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT

# ---- 0. preconditions (nothing is overwritten)
[ "$(SQL "select count(*) from pg_database where datname in ('$TARGET_DB','$STAGE_DB')")" = "0" ] || die "database $TARGET_DB (or its staging db) already exists"
for p in "$STORAGE_DIR" "$CONFIG_OUT" "$STAGE_FILES" "$STAGE_CFG"; do [ ! -e "$p" ] || die "$p already exists"; done

# ---- 1. integrity + decrypt + validate every archive
(cd "$DIR" && sha256sum --quiet -c "SHA256SUMS-$TS") || die "checksum mismatch / missing files"
M="$DIR/MANIFEST-$TS"; want() { grep "^$1=" "$M" | cut -d= -f2; }
dec() { [ -f "$DIR/$1" ] || die "$1 missing"; age -d -i "$AGE_IDENTITY" -o "$WORK/$2" "$DIR/$1" || die "decrypting $1 (wrong key or tampered file)"; }
dec "db-$TS.dump.age" db.dump; pg_restore -l "$WORK/db.dump" > /dev/null || die "database archive unreadable"
EXT=$(want storage_files)
if [ "$EXT" != "external" ]; then
  dec "storage-$TS.tar.age" storage.tar
  n=$(tar -tvf "$WORK/storage.tar" | grep -c '^-') || n=0; [ "$n" = "$EXT" ] || die "photo archive has $n files, manifest says $EXT"
fi
dec "config-$TS.tar.age" config.tar; tar -tf "$WORK/config.tar" | grep -q '/\.env$' || die "config archive has no .env"
echo "stage 1: all archives decrypted and validated"

# ---- 2. database into staging db
SQL "create database \"$STAGE_DB\"" >/dev/null
U=$(dburl "$STAGE_DB")
psql "$U" -v ON_ERROR_STOP=1 -q -c 'create schema if not exists extensions; create extension if not exists pgcrypto with schema extensions; create extension if not exists "uuid-ossp" with schema extensions' || die "extensions"
pg_restore --no-owner --clean --if-exists --exit-on-error --single-transaction -d "$U" "$WORK/db.dump" || die "pg_restore error"
for kq in products:public.products orders:public.orders users:auth.users objects:storage.objects user_roles:public.user_roles migrations:public._selfhost_migrations; do
  k=${kq%%:*}; q=${kq#*:}; got=$(psql "$U" -v ON_ERROR_STOP=1 -tAq -c "select count(*) from $q") || die "verify $q"
  [ "$got" = "$(want "$k")" ] || die "$q has $got rows, backup had $(want "$k")"
done
echo "stage 2: database restored to staging and verified"

# ---- 3. photos + config into staging folders
if [ "$EXT" != "external" ]; then
  mkdir -p "$STAGE_FILES"; tar -xf "$WORK/storage.tar" -C "$STAGE_FILES" || die "extract photos"
  n=$(find "$STAGE_FILES" -type f | wc -l); [ "$n" = "$EXT" ] || die "photos: $n extracted, expected $EXT"
fi
mkdir -p "$STAGE_CFG"; chmod 700 "$STAGE_CFG"
tar -xPf "$WORK/config.tar" --transform "s#^/#$(realpath "$STAGE_CFG")/#" || die "extract config"
[ -n "$(find "$STAGE_CFG" -name .env -type f)" ] || die "config: .env not extracted"
echo "stage 3: photos and config staged and verified"
[ "${RESTORE_TEST_FAIL_AT:-}" = "activate" ] && die "simulated failure before activation (test hook)"

# ---- 4. activation (each step undone by cleanup on failure)
SQL "alter database \"$STAGE_DB\" rename to \"$TARGET_DB\"" >/dev/null || die "activate database"; DB_RENAMED=1
if [ "$EXT" != "external" ]; then mv "$STAGE_FILES" "$STORAGE_DIR" || die "activate photos"; FILES_MOVED=1; fi
[ "${RESTORE_TEST_FAIL_AT:-}" = "config" ] && die "simulated failure during activation (test hook)"
mv "$STAGE_CFG" "$CONFIG_OUT" || die "activate config"
ACTIVE=1
echo "RESTORE OK ($TS): database $TARGET_DB, photos $STORAGE_DIR, config $CONFIG_OUT (copy .env back; SMTP_ENCRYPTION_KEY must stay identical)"
