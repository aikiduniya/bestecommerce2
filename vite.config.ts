// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

// SELF_HOSTED=1 builds swap Lovable-only helpers for empty stand-ins (src/selfhost-stubs).
// Lovable's editor/dev builds never set it, so they keep the original helpers.
const SELF_HOSTED = process.env.SELF_HOSTED === "1";
const stub = (f: string) => fileURLToPath(new URL(`./src/selfhost-stubs/${f}`, import.meta.url));
const STUBS: [RegExp, string][] = [
  [/integrations[\\/]supabase[\\/]previewAuthStorage(\.ts)?$/, stub("preview-auth-storage.ts")],
  [/lib[\\/]lovable-error-reporting(\.ts)?$/, stub("lovable-error-reporting.ts")],
  [/integrations[\\/]lovable([\\/]index)?(\.ts)?$/, stub("lovable-auth.ts")],
];
const selfHostStubs: Plugin = {
  name: "selfhost-stubs",
  enforce: "pre",
  resolveId(id, importer) {
    const full = id.startsWith(".") && importer ? fileURLToPath(new URL(id, `file://${importer}`)) : id;
    for (const [re, target] of STUBS) if (re.test(full)) return target;
    return null;
  },
};

export default defineConfig({
  plugins: SELF_HOSTED ? [selfHostStubs] : [],
  // Cloudflare-only SMTP socket module stays external so self-hosted Node builds also succeed.
  vite: { build: { rollupOptions: { external: ["cloudflare:sockets"] } } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
