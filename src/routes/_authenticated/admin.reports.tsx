import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { money, ordersQuery, settingsQuery, couponsQuery, productsQuery, categoriesQuery, productCostsQuery, downloadCsv, type Order } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsPage,
});

const DAY = 24 * 60 * 60 * 1000;
const TABS = ["Sales", "Cash on Delivery", "Coupons", "Inventory", "Categories", "Profitability"] as const;
const RANGES = [7, 14, 30, 90];

function inRange(o: Order, days: number, offset = 0) {
  const t = new Date(o.created_at).getTime();
  const end = Date.now() - offset * days * DAY;
  return t >= end - days * DAY && t < end + DAY;
}

function ReportsPage() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: s } = useQuery(settingsQuery);
  const { data: coupons = [] } = useQuery(couponsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: costs = [] } = useQuery(productCostsQuery);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Sales");
  const [days, setDays] = useState(30);
  const cur = s?.currency ?? "USD";
  const live = orders.filter((o) => o.status !== "cancelled");

  // ---- Sales ----
  const period = live.filter((o) => inRange(o, days));
  const prev = live.filter((o) => inRange(o, days, 1));
  const sum = (l: Order[]) => l.reduce((t, o) => t + Number(o.total), 0);
  const revenue = sum(period);
  const prevRevenue = sum(prev);
  const delta = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  const aov = period.length ? revenue / period.length : 0;
  const itemsSold = period.reduce((t, o) => t + (o.items as { qty: number }[]).reduce((x, l) => x + l.qty, 0), 0);
  const chart = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    return { day: key.slice(5), total: live.filter((o) => o.created_at.slice(0, 10) === key).reduce((t, o) => t + Number(o.total), 0) };
  });
  const prod = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of period) {
    for (const l of o.items as { name: string; qty: number; price: number }[]) {
      const e = prod.get(l.name) ?? { name: l.name, qty: 0, revenue: 0 };
      e.qty += l.qty;
      e.revenue += l.qty * l.price;
      prod.set(l.name, e);
    }
  }
  const topProducts = [...prod.values()].sort((a, b) => b.revenue - a.revenue);

  // ---- Categories ----
  const catOf = new Map(products.map((p) => [p.id, p.category_id]));
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Uncategorized";
  const catMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of period) {
    for (const l of o.items as { product_id?: string; name: string; qty: number; price: number }[]) {
      const cid = (l.product_id && catOf.get(l.product_id)) || null;
      const name = catName(cid);
      const e = catMap.get(name) ?? { name, qty: 0, revenue: 0 };
      e.qty += l.qty;
      e.revenue += l.qty * l.price;
      catMap.set(name, e);
    }
  }
  const catRows = [...catMap.values()].sort((a, b) => b.revenue - a.revenue);
  function exportCategories() {
    downloadCsv(`sales-by-category-${days}-days.csv`, [
      ["Category", "Units sold", "Revenue"],
      ...catRows.map((r) => [r.name, r.qty, r.revenue.toFixed(2)]),
    ]);
  }

  // ---- Profitability ----
  const costOf = new Map(costs.map((c) => [c.product_id, Number(c.cost_price ?? 0)]));
  const profitMap = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
  for (const o of period) {
    for (const l of o.items as { product_id?: string; name: string; qty: number; price: number }[]) {
      const e = profitMap.get(l.name) ?? { name: l.name, qty: 0, revenue: 0, cost: 0 };
      e.qty += l.qty;
      e.revenue += l.qty * l.price;
      e.cost += l.qty * (l.product_id ? costOf.get(l.product_id) ?? 0 : 0);
      profitMap.set(l.name, e);
    }
  }
  const profitRows = [...profitMap.values()].map((r) => ({ ...r, profit: r.revenue - r.cost, margin: r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : 0 })).sort((a, b) => b.profit - a.profit);
  const totalProfit = profitRows.reduce((t, r) => t + r.profit, 0);
  const totalCost = profitRows.reduce((t, r) => t + r.cost, 0);
  function exportProfit() {
    downloadCsv(`profitability-${days}-days.csv`, [
      ["Product", "Units sold", "Revenue", "Cost", "Profit", "Margin %"],
      ...profitRows.map((r) => [r.name, r.qty, r.revenue.toFixed(2), r.cost.toFixed(2), r.profit.toFixed(2), r.margin]),
    ]);
  }

  function exportOrders() {
    downloadCsv(`orders-last-${days}-days.csv`, [
      ["Order", "Date", "Customer", "Email", "Status", "Payment", "Method", "Subtotal", "Discount", "Shipping", "Fee", "Total", "Currency"],
      ...orders.filter((o) => inRange(o, days)).map((o) => [o.order_number, o.created_at.slice(0, 10), o.customer_name, o.customer_email, o.status, o.payment_status, o.payment_method, o.subtotal, o.discount_total, o.shipping_total, o.payment_fee, o.total, o.currency]),
    ]);
  }

  // ---- COD ----
  const cod = orders.filter((o) => o.payment_method === "cod");
  const codLive = cod.filter((o) => o.status !== "cancelled");
  const codGroups = [
    { label: "Awaiting confirmation", list: codLive.filter((o) => !o.cod_confirmed_at) },
    { label: "Confirmed, cash not collected", list: codLive.filter((o) => o.cod_confirmed_at && !o.cod_collected_at) },
    { label: "Cash collected", list: codLive.filter((o) => o.cod_collected_at) },
    { label: "Cancelled COD orders", list: cod.filter((o) => o.status === "cancelled") },
  ];
  const codFees = codLive.reduce((t, o) => t + Number(o.payment_fee), 0);

  // ---- Coupons ----
  const couponRows = coupons.map((c) => {
    const withCode = live.filter((o) => o.coupon_code === c.code);
    return { code: c.code, used: c.used_count, discount: withCode.reduce((t, o) => t + Number(o.discount_total), 0), revenue: sum(withCode), active: c.is_active };
  });
  function exportCoupons() {
    downloadCsv("coupon-performance.csv", [
      ["Code", "Times used", "Discount given", "Revenue with coupon", "Active"],
      ...couponRows.map((r) => [r.code, r.used, r.discount.toFixed(2), r.revenue.toFixed(2), r.active ? "yes" : "no"]),
    ]);
  }

  // ---- Inventory ----
  const stockValue = products.reduce((t, p) => t + p.stock * Number(p.price), 0);
  const outOfStock = products.filter((p) => p.stock === 0);
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold);
  function exportInventory() {
    downloadCsv("inventory.csv", [
      ["Product", "SKU", "Status", "Price", "Stock", "Low stock threshold", "Stock value"],
      ...products.map((p) => [p.name, p.sku, p.status, p.price, p.stock, p.low_stock_threshold, (p.stock * Number(p.price)).toFixed(2)]),
    ]);
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Live figures from your real store data.">
        {tab === "Sales" && (
          <select aria-label="Date range" className="h-9 rounded-md border bg-card px-3 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => <option key={r} value={r}>Last {r} days</option>)}
          </select>
        )}
        {tab === "Sales" && <Button variant="outline" onClick={exportOrders}><Download className="size-4" /> Export orders CSV</Button>}
        {tab === "Coupons" && <Button variant="outline" onClick={exportCoupons}><Download className="size-4" /> Export CSV</Button>}
        {tab === "Inventory" && <Button variant="outline" onClick={exportInventory}><Download className="size-4" /> Export CSV</Button>}
        {tab === "Categories" && <Button variant="outline" onClick={exportCategories}><Download className="size-4" /> Export CSV</Button>}
        {tab === "Profitability" && <Button variant="outline" onClick={exportProfit}><Download className="size-4" /> Export CSV</Button>}
        {(tab === "Categories" || tab === "Profitability") && (
          <select aria-label="Date range" className="h-9 rounded-md border bg-card px-3 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => <option key={r} value={r}>Last {r} days</option>)}
          </select>
        )}
      </PageHeader>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap rounded-md px-4 py-2 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t}</button>
        ))}
      </div>

      {tab === "Sales" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Revenue</p><p className="mt-2 font-display text-4xl">{money(revenue, cur)}</p><p className="mt-1 text-xs text-muted-foreground">{delta === null ? "No prior period to compare" : `${delta >= 0 ? "+" : ""}${delta}% vs previous ${days} days`}</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Orders</p><p className="mt-2 font-display text-4xl">{period.length}</p><p className="mt-1 text-xs text-muted-foreground">{orders.filter((o) => o.status === "cancelled" && inRange(o, days)).length} cancelled in range</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Avg. order value</p><p className="mt-2 font-display text-4xl">{money(aov, cur)}</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Items sold</p><p className="mt-2 font-display text-4xl">{itemsSold}</p></Card>
          </div>
          <Card className="mt-6 p-6">
            <p className="eyebrow text-muted-foreground">Revenue per day</p>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" stroke="var(--chart-1)" fill="url(#rg)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="mt-6 p-4">
            <p className="eyebrow mb-2 px-2 pt-2 text-muted-foreground">Product performance · last {days} days</p>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Units sold</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {topProducts.map((p) => (
                  <TableRow key={p.name}><TableCell>{p.name}</TableCell><TableCell>{p.qty}</TableCell><TableCell>{money(p.revenue, cur)}</TableCell></TableRow>
                ))}
                {topProducts.length === 0 && <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No sales in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {tab === "Cash on Delivery" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {codGroups.map((g) => (
              <Card key={g.label} className="p-6">
                <p className="eyebrow text-muted-foreground">{g.label}</p>
                <p className="mt-2 font-display text-4xl">{g.list.length}</p>
                <p className="text-sm text-muted-foreground">{money(sum(g.list), cur)}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-6 p-6 text-sm">
            <p>Total COD orders: <strong>{cod.length}</strong> · COD fees charged (excluding cancelled): <strong>{money(codFees, cur)}</strong></p>
            <p className="mt-1 text-muted-foreground">Collection rate: {codLive.length ? Math.round((codGroups[2]!.list.length / codLive.length) * 100) : 0}% of active COD orders.</p>
          </Card>
        </>
      )}

      {tab === "Coupons" && (
        <Card className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Status</TableHead><TableHead>Times used</TableHead><TableHead>Discount given</TableHead><TableHead>Revenue with coupon</TableHead></TableRow></TableHeader>
            <TableBody>
              {couponRows.map((c) => (
                <TableRow key={c.code}>
                  <TableCell className="font-medium">{c.code}</TableCell>
                  <TableCell>{c.active ? "Active" : "Inactive"}</TableCell>
                  <TableCell>{c.used}</TableCell>
                  <TableCell>{money(c.discount, cur)}</TableCell>
                  <TableCell>{money(c.revenue, cur)}</TableCell>
                </TableRow>
              ))}
              {couponRows.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No coupons yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "Categories" && (
        <Card className="p-4">
          <p className="eyebrow mb-2 px-2 pt-2 text-muted-foreground">Sales by category · last {days} days</p>
          <Table>
            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Units sold</TableHead><TableHead>Revenue</TableHead><TableHead>Share</TableHead></TableRow></TableHeader>
            <TableBody>
              {catRows.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.qty}</TableCell>
                  <TableCell>{money(r.revenue, cur)}</TableCell>
                  <TableCell>{revenue > 0 ? `${Math.round((r.revenue / revenue) * 100)}%` : "—"}</TableCell>
                </TableRow>
              ))}
              {catRows.length === 0 && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No sales in this period.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "Profitability" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Revenue</p><p className="mt-2 font-display text-4xl">{money(revenue, cur)}</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Cost of goods</p><p className="mt-2 font-display text-4xl">{money(totalCost, cur)}</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Gross profit</p><p className="mt-2 font-display text-4xl">{money(totalProfit, cur)}</p><p className="mt-1 text-xs text-muted-foreground">{revenue > 0 ? `${Math.round((totalProfit / revenue) * 100)}% margin` : "—"}</p></Card>
          </div>
          <Card className="mt-6 p-4">
            <p className="eyebrow mb-2 px-2 pt-2 text-muted-foreground">Profit per product · last {days} days</p>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Units</TableHead><TableHead>Revenue</TableHead><TableHead>Cost</TableHead><TableHead>Profit</TableHead><TableHead>Margin</TableHead></TableRow></TableHeader>
              <TableBody>
                {profitRows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.qty}</TableCell>
                    <TableCell>{money(r.revenue, cur)}</TableCell>
                    <TableCell>{money(r.cost, cur)}</TableCell>
                    <TableCell className={r.profit < 0 ? "text-destructive" : ""}>{money(r.profit, cur)}</TableCell>
                    <TableCell>{r.margin}%</TableCell>
                  </TableRow>
                ))}
                {profitRows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No sales in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <p className="px-2 pb-2 pt-3 text-xs text-muted-foreground">Costs come from the staff-only cost price on each product. Products without a cost price count as zero cost.</p>
          </Card>
        </>
      )}

      {tab === "Inventory" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Stock value at retail</p><p className="mt-2 font-display text-4xl">{money(stockValue, cur)}</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Out of stock</p><p className="mt-2 font-display text-4xl">{outOfStock.length}</p></Card>
            <Card className="p-6"><p className="eyebrow text-muted-foreground">Low stock</p><p className="mt-2 font-display text-4xl">{lowStock.length}</p></Card>
          </div>
          <Card className="mt-6 p-4">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Status</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Stock value</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...products].sort((a, b) => a.stock - b.stock).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="capitalize">{p.status}</TableCell>
                    <TableCell>{money(p.price, cur)}</TableCell>
                    <TableCell className={p.stock === 0 ? "text-destructive" : p.stock <= p.low_stock_threshold ? "text-warning" : ""}>{p.stock}</TableCell>
                    <TableCell>{money(p.stock * Number(p.price), cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </>
  );
}
