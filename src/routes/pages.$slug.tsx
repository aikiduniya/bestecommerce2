import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pagesQuery } from "@/lib/store";
import { getPageSeo } from "@/lib/content.functions";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Prose } from "@/components/store/Prose";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/pages/$slug")({
  loader: ({ params }) => getPageSeo({ data: params.slug }).catch(() => null),
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Information";
    const description = loaderData?.description ?? "Store information and policies.";
    return {
      meta: [
        { title }, { name: "description", content: description },
        { property: "og:title", content: title }, { property: "og:description", content: description },
        { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: CmsPage,
});

function CmsPage() {
  const { slug } = Route.useParams();
  const { data: pages = [], isLoading } = useQuery(pagesQuery);
  const p = pages.find((x) => x.slug === slug && x.is_published);
  return (
    <StoreLayout>
      <article className="mx-auto max-w-3xl px-6 py-16">
        {isLoading ? <Skeleton className="h-64" /> : !p ? (
          <div className="py-20 text-center"><h1 className="text-5xl">Page not found</h1><Link to="/" className="mt-6 inline-block text-gold">Back home</Link></div>
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
