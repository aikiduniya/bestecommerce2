import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requestOrigin, resolveSiteUrl } from "./site-url";

/** Read-only publishable-key client for server code. Call only inside server handlers. */
export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
/** Canonical origin for server output: Admin primary URL → SITE_URL env → active request domain. */
export async function originOf(req: Request): Promise<string> {
  let admin: string | null = null;
  try {
    const { data } = await publicClient().from("store_settings").select("site_url").eq("id", 1).maybeSingle();
    admin = data?.site_url ?? null;
  } catch { /* fall back */ }
  return resolveSiteUrl(admin, process.env["SITE_URL"], requestOrigin(req));
}
