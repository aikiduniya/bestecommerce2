import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { giftCardsQuery, money, settingsQuery } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/gift-cards")({
  head: () => ({ meta: [{ title: "Gift Cards — Admin" }, { name: "robots", content: "noindex" }] }),
  component: GiftCards,
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${part()}-${part()}-${part()}`;
}

function GiftCards() {
  const { data: cards = [] } = useQuery(giftCardsQuery);
  const { data: s } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ code: genCode(), balance: "", expires: "", note: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const bal = Number(f.balance);
    if (!bal || bal <= 0) { toast.error("Enter a valid amount"); return; }
    setBusy(true);
    const { error } = await supabase.from("gift_cards").insert({
      code: f.code.trim().toUpperCase(),
      initial_balance: bal,
      balance: bal,
      expires_at: f.expires ? new Date(f.expires).toISOString() : null,
      note: f.note || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Gift card ${f.code} created`);
    setOpen(false);
    setF({ code: genCode(), balance: "", expires: "", note: "" });
    qc.invalidateQueries({ queryKey: ["gift-cards"] });
  }

  async function toggle(id: string, active: boolean) {
    const { error } = await supabase.from("gift_cards").update({ is_active: active }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["gift-cards"] });
  }

  const totalOutstanding = cards.filter((c) => c.is_active).reduce((a, c) => a + Number(c.balance), 0);

  return (
    <div>
      <PageHeader title="Gift cards" subtitle={`${cards.length} cards · ${money(totalOutstanding, s?.currency)} outstanding`}>
        <Button variant="gold" onClick={() => setOpen(true)}>New gift card</Button>
      </PageHeader>
      <div className="mt-6 overflow-x-auto rounded border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3">Code</th><th className="p-3">Balance</th><th className="p-3">Initial</th><th className="p-3">Expires</th><th className="p-3">Status</th><th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const expired = c.expires_at && new Date(c.expires_at) < new Date();
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3 font-mono text-xs">{c.code}{c.note && <span className="block text-muted-foreground">{c.note}</span>}</td>
                  <td className="p-3 font-medium">{money(c.balance, s?.currency)}</td>
                  <td className="p-3 text-muted-foreground">{money(c.initial_balance, s?.currency)}</td>
                  <td className="p-3 text-muted-foreground">{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}</td>
                  <td className="p-3">{expired ? <StatusPill tone="warn">Expired</StatusPill> : Number(c.balance) <= 0 ? <StatusPill tone="muted">Used up</StatusPill> : <StatusPill tone="ok">Valid</StatusPill>}</td>
                  <td className="p-3"><Switch checked={c.is_active} onCheckedChange={(v) => toggle(c.id, v)} /></td>
                </tr>
              );
            })}
            {cards.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No gift cards yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New gift card</DialogTitle></DialogHeader>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Code</Label>
              <div className="flex gap-2">
                <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} required className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setF({ ...f, code: genCode() })}>Generate</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount ({s?.currency})</Label>
                <Input type="number" min="1" step="0.01" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expires (optional)</Label>
                <Input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Note (optional, admin only)</Label>
              <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create gift card"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
