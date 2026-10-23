#!/usr/bin/env bash
# Full backup set, restorable with scripts/selfhost/restore.sh:
#   db-TS.dump        all store schemas: public (products, orders, settings, roles, migration log),
#                     auth (accounts, password hashes, 2FA, Google identities), storage (file records)
#   storage-TS.tgz    uploaded files (product photos, media library)
#   config-TS.tgz(.enc) .env (encryption key for saved SMTP/Stripe secrets, site URL, keys) + extra CONFIG_FILES
#   SHA256SUMS-TS     checksums of the three files
# Keeps KEEP_DAYS (14) days. Optional: BACKUP_PASSPHRASE encrypts the config archive; RCLONE_REMOTE copies off-site.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
cd "$(dirname "$0")/../.."
DIR=${BACKUP_DIR:-/srv/store/backups}; TS=$(date +%Y%m%d-%H%M%S); mkdir -p "$DIR"; umask 077
pg_dump "$DATABASE_URL" -Fc -Z 9 --schema=public --schema=auth --schema=storage -f "$DIR/db-$TS.dump"
pg_restore -l "$DIR/db-$TS.dump" >/dev/null   # fails loudly if the dump is unreadable

STORAGE_DIR=${STORAGE_DIR:-/opt/supabase/docker/volumes/storage}
if [ -d "$STORAGE_DIR" ]; then tar -czf "$DIR/storage-$TS.tgz" -C "$STORAGE_DIR" .
else echo "WARNING: STORAGE_DIR=$STORAGE_DIR not found — uploaded files NOT backed up (S3/R2 users: back up the bucket)"; fi

ENV_FILE=${ENV_FILE:-.env}
CFG=(); [ -f "$ENV_FILE" ] && CFG+=("$(realpath "$ENV_FILE")")
for f in ${CONFIG_FILES:-}; do [ -f "$f" ] && CFG+=("$(realpath "$f")"); done
if [ ${#CFG[@]} -gt 0 ]; then
  tar -czPf "$DIR/config-$TS.tgz" "${CFG[@]}"
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    openssl enc -aes-256-cbc -pbkdf2 -salt -pass env:BACKUP_PASSPHRASE -in "$DIR/config-$TS.tgz" -out "$DIR/config-$TS.tgz.enc"
    rm -f "$DIR/config-$TS.tgz"
  fi
else echo "WARNING: no .env found — config NOT backed up (keep SMTP_ENCRYPTION_KEY safe yourself)"; fi

(cd "$DIR" && sha256sum *-"$TS".* > "SHA256SUMS-$TS")
find "$DIR" -type f -mtime +"${KEEP_DAYS:-14}" -delete
[ -n "${RCLONE_REMOTE:-}" ] && rclone copy "$DIR" "$RCLONE_REMOTE" --max-age 25h
echo "Backup done: $DIR/*-$TS*"
