import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type ProductSeo = { title: string; description: string; image: string | null } | null;

export const getProductSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug).slice(0, 200))
  .handler(async ({ data: slug }): Promise<ProductSeo> => {
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient(process.env.SUPABASE_URL!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: key.startsWith("sb_")
        ? {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          }
        : undefined,
    });
    const [{ data: p }, { data: s }] = await Promise.all([
      sb.from("products").select("name,seo_title,seo_description,short_description,images").eq("slug", slug).eq("status", "active").maybeSingle(),
      sb.from("store_settings").select("store_name").eq("id", 1).maybeSingle(),
    ]);
    if (!p) return null;
    const store = s?.store_name ?? "";
    const title = p.seo_title?.trim() || (store ? `${p.name} | ${store}` : p.name);
    const description = (p.seo_description || p.short_description || `Shop ${p.name}${store ? ` at ${store}` : ""}.`).slice(0, 160);
    const img = p.images?.[0];
    return { title, description, image: img && img.startsWith("https://") ? img : null };
  });
