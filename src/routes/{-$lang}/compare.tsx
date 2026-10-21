import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { brandsQuery, categoriesQuery, money, productsQuery, settingsQuery } from "@/lib/store";
import { getCompare, setCompare, useCompare } from "@/lib/compare";
import { isValidLang, useLang } from "@/lib/i18n";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export const Route = createFileRoute("/{-$lang}/compare")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  head: () => ({
    meta: [
      { title: "Compare products" },
      { name: "description", content: "Compare products side by side." },
      { property: "og:title", content: "Compare products" },
      { property: "og:description", content: "Compare products side by side." },
    ],
  }),
  component: Compare,
});

function Compare() {
  const lang = useLang();
  const ids = useCompare();
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const { data: s } = useQuery(settingsQuery);
  const cur = s?.currency;

  const items = ids.map((id) => products.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p && p.status === "active");

  const remove = (id: string) => setCompare(getCompare().filter((x) => x !== id));

  const rows: { label: string; value: (p: NonNullable<(typeof items)[number]>) => React.ReactNode }[] = [
    { label: "Price", value: (p) => <span className="font-medium">{money(p.sale_price ?? p.price, cur)}</span> },
    { label: "Regular price", value: (p) => (p.compare_at_price ? money(p.compare_at_price, cur) : "—") },
    { label: "Category", value: (p) => cats.find((c) => c.id === p.category_id)?.name ?? "—" },
    { label: "Brand", value: (p) => brands.find((b) => b.id === p.brand_id)?.name ?? "—" },
    { label: "Availability", value: (p) => (p.stock > 0 ? `${p.stock} in stock` : "Sold out") },
    { label: "SKU", value: (p) => p.sku ?? "—" },
    { label: "Weight", value: (p) => (p.weight_grams ? `${p.weight_grams} g` : "—") },
    { label: "Description", value: (p) => <span className="text-xs text-muted-foreground">{p.short_description ?? "—"}</span> },
  ];

  const specKeys = [...new Set(items.flatMap((p) => Object.keys((p.specifications as Record<string, string>) ?? {})))];
  for (const k of specKeys) {
    rows.push({ label: k, value: (p) => (p.specifications as Record<string, string>)?.[k] ?? "—" });
  }

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <p className="eyebrow text-gold">Side by side</p>
        <h1 className="mt-2 text-6xl">Compare</h1>
        {items.length === 0 ? (
          <div className="mt-10 rounded border border-dashed py-20 text-center text-muted-foreground">
            Nothing to compare yet. Use the compare button on any product.{" "}
            <Link to="/{-$lang}/shop" params={{ lang: lang ?? undefined }} className="text-gold">Browse the shop</Link>
          </div>
        ) : (
          <div className="mt-10 overflow-x-auto rounded border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-40 p-4 text-left text-xs text-muted-foreground">Product</th>
                  {items.map((p) => (
                    <th key={p.id} className="p-4 text-left align-top">
                      <div className="relative">
                        <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="absolute -right-1 -top-1 rounded-full border bg-background p-1"><X className="size-3" /></button>
                        <Link to="/{-$lang}/product/$slug" params={{ lang: lang ?? undefined, slug: p.slug }}>
                          {p.images[0] && <img src={p.images[0]} alt={p.name} className="aspect-square w-28 rounded object-cover" />}
                          <span className="mt-2 block font-medium">{p.name}</span>
                        </Link>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="p-4 text-xs text-muted-foreground">{r.label}</td>
                    {items.map((p) => <td key={p.id} className="p-4 align-top">{r.value(p)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
