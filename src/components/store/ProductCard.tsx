import { Link } from "@tanstack/react-router";
import { money, type Product } from "@/lib/store";

export function ProductCard({ p, currency, fromPrice }: { p: Product; currency?: string | undefined; fromPrice?: number | undefined }) {
  const price = fromPrice ?? Number(p.price);
  const onSale = p.compare_at_price && Number(p.compare_at_price) > price;
  return (
    <Link to="/product/$slug" params={{ slug: p.slug }} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded bg-secondary">
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.name} loading="lazy" className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="flex size-full items-center justify-center font-display text-6xl text-muted-foreground/30">{p.name[0]}</div>
        )}
        {onSale && <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">Sale</span>}
        {p.stock <= 0 && <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">Sold out</span>}
      </div>
      <h3 className="mt-4 text-xl leading-tight">{p.name}</h3>
      <p className="mt-1 text-sm">
        {fromPrice !== undefined && fromPrice !== Number(p.price) ? "From " : ""}
        {money(price, currency)}
        {onSale && <span className="ml-2 text-muted-foreground line-through">{money(p.compare_at_price, currency)}</span>}
      </p>
    </Link>
  );
}
