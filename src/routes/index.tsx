import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import {
  categoriesQuery, collectionsQuery, productCollectionsQuery, productsQuery, settingsQuery, zonesQuery, money,
} from "@/lib/store";
import { getRecentlyViewed } from "@/lib/cart";
import { useFromPrice } from "@/lib/useFromPrice";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { getHomeSeo } from "@/lib/content.functions";

export const Route = createFileRoute("/")({
  loader: () => getHomeSeo().catch(() => null),
  head: ({ loaderData }) => {
    const title = loaderData?.title || "Curated essentials, delivered worldwide";
    const description = loaderData?.description || "Shop watches, fashion, electronics, beauty and home — curated and shipped worldwide.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.verification ? [{ name: "google-site-verification", content: loaderData.verification }] : []),
        ...(loaderData?.image ? [{ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image }] : []),
      ],
    };
  },
  component: Index,
});

function Index() {
  const { data: s } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: cols = [] } = useQuery(collectionsQuery);
  const { data: pcs = [] } = useQuery(productCollectionsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const fromPrice = useFromPrice();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(getRecentlyViewed()), []);

  const active = products.filter((p) => p.status === "active");
  const featured = active.filter((p) => p.is_featured).slice(0, 8);
  const newest = active.slice(0, 4);
  const homeCols = cols.filter((c) => c.is_active && c.show_on_home);
  const recentProducts = recent.map((id) => active.find((p) => p.id === id)).filter(Boolean).slice(0, 4) as typeof active;
  const freeOver = zones.filter((z) => z.is_active && z.free_over).map((z) => Number(z.free_over));
  const cur = s?.currency;

  const Grid = ({ items }: { items: typeof active }) => (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
      {items.map((p) => <ProductCard key={p.id} p={p} currency={cur} fromPrice={fromPrice(p.id)} />)}
    </div>
  );

  return (
    <StoreLayout>
      <section className="bg-hero relative overflow-hidden text-primary-foreground">
        {s?.hero_image_url && <img src={s.hero_image_url} alt="" className="absolute inset-0 size-full object-cover opacity-45" />}
        <div className="relative mx-auto max-w-7xl px-6 py-28 md:py-44">
          {s?.hero_eyebrow && <p className="eyebrow text-gold">{s.hero_eyebrow}</p>}
          <h1 className="mt-6 max-w-3xl text-6xl leading-[1.02] md:text-8xl">{s?.tagline ?? "\u00a0"}</h1>
          {s?.hero_cta && (
            <Button variant="hero" size="lg" className="mt-10" asChild>
              <Link to="/shop">{s.hero_cta} <ArrowRight /></Link>
            </Button>
          )}
        </div>
      </section>

      <section className="border-b bg-card">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-3"><Truck className="size-5 text-gold" />{freeOver.length ? `Free shipping over ${money(Math.min(...freeOver), cur)}` : "Shipping worldwide"}</div>
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-gold" />Pay securely — Cash on Delivery available</div>
          <div className="flex items-center gap-3"><RotateCcw className="size-5 text-gold" />Dedicated customer support</div>
        </div>
      </section>

      {cats.filter((c) => c.is_active && !c.parent_id).length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pt-20">
          <p className="eyebrow text-gold">Browse</p>
          <h2 className="mt-2 text-5xl">Shop by category</h2>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-5">
            {cats.filter((c) => c.is_active && !c.parent_id).map((c) => (
              <Link key={c.id} to="/shop" search={{ category: c.slug }} className="group relative flex aspect-square items-end overflow-hidden rounded bg-secondary p-5">
                {c.image_url && <img src={c.image_url} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                <span className="relative font-display text-2xl">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pt-20">
          <p className="eyebrow text-gold">Featured</p>
          <h2 className="mb-10 mt-2 text-5xl">Selected pieces</h2>
          <Grid items={featured} />
        </section>
      )}

      {homeCols.map((c) => {
        const ids = pcs.filter((x) => x.collection_id === c.id).map((x) => x.product_id);
        const items = active.filter((p) => ids.includes(p.id)).slice(0, 4);
        if (!items.length) return null;
        return (
          <section key={c.id} className="mx-auto max-w-7xl px-6 pt-20">
            <div className="mb-10 flex items-end justify-between">
              <div><p className="eyebrow text-gold">Collection</p><h2 className="mt-2 text-5xl">{c.name}</h2>{c.description && <p className="mt-2 text-muted-foreground">{c.description}</p>}</div>
              <Link to="/shop" search={{ collection: c.slug }} className="text-sm hover:text-gold">View all →</Link>
            </div>
            <Grid items={items} />
          </section>
        );
      })}

      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pt-20">
          <div className="mb-10 flex items-end justify-between">
            <div><p className="eyebrow text-gold">Just in</p><h2 className="mt-2 text-5xl">New arrivals</h2></div>
            <Link to="/shop" search={{ sort: "new" }} className="text-sm hover:text-gold">Shop all →</Link>
          </div>
          <Grid items={newest} />
        </section>
      )}

      {recentProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pt-20">
          <h2 className="mb-10 text-4xl">Recently viewed</h2>
          <Grid items={recentProducts} />
        </section>
      )}
    </StoreLayout>
  );
}
