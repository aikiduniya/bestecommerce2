import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, collectionsQuery, money, productsQuery, settingsQuery } from "@/lib/store";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/discounts")({ component: DiscountsPage });

type Discount = Database["public"]["Tables"]["automatic_discounts"]["Row"];

type DiscForm = { id?: string | undefined; name: string; kind: string; value: string; scope: string; target_id: string; starts_at: string; ends_at: string; priority: string };
const empty: DiscForm = { name: "", kind: "percent", value: "10", scope: "all", target_id: "", starts_at: "", ends_at: "", priority: "0" };
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
const toLocal = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");

function DiscountsPage() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: discounts = [] } = useQuery({
    queryKey: ["auto-discounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("automatic_discounts").select("*").order("priority", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [f, setF] = useState(empty);
  const [editing, setEditing] = useState<DiscForm | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["auto-discounts"] });

  function validate(form: DiscForm): string | null {
    const value = Number(form.value || 0);
    if (!form.name.trim()) return "Name is required";
    if (form.kind === "percent" && (value <= 0 || value > 100)) return "Percent must be between 1 and 100";
    if (form.kind === "fixed" && value <= 0) return "Amount must be above 0";
    if (form.scope !== "all" && !form.target_id) return "Choose what this discount applies to";
    if (form.starts_at && form.ends_at && new Date(form.starts_at) >= new Date(form.ends_at)) return "End date must be after start date";
    return null;
  }

  const payload = (form: DiscForm) => ({
    name: form.name.trim(),
    kind: form.kind,
    value: Number(form.value || 0),
    scope: form.scope,
    target_id: form.scope === "all" ? null : form.target_id,
    starts_at: toIso(form.starts_at),
    ends_at: toIso(form.ends_at),
    priority: Number(form.priority || 0),
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(f);
    if (err) { toast.error(err); return; }
    const { error } = await supabase.from("automatic_discounts").insert(payload(f));
    if (error) { toast.error(error.message); return; }
    toast.success("Discount created — it applies automatically at checkout");
    setF(empty);
    refresh();
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.id) return;
    const err = validate(editing);
    if (err) { toast.error(err); return; }
    const { error } = await supabase.from("automatic_discounts").update(payload(editing)).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Discount updated");
    setEditing(null);
    refresh();
  }

  async function toggle(d: Discount) {
    const { error } = await supabase.from("automatic_discounts").update({ is_active: !d.is_active }).eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function remove(d: Discount) {
    if (!confirm(`Delete discount "${d.name}"?`)) return;
    const { error } = await supabase.from("automatic_discounts").delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  const targetName = (d: Discount) => {
    if (d.scope === "all") return "Whole store";
    if (d.scope === "category") return `Category: ${cats.find((c) => c.id === d.target_id)?.name ?? "?"}`;
    if (d.scope === "collection") return `Collection: ${collections.find((c) => c.id === d.target_id)?.name ?? "?"}`;
    return `Product: ${products.find((p) => p.id === d.target_id)?.name ?? "?"}`;
  };
  const status = (d: Discount) => {
    if (!d.is_active) return "Off";
    const now = Date.now();
    if (d.starts_at && new Date(d.starts_at).getTime() > now) return "Scheduled";
    if (d.ends_at && new Date(d.ends_at).getTime() < now) return "Ended";
    return "Live";
  };

  const scopePicker = (form: DiscForm, set: (p: Partial<DiscForm>) => void) => (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Applies to</Label>
        <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.scope} onChange={(e) => set({ scope: e.target.value, target_id: "" })}>
          <option value="all">Whole store</option>
          <option value="category">A category</option>
          <option value="collection">A collection</option>
          <option value="product">A product</option>
        </select>
      </div>
      {form.scope !== "all" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{form.scope === "category" ? "Category" : form.scope === "collection" ? "Collection" : "Product"}</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.target_id} onChange={(e) => set({ target_id: e.target.value })}>
            <option value="">Choose…</option>
            {form.scope === "category" && cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {form.scope === "collection" && collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            {form.scope === "product" && products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
    </>
  );

  const fields = (form: DiscForm, set: (p: Partial<DiscForm>) => void) => (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Name *</Label>
        <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Summer sale" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="percent">Percent off</option>
            <option value="fixed">Amount off</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Value *</Label>
          <Input type="number" step="0.01" min="0" value={form.value} onChange={(e) => set({ value: e.target.value })} />
        </div>
      </div>
      {scopePicker(form, set)}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Starts (optional)</Label>
        <Input type="datetime-local" value={form.starts_at} onChange={(e) => set({ starts_at: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Ends (optional)</Label>
        <Input type="datetime-local" value={form.ends_at} onChange={(e) => set({ ends_at: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Priority (higher wins)</Label>
        <Input type="number" value={form.priority} onChange={(e) => set({ priority: e.target.value })} />
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title="Automatic discounts" subtitle="Discounts that apply at checkout without a code. Only one applies per order — the highest priority, then the largest." />
      <Card className="p-5">
        <form onSubmit={create} className="space-y-4">
          {fields(f, (p) => setF({ ...f, ...p }))}
          <Button type="submit" variant="gold">Create discount</Button>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {discounts.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No automatic discounts yet.</p>}
        {discounts.map((d) => (
          <Card key={d.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{d.name} <span className="ml-2 text-xs text-muted-foreground">{status(d)}</span></p>
              <p className="text-sm text-muted-foreground">
                {d.kind === "percent" ? `${Number(d.value)}% off` : `${money(d.value, s?.currency)} off`} · {targetName(d)}
                {d.starts_at && ` · from ${new Date(d.starts_at).toLocaleString()}`}
                {d.ends_at && ` · until ${new Date(d.ends_at).toLocaleString()}`}
              </p>
            </div>
            <Switch checked={d.is_active} onCheckedChange={() => toggle(d)} aria-label="Active" />
            <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setEditing({ ...d, name: d.name, kind: d.kind, value: String(d.value), scope: d.scope, target_id: d.target_id ?? "", starts_at: toLocal(d.starts_at), ends_at: toLocal(d.ends_at), priority: String(d.priority) })}><Pencil /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(d)}><Trash2 /></Button>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit discount</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={saveEdit} className="space-y-4">
              {fields(editing, (p) => setEditing({ ...editing, ...p }))}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" variant="gold">Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
