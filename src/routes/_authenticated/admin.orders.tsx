import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ordersQuery, orderEventsQuery, orderNotesQuery, money, optionLabel, type Order } from "@/lib/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Eye, Printer, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: OrdersPage,
});

const STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled"];
const PAY = ["pending", "paid", "refunded", "failed"];
const FULFIL = ["unfulfilled", "packed", "shipped", "delivered", "returned"];

function OrdersPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery(ordersQuery);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<Order | null>(null);
  const [payFilter, setPayFilter] = useState("all");
  const list = orders.filter((o) => (filter === "all" || o.status === filter) && (payFilter === "all" || o.payment_method === payFilter || (payFilter === "cod-pending" && o.payment_method === "cod" && !o.cod_collected_at && o.status !== "cancelled")) &&
    `${o.order_number} ${o.customer_name} ${o.customer_email}`.toLowerCase().includes(q.toLowerCase()));

  async function update(id: string, patch: { status?: string; payment_status?: string; fulfillment_status?: string; cod_confirmed_at?: string; cod_collected_at?: string }) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (patch.status === "cancelled") qc.invalidateQueries({ queryKey: ["products"] });
    toast.success(patch.status === "cancelled" ? "Order cancelled — stock returned to inventory" : "Order updated");
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["order_events", id] });
    setView((v) => (v && v.id === id ? { ...v, ...patch } as Order : v));
  }

  return (
    <>
      <PageHeader title="Orders" subtitle="Track, fulfil and update payment status.">
        <select className="h-9 rounded-md border bg-card px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All orders</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Payment filter" className="h-9 rounded-md border bg-card px-3 text-sm" value={payFilter} onChange={(e) => setPayFilter(e.target.value)}>
          <option value="all">All payments</option><option value="cod">Cash on Delivery</option><option value="cod-pending">COD awaiting collection</option><option value="card">Card</option>
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
                <TableCell className="text-xs"><span className="uppercase">{o.payment_method}</span>
                  {o.payment_method === "cod" && o.status !== "cancelled" && <span className="block text-muted-foreground">{o.cod_collected_at ? "Collected" : o.cod_confirmed_at ? "Confirmed" : "Awaiting confirmation"}</span>}</TableCell>
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
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {view && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle className="font-display text-3xl">Order #{view.order_number}</DialogTitle>
                  <Button size="sm" variant="outline" asChild><Link to="/admin/orders/$id/invoice" params={{ id: view.id }} target="_blank"><Printer className="size-4" /> Invoice</Link></Button>
                </div>
              </DialogHeader>
              <div className="divide-y rounded border text-sm">
                {(view.items as { name: string; qty: number; price: number; sku?: string; options?: Record<string, string> }[]).map((l, i) => (
                  <div key={i} className="flex justify-between p-3"><span>{l.name} × {l.qty}<span className="block text-xs text-muted-foreground">{[l.sku, optionLabel(l.options)].filter(Boolean).join(" · ")}</span></span><span>{money(l.price * l.qty, view.currency)}</span></div>
                ))}
                <div className="space-y-1 p-3">
                  <div className="flex justify-between"><span>Subtotal</span><span>{money(view.subtotal, view.currency)}</span></div>
                  {Number(view.discount_total) > 0 && <div className="flex justify-between text-success"><span>Discount{view.coupon_code ? ` (${view.coupon_code})` : ""}</span><span>−{money(view.discount_total, view.currency)}</span></div>}
<div className="flex justify-between"><span>Shipping</span><span>{money(view.shipping_total, view.currency)}</span></div>
                  {Number(view.payment_fee) > 0 && <div className="flex justify-between"><span>COD fee</span><span>{money(view.payment_fee, view.currency)}</span></div>}
                  <div className="flex justify-between font-semibold"><span>Total</span><span>{money(view.total, view.currency)}</span></div>
                </div>
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-2">
                <div><p className="eyebrow mb-1 text-muted-foreground">Customer</p><p>{view.customer_name}</p><p>{view.customer_email}</p><p>{view.customer_phone}</p></div>
                <div><p className="eyebrow mb-1 text-muted-foreground">Ship to</p>{Object.entries(view.shipping_address as Record<string, string>).filter(([, v]) => v).map(([k, v]) => <p key={k}>{v}</p>)}</div>
              </div>
              {view.notes && <p className="rounded bg-muted p-3 text-sm">Note: {view.notes}</p>}
              <div className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm">
                <span className="text-muted-foreground">Fulfilment</span>
                <select aria-label="Fulfilment status" className="h-8 rounded border bg-background px-2 text-xs capitalize" value={view.fulfillment_status} onChange={(e) => update(view.id, { fulfillment_status: e.target.value })}>
                  {FULFIL.map((s) => <option key={s}>{s}</option>)}
                </select>
                {view.payment_method === "cod" && view.status !== "cancelled" && (
                  <>
                    {view.cod_confirmed_at ? <span className="text-xs text-muted-foreground">COD confirmed {new Date(view.cod_confirmed_at).toLocaleString()}</span>
                      : <Button size="sm" variant="outline" onClick={() => update(view.id, { cod_confirmed_at: new Date().toISOString(), status: view.status === "pending" ? "processing" : view.status })}>Confirm COD order</Button>}
                    {view.cod_collected_at ? <span className="text-xs text-muted-foreground">Cash collected {new Date(view.cod_collected_at).toLocaleString()}</span>
                      : <Button size="sm" variant="gold" onClick={() => update(view.id, { cod_collected_at: new Date().toISOString(), payment_status: "paid" })}>Mark cash collected</Button>}
                  </>
                )}
              </div>
              <div>
                <p className="eyebrow mb-2 text-muted-foreground">Timeline</p>
                <OrderTimeline orderId={view.id} />
              </div>
              <div>
                <p className="eyebrow mb-2 text-muted-foreground">Internal notes · visible to staff only</p>
                <OrderNotes orderId={view.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrderTimeline({ orderId }: { orderId: string }) {
  const { data: events = [] } = useQuery(orderEventsQuery(orderId));
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="space-y-3 border-l pl-4 text-sm">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gold" />
          <p>{e.message}</p>
          <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}

function OrderNotes({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery(orderNotesQuery(orderId));
  const [body, setBody] = useState("");

  async function add() {
    if (!body.trim()) return;
    const { error } = await supabase.from("order_notes").insert({ order_id: orderId, body: body.trim() });
    if (error) { toast.error(error.message); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["order_notes", orderId] });
  }

  async function remove(id: number) {
    const { error } = await supabase.from("order_notes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["order_notes", orderId] });
  }

  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <div key={n.id} className="flex items-start justify-between gap-3 rounded bg-muted p-3 text-sm">
          <div><p>{n.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p></div>
          <Button size="icon" variant="ghost" aria-label="Delete note" onClick={() => remove(n.id)}><Trash2 className="size-4" /></Button>
        </div>
      ))}
      {notes.length === 0 && <p className="text-sm text-muted-foreground">No internal notes yet.</p>}
      <div className="flex gap-2">
        <Input placeholder="Add an internal note…" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button variant="outline" onClick={add}>Add</Button>
      </div>
    </div>
  );
}
