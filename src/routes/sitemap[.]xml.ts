import { createFileRoute } from "@tanstack/react-router";
import { originOf, publicClient, xmlEscape } from "@/lib/public-db";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const o = originOf(request);
        const sb = publicClient();
        const [pr, pg, bp] = await Promise.all([
          sb.from("products").select("slug, updated_at").eq("status", "active"),
          sb.from("pages").select("slug, updated_at").eq("is_published", true),
          sb.from("blog_posts").select("slug, updated_at").eq("is_published", true),
        ]);
        const urls = [
          { loc: `${o}/` }, { loc: `${o}/shop` }, { loc: `${o}/blog` },
          ...(pr.data ?? []).map((x) => ({ loc: `${o}/product/${x.slug}`, mod: x.updated_at })),
          ...(pg.data ?? []).map((x) => ({ loc: `${o}/pages/${x.slug}`, mod: x.updated_at })),
          ...(bp.data ?? []).map((x) => ({ loc: `${o}/blog/${x.slug}`, mod: x.updated_at })),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${xmlEscape(u.loc)}</loc>${"mod" in u && u.mod ? `<lastmod>${new Date(u.mod).toISOString()}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
