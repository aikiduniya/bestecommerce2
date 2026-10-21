import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { contentTranslationsQuery, postsQuery, settingsQuery } from "@/lib/store";
import { applyTranslation, hreflangLinks, indexTranslations, isValidLang, useLang } from "@/lib/i18n";
import { getPostSeo } from "@/lib/content.functions";
import { useMemo } from "react";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Prose } from "@/components/store/Prose";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/{-$lang}/blog/$slug")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  loader: async ({ params, context }) => ({
    seo: await getPostSeo({ data: params.slug }).catch(() => null),
    st: await context.queryClient.ensureQueryData(settingsQuery).catch(() => null),
  }),
  head: ({ loaderData, params }) => {
    const title = loaderData?.seo?.title ?? "Journal article";
    const description = loaderData?.seo?.description ?? "Read this article from our journal.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.seo?.image ? [{ property: "og:image", content: loaderData.seo.image }, { name: "twitter:image", content: loaderData.seo.image }] : []),
        ...(loaderData?.seo ? [] : [{ name: "robots", content: "noindex" }]),
      ],
      links: hreflangLinks(loaderData?.st, `/blog/${params.slug}`),
    };
  },
  component: BlogPost,
});

function BlogPost() {
  const { slug } = Route.useParams();
  const lang = useLang();
  const lp = { lang: lang ?? undefined };
  const { data: posts = [], isLoading } = useQuery(postsQuery);
  const { data: trs = [] } = useQuery(contentTranslationsQuery);
  const index = useMemo(() => indexTranslations(trs), [trs]);
  // Match the base slug or the translated slug for the active language.
  const base = posts.find((x) => x.is_published && (x.slug === slug || index["blog_post"]?.[x.id]?.[lang ?? ""]?.["slug"] === slug));
  const p = base ? applyTranslation(index, "blog_post", base, lang) : undefined;
  return (
    <StoreLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        {isLoading ? <Skeleton className="h-64" /> : !p ? (
          <div className="py-20 text-center"><h1 className="text-5xl">Article not found</h1><Link to="/{-$lang}/blog" params={lp} className="mt-6 inline-block text-gold">All articles</Link></div>
        ) : (
          <>
            <Link to="/{-$lang}/blog" params={lp} className="eyebrow text-gold">← Journal</Link>
            <h1 className="mt-4 text-6xl leading-tight">{p.title}</h1>
            <p className="mt-4 text-sm text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}{p.author ? ` · ${p.author}` : ""}</p>
            {p.cover_image && <img src={p.cover_image} alt={p.title} className="my-10 aspect-[16/9] w-full rounded object-cover" />}
            <Prose text={p.body} />
            {p.tags.length > 0 && <p className="mt-10 flex flex-wrap gap-2">{p.tags.map((t) => <span key={t} className="rounded-full border px-3 py-1 text-xs">{t}</span>)}</p>}
          </>
        )}
      </article>
    </StoreLayout>
  );
}
