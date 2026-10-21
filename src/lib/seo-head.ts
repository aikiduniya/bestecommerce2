export const SITE = "https://bestecommerce2.lovable.app";

type Meta = Record<string, string>;
/** Extra robots/keywords meta shared by content routes. */
export function extraMeta(seo: { keywords?: string | null; noindex?: boolean } | null | undefined): Meta[] {
  const out: Meta[] = [];
  if (seo?.keywords) out.push({ name: "keywords", content: seo.keywords });
  if (seo?.noindex) out.push({ name: "robots", content: "noindex, follow" });
  return out;
}

export const jsonLd = (data: unknown) => ({ type: "application/ld+json", children: JSON.stringify(data).replace(/</g, "\\u003c") });

export function breadcrumb(items: { name: string; url: string }[]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) };
}

export type PageSeo = { title?: string; description?: string; keywords?: string; og_image?: string; noindex?: boolean };
/** Admin-editable SEO for fixed storefront pages (store_settings.page_seo[key]). */
export function pageSeoOf(settings: unknown, key: string): PageSeo {
  const all = (settings as { page_seo?: Record<string, PageSeo> } | null)?.page_seo;
  return (all && typeof all === "object" && all[key]) || {};
}

type Taxo = { name: string; description?: string | null; meta_title?: string | null; meta_description?: string | null; meta_keywords?: string | null; canonical_url?: string | null; og_image_url?: string | null; robots_noindex?: boolean; image_url?: string | null; logo_url?: string | null };
/** Head tags for a page, with optional overrides from a category/brand/collection. */
export function buildHead(o: { title: string; description: string; path: string; keywords?: string | null; image?: string | null; noindex?: boolean; canonical?: string | null; type?: string }) {
  const meta: Meta[] = [
    { title: o.title },
    { name: "description", content: o.description },
    { property: "og:title", content: o.title },
    { property: "og:description", content: o.description },
    { property: "og:type", content: o.type ?? "website" },
    { property: "og:url", content: `${SITE}${o.path}` },
    { name: "twitter:card", content: o.image ? "summary_large_image" : "summary" },
    ...extraMeta({ keywords: o.keywords, noindex: o.noindex }),
  ];
  if (o.image && /^https:\/\//.test(o.image)) meta.push({ property: "og:image", content: o.image }, { name: "twitter:image", content: o.image });
  return { meta, canonical: o.canonical || `${SITE}${o.path}` };
}
export function taxoHead(t: Taxo, kind: "category" | "brand" | "collection", slug: string) {
  const title = t.meta_title || `${t.name} — Shop`;
  const description = t.meta_description || t.description || `Shop ${t.name}: curated products, delivered worldwide.`;
  return buildHead({ title, description, path: `/shop?${kind}=${encodeURIComponent(slug)}`, keywords: t.meta_keywords, image: t.og_image_url || t.image_url || t.logo_url, noindex: t.robots_noindex, canonical: t.canonical_url });
}
