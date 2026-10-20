import { createFileRoute } from "@tanstack/react-router";
import { originOf, publicClient, xmlEscape } from "@/lib/public-db";

// Public Google Merchant Center product feed (RSS 2.0 + g: namespace). Read-only, public catalog data only.
export const Route = createFileRoute("/api/public/merchant-feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const o = originOf(request);
        const sb = publicClient();
        const [{ data: s }, { data: products }, { data: brands }] = await Promise.all([
          sb.from("store_settings").select("store_name, tagline, currency").eq("id", 1).maybeSingle(),
          sb.from("products").select("id, name, slug, sku, short_description, description, price, stock, images, brand_id").eq("status", "active").limit(5000),
          sb.from("brands").select("id, name"),
        ]);
        const cur = s?.currency ?? "USD";
        const items = (products ?? []).map((p) => {
          const brand = brands?.find((b) => b.id === p.brand_id)?.name ?? s?.store_name ?? "";
          return `<item><g:id>${xmlEscape(p.sku || p.id)}</g:id><title>${xmlEscape(p.name)}</title><description>${xmlEscape((p.short_description || p.description || p.name).slice(0, 5000))}</description><link>${xmlEscape(`${o}/product/${p.slug}`)}</link>${p.images?.[0] ? `<g:image_link>${xmlEscape(p.images[0])}</g:image_link>` : ""}<g:price>${Number(p.price).toFixed(2)} ${cur}</g:price><g:availability>${p.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability><g:condition>new</g:condition><g:brand>${xmlEscape(brand)}</g:brand></item>`;
        });
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${xmlEscape(s?.store_name ?? "Store")}</title><link>${xmlEscape(o)}</link><description>${xmlEscape(s?.tagline ?? "")}</description>\n${items.join("\n")}\n</channel></rss>`;
        return new Response(xml, { headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" } });
      },
    },
  },
});
