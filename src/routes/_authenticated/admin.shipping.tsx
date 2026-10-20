import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, zonesQuery, type ShippingZone } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/shipping")({
  component: ShippingPage,
});

function ShippingPage() {
  const { isAdmin } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: s } = useQuery(settingsQuery);
  const refresh = () => qc.invalidateQueries({ queryKey: ["shipping_zones"] });

  async function add() {
    const { error } = await supabase.from("shipping_zones").insert({ name: "New zone", rate: 0, sort_order: zones.length + 1 });
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function update(id: string, patch: Partial<ShippingZone>) {
    const { error } = await supabase.from("shipping_zones").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    refresh();
  }
  async function remove(z: ShippingZone) {
    if (!confirm(`Delete "${z.name}"?`)) return;
    const { error } = await supabase.from("shipping_zones").delete().eq("id", z.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <>
      <PageHeader title="Shipping" subtitle={`Rates in ${s?.currency ?? ""}. Leave countries empty to ship everywhere. Use 2-letter codes (US, GB, PK).`}>
        {isAdmin && <Button variant="gold" onClick={add}><Plus /> Add zone</Button>}
      </PageHeader>
      <div className="grid gap-4">
        {zones.map((z) => (
          <Card key={z.id} className="grid gap-4 p-5 md:grid-cols-6">
            <div className="space-y-1.5 md:col-span-2"><Label className="text-xs text-muted-foreground">Name</Label><Input defaultValue={z.name} disabled={!isAdmin} onBlur={(e) => e.target.value !== z.name && update(z.id, { name: e.target.value })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label className="text-xs text-muted-foreground">Countries</Label>
              <Input defaultValue={z.countries.join(", ")} placeholder="Everywhere" disabled={!isAdmin}
                onBlur={(e) => update(z.id, { countries: e.target.value.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean) })} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Rate</Label><Input type="number" min="0" step="0.01" defaultValue={z.rate} disabled={!isAdmin} onBlur={(e) => update(z.id, { rate: Number(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Free over</Label><Input type="number" min="0" step="0.01" defaultValue={z.free_over ?? ""} placeholder="Never" disabled={!isAdmin} onBlur={(e) => update(z.id, { free_over: e.target.value ? Number(e.target.value) : null })} /></div>
            <div className="space-y-1.5 md:col-span-2"><Label className="text-xs text-muted-foreground">Delivery estimate</Label><Input defaultValue={z.estimated_days ?? ""} disabled={!isAdmin} onBlur={(e) => update(z.id, { estimated_days: e.target.value || null })} /></div>
            <div className="flex items-end gap-4 md:col-span-4 md:justify-end">
              <label className="flex items-center gap-2 text-sm"><Switch checked={z.is_active} disabled={!isAdmin} onCheckedChange={(v) => update(z.id, { is_active: v })} /> Active</label>
              {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(z)} aria-label="Delete"><Trash2 /></Button>}
            </div>
          </Card>
        ))}
        {zones.length === 0 && <Card className="p-10 text-center text-muted-foreground">No shipping zones — customers can't check out until you add one.</Card>}
      </div>
    </>
  );
}
