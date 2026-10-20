import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { money, ordersQuery, settingsQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: s } = useQuery(settingsQuery);
  const cod = orders.filter((o) => o.payment_method === "cod");
  const live = cod.filter((o) => o.status !== "cancelled");
  const sum = (l: typeof orders) => l.reduce((t, o) => t + Number(o.total), 0);
  const groups = [
    { label: "Awaiting confirmation", list: live.filter((o) => !o.cod_confirmed_at) },
    { label: "Confirmed, cash not collected", list: live.filter((o) => o.cod_confirmed_at && !o.cod_collected_at) },
    { label: "Cash collected", list: live.filter((o) => o.cod_collected_at) },
    { label: "Cancelled COD orders", list: cod.filter((o) => o.status === "cancelled") },
  ];
  const fees = live.reduce((t, o) => t + Number(o.payment_fee), 0);

  return (
    <>
      <PageHeader title="Cash on Delivery report" subtitle="Live figures from your orders." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => (
          <Card key={g.label} className="p-6">
            <p className="eyebrow text-muted-foreground">{g.label}</p>
            <p className="mt-2 font-display text-4xl">{g.list.length}</p>
            <p className="text-sm text-muted-foreground">{money(sum(g.list), s?.currency)}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6 text-sm">
        <p>Total COD orders: <strong>{cod.length}</strong> · COD fees charged (excluding cancelled): <strong>{money(fees, s?.currency)}</strong></p>
        <p className="mt-1 text-muted-foreground">Collection rate: {live.length ? Math.round((groups[2]!.list.length / live.length) * 100) : 0}% of active COD orders.</p>
      </Card>
    </>
  );
}
