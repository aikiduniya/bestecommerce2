import { createFileRoute } from "@tanstack/react-router";
import { originOf, publicClient, xmlEscape } from "@/lib/public-db";
import { langCodes } from "@/lib/seo-files";

type U = { path: string; mod?: string | null };

// Generated live from the database on every request, so new/edited/unpublished content is reflected automatically.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const o = await originOf(request);
        const sb = publicClient();
        const [st, pr, pg, bp, cat, br, col] = await Promise.all([
          sb.from("store_settings").select("languages").eq("id", 1).maybeSingle(),
          sb.from("products").select("slug, updated_at").eq("status", "active").eq("robots_noindex", false),
          sb.from("pages").select("slug, updated_at").eq("is_published", true).eq("robots_noindex", false),
          sb.from("blog_posts").select("slug, updated_at").eq("is_published", true).eq("robots_noindex", false),
          sb.from("categories").select("slug").eq("is_active", true).eq("robots_noindex", false),
          sb.from("brands").select("slug").eq("is_active", true).eq("robots_noindex", false),
          sb.from("collections").select("slug").eq("is_active", true).eq("robots_noindex", false),
        ]);
        const failed = [pr, pg, bp, cat, br, col].find((r) => r.error);
        if (failed?.error) return new Response("Sitemap unavailable", { status: 503 });
        const langs = langCodes(st.data?.languages);
        const urls: U[] = [
          { path: "/" }, { path: "/shop" }, { path: "/blog" },
          ...(cat.data ?? []).map((x) => ({ path: `/shop?category=${encodeURIComponent(x.slug)}` })),
          ...(br.data ?? []).map((x) => ({ path: `/shop?brand=${encodeURIComponent(x.slug)}` })),
          ...(col.data ?? []).map((x) => ({ path: `/shop?collection=${encodeURIComponent(x.slug)}` })),
          ...(pr.data ?? []).map((x) => ({ path: `/product/${x.slug}`, mod: x.updated_at })),
          ...(pg.data ?? []).map((x) => ({ path: `/pages/${x.slug}`, mod: x.updated_at })),
          ...(bp.data ?? []).map((x) => ({ path: `/blog/${x.slug}`, mod: x.updated_at })),
        ];
        const loc = (l: string | null, p: string) => `${o}${l ? `/${l}${p === "/" ? "" : p}` : p}`;
        const alts = (p: string) =>
          langs.length
            ? [`<xhtml:link rel="alternate" hreflang="en" href="${xmlEscape(loc(null, p))}"/>`, `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(loc(null, p))}"/>`,
               ...langs.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${xmlEscape(loc(l, p))}"/>`)].join("")
            : "";
        const entries = urls.flatMap((u) => [null, ...langs].map((l) =>
          `  <url><loc>${xmlEscape(loc(l, u.path))}</loc>${u.mod ? `<lastmod>${new Date(u.mod).toISOString()}</lastmod>` : ""}${alts(u.path)}</url>`));
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=600" } });
      },
    },
  },
});
