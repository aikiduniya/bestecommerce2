import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { categoriesQuery, productsQuery, settingsQuery, money } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Curated essentials, delivered worldwide" },
      { name: "description", content: "Shop watches, fashion, electronics, beauty and home — curated and shipped worldwide." },
      { property: "og:title", content: "Curated essentials, delivered worldwide" },
      { property: "og:description", content: "Shop watches, fashion, electronics, beauty and home — curated and shipped worldwide." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: s } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const featured = products.filter((p) => p.is_featured).concat(products.filter((p) => !p.is_featured)).slice(0, 8);

  if (s?.maintenance_mode) {
    return (
      <div className="bg-hero flex min-h-screen flex-col items-center justify-center p-8 text-center text-primary-foreground">
        <h1 className="text-6xl">{s.store_name}</h1>
        <p className="mt-4 opacity-70">We're polishing things up. Back shortly.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {s?.announcement_enabled && s.announcement && (
        <div className="bg-primary py-2 text-center text-xs tracking-wide text-primary-foreground">{s.announcement}</div>
      )}
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          {s?.logo_url ? <img src={s.logo_url} alt={s.store_name} className="h-8" /> : <span className="font-display text-3xl">{s?.store_name ?? "\u00a0"}</span>}
          <nav className="hidden gap-8 text-sm md:flex">
            {cats.slice(0, 5).map((c) => <span key={c.id} className="cursor-pointer hover:text-gold">{c.name}</span>)}
          </nav>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">Account</Link>
        </div>
      </header>

      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <p className="eyebrow text-gold">New season</p>
          <h1 className="mt-6 max-w-3xl text-6xl leading-[1.05] md:text-8xl">{s?.tagline ?? ""}</h1>
          <Button variant="hero" size="lg" className="mt-10">Shop the collection <ArrowRight /></Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between">
          <div><p className="eyebrow text-gold">Featured</p><h2 className="mt-2 text-5xl">Selected pieces</h2></div>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {featured.map((p) => (
            <article key={p.id} className="group">
              <div className="aspect-[4/5] overflow-hidden rounded bg-secondary">
                {p.images[0] ? (
                  <img src={p.images[0]} alt={p.name} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="flex size-full items-center justify-center font-display text-5xl text-muted-foreground/40">{p.name[0]}</div>
                )}
              </div>
              <h3 className="mt-4 text-xl">{p.name}</h3>
              <p className="text-sm">
                {money(p.price, s?.currency)}
                {p.compare_at_price && <span className="ml-2 text-muted-foreground line-through">{money(p.compare_at_price, s?.currency)}</span>}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t py-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {s?.store_name} {s?.support_email && `· ${s.support_email}`}
      </footer>
    </div>
  );
}
