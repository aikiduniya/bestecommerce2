import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { money, ordersQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
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
      <PageHeader title="Customers" subtitle={`${map.size} customers who have ordered`} />
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
