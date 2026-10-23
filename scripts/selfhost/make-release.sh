#!/usr/bin/env bash
# Build the standalone self-hosting ZIP from this project WITHOUT changing the project itself.
# The staged copy has every Lovable package, editor helper and Lovable sign-in broker removed.
# Usage: scripts/selfhost/make-release.sh [/tmp/out.zip]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
OUT=${1:-/tmp/store-selfhost-$(date +%Y-%m-%d).zip}
STAGE=$(mktemp -d)/store
mkdir -p "$STAGE"
rsync -a "$ROOT"/ "$STAGE"/ \
  --exclude node_modules --exclude .git --exclude .env --exclude .lovable --exclude .workspace \
  --exclude .tanstack --exclude .output --exclude dist --exclude .wrangler --exclude tsconfig.tsbuildinfo \
  --exclude /supabase --exclude roadmap.md --exclude AGENTS.md --exclude '*.bak' --exclude bun.lock --exclude bunfig.toml
cd "$STAGE"
S=scripts/selfhost/standalone

# 1. Standard Vite config (no @lovable.dev/vite-tanstack-config)
cp $S/vite.config.ts vite.config.ts
# 2. No Lovable editor session broker / sign-in broker / stubs
cp $S/previewAuthStorage.ts src/integrations/supabase/previewAuthStorage.ts
rm -rf src/integrations/lovable src/selfhost-stubs
# 3. Error reporting without the Lovable editor hook
rm -f src/lib/lovable-error-reporting.ts && cp $S/error-reporting.ts src/lib/error-reporting.ts
sed -i 's#\.\./lib/lovable-error-reporting#../lib/error-reporting#; s#reportLovableError#reportError#g' src/routes/__root.tsx
# 4. Google sign-in only through the owner's own auth server
python3 - <<'PY'
import re,io
p="src/routes/auth.tsx"; s=open(p).read()
new='''  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/auth" } });
    if (error) toast.error(error.message);
  }

  return ('''
s2=re.sub(r"  async function google\(\) \{.*?\n  \}\n\n  return \(", new, s, count=1, flags=re.S)
assert s2!=s; open(p,"w").write(s2)
PY
# 5. package.json without Lovable packages
node -e '
const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json"));
p.name="store-selfhost";
for (const k of ["dependencies","devDependencies"]) for (const d of Object.keys(p[k]||{})) if (d.startsWith("@lovable.dev/")) delete p[k][d];
fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n");'
sed -i '/SELF_HOSTED=1/d' scripts/selfhost/build-node.sh
cp docs/self-hosting/RELEASE.md START-HERE.md
cp docs/self-hosting/RELEASE.md README.md
sed -i 's#Unset = Lovable broker\.#Google sign-in always uses your own auth server in this package.#' .env.example
sed -i 's#foo\.lovable\.app#foo.other-host.app#' src/lib/site-url.test.ts
rm -rf $S scripts/selfhost/make-release.sh

# Fail if anything Lovable-specific is left in code/config
if grep -rIl -E "@lovable\.dev|integrations/lovable|lovable-error-reporting|cloud-auth-js|vite-tanstack-config|lovable\.dev/|__lovable|lovable\.app" \
     --exclude-dir=docs --exclude=START-HERE.md --exclude=README.md . ; then
  echo "Lovable references remain (above)"; exit 1; fi

mkdir -p "$(dirname "$OUT")"; cd ..; rm -f "$OUT"; zip -qr "$OUT" store
echo "Release: $OUT ($(unzip -l "$OUT" | tail -1 | awk '{print $2}') files)"
