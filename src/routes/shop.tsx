import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
import { brandsQuery, categoriesQuery, collectionsQuery, productCollectionsQuery, productsQuery, settingsQuery } from "@/lib/store";
import { useFromPrice } from "@/lib/useFromPrice";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  collection: z.string().optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  stock: z.enum(["in"]).optional(),
  sort: z.enum(["new", "price-asc", "price-desc", "name"]).optional(),
});

export const Route = createFileRoute("/shop")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Shop all products" },
      { name: "description", content: "Browse the full catalog — filter by category, brand, price and availability." },
      { property: "og:title", content: "Shop all products" },
      { property: "og:description", content: "Browse the full catalog — filter by category, brand, price and availability." },
    ],
  }),
  component: Shop,
});

function Shop() {
  const sp = Route.useSearch();
  const navigate = useNavigate({ from: "/shop" });
  const { data: products = [], isLoading } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const { data: cols = [] } = useQuery(collectionsQuery);
  const { data: pcs = [] } = useQuery(productCollectionsQuery);
  const { data: s } = useQuery(settingsQuery);
  const fromPrice = useFromPrice();

  const set = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const cat = cats.find((c) => c.slug === sp.category);
  const catIds = cat ? [cat.id, ...cats.filter((c) => c.parent_id === cat.id).map((c) => c.id)] : null;
  const brand = brands.find((b) => b.slug === sp.brand);
  const col = cols.find((c) => c.slug === sp.collection);
  const colIds = col ? pcs.filter((x) => x.collection_id === col.id).map((x) => x.product_id) : null;
  const q = sp.q?.toLowerCase().trim();
  const priceOf = (p: (typeof products)[number]) => fromPrice(p.id) ?? Number(p.price);

  let list = products.filter((p) => p.status === "active");
  if (q) list = list.filter((p) => [p.name, p.short_description, p.sku, ...p.tags].join(" ").toLowerCase().includes(q));
  if (catIds) list = list.filter((p) => p.category_id && catIds.includes(p.category_id));
  if (brand) list = list.filter((p) => p.brand_id === brand.id);
  if (colIds) list = list.filter((p) => colIds.includes(p.id));
  if (sp.min !== undefined) list = list.filter((p) => priceOf(p) >= sp.min!);
  if (sp.max !== undefined) list = list.filter((p) => priceOf(p) <= sp.max!);
  if (sp.stock === "in") list = list.filter((p) => p.stock > 0);
  list = [...list].sort((a, b) => {
    switch (sp.sort) {
      case "price-asc": return priceOf(a) - priceOf(b);
      case "price-desc": return priceOf(b) - priceOf(a);
      case "name": return a.name.localeCompare(b.name);
      default: return b.created_at.localeCompare(a.created_at);
    }
  });

  const title = col?.name ?? cat?.name ?? brand?.name ?? (q ? `Results for “${sp.q}”` : "Shop all");
  const select = "h-9 w-full rounded-md border bg-card px-3 text-sm";

  return (
    <StoreLayout>
      <div className="mx-auto max-w-7xl px-6 py-14">
        <p className="eyebrow text-gold">Catalog</p>
        <h1 className="mt-2 text-6xl">{title}</h1>
        <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-6 text-sm">
            <p className="flex items-center gap-2 font-medium"><SlidersHorizontal className="size-4" /> Filters</p>
            <div className="space-y-1.5">
              <label className="eyebrow text-muted-foreground">Search</label>
              <input className={select} defaultValue={sp.q} onKeyDown={(e) => e.key === "Enter" && set({ q: (e.target as HTMLInputElement).value || undefined })} placeholder="Press enter" />
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow text-muted-foreground">Category</label>
              <select className={select} value={sp.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })}>
                <option value="">All</option>
                {cats.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.slug}>{c.parent_id ? "— " : ""}{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="eyebrow text-muted-foreground">Brand</label>
              <select className={select} value={sp.brand ?? ""} onChange={(e) => set({ brand: e.target.value || undefined })}>
                <option value="">All</option>
                {brands.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.slug}>{b.name}</option>)}
              </select>
            </div>
            {cols.some((c) => c.is_active) && (
              <div className="space-y-1.5">
                <label className="eyebrow text-muted-foreground">Collection</label>
                <select className={select} value={sp.collection ?? ""} onChange={(e) => set({ collection: e.target.value || undefined })}>
                  <option value="">All</option>
                  {cols.filter((c) => c.is_active).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="eyebrow text-muted-foreground">Price</label>
              <div className="flex gap-2">
                <input type="number" min={0} placeholder="Min" defaultValue={sp.min} className={select} onBlur={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })} />
                <input type="number" min={0} placeholder="Max" defaultValue={sp.max} className={select} onBlur={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sp.stock === "in"} onChange={(e) => set({ stock: e.target.checked ? "in" : undefined })} /> In stock only
            </label>
            <button className="text-xs text-muted-foreground underline" onClick={() => navigate({ search: {} })}>Clear all</button>
          </aside>
          <div>
            <div className="mb-6 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{list.length} products</span>
              <select className="h-9 rounded-md border bg-card px-3" value={sp.sort ?? "new"} onChange={(e) => set({ sort: e.target.value as "new" })}>
                <option value="new">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="name">Name</option>
              </select>
            </div>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5]" />)}</div>
            ) : list.length === 0 ? (
              <div className="rounded border border-dashed py-24 text-center text-muted-foreground">No products match these filters.</div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
                {list.map((p) => <ProductCard key={p.id} p={p} currency={s?.currency} fromPrice={fromPrice(p.id)} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </StoreLayout>
  );
}
