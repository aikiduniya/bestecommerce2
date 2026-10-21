import { createFileRoute } from "@tanstack/react-router";
import { originOf, publicClient } from "@/lib/public-db";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const o = originOf(request);
        const sb = publicClient();
        const [s, pr, pg, bp] = await Promise.all([
          sb.from("store_settings").select("store_name, tagline, seo_description, llms_txt, support_email").eq("id", 1).maybeSingle(),
          sb.from("products").select("slug, name, short_description").eq("status", "active").order("created_at", { ascending: false }).limit(50),
          sb.from("pages").select("slug, title").eq("is_published", true),
          sb.from("blog_posts").select("slug, title").eq("is_published", true).limit(30),
        ]);
        const st = s.data;
        let txt: string;
        if (st?.llms_txt?.trim()) txt = st.llms_txt.trim();
        else {
          const lines = [`# ${st?.store_name ?? "Store"}`];
          const sum = st?.tagline || st?.seo_description;
          if (sum) lines.push("", `> ${sum.replace(/\n/g, " ")}`);
          if (st?.support_email) lines.push("", `Contact: ${st.support_email}`);
          lines.push("", "## Pages", `- [Home](${o}/): Storefront`, `- [Shop](${o}/shop): Full catalog`, `- [Blog](${o}/blog): Articles`);
          for (const p of pg.data ?? []) lines.push(`- [${p.title}](${o}/pages/${p.slug})`);
          if (pr.data?.length) {
            lines.push("", "## Products");
            for (const p of pr.data) lines.push(`- [${p.name}](${o}/product/${p.slug})${p.short_description ? `: ${p.short_description.replace(/\n/g, " ").slice(0, 140)}` : ""}`);
          }
          if (bp.data?.length) {
            lines.push("", "## Blog");
            for (const b of bp.data) lines.push(`- [${b.title}](${o}/blog/${b.slug})`);
          }
          txt = lines.join("\n");
        }
        return new Response(txt + "\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" } });
      },
    },
  },
});
