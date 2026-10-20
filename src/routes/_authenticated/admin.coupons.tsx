import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, settingsQuery, type Coupon } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/coupons")({ component: CouponsPage });

const empty = { code: "", description: "", kind: "percent", value: "10", min_subtotal: "", max_uses: "", per_user_limit: "", starts_at: "", ends_at: "" };
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);
const toLocal = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");

function CouponsPage() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const { data: coupons = [] } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => { const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false }); if (error) throw error; return data; },
  });
  const [f, setF] = useState(empty);
  const refresh = () => qc.invalidateQueries({ queryKey: ["coupons"] });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) { toast.error("Code must be 3–30 letters, numbers, - or _"); return; }
    const value = Number(f.value || 0);
    if (f.kind === "percent" && (value <= 0 || value > 100)) { toast.error("Percent must be between 1 and 100"); return; }
    if (f.kind === "fixed" && value <= 0) { toast.error("Amount must be above 0"); return; }
    if (f.starts_at && f.ends_at && new Date(f.starts_at) >= new Date(f.ends_at)) { toast.error("End date must be after start date"); return; }
    const { error } = await supabase.from("coupons").insert({
      code, description: f.description || null, kind: f.kind, value: f.kind === "free_shipping" ? 0 : value,
      min_subtotal: f.min_subtotal ? Number(f.min_subtotal) : null, max_uses: f.max_uses ? Number(f.max_uses) : null,
      per_user_limit: f.per_user_limit ? Number(f.per_user_limit) : null, starts_at: toIso(f.starts_at), ends_at: toIso(f.ends_at),
    });
    if (error) { toast.error(error.code === "23505" ? "That code already exists" : error.message); return; }
    toast.success(`Coupon ${code} created`);
    setF(empty);
    refresh();
  }
  async function update(id: string, patch: Partial<Coupon>) {
    const { error } = await supabase.from("coupons").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  const status = (c: Coupon) => {
    const now = Date.now();
    if (!c.is_active) return "Paused";
    if (c.starts_at && new Date(c.starts_at).getTime() > now) return "Scheduled";
    if (c.ends_at && new Date(c.ends_at).getTime() < now) return "Expired";
    if (c.max_uses !== null && c.used_count >= c.max_uses) return "Used up";
    return "Live";
  };
  const field = (k: keyof typeof empty, label: string, type = "text", extra: Record<string, string> = {}) => (
    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label><Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></div>
  );

  return (
    <>
      <PageHeader title="Coupons & promotions" subtitle="Discount codes are checked and applied on the server when an order is placed. Use start/end dates for flash sales and campaigns." />
      <Card className="mb-8 p-6">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-3">
          {field("code", "Code *", "text", { placeholder: "SUMMER20" })}
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Type</Label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="percent">Percent off</option><option value="fixed">Fixed amount off</option><option value="free_shipping">Free shipping</option>
            </select></div>
          {f.kind !== "free_shipping" ? field("value", f.kind === "percent" ? "Percent (%)" : `Amount (${s?.currency ?? "USD"})`, "number", { min: "0", step: "0.01" }) : <div />}
          {field("min_subtotal", "Minimum order (optional)", "number", { min: "0", step: "0.01" })}
          {field("max_uses", "Total uses limit (optional)", "number", { min: "1" })}
          {field("per_user_limit", "Uses per customer (optional)", "number", { min: "1" })}
          {field("starts_at", "Starts (optional)", "datetime-local")}
          {field("ends_at", "Ends (optional)", "datetime-local")}
          {field("description", "Internal note / campaign name")}
          <div className="sm:col-span-3"><Button variant="gold" type="submit">Create coupon</Button></div>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="p-4">Code</th><th>Discount</th><th>Rules</th><th>Schedule</th><th>Used</th><th>Status</th><th>Active</th><th /></tr></thead>
          <tbody className="divide-y">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="p-4 font-mono font-medium">{c.code}<p className="font-sans text-xs text-muted-foreground">{c.description}</p></td>
                <td>{c.kind === "percent" ? `${Number(c.value)}%` : c.kind === "fixed" ? money(c.value, s?.currency) : "Free shipping"}</td>
                <td className="text-xs text-muted-foreground">{c.min_subtotal !== null && <>Min {money(c.min_subtotal, s?.currency)}<br /></>}{c.per_user_limit !== null && <>{c.per_user_limit}/customer</>}</td>
                <td className="text-xs">
                  <input type="datetime-local" className="block rounded border bg-background px-1" defaultValue={toLocal(c.starts_at)} onBlur={(e) => update(c.id, { starts_at: toIso(e.target.value) })} aria-label="Start" />
                  <input type="datetime-local" className="mt-1 block rounded border bg-background px-1" defaultValue={toLocal(c.ends_at)} onBlur={(e) => update(c.id, { ends_at: toIso(e.target.value) })} aria-label="End" />
                </td>
                <td>{c.used_count}{c.max_uses !== null && ` / ${c.max_uses}`}</td>
                <td><span className={`rounded-full px-2.5 py-0.5 text-xs ${status(c) === "Live" ? "bg-success/15 text-success" : "bg-muted"}`}>{status(c)}</span></td>
                <td><Switch checked={c.is_active} onCheckedChange={(v) => update(c.id, { is_active: v })} /></td>
                <td><Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Delete"><Trash2 /></Button></td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={8} className="p-6 text-muted-foreground">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}
