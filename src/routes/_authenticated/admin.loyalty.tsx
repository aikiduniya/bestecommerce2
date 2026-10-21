import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminLoyaltyQuery, adminReferralsQuery, money, settingsQuery } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/loyalty")({
  head: () => ({ meta: [{ title: "Loyalty & Referrals — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Loyalty,
});

function Loyalty() {
  const { data: s } = useQuery(settingsQuery);
  const { data: txs = [] } = useQuery(adminLoyaltyQuery);
  const { data: referrals = [] } = useQuery(adminReferralsQuery);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string> | null>(null);

  const v = (k: string, dflt: string) => (form && k in form ? form[k] : dflt);

  async function save() {
    if (!s || !form) return;
    setBusy(true);
    const patch: Record<string, boolean | number> = {};
    for (const [k, val] of Object.entries(form)) {
      if (k === "loyalty_enabled" || k === "referral_enabled") patch[k] = val === "1";
      else patch[k] = Number(val);
    }
    const { error } = await supabase.from("store_settings").update(patch as never).eq("id", 1);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  const set = (k: string, val: string) => setForm((f) => ({ ...(f ?? {}), [k]: val }));
  const toggle = (k: string, cur: boolean) => set(k, cur ? "0" : "1");

  const balances = new Map<string, number>();
  for (const t of txs) balances.set(t.user_id, (balances.get(t.user_id) ?? 0) + t.points);

  return (
    <div>
      <PageHeader title="Loyalty & referrals" subtitle="Points earned on delivered orders, redeemed at checkout" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded border bg-card p-6">
          <h2 className="text-xl">Loyalty points</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between text-sm">
              Enable loyalty points
              <Switch checked={v("loyalty_enabled", s?.loyalty_enabled ? "1" : "0") === "1"} onCheckedChange={() => toggle("loyalty_enabled", v("loyalty_enabled", s?.loyalty_enabled ? "1" : "0") === "1")} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Points per 1 {s?.currency}</Label>
                <Input type="number" min="0" step="0.1" value={v("loyalty_earn_rate", String(s?.loyalty_earn_rate ?? 1))} onChange={(e) => set("loyalty_earn_rate", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Value per point</Label>
                <Input type="number" min="0" step="0.001" value={v("loyalty_redeem_value", String(s?.loyalty_redeem_value ?? 0.01))} onChange={(e) => set("loyalty_redeem_value", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Min. redeem</Label>
                <Input type="number" min="0" value={v("loyalty_min_redeem", String(s?.loyalty_min_redeem ?? 0))} onChange={(e) => set("loyalty_min_redeem", e.target.value)} />
              </div>
            </div>
          </div>
          <h2 className="mt-8 text-xl">Referrals</h2>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between text-sm">
              Enable referral program
              <Switch checked={v("referral_enabled", s?.referral_enabled ? "1" : "0") === "1"} onCheckedChange={() => toggle("referral_enabled", v("referral_enabled", s?.referral_enabled ? "1" : "0") === "1")} />
            </label>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reward points for referrer (on friend's first delivered order)</Label>
              <Input type="number" min="0" value={v("referral_reward_points", String(s?.referral_reward_points ?? 100))} onChange={(e) => set("referral_reward_points", e.target.value)} />
            </div>
          </div>
          <Button variant="gold" className="mt-6" onClick={save} disabled={busy || !form}>{busy ? "Saving…" : "Save changes"}</Button>
        </section>

        <section className="rounded border bg-card p-6">
          <h2 className="text-xl">Recent point activity</h2>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
            {txs.slice(0, 30).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="min-w-0"><span className="block truncate">{t.note ?? t.kind}</span><span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span></span>
                <span className={t.points >= 0 ? "text-success" : "text-destructive"}>{t.points >= 0 ? "+" : ""}{t.points}</span>
              </div>
            ))}
            {txs.length === 0 && <p className="text-muted-foreground">No point activity yet.</p>}
          </div>
          <h2 className="mt-8 text-xl">Referrals ({referrals.length})</h2>
          <div className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                <StatusPill value={r.rewarded ? "Rewarded" : "Pending first order"} />
              </div>
            ))}
            {referrals.length === 0 && <p className="text-muted-foreground">No referrals yet.</p>}
          </div>
        </section>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{balances.size} customers hold points. Points are earned when an order is marked delivered and refunded automatically if the order is cancelled.</p>
    </div>
  );
}
