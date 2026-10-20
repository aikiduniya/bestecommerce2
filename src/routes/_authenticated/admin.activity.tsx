import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const [entity, setEntity] = useState("all");
  const { data = [] } = useQuery({
    queryKey: ["activity", entity],
    queryFn: async () => {
      let q = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (entity !== "all") q = q.eq("entity", entity);
      return (await q).data ?? [];
    },
  });
  const staff = useQuery({ queryKey: ["staff_members"], queryFn: async () => (await supabase.from("staff_members").select("user_id,email")).data ?? [] });
  const who = (id: string | null) => (id ? staff.data?.find((s) => s.user_id === id)?.email ?? "Customer / system" : "System");

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every change to catalog, orders, settings, shipping and staff — newest first.">
        <select aria-label="Filter activity" className="h-9 rounded-md border bg-card px-3 text-sm" value={entity} onChange={(e) => setEntity(e.target.value)}>
          {["all", "products", "categories", "brands", "collections", "orders", "shipping_zones", "store_settings", "user_roles", "staff_members", "staff_roles"].map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
        </select>
      </PageHeader>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Item</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((a) => {
              const d = a.details as Record<string, string>;
              return (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{who(a.actor_id)}</TableCell>
                  <TableCell className="text-xs capitalize">{a.action}</TableCell>
                  <TableCell className="text-xs">{a.entity.replace("_", " ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(" · ")}</TableCell>
                </TableRow>
              );
            })}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No activity yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
