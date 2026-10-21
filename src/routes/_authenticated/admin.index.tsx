import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DollarSign, Package, ShoppingBag, AlertTriangle, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Plus, TicketPercent, LayoutTemplate, History } from "lucide-react";
import { ordersQuery, productsQuery, settingsQuery, activityQuery, money, type Order } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

const DAY = 24 * 60 * 60 * 1000;

function inLast(o: Order, days: number, offset = 0) {
  const t = new Date(o.created_at).getTime();
  const now = Date.now() - offset * days * DAY;
  return t >= now - days * DAY && t < now + DAY;
}

function Dashboard() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const { data: activity = [] } = useQuery(activityQuery);
  const cur = settings?.currency ?? "USD";
  const [range, setRange] = useState(14);

  const live = orders.filter((o) => o.status !== "cancelled");
  const period = live.filter((o) => inLast(o, range));
  const prev = live.filter((o) => inLast(o, range, 1));
  const revenue = period.reduce((s, o) => s + Number(o.total), 0);
  const prevRevenue = prev.reduce((s, o) => s + Number(o.total), 0);
  const delta = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  const aov = period.length ? revenue / period.length : 0;
  const today = live.filter((o) => o.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const customers = new Set(orders.map((o) => o.customer_email.toLowerCase())).size;
  const pending = orders.filter((o) => o.status === "pending").length;
  const lowStock = products.filter((p) => p.stock <= p.low_stock_threshold);

  const days = Array.from({ length: Math.max(range, 7) }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (Math.max(range, 7) - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const total = live.filter((o) => o.created_at.slice(0, 10) === key).reduce((s, o) => s + Number(o.total), 0);
    return { day: key.slice(5), total };
  });

  const units = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of live) {
    for (const l of o.items as { name: string; qty: number; price: number }[]) {
      const e = units.get(l.name) ?? { name: l.name, qty: 0, revenue: 0 };
      e.qty += l.qty;
      e.revenue += l.qty * l.price;
      units.set(l.name, e);
    }
  }
  const top = [...units.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const stats = [
    { label: `Revenue · ${range} days`, value: money(revenue, cur), icon: DollarSign, sub: delta === null ? "No prior period" : `${delta >= 0 ? "+" : ""}${delta}% vs previous ${range} days`, up: (delta ?? 0) >= 0 },
    { label: `Orders · ${range} days`, value: period.length, icon: ShoppingBag, sub: pending ? `${pending} awaiting action` : "Nothing pending", up: true },
    { label: "Avg. order value", value: money(aov, cur), icon: TrendingUp, sub: `${today.length} order${today.length === 1 ? "" : "s"} today`, up: true },
    { label: "Customers", value: customers, icon: Users, sub: "Unique ordering customers", up: true },
    { label: "Low stock", value: lowStock.length, icon: AlertTriangle, sub: `${products.filter((p) => p.status === "active").length} active products`, up: lowStock.length === 0 },
  ];

  const quick = [
    { to: "/admin/products", label: "Add a product", icon: Plus },
    { to: "/admin/coupons", label: "Create a coupon", icon: TicketPercent },
    { to: "/admin/homepage", label: "Edit homepage", icon: LayoutTemplate },
    { to: "/admin/orders", label: "Manage orders", icon: ShoppingBag },
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Your store at a glance">
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Date range">
          {[7, 14, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setRange(d)} aria-pressed={range === d}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${range === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{d}d</button>
          ))}
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-muted-foreground">{s.label}</p>
              <s.icon className="size-4 text-gold" />
            </div>
            <p className="mt-3 font-display text-4xl">{s.value}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {s.label.startsWith("Revenue") && delta !== null && (s.up ? <ArrowUpRight className="size-3 text-success" /> : <ArrowDownRight className="size-3 text-destructive" />)}
              {s.sub}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quick.map((q) => (
          <Link key={q.to} to={q.to}>
            <Card className="flex items-center gap-3 p-4 transition-colors hover:border-gold">
              <q.icon className="size-4 text-gold" />
              <span className="text-sm font-medium">{q.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-muted-foreground">Sales · last {Math.max(range, 7)} days</p>
          <Link to="/admin/reports" className="text-sm text-gold">Full reports</Link>
        </div>
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
          <p className="eyebrow text-muted-foreground">Top products by units sold</p>
          <div className="mt-4 divide-y">
            {top.map((t) => (
              <div key={t.name} className="flex justify-between py-3 text-sm">
                <span>{t.name}</span>
                <span className="text-muted-foreground">{t.qty} sold · {money(t.revenue, cur)}</span>
              </div>
            ))}
            {top.length === 0 && <p className="py-6 text-sm text-muted-foreground">No sales yet.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex justify-between">
            <p className="eyebrow text-muted-foreground">Low stock alerts</p>
            <Link to="/admin/products" className="text-sm text-gold">Manage</Link>
          </div>
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
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <p className="eyebrow text-muted-foreground">Recent activity</p>
            <History className="size-4 text-gold" />
          </div>
          <div className="mt-4 divide-y">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="py-3 text-sm">
                <p className="capitalize">{a.action} · {a.entity}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
              </div>
            ))}
            {activity.length === 0 && <p className="py-6 text-sm text-muted-foreground">No activity recorded yet.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
