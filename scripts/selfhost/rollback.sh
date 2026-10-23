#!/usr/bin/env bash
# Point /srv/store/current at the previous release and restart.
set -euo pipefail
BASE=${BASE:-/srv/store}
CUR=$(readlink -f "$BASE/current")
PREV=$(ls -1dt "$BASE"/releases/* | grep -v "^$CUR$" | head -1)
[ -n "$PREV" ] || { echo "No previous release"; exit 1; }
[ -f "$CUR/MIGRATIONS" ] && [ -f "$PREV/MIGRATIONS" ] && ! diff -q "$PREV/MIGRATIONS" "$CUR/MIGRATIONS" >/dev/null && \
  echo "Note: database has newer migrations than $PREV (backward compatible by policy; if they were ALLOW_BREAKING, restore backup $(cat "$CUR/BACKUP_SET" 2>/dev/null))"
ln -sfn "$PREV" "$BASE/current" && ${RESTART_CMD:-sudo systemctl restart store}
echo "Rolled back to $PREV"
