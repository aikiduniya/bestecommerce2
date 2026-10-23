#!/usr/bin/env bash
# Safe deploy: pull → build → compatibility check → encrypted backup → migrations (all-or-nothing)
#              → new release → restart → health check → automatic app rollback.
# Layout: $BASE/app (git checkout), $BASE/releases/<ts>, $BASE/current -> release, $BASE/deploy.log
# Failure handling:
#   build fails / migration check refuses  -> nothing changed, old release keeps running (exit 2/3)
#   migration fails                        -> its transaction is rolled back, DB unchanged, old release keeps running (exit 4)
#   health check fails after migration     -> app rolled back; schema is backward compatible so the old release works (exit 5)
#   ... after an ALLOW_BREAKING migration  -> app rolled back AND restore instructions printed for the pre-deploy backup (exit 6)
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
set +e; CHECK=$(CHECK_ONLY=1 scripts/selfhost/apply-migrations.sh 2>&1); rc=$?; set -e
echo "$CHECK"; [ $rc -eq 0 ] || { log "migration check refused (rc=$rc) — nothing changed"; exit 3; }
BREAKING=0; grep -q BREAKING_MIGRATION=1 <<<"$CHECK" && BREAKING=1

# 2. encrypted, verified pre-deploy backup (deploy stops if it fails)
SET=$(scripts/selfhost/backup.sh | sed -n 's/^BACKUP_SET=//p'); [ -n "$SET" ] || { log "pre-deploy backup failed — nothing changed"; exit 2; }
log "pre-deploy backup $SET"

# 3. migrations: single transaction
scripts/selfhost/apply-migrations.sh || { log "MIGRATION FAILED — rolled back, DB unchanged, old release still live (backup $SET)"; exit 4; }

# 4. release switch + health check (homepage + DB-backed sitemap)
mkdir -p "$REL" && cp -a .output "$REL/" && cp .env "$REL/.env"
psql "$DATABASE_URL" -tAq -c "select name from public._selfhost_migrations order by 1" > "$REL/MIGRATIONS"; echo "$SET" > "$REL/BACKUP_SET"
PREV=$(readlink -f "$BASE/current" || true)
ln -sfn "$REL" "$BASE/current"; $RESTART
ok=0; for i in $(seq 1 30); do
  curl -fsS -o /dev/null "http://127.0.0.1:$PORT/" && curl -fsS -o /dev/null "http://127.0.0.1:$PORT/sitemap.xml" && { ok=1; break; }; sleep 1; done
if [ $ok -ne 1 ]; then
  log "health check failed — rolling back app to ${PREV:-none}"
  [ -n "$PREV" ] && ln -sfn "$PREV" "$BASE/current" && $RESTART
  if [ $BREAKING -eq 1 ]; then
    log "schema change was NOT backward compatible: restore backup $SET into a new database (scripts/selfhost/restore.sh ${BACKUP_DIR:-/srv/store/backups} $SET) and point the services at it"; exit 6
  fi
  exit 5
fi
ls -1dt "$BASE"/releases/* | tail -n +6 | xargs -r rm -rf
log "deployed $REL (backup $SET)"
