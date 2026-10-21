import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Download, Users, Repeat, Crown, Wallet } from "lucide-react";
import { money, ordersQuery, downloadCsv } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { KpiCard, KpiGrid, PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const [q, setQ] = useState("");
  const map = new Map<string, { name: string; email: string; phone: string | null; orders: number; spent: number; last: string; currency: string }>();
  for (const o of orders) {
    const k = o.customer_email.toLowerCase();
    const cur = map.get(k) ?? { name: o.customer_name, email: o.customer_email, phone: o.customer_phone, orders: 0, spent: 0, last: o.created_at, currency: o.currency };
    cur.orders++;
    if (o.status !== "cancelled") cur.spent += Number(o.total);
    if (o.created_at > cur.last) cur.last = o.created_at;
    map.set(k, cur);
  }
  const list = [...map.values()].filter((c) => (c.name + c.email).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.spent - a.spent);

  return (
    <>
      <PageHeader title="Customers" subtitle={`${map.size} customers who have ordered`}>
        <Button variant="outline" onClick={() => downloadCsv("customers.csv", [
          ["Name", "Email", "Phone", "Orders", "Total spent", "Currency", "Last order"],
          ...list.map((c) => [c.name, c.email, c.phone, c.orders, c.spent.toFixed(2), c.currency, c.last.slice(0, 10)]),
        ])}><Download className="size-4" /> Export CSV</Button>
      </PageHeader>
      <KpiGrid>
        <KpiCard label="Customers" value={map.size} icon={Users} sub="Unique ordering customers" />
        <KpiCard label="Repeat buyers" value={[...map.values()].filter((c) => c.orders > 1).length} icon={Repeat} sub="Ordered more than once" />
        <KpiCard label="Top spender" value={list[0] ? money(list[0].spent, list[0].currency) : "—"} icon={Crown} sub={list[0]?.name ?? "No orders yet"} />
        <KpiCard label="Avg. lifetime value" value={map.size ? money([...map.values()].reduce((n, c) => n + c.spent, 0) / map.size, orders[0]?.currency ?? "USD") : "—"} icon={Wallet} sub="Per customer" />
      </KpiGrid>
      <Card className="p-4">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Orders</TableHead><TableHead>Total spent</TableHead><TableHead>Last order</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.email}>
                <TableCell><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.email}</p></TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.orders}</TableCell>
                <TableCell>{money(c.spent, c.currency)}</TableCell>
                <TableCell>{new Date(c.last).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No customers yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
