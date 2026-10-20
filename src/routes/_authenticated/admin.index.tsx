import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, Package, ShoppingBag, AlertTriangle } from "lucide-react";
import { ordersQuery, productsQuery, settingsQuery, money } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const cur = settings?.currency ?? "USD";

  const revenue = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);
  const lowStock = products.filter((p) => p.stock <= p.low_stock_threshold);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    const total = orders
      .filter((o) => o.created_at.slice(0, 10) === key && o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total), 0);
    return { day: key.slice(5), total };
  });

  const stats = [
    { label: "Revenue", value: money(revenue, cur), icon: DollarSign },
    { label: "Orders", value: orders.length, icon: ShoppingBag },
    { label: "Active products", value: products.filter((p) => p.status === "active").length, icon: Package },
    { label: "Low stock", value: lowStock.length, icon: AlertTriangle },
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Your store at a glance" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 text-gold" />
            </div>
            <p className="mt-3 font-display text-4xl">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <p className="eyebrow text-muted-foreground">Sales · last 14 days</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={days}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke="var(--chart-1)" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="flex justify-between">
            <p className="eyebrow text-muted-foreground">Recent orders</p>
            <Link to="/admin/orders" className="text-sm text-gold">View all</Link>
          </div>
          <div className="mt-4 divide-y">
            {orders.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center justify-between py-3 text-sm">
                <span>#{o.order_number} · {o.customer_name}</span>
                <span className="flex items-center gap-3"><StatusPill value={o.status} />{money(o.total, o.currency)}</span>
              </div>
            ))}
            {orders.length === 0 && <p className="py-6 text-sm text-muted-foreground">No orders yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <p className="eyebrow text-muted-foreground">Low stock alerts</p>
          <div className="mt-4 divide-y">
            {lowStock.slice(0, 6).map((p) => (
              <div key={p.id} className="flex justify-between py-3 text-sm">
                <span>{p.name}</span>
                <span className={p.stock === 0 ? "text-destructive" : "text-muted-foreground"}>{p.stock} left</span>
              </div>
            ))}
            {lowStock.length === 0 && <p className="py-6 text-sm text-muted-foreground">All stock levels healthy.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
