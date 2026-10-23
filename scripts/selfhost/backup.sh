#!/usr/bin/env bash
# Nightly backup: database (incl. auth users) + storage files. Keeps 14 days. Optional rclone off-site copy.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
DIR=${BACKUP_DIR:-/srv/store/backups}; TS=$(date +%Y%m%d-%H%M%S); mkdir -p "$DIR"; umask 077
pg_dump "$DATABASE_URL" -Fc -Z 9 --schema=public --schema=auth --schema=storage -f "$DIR/db-$TS.dump"
STORAGE_DIR=${STORAGE_DIR:-/opt/supabase/docker/volumes/storage}
[ -d "$STORAGE_DIR" ] && tar -czf "$DIR/storage-$TS.tgz" -C "$STORAGE_DIR" .
find "$DIR" -type f -mtime +14 -delete
[ -n "${RCLONE_REMOTE:-}" ] && rclone copy "$DIR" "$RCLONE_REMOTE" --max-age 25h
echo "Backup done: $DIR/*-$TS.*"
