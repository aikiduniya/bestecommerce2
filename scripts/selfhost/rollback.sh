#!/usr/bin/env bash
# Point $BASE/current at the newest previously HEALTHY release (failed releases are skipped), restart, health check.
set -euo pipefail
BASE=${BASE:-/srv/store}; PORT=${PORT:-3000}
CUR=$(readlink -f "$BASE/current")
PREV=""; for d in $(ls -1dt "$BASE"/releases/*/); do d=${d%/}; [ "$d" != "$CUR" ] && [ -f "$d/HEALTHY" ] && { PREV=$d; break; }; done
[ -n "$PREV" ] || { echo "No previous healthy release"; exit 1; }
[ -f "$CUR/MIGRATIONS" ] && [ -f "$PREV/MIGRATIONS" ] && ! diff -q "$PREV/MIGRATIONS" "$CUR/MIGRATIONS" >/dev/null && \
  echo "Note: database has newer migrations than $PREV (backward compatible by policy; if one was applied with ALLOW_BREAKING, restore backup $(cat "$CUR/BACKUP_SET" 2>/dev/null) instead)"
ln -sfn "$PREV" "$BASE/current" && ${RESTART_CMD:-sudo systemctl restart store}
for i in $(seq 1 30); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && { echo "Rolled back to $PREV (healthy)"; exit 0; }; sleep 1; done
echo "Rolled back to $PREV but health check failed"; exit 1
