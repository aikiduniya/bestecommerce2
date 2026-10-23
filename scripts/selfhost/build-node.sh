#!/usr/bin/env bash
# Build the store as a standalone Node.js server in ./.output (run from the project root).
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f .env ] || { echo "Missing .env (copy .env.example)"; exit 1; }
set -a; . ./.env; set +a
for v in VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SMTP_ENCRYPTION_KEY; do
  [ -n "${!v:-}" ] || { echo "Missing $v in .env"; exit 1; }
done
export NITRO_PRESET="${NITRO_PRESET:-node-server}"
export SELF_HOSTED=1   # strip Lovable-only helpers from this build
if command -v bun >/dev/null; then bun install --frozen-lockfile || bun install; else npm install --legacy-peer-deps; fi
npx vite build
# SMTP on Node uses nodemailer (loaded at runtime, not bundled).
if [ "$NITRO_PRESET" = "node-server" ]; then [ -f .output/server/package.json ] || echo '{"private":true}' > .output/server/package.json; (cd .output/server && npm install --prefix . --no-save --omit=dev nodemailer@6 >/dev/null); fi
echo "Built .output/ (preset: $NITRO_PRESET). Start with: node .output/server/index.mjs"
