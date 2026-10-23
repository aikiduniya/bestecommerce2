import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requestOrigin, resolveSiteUrl } from "./site-url";

/** Canonical site origin for SSR + browser. Admin setting → SITE_URL env (server) → active domain. */
export const currentSiteUrl = createIsomorphicFn()
  .server((adminValue: string | null | undefined) => {
    let fallback = "";
    try { fallback = requestOrigin(getRequest()); } catch { /* no request (prerender) */ }
    return resolveSiteUrl(adminValue, process.env["SITE_URL"], fallback);
  })
  .client((adminValue: string | null | undefined) => resolveSiteUrl(adminValue, null, window.location.origin));
