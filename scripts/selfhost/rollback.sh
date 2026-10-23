#!/usr/bin/env bash
# Point /srv/store/current at the previous release and restart.
set -euo pipefail
BASE=${BASE:-/srv/store}
CUR=$(readlink -f "$BASE/current")
PREV=$(ls -1dt "$BASE"/releases/* | grep -v "^$CUR$" | head -1)
[ -n "$PREV" ] || { echo "No previous release"; exit 1; }
ln -sfn "$PREV" "$BASE/current" && sudo systemctl restart store
echo "Rolled back to $PREV"
