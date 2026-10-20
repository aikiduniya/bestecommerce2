import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/public-db";

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

export const getHomeSeo = createServerFn({ method: "GET" }).handler(async () => {
  const { data } = await publicClient().from("store_settings").select("store_name, tagline, seo_title, seo_description, google_site_verification, og_image_url").eq("id", 1).maybeSingle();
  if (!data) return null;
  return {
    title: data.seo_title || `${data.store_name} — ${data.tagline ?? ""}`,
    description: data.seo_description || data.tagline || "",
    verification: data.google_site_verification?.trim() || null,
    image: data.og_image_url?.startsWith("https://") ? data.og_image_url : null,
  };
});
