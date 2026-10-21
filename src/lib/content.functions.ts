import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/public-db";

const slugOk = (s: string) => /^[a-z0-9-]{1,120}$/.test(s);

// Resolve an entity id from a translated slug in content_translations.
async function translatedId(sb: ReturnType<typeof publicClient>, entityType: string, slug: string): Promise<string | null> {
  const { data } = await sb.from("content_translations").select("entity_id").eq("entity_type", entityType).filter("fields->>slug", "eq", slug).limit(1).maybeSingle();
  return data?.entity_id ?? null;
}

export const getPageSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug))
  .handler(async ({ data }) => {
    if (!slugOk(data)) return null;
    const sb = publicClient();
    let { data: p } = await sb.from("pages").select("title, seo_title, seo_description, body, meta_keywords, canonical_url, robots_noindex, og_image_url").eq("slug", data).eq("is_published", true).maybeSingle();
    if (!p) {
      const id = await translatedId(sb, "page", data);
      if (id) {
        const { data: byId } = await sb.from("pages").select("title, seo_title, seo_description, body, meta_keywords, canonical_url, robots_noindex, og_image_url").eq("id", id).eq("is_published", true).maybeSingle();
        p = byId;
      }
    }
    const { data: s } = await sb.from("store_settings").select("store_name").eq("id", 1).maybeSingle();
    if (!p) return null;
    return {
      title: p.seo_title || `${p.title} | ${s?.store_name ?? ""}`,
      description: p.seo_description || p.body.slice(0, 155),
      keywords: p.meta_keywords?.trim() || null, canonical: p.canonical_url?.trim() || null, noindex: p.robots_noindex,
      image: p.og_image_url?.startsWith("https://") ? p.og_image_url : null,
      name: p.title,
    };
  });

export const getPostSeo = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => String(slug))
  .handler(async ({ data }) => {
    if (!slugOk(data)) return null;
    const sb = publicClient();
    let { data: p } = await sb.from("blog_posts").select("title, seo_title, seo_description, excerpt, cover_image, meta_keywords, canonical_url, robots_noindex, og_image_url, author, published_at, updated_at").eq("slug", data).eq("is_published", true).maybeSingle();
    if (!p) {
      const id = await translatedId(sb, "blog_post", data);
      if (id) {
        const { data: byId } = await sb.from("blog_posts").select("title, seo_title, seo_description, excerpt, cover_image, meta_keywords, canonical_url, robots_noindex, og_image_url, author, published_at, updated_at").eq("id", id).eq("is_published", true).maybeSingle();
        p = byId;
      }
    }
    const { data: s } = await sb.from("store_settings").select("store_name").eq("id", 1).maybeSingle();
    if (!p) return null;
    return {
      title: p.seo_title || `${p.title} | ${s?.store_name ?? ""}`,
      description: p.seo_description || p.excerpt || "",
      image: p.cover_image && p.cover_image.startsWith("https://") ? p.cover_image : null,
    };
  });

export const getHomeSeo = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("store_settings").select("store_name, tagline, seo_title, seo_description, google_site_verification, bing_site_verification, og_image_url").eq("id", 1).maybeSingle();
  if (!data) return null;
  return {
    title: data.seo_title || `${data.store_name} — ${data.tagline ?? ""}`,
    description: data.seo_description || data.tagline || "",
    verification: data.google_site_verification?.trim() || null,
    bing: data.bing_site_verification?.trim() || null,
    image: data.og_image_url?.startsWith("https://") ? data.og_image_url : null,
  };
});
