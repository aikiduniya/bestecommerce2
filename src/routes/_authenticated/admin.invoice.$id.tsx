import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, optionLabel, settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/invoice/$id")({
  head: () => ({ meta: [{ title: "Invoice" }, { name: "robots", content: "noindex" }] }),
  component: InvoicePage,
});

type Line = { name: string; qty: number; price: number; sku?: string; options?: Record<string, string> };

function InvoicePage() {
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
        <Button variant="gold" onClick={() => window.print()}><Printer className="size-4" /> Print / Save as PDF</Button>
      </div>

      <div className="rounded border bg-card p-8 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            {s?.logo_url && <img src={s.logo_url} alt={s.store_name} className="mb-2 h-10 object-contain" />}
            <p className="font-display text-3xl">{s?.store_name ?? "Store"}</p>
            {s?.support_email && <p className="text-sm text-muted-foreground">{s.support_email}</p>}
            {s?.support_phone && <p className="text-sm text-muted-foreground">{s.support_phone}</p>}
          </div>
          <div className="text-right">
            <p className="font-display text-2xl">INVOICE</p>
            <p className="text-sm">#{o.order_number}</p>
            <p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid gap-6 border-b py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Bill to</p>
            <p className="font-medium">{o.customer_name}</p>
            <p>{o.customer_email}</p>
            {o.customer_phone && <p>{o.customer_phone}</p>}
          </div>
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Ship to</p>
            <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
            <p>{[addr.city, addr.state, addr.postal].filter(Boolean).join(", ")}</p>
            <p>{addr.country}</p>
          </div>
        </div>

        <table className="w-full py-6 text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Price</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((l, i) => (
              <tr key={i} className="border-b">
                <td className="py-2">{l.name}<span className="block text-xs text-muted-foreground">{[l.sku, optionLabel(l.options)].filter(Boolean).join(" · ")}</span></td>
                <td className="py-2 text-right">{l.qty}</td>
                <td className="py-2 text-right">{money(l.price, o.currency)}</td>
                <td className="py-2 text-right">{money(l.price * l.qty, o.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(o.subtotal, o.currency)}</span></div>
          {Number(o.discount_total) > 0 && <div className="flex justify-between"><span>Discount{o.coupon_code ? ` (${o.coupon_code})` : ""}</span><span>−{money(o.discount_total, o.currency)}</span></div>}
          {Number(o.auto_discount_total) > 0 && <div className="flex justify-between"><span>Discount{o.auto_discount_name ? ` (${o.auto_discount_name})` : ""}</span><span>−{money(o.auto_discount_total, o.currency)}</span></div>}
          <div className="flex justify-between"><span>Shipping</span><span>{money(o.shipping_total, o.currency)}</span></div>
          {Number(o.tax_total) > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(o.tax_total, o.currency)}</span></div>}
          {Number(o.payment_fee) > 0 && <div className="flex justify-between"><span>COD fee</span><span>{money(o.payment_fee, o.currency)}</span></div>}
          <div className="flex justify-between border-t pt-2 font-display text-xl"><span>Total</span><span>{money(o.total, o.currency)}</span></div>
        </div>

        <div className="mt-8 border-t pt-4 text-sm text-muted-foreground">
          <p>Payment method: {o.payment_method === "cod" ? "Cash on Delivery" : "Card"} · Payment status: <span className="capitalize">{o.payment_status}</span></p>
          <p className="mt-1">Thank you for shopping with {s?.store_name ?? "us"}.</p>
        </div>
      </div>
    </div>
  );
}
