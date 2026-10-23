#!/usr/bin/env bash
# Safe deploy: pull → build → compatibility check → encrypted backup → migrations (all-or-nothing)
#              → new release → restart → health check → automatic app rollback.
# Layout: $BASE/app (git checkout), $BASE/releases/<ts>, $BASE/current -> release, $BASE/deploy.log
# Failure handling:
#   build fails / migration check refuses  -> nothing changed, old release keeps running (exit 2/3)
#   migration fails                        -> its transaction is rolled back, DB unchanged, old release keeps running (exit 4)
#   health check fails after migration     -> app rolled back; schema is backward compatible so the old release works (exit 5)
#   rollback itself unhealthy              -> CRITICAL logged, store marked unhealthy (exit 7); never reports success
# Backward-INCOMPATIBLE migrations are NEVER deployed automatically (ALLOW_BREAKING is ignored here):
# use the maintenance-window procedure in INSTALL.md ("Breaking schema changes").
set -euo pipefail
BASE=${BASE:-/srv/store}; APP=$BASE/app; TS=$(date +%Y%m%d%H%M%S); REL=$BASE/releases/$TS
RESTART=${RESTART_CMD:-"sudo systemctl restart store"}
LOG=$BASE/deploy.log; log() { echo "[$(date -Is)] $*" | tee -a "$LOG"; }
cd "$APP"
[ "${NO_PULL:-}" = "1" ] || git pull --ff-only
set -a; . ./.env; set +a
: "${DATABASE_URL:?DATABASE_URL must be in .env}"
PORT=${PORT:-3000}
scripts/selfhost/build-node.sh || { log "build failed — nothing changed"; exit 2; }

# 1. compatibility check before touching anything
set +e; CHECK=$(ALLOW_BREAKING= CHECK_ONLY=1 scripts/selfhost/apply-migrations.sh 2>&1); rc=$?; set -e
echo "$CHECK"; [ $rc -eq 0 ] || { log "migration check refused (rc=$rc) — nothing changed"; exit 3; }

# 2. encrypted, verified pre-deploy backup (deploy stops if it fails)
SET=$(scripts/selfhost/backup.sh | sed -n 's/^BACKUP_SET=//p'); [ -n "$SET" ] || { log "pre-deploy backup failed — nothing changed"; exit 2; }
log "pre-deploy backup $SET"

# 3. migrations: single transaction
ALLOW_BREAKING= scripts/selfhost/apply-migrations.sh || { log "MIGRATION FAILED — rolled back, DB unchanged, old release still live (backup $SET)"; exit 4; }

# 4. release switch + health check (homepage + DB-backed sitemap)
mkdir -p "$REL" && cp -a .output "$REL/" && cp .env "$REL/.env"
psql "$DATABASE_URL" -tAq -c "select name from public._selfhost_migrations order by 1" > "$REL/MIGRATIONS"; echo "$SET" > "$REL/BACKUP_SET"
PREV=$(readlink -f "$BASE/current" || true)
ln -sfn "$REL" "$BASE/current"; $RESTART
ok=0; for i in $(seq 1 30); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/sitemap.xml" && { ok=1; break; }; sleep 1; done
if [ $ok -ne 1 ]; then
  log "health check failed — rolling back app to ${PREV:-none}"
  mv "$REL" "$REL.failed"   # never chosen by rollback.sh
  [ -n "$PREV" ] || { log "CRITICAL: no previous release to return to"; exit 7; }
  ln -sfn "$PREV" "$BASE/current"; $RESTART
  for i in $(seq 1 30); do curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/sitemap.xml" && { log "rolled back to $PREV (healthy); schema change was backward compatible"; exit 5; }; sleep 1; done
  log "CRITICAL: rollback release $PREV is also unhealthy — restore backup $SET (INSTALL.md)"; exit 7
fi
touch "$REL/HEALTHY"
ls -1dt "$BASE"/releases/*/ | tail -n +6 | xargs -r rm -rf
log "deployed $REL (backup $SET)"
