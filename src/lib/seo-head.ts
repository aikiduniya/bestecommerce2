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
