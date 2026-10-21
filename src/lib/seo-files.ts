/** Builders for crawler files. Pure functions so they can be unit-tested. */
export const PRIVATE_PATHS = ["/admin", "/account", "/checkout", "/cart", "/auth", "/order/", "/track", "/compare", "/api/", "/*?q=", "/*?*sort="];

export function buildRobots(custom: string | null | undefined, origin: string): string {
  const body = custom?.trim()
    ? custom.trim()
    : ["User-agent: *", "Allow: /", ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`)].join("\n");
  const blocksAll = /^\s*Disallow:\s*\/\s*$/m.test(body) && !/^\s*Allow:/m.test(body);
  const withoutSitemap = body.replace(/^\s*Sitemap:.*$/gim, "").trim();
  return blocksAll ? withoutSitemap + "\n" : `${withoutSitemap}\n\nSitemap: ${origin}/sitemap.xml\n`;
}

export function langCodes(languages: unknown): string[] {
  if (!Array.isArray(languages)) return [];
  return languages
    .map((l) => (typeof l === "string" ? l : l && typeof l === "object" ? (l as { code?: unknown }).code : null))
    .filter((c): c is string => typeof c === "string" && /^[a-z]{2}$/.test(c) && c !== "en");
}
