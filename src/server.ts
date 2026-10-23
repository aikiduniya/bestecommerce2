import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/** Admin-managed 301/302 redirects, checked only for paths that would otherwise 404. */
async function findRedirect(request: Request): Promise<Response | null> {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const { publicClient } = await import("./lib/public-db");
    const { data } = await publicClient().from("redirects").select("to_path, status_code").eq("from_path", path).eq("is_active", true).maybeSingle();
    if (!data) return null;
    const to = /^https?:\/\//.test(data.to_path) ? data.to_path : new URL(data.to_path, url.origin).toString();
    return new Response(null, { status: data.status_code === 302 ? 302 : 301, headers: { Location: to } });
  } catch {
    return null;
  }
}

let primaryCache: { at: number; url: string | null; enforce: boolean } | null = null;
/** 301 www/non-www twin hosts and plain-HTTP requests on the primary host to the Admin primary URL (opt-in). */
async function primaryHostRedirect(request: Request): Promise<Response | null> {
  try {
    if (!primaryCache || Date.now() - primaryCache.at > 60_000) {
      const { publicClient } = await import("./lib/public-db");
      const { data } = await publicClient().from("store_settings").select("site_url, enforce_primary_host").eq("id", 1).maybeSingle();
      primaryCache = { at: Date.now(), url: data?.site_url ?? null, enforce: !!data?.enforce_primary_host };
    }
    if (!primaryCache.enforce || !primaryCache.url) return null;
    const { isHostTwin, requestOrigin } = await import("./lib/site-url");
    const primary = new URL(primaryCache.url);
    const cur = new URL(requestOrigin(request));
    const twin = isHostTwin(cur.host, primary.host);
    const insecure = cur.host === primary.host && cur.protocol === "http:" && primary.protocol === "https:";
    if (!twin && !insecure) return null;
    const u = new URL(request.url);
    return new Response(null, { status: 301, headers: { Location: `${primary.origin}${u.pathname}${u.search}` } });
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      if (request.method === "GET" || request.method === "HEAD") {
        const hostRedirect = await primaryHostRedirect(request);
        if (hostRedirect) return hostRedirect;
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      if (response.status === 404 && request.method === "GET") {
        const target = await findRedirect(request);
        if (target) return target;
      }
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
