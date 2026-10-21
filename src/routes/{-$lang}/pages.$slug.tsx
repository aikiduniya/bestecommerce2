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
import { ContactForm } from "@/components/store/ContactForm";
import { FaqList } from "@/components/store/FaqList";
import { useIsStaff, useSessionUser } from "@/lib/auth";
import { Mail, MapPin, Phone, Clock } from "lucide-react";

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
  const { user } = useSessionUser();
  const isStaff = useIsStaff(user?.id);
  const { data: st } = useQuery(settingsQuery);
  const base = pages.find((x) => (x.is_published || isStaff) && (x.slug === slug || index["page"]?.[x.id]?.[lang ?? ""]?.["slug"] === slug));
  const p = base ? applyTranslation(index, "page", base, lang) : undefined;
  return (
    <StoreLayout>
      <article className={`mx-auto px-6 py-16 ${slug === "contact" ? "max-w-5xl" : "max-w-3xl"}`}>
        {isLoading ? <Skeleton className="h-64" /> : !p ? (
          <div className="py-20 text-center"><h1 className="text-5xl">Page not found</h1><Link to="/{-$lang}" params={lp} className="mt-6 inline-block text-gold">Back home</Link></div>
        ) : (
          <>
            {!base?.is_published && <p className="mb-6 rounded border border-warning bg-warning/15 px-4 py-2 text-sm">Draft preview — only staff can see this page until it is published.</p>}
            <h1 className="mb-10 text-5xl md:text-6xl">{p.title}</h1>
            {base?.image_url && <img src={base.image_url} alt={base.image_alt || p.title} className="mb-10 aspect-[16/7] w-full rounded object-cover" />}
            <Prose text={p.body} />
            {slug === "faqs" && <div className="mt-12"><FaqList /></div>}
            {slug === "contact" && (
              <div className="mt-12 grid gap-8 md:grid-cols-[1fr_260px]">
                <ContactForm />
                <aside className="space-y-4 text-sm">
                  {st?.support_email && <p className="flex gap-3"><Mail className="size-4 shrink-0 text-gold" /><a href={`mailto:${st.support_email}`} className="hover:text-gold">{st.support_email}</a></p>}
                  {st?.support_phone && <p className="flex gap-3"><Phone className="size-4 shrink-0 text-gold" />{st.support_phone}</p>}
                  {st?.contact_address && <p className="flex gap-3 whitespace-pre-line"><MapPin className="size-4 shrink-0 text-gold" />{st.contact_address}</p>}
                  {st?.contact_hours && <p className="flex gap-3 whitespace-pre-line"><Clock className="size-4 shrink-0 text-gold" />{st.contact_hours}</p>}
                </aside>
              </div>
            )}
          </>
        )}
      </article>
    </StoreLayout>
  );
}
