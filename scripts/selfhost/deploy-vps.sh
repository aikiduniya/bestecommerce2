#!/usr/bin/env bash
# Zero-downtime-ish deploy: pull → build → new release dir → switch symlink → restart → health check → auto-rollback.
# Layout: /srv/store/app (git checkout), /srv/store/releases/<ts>, /srv/store/current -> release
set -euo pipefail
BASE=${BASE:-/srv/store}; APP=$BASE/app; REL=$BASE/releases/$(date +%Y%m%d%H%M%S)
PORT=${PORT:-3000}
RESTART=${RESTART_CMD:-"sudo systemctl restart store"}   # override for non-systemd hosts
cd "$APP"
[ "${NO_PULL:-}" = "1" ] || git pull --ff-only
scripts/selfhost/build-node.sh
# Database: backup first, then apply only new versioned migrations (additive; existing rows untouched)
set -a; . ./.env; set +a
: "${DATABASE_URL:?DATABASE_URL must be in .env for migrations}"
scripts/selfhost/backup.sh
scripts/selfhost/apply-migrations.sh
mkdir -p "$REL" && cp -a .output "$REL/" && cp .env "$REL/.env"
PREV=$(readlink -f "$BASE/current" || true)
PORT=$(grep -E "^PORT=" .env | cut -d= -f2 || echo "$PORT"); PORT=${PORT:-3000}
ln -sfn "$REL" "$BASE/current"
$RESTART
for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/robots.txt" >/dev/null && break; sleep 1; done
if ! curl -fsS "http://127.0.0.1:$PORT/" >/dev/null; then
  echo "Health check failed — rolling back"; [ -n "$PREV" ] && ln -sfn "$PREV" "$BASE/current" && $RESTART; exit 1
fi
ls -1dt "$BASE"/releases/* | tail -n +6 | xargs -r rm -rf
echo "Deployed $REL"
