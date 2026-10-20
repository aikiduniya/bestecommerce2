import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { postsQuery } from "@/lib/store";
import { getPostSeo } from "@/lib/content.functions";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Prose } from "@/components/store/Prose";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => getPostSeo({ data: params.slug }).catch(() => null),
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Journal article";
    const description = loaderData?.description ?? "Read this article from our journal.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.image ? [{ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image }] : []),
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: BlogPost,
});

function BlogPost() {
  const { slug } = Route.useParams();
  const { data: posts = [], isLoading } = useQuery(postsQuery);
  const p = posts.find((x) => x.slug === slug && x.is_published);
  return (
    <StoreLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        {isLoading ? <Skeleton className="h-64" /> : !p ? (
          <div className="py-20 text-center"><h1 className="text-5xl">Article not found</h1><Link to="/blog" className="mt-6 inline-block text-gold">All articles</Link></div>
        ) : (
          <>
            <Link to="/blog" className="eyebrow text-gold">← Journal</Link>
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
