import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Star, Quote } from "lucide-react";
import { toast } from "sonner";
import {
  brandsQuery, categoriesQuery, collectionsQuery, productCollectionsQuery, productsQuery, settingsQuery, zonesQuery, money,
  type Product,
} from "@/lib/store";
import { getRecentlyViewed } from "@/lib/cart";
import { useLang } from "@/lib/i18n";
import { useFromPrice } from "@/lib/useFromPrice";
import { bestSellersQuery, type HomeSection } from "@/lib/sections";
import { ProductCard } from "@/components/store/ProductCard";
import { Button } from "@/components/ui/button";
import { Prose } from "@/components/store/Prose";
import { HeroSlider, type Slide } from "@/components/store/HeroSlider";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { FaqList } from "@/components/store/FaqList";
import { ContactForm } from "@/components/store/ContactForm";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

type Cfg = any;

export function HomeSections({ sections }: { sections: HomeSection[] }) {
  const { data: s } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: cols = [] } = useQuery(collectionsQuery);
  const { data: pcs = [] } = useQuery(productCollectionsQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: bestIds = [] } = useQuery(bestSellersQuery);
  const lang = useLang();
  const lp = { lang: lang ?? undefined };
  const fromPrice = useFromPrice();
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(getRecentlyViewed()), []);

  const active = products.filter((p) => p.status === "active");
  const cur = s?.currency;
  const freeOver = zones.filter((z) => z.is_active && z.free_over).map((z) => Number(z.free_over));

  const Grid = ({ items }: { items: Product[] }) => (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
      {items.map((p) => <ProductCard key={p.id} p={p} currency={cur} fromPrice={fromPrice(p.id)} />)}
    </div>
  );

  const Head = ({ eyebrow, title, sub }: { eyebrow?: string; title?: string | null; sub?: string | null }) => (
    <div className="mb-10">
      {eyebrow && <p className="eyebrow text-gold">{eyebrow}</p>}
      {title && <h2 className="mt-2 text-5xl">{title}</h2>}
      {sub && <p className="mt-2 text-muted-foreground">{sub}</p>}
    </div>
  );

  function render(sec: HomeSection) {
    const c = (sec.config ?? {}) as Cfg;
    switch (sec.type) {
      case "hero": {
        const slides: Slide[] = Array.isArray(c.slides) && c.slides.length
          ? c.slides
          : [{ eyebrow: c.eyebrow || s?.hero_eyebrow || "", title: sec.title || s?.tagline || "", description: sec.subtitle ?? "", image_url: c.image_url || s?.hero_image_url || "", image_alt: c.image_alt || s?.hero_image_alt || "", cta_label: c.cta_label, cta_link: c.cta_link, overlay: s?.hero_overlay != null ? 100 - s.hero_overlay : 55 }];
        return <HeroSlider slides={slides} layout={c.layout ?? (Array.isArray(c.slides) && c.slides.length ? "split" : "full")} height={c.height || s?.hero_height || "tall"} autoplay={Number(c.autoplay ?? 6)} />;
      }
      case "about":
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <div className={`grid items-center gap-10 md:grid-cols-2 ${c.image_side === "right" ? "" : "md:[&>*:first-child]:order-2"}`}>
              <div>
                {c.eyebrow && <p className="eyebrow flex items-center gap-3 text-gold"><span className="h-px w-10 bg-gold" />{c.eyebrow}</p>}
                {sec.title && <h2 className="mt-3 text-5xl">{sec.title}</h2>}
                {sec.subtitle && <p className="mt-3 font-display text-xl italic text-muted-foreground">{sec.subtitle}</p>}
                {c.body && <div className="mt-6"><Prose text={c.body} /></div>}
                {c.cta_label && <Button variant="gold" size="lg" className="mt-8" asChild><a href={c.cta_link || "/pages/about"}>{c.cta_label} <ArrowRight /></a></Button>}
              </div>
              {c.image_url ? <img src={c.image_url} alt={c.image_alt || sec.title || ""} loading="lazy" className="aspect-[4/5] w-full rounded-sm border border-gold/30 object-cover shadow-elegant" /> : <div className="aspect-[4/5] rounded-sm bg-secondary" />}
            </div>
          </section>
        );
      case "contact":
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <div className="grid gap-10 rounded border bg-card p-6 md:grid-cols-[1fr_1.4fr] md:p-12">
              <div>
                <p className="eyebrow text-gold">{c.eyebrow || "Contact"}</p>
                <h2 className="mt-2 text-5xl">{sec.title ?? "Get in touch"}</h2>
                {sec.subtitle && <p className="mt-3 text-muted-foreground">{sec.subtitle}</p>}
                <div className="mt-8 space-y-3 text-sm">
                  {s?.support_email && <a href={`mailto:${s.support_email}`} className="flex items-center gap-3 hover:text-gold"><Mail className="size-4 text-gold" />{s.support_email}</a>}
                  {s?.support_phone && <p className="flex items-center gap-3"><Phone className="size-4 text-gold" />{s.support_phone}</p>}
                  {s?.contact_address && <p className="flex items-start gap-3 whitespace-pre-line"><MapPin className="mt-0.5 size-4 text-gold" />{s.contact_address}</p>}
                  {s?.contact_hours && <p className="flex items-start gap-3 whitespace-pre-line"><Clock className="mt-0.5 size-4 text-gold" />{s.contact_hours}</p>}
                </div>
              </div>
              {c.show_form === false ? (
                <div className="flex items-center"><Button variant="gold" size="lg" asChild><a href="/pages/contact">{c.cta_label || "Contact us"} <ArrowRight /></a></Button></div>
              ) : <ContactForm />}
            </div>
          </section>
        );
      case "trust_badges": {
        const icons: Record<string, typeof Truck> = { truck: Truck, shield: ShieldCheck, rotate: RotateCcw };
        const items: { icon?: string; text: string }[] = Array.isArray(c.items) ? c.items : [];
        const list = items.length ? items : [
          { icon: "truck", text: freeOver.length ? `Free shipping over ${money(Math.min(...freeOver), cur)}` : "Shipping worldwide" },
          { icon: "shield", text: "Pay securely — Cash on Delivery available" },
          { icon: "rotate", text: "Dedicated customer support" },
        ];
        return (
          <section className="border-b bg-card">
            <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 text-sm sm:grid-cols-3">
              {list.map((it, i) => {
                const Icon = icons[it.icon ?? ""] ?? Truck;
                return <div key={i} className="flex items-center gap-3"><Icon className="size-5 shrink-0 text-gold" />{it.text}</div>;
              })}
            </div>
          </section>
        );
      }
      case "categories": {
        const list = cats.filter((x) => x.is_active && !x.parent_id).slice(0, Number(c.count) || 5);
        if (!list.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <Head eyebrow="Browse" title={sec.title ?? "Shop by category"} sub={sec.subtitle} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {list.map((x) => (
                <Link key={x.id} to="/{-$lang}/shop" params={lp} search={{ category: x.slug }} className="group relative flex aspect-square items-end overflow-hidden rounded bg-secondary p-5">
                  {x.image_url && <img src={x.image_url} alt={("image_alt" in x && (x as { image_alt?: string | null }).image_alt) || x.name} className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                  <span className="relative font-display text-2xl">{x.name}</span>
                </Link>
              ))}
            </div>
          </section>
        );
      }
      case "featured_products": {
        const items = active.filter((p) => p.is_featured).slice(0, Number(c.count) || 8);
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <Head eyebrow="Featured" title={sec.title ?? "Selected pieces"} sub={sec.subtitle} />
            <Grid items={items} />
          </section>
        );
      }
      case "collection": {
        const col = cols.find((x) => x.id === c.collection_id && x.is_active);
        if (!col) return null;
        const ids = pcs.filter((x) => x.collection_id === col.id).map((x) => x.product_id);
        const items = active.filter((p) => ids.includes(p.id)).slice(0, Number(c.count) || 4);
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <div className="mb-10 flex items-end justify-between">
              <Head eyebrow="Collection" title={sec.title ?? col.name} sub={sec.subtitle ?? col.description} />
              <Link to="/{-$lang}/shop" params={lp} search={{ collection: col.slug }} className="shrink-0 text-sm hover:text-gold">View all →</Link>
            </div>
            <Grid items={items} />
          </section>
        );
      }
      case "best_sellers": {
        const items = bestIds.map((id) => active.find((p) => p.id === id)).filter(Boolean).slice(0, Number(c.count) || 4) as Product[];
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <Head eyebrow="Popular" title={sec.title ?? "Best sellers"} sub={sec.subtitle} />
            <Grid items={items} />
          </section>
        );
      }
      case "new_arrivals": {
        const items = active.slice(0, Number(c.count) || 4);
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <div className="mb-10 flex items-end justify-between">
              <Head eyebrow="Just in" title={sec.title ?? "New arrivals"} sub={sec.subtitle} />
              <Link to="/{-$lang}/shop" params={lp} search={{ sort: "new" }} className="shrink-0 text-sm hover:text-gold">Shop all →</Link>
            </div>
            <Grid items={items} />
          </section>
        );
      }
      case "promo_banner":
        return (
          <section className={`relative mt-20 overflow-hidden ${c.theme === "light" ? "bg-secondary" : "bg-hero text-primary-foreground"}`}>
            {c.image_url && <img src={c.image_url} alt="" className="absolute inset-0 size-full object-cover opacity-40" />}
            <div className="relative mx-auto max-w-7xl px-6 py-20 text-center">
              {sec.title && <h2 className="text-5xl">{sec.title}</h2>}
              {sec.subtitle && <p className="mx-auto mt-3 max-w-xl opacity-80">{sec.subtitle}</p>}
              {c.cta_label && (
                <Button variant={c.theme === "light" ? "default" : "hero"} size="lg" className="mt-8" asChild>
                  <Link to={c.cta_link || "/shop"}>{c.cta_label}</Link>
                </Button>
              )}
            </div>
          </section>
        );
      case "brands": {
        const list = brands.filter((b) => b.is_active).slice(0, Number(c.count) || 8);
        if (!list.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <Head eyebrow="Brands" title={sec.title ?? "Our brands"} sub={sec.subtitle} />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {list.map((b) => (
                <Link key={b.id} to="/{-$lang}/shop" params={lp} search={{ brand: b.slug }} className="flex h-24 items-center justify-center rounded border bg-card p-4 hover:border-gold">
                  {b.logo_url ? <img src={b.logo_url} alt={b.name} className="max-h-12 object-contain" /> : <span className="font-display text-xl">{b.name}</span>}
                </Link>
              ))}
            </div>
          </section>
        );
      }
      case "testimonials": {
        const items: { name: string; text: string; rating?: number }[] = Array.isArray(c.items) ? c.items : [];
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <Head eyebrow="Testimonials" title={sec.title ?? "What customers say"} sub={sec.subtitle} />
            <div className="grid gap-6 md:grid-cols-3">
              {items.map((t, i) => (
                <figure key={i} className="rounded border bg-card p-6">
                  <Quote className="size-5 text-gold" />
                  <blockquote className="mt-3 text-sm leading-relaxed">{t.text}</blockquote>
                  <figcaption className="mt-4 flex items-center justify-between text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="flex gap-0.5">{Array.from({ length: t.rating ?? 5 }).map((_, j) => <Star key={j} className="size-3.5 fill-gold text-gold" />)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      }
      case "newsletter":
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <div className="rounded border bg-card px-6 py-14 text-center">
              <h2 className="text-4xl">{sec.title ?? "Stay in the loop"}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{sec.subtitle ?? c.note}</p>
              <NewsletterForm cta={c.cta_label || "Subscribe"} />
            </div>
          </section>
        );
      case "text":
        return (
          <section className="mx-auto max-w-3xl px-6 pt-20 text-center">
            {sec.title && <h2 className="mb-4 text-4xl">{sec.title}</h2>}
            <Prose text={c.body ?? ""} />
          </section>
        );
      case "image":
        if (!c.image_url) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            {c.link ? (
              <Link to={c.link}><img src={c.image_url} alt={sec.title ?? ""} className="w-full rounded object-cover" /></Link>
            ) : (
              <img src={c.image_url} alt={sec.title ?? ""} className="w-full rounded object-cover" />
            )}
          </section>
        );
      case "video": {
        if (!c.video_url) return null;
        const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/.exec(c.video_url)?.[1];
        return (
          <section className="mx-auto max-w-5xl px-6 pt-20">
            {sec.title && <Head title={sec.title} sub={sec.subtitle} />}
            <div className="aspect-video overflow-hidden rounded bg-black">
              {yt ? (
                <iframe src={`https://www.youtube.com/embed/${yt}`} title={sec.title ?? "Video"} className="size-full" allowFullScreen />
              ) : (
                <video src={c.video_url} poster={c.poster || undefined} controls className="size-full" />
              )}
            </div>
          </section>
        );
      }
      case "faq": {
        if (c.source === "db") {
          return (
            <section className="mx-auto max-w-3xl px-6 pt-20">
              <Head eyebrow="FAQ" title={sec.title ?? "Frequently asked questions"} sub={sec.subtitle} />
              <FaqList homeOnly limit={Number(c.count) || 8} />
              <a href="/pages/faqs" className="mt-6 inline-flex items-center gap-2 text-sm text-gold">All questions <ArrowRight className="size-4" /></a>
            </section>
          );
        }
        const items: { q: string; a: string }[] = Array.isArray(c.items) ? c.items : [];
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-3xl px-6 pt-20">
            <Head title={sec.title ?? "Frequently asked questions"} sub={sec.subtitle} />
            <div className="divide-y rounded border bg-card">
              {items.map((f, i) => (
                <details key={i} className="group p-5">
                  <summary className="cursor-pointer list-none font-medium group-open:text-gold">{f.q}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      }
      case "recently_viewed": {
        const items = recent.map((id) => active.find((p) => p.id === id)).filter(Boolean).slice(0, 4) as Product[];
        if (!items.length) return null;
        return (
          <section className="mx-auto max-w-7xl px-6 pt-20">
            <Head title={sec.title ?? "Recently viewed"} />
            <Grid items={items} />
          </section>
        );
      }
      default:
        return null;
    }
  }

  return <>{sections.filter((x) => x.is_enabled).map((sec) => <div key={sec.id}>{render(sec)}</div>)}</>;
}
