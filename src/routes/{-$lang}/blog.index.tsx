import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { contentTranslationsQuery, postsQuery, settingsQuery } from "@/lib/store";
import { applyTranslation, hreflangLinks, indexTranslations, isValidLang, useLang } from "@/lib/i18n";
import { buildHead, pageSeoOf } from "@/lib/seo-head";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

export const Route = createFileRoute("/{-$lang}/blog/")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQuery).catch(() => null),
  head: ({ loaderData }) => {
    const ps = pageSeoOf(loaderData, "blog");
    const h = buildHead({ title: ps.title || "Journal — Stories, guides & news", description: ps.description || "Read our latest stories, style guides and store news.", path: "/blog", keywords: ps.keywords, image: ps.og_image, noindex: ps.noindex });
    return { meta: h.meta, links: [...hreflangLinks(loaderData, "/blog"), { rel: "canonical", href: h.canonical }] };
  },
  component: BlogIndex,
});

function BlogIndex() {
  const lang = useLang();
  const lp = { lang: lang ?? undefined };
  const { data: posts = [], isLoading } = useQuery(postsQuery);
  const { data: trs = [] } = useQuery(contentTranslationsQuery);
  const index = useMemo(() => indexTranslations(trs), [trs]);
  const live = posts.filter((p) => p.is_published).map((p) => applyTranslation(index, "blog_post", p, lang));
  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <p className="eyebrow text-gold">Journal</p>
        <h1 className="mt-2 text-6xl">Stories & guides</h1>
        {isLoading ? <Skeleton className="mt-10 h-64" /> : live.length === 0 ? (
          <p className="mt-10 text-muted-foreground">No articles yet — check back soon.</p>
        ) : (
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {live.map((p) => (
              <Link key={p.id} to="/{-$lang}/blog/$slug" params={{ ...lp, slug: p.slug }} className="group">
                <div className="aspect-[4/3] overflow-hidden rounded bg-secondary">
                  {p.cover_image && <img src={p.cover_image} alt={p.title} className="size-full object-cover transition duration-500 group-hover:scale-105" />}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}{p.author ? ` · ${p.author}` : ""}</p>
                <h2 className="mt-1 text-2xl group-hover:text-gold">{p.title}</h2>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
