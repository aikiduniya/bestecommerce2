#!/usr/bin/env bash
# Export a SELF-HOSTED database (for Lovable Cloud use its "Export data" button instead).
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
OUT=${1:-export-$(date +%Y%m%d-%H%M%S).dump}; umask 077
pg_dump "$DATABASE_URL" -Fc -Z 9 --schema=public --schema=auth --schema=storage -f "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "Wrote $OUT (+ .sha256). Contains password hashes — store encrypted."
