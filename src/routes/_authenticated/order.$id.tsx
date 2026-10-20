import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, optionLabel } from "@/lib/store";
import { StoreLayout } from "@/components/store/StoreLayout";
import { StatusPill } from "@/components/admin/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/order/$id")({
  head: () => ({ meta: [{ title: "Order details" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

type Line = { name: string; qty: number; price: number; options?: Record<string, string>; image?: string | null };

function OrderPage() {
  const { id } = Route.useParams();
  const { data: o, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <StoreLayout><div className="mx-auto max-w-3xl p-14"><Skeleton className="h-96" /></div></StoreLayout>;
  if (!o) return <StoreLayout><div className="py-32 text-center"><h1 className="text-5xl">Order not found</h1></div></StoreLayout>;
  const addr = o.shipping_address as { line1?: string; line2?: string; city?: string; state?: string; postal?: string; country?: string };
  const fresh = Date.now() - new Date(o.created_at).getTime() < 10 * 60 * 1000;

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-6 py-14">
        {fresh && (
          <div className="mb-10 flex items-center gap-4 rounded border border-gold bg-gold-soft/40 p-6">
            <CheckCircle2 className="size-8 text-gold" />
            <div><p className="font-display text-2xl">Thank you — your order is confirmed.</p><p className="text-sm text-muted-foreground">You'll pay in cash on delivery. We'll keep you updated by email.</p></div>
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow text-gold">Order</p><h1 className="mt-2 text-6xl">#{o.order_number}</h1><p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p></div>
          <div className="flex gap-2"><StatusPill value={o.status} /><StatusPill value={o.payment_status} /></div>
        </div>
        <div className="mt-10 divide-y rounded border bg-card">
          {(o.items as Line[]).map((l, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="size-16 overflow-hidden rounded bg-secondary">{l.image && <img src={l.image} alt="" className="size-full object-cover" />}</div>
              <div className="flex-1"><p>{l.name}</p>{l.options && <p className="text-xs text-muted-foreground">{optionLabel(l.options)}</p>}<p className="text-xs text-muted-foreground">Qty {l.qty} × {money(l.price, o.currency)}</p></div>
              <p>{money(l.price * l.qty, o.currency)}</p>
            </div>
          ))}
          <div className="space-y-1 p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(o.subtotal, o.currency)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{money(o.shipping_total, o.currency)}</span></div>
            <div className="flex justify-between font-display text-2xl"><span>Total</span><span>{money(o.total, o.currency)}</span></div>
          </div>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 text-sm">
          <div className="rounded border bg-card p-4"><p className="eyebrow mb-2 text-muted-foreground">Ship to</p><p>{o.customer_name}</p><p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p><p>{[addr.city, addr.state, addr.postal].filter(Boolean).join(", ")}</p><p>{addr.country}</p></div>
          <div className="rounded border bg-card p-4"><p className="eyebrow mb-2 text-muted-foreground">Payment</p><p>Cash on Delivery</p><p className="text-muted-foreground">{o.customer_email}</p></div>
        </div>
        <Link to="/account" className="mt-10 inline-block text-sm text-gold">← All orders</Link>
      </div>
    </StoreLayout>
  );
}
