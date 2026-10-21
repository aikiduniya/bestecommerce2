import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/store";
import { isValidLang } from "@/lib/i18n";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GuestOrder = {
  order_number: number;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  items: { name: string; qty: number; price: number; options?: Record<string, string> }[];
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  payment_fee: number;
  discount_total: number;
  total: number;
  currency: string;
  created_at: string;
  customer_name: string;
};

export const Route = createFileRoute("/{-$lang}/track")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  validateSearch: (s: Record<string, unknown>) => ({
    n: typeof s["n"] === "number" ? s["n"] : typeof s["n"] === "string" && /^\d+$/.test(s["n"]) ? Number(s["n"]) : undefined,
    e: typeof s["e"] === "string" ? s["e"] : undefined,
    placed: s["placed"] === 1 || s["placed"] === "1" ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Track your order" },
      { name: "description", content: "Check the status of your guest order." },
      { property: "og:title", content: "Track your order" },
      { property: "og:description", content: "Check the status of your guest order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackOrder,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};

function TrackOrder() {
  const search = Route.useSearch();
  const [num, setNum] = useState(search.n ? String(search.n) : "");
  const [email, setEmail] = useState(search.e ?? "");
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!num.trim() || !email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("track_guest_order", { _order_number: Number(num), _email: email });
    setBusy(false);
    setSearched(true);
    if (error) { toast.error(error.message); return; }
    setOrder((data as GuestOrder | null) ?? null);
  }

  // Auto-lookup when arriving from checkout.
  if (search.n && search.e && !searched && !busy) void lookup();

  return (
    <StoreLayout>
      <div className="mx-auto max-w-xl px-6 py-16">
        {search.placed === 1 && order && (
          <div className="mb-8 rounded border border-gold bg-gold-soft/40 p-5 text-center">
            <p className="font-display text-3xl">Thank you, {order.customer_name.split(" ")[0]}.</p>
            <p className="mt-2 text-sm text-muted-foreground">Your order has been placed. Save your order number — you'll need it to track your order.</p>
          </div>
        )}
        <h1 className="text-5xl">Track your order</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter your order number and the email you used at checkout.</p>
        <form onSubmit={lookup} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Order number</Label>
            <Input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value)} placeholder="e.g. 1001" required />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" variant="gold" disabled={busy}>{busy ? "Looking up…" : "Find my order"}</Button>
        </form>

        {searched && !order && !busy && (
          <p className="mt-8 rounded border border-destructive/40 p-4 text-sm text-destructive">
            No guest order found with that number and email. Check both and try again.
          </p>
        )}

        {order && (
          <div className="mt-10 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Order</p>
                <p className="font-display text-3xl">#{order.order_number}</p>
              </div>
              <div className="text-right text-sm">
                <p><span className="text-muted-foreground">Status:</span> {STATUS_LABEL[order.status] ?? order.status}</p>
                <p><span className="text-muted-foreground">Payment:</span> {order.payment_status === "pending" ? "Pay on delivery" : order.payment_status}</p>
                <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="divide-y rounded border bg-card px-5 text-sm">
              {order.items.map((i, idx) => (
                <div key={idx} className="flex justify-between gap-3 py-3">
                  <span>{i.name} × {i.qty}{i.options && Object.keys(i.options).length > 0 && <span className="block text-xs text-muted-foreground">{Object.values(i.options).join(" / ")}</span>}</span>
                  <span>{money(i.price * i.qty, order.currency)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal, order.currency)}</span></div>
              {Number(order.discount_total) > 0 && <div className="flex justify-between text-success"><span>Discount</span><span>−{money(order.discount_total, order.currency)}</span></div>}
              <div className="flex justify-between"><span>Shipping</span><span>{money(order.shipping_total, order.currency)}</span></div>
              {Number(order.tax_total) > 0 && <div className="flex justify-between"><span>Tax</span><span>{money(order.tax_total, order.currency)}</span></div>}
              {Number(order.payment_fee) > 0 && <div className="flex justify-between"><span>Cash on Delivery fee</span><span>{money(order.payment_fee, order.currency)}</span></div>}
              <div className="flex justify-between pt-2 font-display text-2xl"><span>Total</span><span>{money(order.total, order.currency)}</span></div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
