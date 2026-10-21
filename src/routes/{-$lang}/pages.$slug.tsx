import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { contentTranslationsQuery, pagesQuery, settingsQuery } from "@/lib/store";
import { applyTranslation, hreflangLinks, indexTranslations, isValidLang, useLang } from "@/lib/i18n";
import { getPageSeo } from "@/lib/content.functions";
import { SITE, breadcrumb, extraMeta, jsonLd } from "@/lib/seo-head";

import { useMemo } from "react";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Prose } from "@/components/store/Prose";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/{-$lang}/pages/$slug")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  loader: async ({ params, context }) => ({
    seo: await getPageSeo({ data: params.slug }).catch(() => null),
    st: await context.queryClient.ensureQueryData(settingsQuery).catch(() => null),
  }),
  head: ({ loaderData, params }) => {
    const title = loaderData?.seo?.title ?? "Information";
    const description = loaderData?.seo?.description ?? "Store information and policies.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
        ...(loaderData?.seo ? extraMeta(loaderData.seo) : [{ name: "robots", content: "noindex" }]),
        ...(loaderData?.seo?.image ? [{ property: "og:image", content: loaderData.seo.image }, { name: "twitter:image", content: loaderData.seo.image }] : []),
      ],
      links: [{ rel: "canonical", href: loaderData?.seo?.canonical || `${SITE}${params.lang ? `/${params.lang}` : ""}/pages/${params.slug}` }, ...hreflangLinks(loaderData?.st, `/pages/${params.slug}`)],
      scripts: loaderData?.seo ? [jsonLd(breadcrumb([{ name: "Home", url: `${SITE}/` }, { name: loaderData.seo.name, url: `${SITE}/pages/${params.slug}` }]))] : [],
    };
  },
  component: CmsPage,
});

function CmsPage() {
  const { slug } = Route.useParams();
  const lang = useLang();
  const lp = { lang: lang ?? undefined };
  const { data: pages = [], isLoading } = useQuery(pagesQuery);
  const { data: trs = [] } = useQuery(contentTranslationsQuery);
  const index = useMemo(() => indexTranslations(trs), [trs]);
  const base = pages.find((x) => x.is_published && (x.slug === slug || index["page"]?.[x.id]?.[lang ?? ""]?.["slug"] === slug));
  const p = base ? applyTranslation(index, "page", base, lang) : undefined;
  return (
    <StoreLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        {isLoading ? <Skeleton className="h-64" /> : !p ? (
          <div className="py-20 text-center"><h1 className="text-5xl">Page not found</h1><Link to="/{-$lang}" params={lp} className="mt-6 inline-block text-gold">Back home</Link></div>
        ) : (
          <>
            <h1 className="mb-10 text-6xl">{p.title}</h1>
            <Prose text={p.body} />
          </>
        )}
      </article>
    </StoreLayout>
  );
}
