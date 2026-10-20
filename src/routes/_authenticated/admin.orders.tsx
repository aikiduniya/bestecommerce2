import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ordersQuery, money, optionLabel, type Order } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Eye, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: OrdersPage,
});

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const PAY = ["pending", "paid", "refunded", "failed"];

function OrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery(ordersQuery);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<Order | null>(null);
  const list = orders.filter((o) => (filter === "all" || o.status === filter) &&
    `${o.order_number} ${o.customer_name} ${o.customer_email}`.toLowerCase().includes(q.toLowerCase()));

  async function update(id: string, patch: { status?: string; payment_status?: string }) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (patch.status === "cancelled") qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(patch.status === "cancelled" ? "Order cancelled — stock returned to inventory" : "Order updated");
    qc.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <>
      <PageHeader title="Orders" subtitle="Track, fulfil and update payment status.">
        <select className="h-9 rounded-md border bg-card px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All orders</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </PageHeader>
      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search order #, name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Fulfilment</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <p className="font-medium">#{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                </TableCell>
                <TableCell>
                  <p>{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{o.customer_email}</p>
                </TableCell>
                <TableCell className="uppercase text-xs">{o.payment_method}</TableCell>
                <TableCell>{money(o.total, o.currency)}</TableCell>
                <TableCell>
                  <select className="h-8 rounded border bg-background px-2 text-xs capitalize" value={o.status} onChange={(e) => update(o.id, { status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusPill value={o.payment_status} />
                    <select className="h-8 rounded border bg-background px-2 text-xs" value={o.payment_status} onChange={(e) => update(o.id, { payment_status: e.target.value })}>
                      {PAY.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => setView(o)} aria-label="View"><Eye /></Button></TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No orders yet. They will appear here once customers check out.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          {view && (
            <>
              <DialogHeader><DialogTitle className="font-display text-3xl">Order #{view.order_number}</DialogTitle></DialogHeader>
              <div className="divide-y rounded border text-sm">
                {(view.items as { name: string; qty: number; price: number; sku?: string; options?: Record<string, string> }[]).map((l, i) => (
                  <div key={i} className="flex justify-between p-3"><span>{l.name} × {l.qty}<span className="block text-xs text-muted-foreground">{[l.sku, optionLabel(l.options)].filter(Boolean).join(" · ")}</span></span><span>{money(l.price * l.qty, view.currency)}</span></div>
                ))}
                <div className="space-y-1 p-3">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(view.subtotal, view.currency)}</span></div>
                  <div className="flex justify-between"><span>Shipping</span><span>{money(view.shipping_total, view.currency)}</span></div>
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{money(view.total, view.currency)}</span></div>
                </div>
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div><p className="eyebrow mb-1 text-muted-foreground">Customer</p><p>{view.customer_name}</p><p>{view.customer_email}</p><p>{view.customer_phone}</p></div>
                <div><p className="eyebrow mb-1 text-muted-foreground">Ship to</p>{Object.entries(view.shipping_address as Record<string, string>).filter(([, v]) => v).map(([k, v]) => <p key={k}>{v}</p>)}</div>
              </div>
              {view.notes && <p className="rounded bg-muted p-3 text-sm">Note: {view.notes}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
