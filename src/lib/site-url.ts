/**
 * Domain-independent site origin.
 * Priority: Admin "Primary website URL" (store_settings.site_url) → SITE_URL env (server) → current request/browser origin.
 * Never hardcode a hosting domain.
 */

/** Normalise user input to "https://host[:port]" (no path, no trailing slash). Returns null when invalid. */
export function normalizeSiteUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") && u.hostname !== "localhost") return null;
    const proto = u.hostname === "localhost" ? u.protocol : "https:"; // production domains always HTTPS
    return `${proto}//${u.host.toLowerCase()}`;
  } catch {
    return null;
  }
}

/** Origin of an incoming request, honouring reverse proxies (X-Forwarded-Host/Proto). */
export function requestOrigin(req: Request): string {
  const u = new URL(req.url);
  const fh = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const fp = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = fh || u.host;
  const proto = fp ? `${fp}:` : host.startsWith("localhost") ? u.protocol : "https:";
  return `${proto}//${host}`;
}

/** Pick the canonical origin from admin setting, env fallback, then request origin. */
export function resolveSiteUrl(adminValue: string | null | undefined, envValue: string | null | undefined, fallback: string): string {
  return normalizeSiteUrl(adminValue) ?? normalizeSiteUrl(envValue) ?? fallback.replace(/\/+$/, "");
}

/** www ↔ non-www twin check, used to 301 the alternate host to the primary one. */
export function isHostTwin(a: string, b: string): boolean {
  const strip = (h: string) => h.toLowerCase().replace(/^www\./, "");
  return a.toLowerCase() !== b.toLowerCase() && strip(a) === strip(b);
}
