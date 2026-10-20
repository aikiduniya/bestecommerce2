import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ordersQuery, money } from "@/lib/store";
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
  const list = orders.filter((o) => filter === "all" || o.status === filter);

  async function update(id: string, patch: { status?: string; payment_status?: string }) {
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Order updated");
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Fulfilment</TableHead>
              <TableHead>Paid</TableHead>
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
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No orders yet. They will appear here once customers check out.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
