import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Heart, Minus, Plus, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brandsQuery, categoriesQuery, money, optionsOf, productsQuery, settingsQuery, variantsQuery } from "@/lib/store";
import { pushRecentlyViewed, useCart } from "@/lib/cart";
import { effectivePrice, regularPrice, saleActive } from "@/lib/sale";
import { trackAddToCart, trackViewItem } from "@/lib/analytics";
import { useSessionUser } from "@/lib/auth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductSeo } from "@/lib/seo.functions";
import { ReviewsQA } from "@/components/store/ReviewsQA";

export const Route = createFileRoute("/product/$slug")({
  loader: ({ params }) => getProductSeo({ data: params.slug }).catch(() => null),
  head: ({ loaderData, params }) => {
    const title = loaderData?.title ?? "Product details";
    const description = loaderData?.description ?? "Product details, options, pricing and availability.";
    const url = `https://bestecommerce2.lovable.app/product/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        ...(loaderData?.image
          ? [{ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image }]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: products = [], isLoading } = useQuery(productsQuery);
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const p = products.find((x) => x.slug === slug && x.status === "active");
  const { data: variants = [] } = useQuery({ ...variantsQuery(p?.id ?? ""), enabled: !!p });
  const { user } = useSessionUser();
  const qc = useQueryClient();
  const cart = useCart();
  const [sel, setSel] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);

  const activeVariants = variants.filter((v) => v.is_active);
  const opts = p ? optionsOf(p) : [];
  const hasVariants = activeVariants.length > 0;
  const variant = useMemo(
    () => activeVariants.find((v) => opts.every((o) => (v.options as Record<string, string>)[o.name] === sel[o.name])),
    [activeVariants, opts, sel],
  );

  const wish = useQuery({
    queryKey: ["wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wishlists").select("product_id")).data?.map((w) => w.product_id) ?? [],
  });
  const inWish = !!p && (wish.data ?? []).includes(p.id);

  useEffect(() => {
    if (p) {
      pushRecentlyViewed(p.id);
      document.title = p.seo_title || `${p.name} | ${s?.store_name ?? ""}`;
      trackViewItem({ id: p.id, name: p.name, price: effectivePrice(p, null) }, s?.currency);
    }
  }, [p, s?.store_name, s?.currency]);

  if (isLoading) return <StoreLayout><div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-2"><Skeleton className="aspect-square" /><Skeleton className="h-64" /></div></StoreLayout>;
  if (!p) {
    return (
      <StoreLayout>
        <div className="py-32 text-center">
          <h1 className="text-5xl">Product not found</h1>
          <Link to="/shop" className="mt-6 inline-block text-gold">Back to shop</Link>
        </div>
      </StoreLayout>
    );
  }

  const images = [...(variant?.image_url ? [variant.image_url] : []), ...p.images].filter((v, i, a) => a.indexOf(v) === i);
  const price = effectivePrice(p, variant);
  const reg = regularPrice(p, variant);
  const flashSale = saleActive(p) && (p.sale_price !== null || variant?.sale_price != null) && price < reg;
  const compare = flashSale ? reg : (variant?.compare_at_price ?? p.compare_at_price);
  const stock = hasVariants ? variant?.stock ?? 0 : p.stock;
  const needsChoice = hasVariants && !variant;
  const related = products.filter((x) => x.status === "active" && x.id !== p.id && x.category_id === p.category_id).slice(0, 4);
  const valueAvailable = (name: string, value: string) =>
    activeVariants.some((v) => {
      const o = v.options as Record<string, string>;
      return o[name] === value && v.stock > 0 && opts.every((x) => x.name === name || !sel[x.name] || o[x.name] === sel[x.name]);
    });

  function addToCart() {
    if (!p) return;
    if (needsChoice) { toast.error("Please choose your options"); return; }
    if (stock < qty) { toast.error(stock === 0 ? "Out of stock" : `Only ${stock} available`); return; }
    cart.add({
      product_id: p.id, variant_id: variant?.id ?? null, qty, name: p.name, slug: p.slug, price,
      image: images[0] ?? null, options: (variant?.options as Record<string, string>) ?? undefined,
    });
    trackAddToCart({ id: p.id, name: p.name, price, qty, variant: variant ? Object.values(variant.options as Record<string, string>).join(" / ") : undefined }, s?.currency);
    toast.success("Added to cart", { action: { label: "View cart", onClick: () => (window.location.href = "/cart") } });
  }

  async function toggleWish() {
    if (!user || !p) { toast.error("Sign in to save to your wishlist"); return; }
    const { error } = inWish
      ? await supabase.from("wishlists").delete().eq("product_id", p.id).eq("user_id", user.id)
      : await supabase.from("wishlists").insert({ product_id: p.id, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["wishlist"] });
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <nav className="mb-8 text-xs text-muted-foreground">
          <Link to="/shop" className="hover:text-foreground">Shop</Link>
          {cats.find((c) => c.id === p.category_id) && (
            <> / <Link to="/shop" search={{ category: cats.find((c) => c.id === p.category_id)!.slug }} className="hover:text-foreground">{cats.find((c) => c.id === p.category_id)!.name}</Link></>
          )}
        </nav>
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <div className="aspect-square overflow-hidden rounded bg-secondary">
              {images[img] ? <img src={images[img]} alt={p.name} className="size-full object-cover" /> : <div className="flex size-full items-center justify-center font-display text-8xl text-muted-foreground/30">{p.name[0]}</div>}
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-3">
                {images.map((u, i) => (
                  <button key={u} onClick={() => setImg(i)} className={`aspect-square overflow-hidden rounded border-2 ${i === img ? "border-gold" : "border-transparent"}`}>
                    <img src={u} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            {brands.find((b) => b.id === p.brand_id) && <p className="eyebrow text-gold">{brands.find((b) => b.id === p.brand_id)!.name}</p>}
            <h1 className="mt-2 text-5xl leading-tight">{p.name}</h1>
            <p className="mt-4 text-2xl">
              {money(price, s?.currency)}
              {compare && Number(compare) > price && <span className="ml-3 text-lg text-muted-foreground line-through">{money(compare, s?.currency)}</span>}
            </p>
            {flashSale && p.sale_ends_at && new Date(p.sale_ends_at) > new Date() && <SaleCountdown endsAt={p.sale_ends_at} />}
            {p.short_description && <p className="mt-4 text-muted-foreground">{p.short_description}</p>}

            {opts.map((o) => (
              <div key={o.name} className="mt-6">
                <p className="eyebrow mb-2 text-muted-foreground">{o.name}{sel[o.name] && <span className="ml-2 normal-case tracking-normal text-foreground">{sel[o.name]}</span>}</p>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((val) => {
                    const ok = valueAvailable(o.name, val);
                    return (
                      <button
                        key={val}
                        onClick={() => { setSel({ ...sel, [o.name]: val }); setImg(0); }}
                        className={`min-w-12 rounded border px-4 py-2 text-sm transition ${sel[o.name] === val ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground"} ${ok ? "" : "opacity-40 line-through"}`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <p className="mt-6 text-sm">
              {needsChoice ? <span className="text-muted-foreground">Select options to see availability</span>
                : stock > 0 ? <span className="text-success">{stock <= p.low_stock_threshold ? `Only ${stock} left` : "In stock"}</span>
                : <span className="text-destructive">Out of stock</span>}
            </p>

            <div className="mt-6 flex gap-3">
              <div className="flex items-center rounded border">
                <button className="p-3" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease"><Minus className="size-4" /></button>
                <span className="w-8 text-center">{qty}</span>
                <button className="p-3" onClick={() => setQty(Math.min(100, qty + 1))} aria-label="Increase"><Plus className="size-4" /></button>
              </div>
              <Button size="lg" className="h-12 flex-1" onClick={addToCart} disabled={!needsChoice && stock <= 0}>
                {!needsChoice && stock <= 0 ? "Sold out" : "Add to cart"}
              </Button>
              <Button size="lg" variant="outline" className="h-12" onClick={toggleWish} aria-label="Wishlist">
                <Heart className={inWish ? "fill-gold text-gold" : ""} />
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Truck className="size-4" /> Shipping calculated at checkout</p>
            {p.description && <div className="mt-10 whitespace-pre-line border-t pt-8 leading-relaxed text-muted-foreground">{p.description}</div>}
          </div>
        </div>
        <ReviewsQA productId={p.id} reviewsEnabled={s?.reviews_enabled ?? true} />
        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-10 text-4xl">You may also like</h2>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{related.map((r) => <ProductCard key={r.id} p={r} currency={s?.currency} />)}</div>
          </section>
        )}
      </div>
    </StoreLayout>
  );
}

function SaleCountdown({ endsAt }: { endsAt: string }) {
  const [left, setLeft] = useState(() => new Date(endsAt).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(endsAt).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (left <= 0) return null;
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return (
    <div className="mt-4 inline-flex items-center gap-3 rounded border border-gold/40 bg-gold/10 px-4 py-2">
      <span className="eyebrow text-gold">Sale ends in</span>
      <span className="font-display text-lg tabular-nums">
        {d > 0 && `${d}d `}{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")}
      </span>
    </div>
  );
}
