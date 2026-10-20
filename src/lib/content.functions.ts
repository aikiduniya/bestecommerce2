import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
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

const slugOk = (s: string) => /^[a-z0-9-]{1,120}$/.test(s);

export const getPageSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug))
  .handler(async ({ data }) => {
    if (!slugOk(data)) return null;
    const sb = publicClient();
    const [{ data: p }, { data: s }] = await Promise.all([
      sb.from("pages").select("title, seo_title, seo_description, body").eq("slug", data).eq("is_published", true).maybeSingle(),
      sb.from("store_settings").select("store_name").eq("id", 1).maybeSingle(),
    ]);
    if (!p) return null;
    return {
      title: p.seo_title || `${p.title} | ${s?.store_name ?? ""}`,
      description: p.seo_description || p.body.slice(0, 155),
    };
  });

export const getPostSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug))
  .handler(async ({ data }) => {
    if (!slugOk(data)) return null;
    const sb = publicClient();
    const [{ data: p }, { data: s }] = await Promise.all([
      sb.from("blog_posts").select("title, seo_title, seo_description, excerpt, cover_image").eq("slug", data).eq("is_published", true).maybeSingle(),
      sb.from("store_settings").select("store_name").eq("id", 1).maybeSingle(),
    ]);
    if (!p) return null;
    return {
      title: p.seo_title || `${p.title} | ${s?.store_name ?? ""}`,
      description: p.seo_description || p.excerpt || "",
      image: p.cover_image && p.cover_image.startsWith("https://") ? p.cover_image : null,
    };
  });
