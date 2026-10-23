#!/usr/bin/env bash
# Encrypted, verified backup set (restore with scripts/selfhost/restore.sh). Every file is encrypted with
# age (X25519 + ChaCha20-Poly1305, authenticated) to a PUBLIC key; the private key stays off the server.
#   db-TS.dump.age       schemas public + auth + storage (store data, accounts/2FA, file records)
#   storage-TS.tar.age   uploaded files (STORAGE_DIR)
#   config-TS.tar.age    .env (+ CONFIG_FILES), incl. SMTP_ENCRYPTION_KEY
#   MANIFEST-TS          row/file counts used to verify a restore;  SHA256SUMS-TS  checksums of all of the above
# Required: DATABASE_URL, BACKUP_AGE_RECIPIENTS (file with age public keys, from: age-keygen -o backup.key; age-keygen -y backup.key),
#           STORAGE_DIR (or STORAGE_EXTERNAL=1 if files live in S3/R2 and are backed up there), ENV_FILE (default .env).
# Optional: BACKUP_DIR (/srv/store/backups), KEEP_DAYS (14), CONFIG_FILES, RCLONE_REMOTE (copies only encrypted files, then verifies).
# Prints "BACKUP_SET=<TS>" on success; exits non-zero and leaves nothing behind on any failure.
set -euo pipefail
cd "$(dirname "$0")/../.."
die() { echo "BACKUP FAILED: $*" >&2; exit 1; }
: "${DATABASE_URL:?Set DATABASE_URL}"
command -v age >/dev/null || die "install age (apt install age)"
REC=${BACKUP_AGE_RECIPIENTS:-}; [ -f "$REC" ] || die "BACKUP_AGE_RECIPIENTS must point to a file of age public keys"
grep -q '^AGE-SECRET-KEY' "$REC" && die "BACKUP_AGE_RECIPIENTS contains a PRIVATE key — keep it off the server, use the public key"
ENV_FILE=${ENV_FILE:-.env}; [ -f "$ENV_FILE" ] || die "config file $ENV_FILE missing"
STORAGE_DIR=${STORAGE_DIR:-/opt/supabase/docker/volumes/storage}
[ "${STORAGE_EXTERNAL:-}" = "1" ] || [ -d "$STORAGE_DIR" ] || die "STORAGE_DIR=$STORAGE_DIR missing (set STORAGE_EXTERNAL=1 only if files are in S3/R2)"

umask 077
DIR=${BACKUP_DIR:-/srv/store/backups}; mkdir -p "$DIR"; chmod 700 "$DIR"
TS=$(date +%Y%m%d-%H%M%S); WORK=$(mktemp -d "$DIR/.work-$TS.XXXX")
trap 'rm -rf "$WORK"' EXIT
enc() { age -R "$REC" -o "$WORK/$2" "$1" && rm -f "$1" && [ -s "$WORK/$2" ] || die "encrypting $2"; }

pg_dump "$DATABASE_URL" -Fc -Z 9 --schema=public --schema=auth --schema=storage -f "$WORK/db.dump" || die "pg_dump"
pg_restore -l "$WORK/db.dump" > "$WORK/toc" || die "dump unreadable"
for t in public.products public.orders auth.users storage.objects; do grep -q "TABLE DATA ${t%%.*} ${t#*.} " "$WORK/toc" || die "dump lacks $t"; done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -F= -c "select 'products',count(*) from public.products union all select 'orders',count(*) from public.orders union all select 'users',count(*) from auth.users union all select 'objects',count(*) from storage.objects union all select 'user_roles',count(*) from public.user_roles union all select 'migrations',count(*) from public._selfhost_migrations" > "$WORK/MANIFEST-$TS" || die "counting rows"
enc "$WORK/db.dump" "db-$TS.dump.age"; rm -f "$WORK/toc"

if [ "${STORAGE_EXTERNAL:-}" = "1" ]; then echo "storage_files=external" >> "$WORK/MANIFEST-$TS"
else
  echo "storage_files=$(find "$STORAGE_DIR" -type f | wc -l)" >> "$WORK/MANIFEST-$TS"
  tar -cf "$WORK/storage.tar" -C "$STORAGE_DIR" . || die "tar storage"; enc "$WORK/storage.tar" "storage-$TS.tar.age"
fi
CFG=("$(realpath "$ENV_FILE")"); for f in ${CONFIG_FILES:-}; do [ -f "$f" ] || die "CONFIG_FILES entry $f missing"; CFG+=("$(realpath "$f")"); done
tar -cPf "$WORK/config.tar" "${CFG[@]}" || die "tar config"; enc "$WORK/config.tar" "config-$TS.tar.age"

(cd "$WORK" && sha256sum *-"$TS"* > "SHA256SUMS-$TS")
chmod 600 "$WORK"/*; mv "$WORK"/*-"$TS"* "$DIR"/           # publish the set only when complete
find "$DIR" -maxdepth 1 -type f -mtime +"${KEEP_DAYS:-14}" -delete
if [ -n "${RCLONE_REMOTE:-}" ]; then
  rclone copy "$DIR" "$RCLONE_REMOTE" --include "*-$TS*" || die "off-site copy"
  rclone check "$DIR" "$RCLONE_REMOTE" --include "*-$TS*" --one-way || die "off-site verify"
fi
echo "BACKUP_SET=$TS"
