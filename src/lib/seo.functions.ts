import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type ProductSeo = {
  title: string; description: string; image: string | null; keywords: string | null; canonical: string | null; noindex: boolean;
  name: string; images: string[]; price: number; currency: string; inStock: boolean; sku: string | null; brand: string | null; category: string | null; store: string;
} | null;

export const getProductSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug).slice(0, 200))
  .handler(async ({ data: slug }): Promise<ProductSeo> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
              if (!key.startsWith("sb_")) return fetch(input, init);
              const h = new Headers(init?.headers);
              if (h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
      },
    });
    // Resolve the base slug, or a translated slug stored in content_translations.
    let { data: p } = await sb.from("products").select("id,name,seo_title,seo_description,short_description,images,meta_keywords,canonical_url,robots_noindex,og_image_url,price,sale_price,sale_starts_at,sale_ends_at,stock,sku,barcode,brand_id,category_id").eq("slug", slug).eq("status", "active").maybeSingle();
    if (!p) {
      const { data: tr } = await sb.from("content_translations").select("entity_id").eq("entity_type", "product").filter("fields->>slug", "eq", slug).limit(1).maybeSingle();
      if (tr) {
        const { data: byId } = await sb.from("products").select("id,name,seo_title,seo_description,short_description,images,meta_keywords,canonical_url,robots_noindex,og_image_url,price,sale_price,sale_starts_at,sale_ends_at,stock,sku,barcode,brand_id,category_id").eq("id", tr.entity_id).eq("status", "active").maybeSingle();
        p = byId;
      }
    }
    const { data: s } = await sb.from("store_settings").select("store_name, currency").eq("id", 1).maybeSingle();
    if (!p) return null;
    const store = s?.store_name ?? "";
    const title = p.seo_title?.trim() || (store ? `${p.name} | ${store}` : p.name);
    const description = (p.seo_description || p.short_description || `Shop ${p.name}${store ? ` at ${store}` : ""}.`).slice(0, 160);
    const img = p.og_image_url?.trim() || p.images?.[0];
    const [b, c] = await Promise.all([
      p.brand_id ? sb.from("brands").select("name").eq("id", p.brand_id).maybeSingle() : Promise.resolve({ data: null }),
      p.category_id ? sb.from("categories").select("name").eq("id", p.category_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const now = Date.now();
    const saleOn = p.sale_price !== null && (!p.sale_starts_at || Date.parse(p.sale_starts_at) <= now) && (!p.sale_ends_at || Date.parse(p.sale_ends_at) > now);
    return {
      title, description, image: img && img.startsWith("https://") ? img : null,
      keywords: p.meta_keywords?.trim() || null, canonical: p.canonical_url?.trim() || null, noindex: p.robots_noindex,
      name: p.name, images: (p.images ?? []).filter((u: string) => u.startsWith("https://")), price: Number(saleOn ? p.sale_price : p.price),
      currency: s?.currency ?? "USD", inStock: p.stock > 0, sku: p.sku ?? p.barcode ?? null, brand: b.data?.name ?? null, category: c.data?.name ?? null, store,
    };
  });
