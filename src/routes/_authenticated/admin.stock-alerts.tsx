import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery, stockAlertsQuery, downloadCsv } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, MailCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/stock-alerts")({
  component: StockAlertsPage,
});

function StockAlertsPage() {
  const qc = useQueryClient();
  const { data: alerts = [] } = useQuery(stockAlertsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "Deleted product";
  const stockOf = (id: string) => products.find((p) => p.id === id)?.stock ?? 0;

  async function markNotified(id: string) {
    const { error } = await supabase.from("stock_alerts").update({ notified_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as notified");
    qc.invalidateQueries({ queryKey: ["stock_alerts"] });
  }

  function exportCsv() {
    downloadCsv("back-in-stock-subscribers.csv", [
      ["Product", "Email", "Subscribed", "Current stock", "Notified"],
      ...alerts.map((a) => [nameOf(a.product_id), a.email, a.created_at.slice(0, 10), stockOf(a.product_id), a.notified_at ? a.notified_at.slice(0, 10) : ""]),
    ]);
  }

  const waiting = alerts.filter((a) => !a.notified_at);

  return (
    <>
      <PageHeader title="Back-in-stock alerts" subtitle={`${waiting.length} subscribers waiting · ${alerts.length} total`}>
        <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
      </PageHeader>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Email</TableHead><TableHead>Subscribed</TableHead><TableHead>Stock now</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {alerts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{nameOf(a.product_id)}</TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>{new Date(a.created_at).toLocaleDateString()}</TableCell>
                <TableCell className={stockOf(a.product_id) > 0 ? "text-success" : "text-destructive"}>{stockOf(a.product_id)}</TableCell>
                <TableCell>{a.notified_at ? `Notified ${new Date(a.notified_at).toLocaleDateString()}` : "Waiting"}</TableCell>
                <TableCell>
                  {!a.notified_at && stockOf(a.product_id) > 0 && (
                    <Button size="sm" variant="outline" onClick={() => markNotified(a.id)}><MailCheck className="size-4" /> Mark notified</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {alerts.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No subscribers yet. The "Notify me" button appears on sold-out products.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
