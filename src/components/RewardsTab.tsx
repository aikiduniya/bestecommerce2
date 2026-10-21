import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, myLoyaltyQuery, myReferralUsesQuery, settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/admin/PageHeader";

export function RewardsTab({ userId }: { userId: string }) {
  const { data: s } = useQuery(settingsQuery);
  const { data: txs = [] } = useQuery(myLoyaltyQuery(userId));
  const { data: uses = [] } = useQuery(myReferralUsesQuery(userId));
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [applyInput, setApplyInput] = useState("");
  const [busy, setBusy] = useState(false);

  const balance = txs.reduce((a, t) => a + t.points, 0);
  const referredByMe = uses.filter((u) => u.referrer_id === userId);
  const myReferral = uses.find((u) => u.referee_id === userId);
  const redeemValue = Number(s?.loyalty_redeem_value ?? 0);

  async function loadCode() {
    const { data, error } = await supabase.rpc("my_referral_code");
    if (error) { toast.error(error.message); return; }
    setCode(data as string);
  }

  async function applyCode() {
    if (!applyInput.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("apply_referral_code", { _code: applyInput });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Referral code linked to your account");
    setApplyInput("");
    qc.invalidateQueries({ queryKey: ["referral-uses", userId] });
  }

  if (!s?.loyalty_enabled && !s?.referral_enabled) {
    return <div className="rounded border border-dashed py-20 text-center text-muted-foreground">The rewards program isn't active yet.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {s?.loyalty_enabled && (
        <section className="rounded border bg-card p-6">
          <p className="eyebrow text-gold">Loyalty points</p>
          <p className="mt-2 font-display text-5xl">{balance}</p>
          <p className="mt-1 text-sm text-muted-foreground">Worth {money(balance * redeemValue, s.currency)} at checkout · earn {Number(s.loyalty_earn_rate)} point{Number(s.loyalty_earn_rate) === 1 ? "" : "s"} per {money(1, s.currency)} spent</p>
          <div className="mt-6 max-h-64 space-y-2 overflow-y-auto text-sm">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                <span className="min-w-0"><span className="block truncate">{t.note ?? t.kind}</span><span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</span></span>
                <span className={t.points >= 0 ? "text-success" : "text-destructive"}>{t.points >= 0 ? "+" : ""}{t.points}</span>
              </div>
            ))}
            {txs.length === 0 && <p className="text-muted-foreground">No points yet — they're added when your order is delivered.</p>}
          </div>
        </section>
      )}
      {s?.referral_enabled && (
        <section className="rounded border bg-card p-6">
          <p className="eyebrow text-gold">Referrals</p>
          <p className="mt-2 text-sm text-muted-foreground">Share your code — when a friend's first order is delivered, you earn {s.referral_reward_points} points.</p>
          {code ? (
            <div className="mt-4 flex items-center gap-2">
              <code className="rounded border bg-muted px-4 py-2 font-mono text-lg tracking-widest">{code}</code>
              <Button variant="outline" onClick={() => { void navigator.clipboard?.writeText(code); toast.success("Copied"); }}>Copy</Button>
            </div>
          ) : (
            <Button variant="gold" className="mt-4" onClick={loadCode}>Get my referral code</Button>
          )}
          <p className="mt-4 text-sm">{referredByMe.length} friend{referredByMe.length === 1 ? "" : "s"} referred · {referredByMe.filter((r) => r.rewarded).length} rewarded</p>
          {!myReferral && (
            <div className="mt-6 border-t pt-4">
              <p className="text-sm text-muted-foreground">Have a friend's code?</p>
              <div className="mt-2 flex gap-2">
                <Input placeholder="Referral code" value={applyInput} onChange={(e) => setApplyInput(e.target.value.toUpperCase())} />
                <Button variant="outline" onClick={applyCode} disabled={busy}>{busy ? "…" : "Apply"}</Button>
              </div>
            </div>
          )}
          {myReferral && <p className="mt-6 border-t pt-4 text-sm">A referral code is linked to your account {myReferral.rewarded ? <StatusPill value="Rewarded" /> : <StatusPill value="Pending first delivery" />}</p>}
        </section>
      )}
    </div>
  );
}
