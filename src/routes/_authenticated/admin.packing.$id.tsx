import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { optionLabel, settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/packing/$id")({
  head: () => ({ meta: [{ title: "Packing slip" }, { name: "robots", content: "noindex" }] }),
  component: PackingPage,
});

type Line = { name: string; qty: number; sku?: string; options?: Record<string, string> };

function PackingPage() {
  const { id } = Route.useParams();
  const { data: o, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: s } = useQuery(settingsQuery);

  if (isLoading) return <div className="mx-auto max-w-3xl p-14"><Skeleton className="h-96" /></div>;
  if (!o) return <div className="py-32 text-center"><h1 className="text-4xl">Order not found</h1></div>;

  const addr = o.shipping_address as { line1?: string; line2?: string; city?: string; state?: string; postal?: string; country?: string };
  const items = o.items as Line[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:py-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="no-print mb-6 flex items-center justify-between">
        <Link to="/admin/orders" className="text-sm text-gold">← Back to orders</Link>
        <Button variant="gold" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
      </div>

      <div className="rounded border bg-card p-8 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            {s?.logo_url && <img src={s.logo_url} alt={s.store_name} className="mb-2 h-10 object-contain" />}
            <p className="font-display text-3xl">{s?.store_name ?? "Store"}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl">PACKING SLIP</p>
            <p className="text-sm">#{o.order_number}</p>
            <p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="border-b py-6 text-sm">
          <p className="eyebrow mb-2 text-muted-foreground">Ship to</p>
          <p className="font-medium">{o.customer_name}</p>
          <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
          <p>{[addr.city, addr.state, addr.postal].filter(Boolean).join(", ")}</p>
          <p>{addr.country}</p>
          {o.customer_phone && <p>{o.customer_phone}</p>}
        </div>

        <table className="w-full py-6 text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">SKU</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Packed</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{l.name}{l.options && <span className="block text-xs text-muted-foreground">{optionLabel(l.options)}</span>}</td>
                <td className="py-2 text-muted-foreground">{l.sku ?? "—"}</td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right"><span className="inline-block size-4 rounded border" /></td>
              </tr>
            ))}
          </tbody>
        </table>

        {o.notes && <p className="mt-4 rounded bg-muted p-3 text-sm">Order note: {o.notes}</p>}
        {o.tracking_number && <p className="mt-4 text-sm">Tracking: {o.tracking_number}</p>}
        <p className="mt-6 border-t pt-4 text-sm text-muted-foreground">Payment: {o.payment_method === "cod" ? `Cash on Delivery — collect ${o.total} ${o.currency}` : "Card (prepaid)"}</p>
      </div>
    </div>
  );
}
