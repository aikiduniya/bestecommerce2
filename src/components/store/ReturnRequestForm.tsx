import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type ReturnLine = { product_id?: string; variant_id?: string | null; name: string; qty: number; price: number; options?: Record<string, string> };

export function ReturnRequestForm({ orderNumber, email, items, onDone }: { orderNumber: number; email: string; items: ReturnLine[]; onDone?: () => void }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function toggle(i: number) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (picked.size === 0) { toast.error("Select at least one item to return."); return; }
    if (reason.trim().length < 5) { toast.error("Please tell us why you're returning these items."); return; }
    setBusy(true);
    const chosen = [...picked].map((i) => {
      const l = items[i]!;
      return { product_id: l.product_id ?? null, variant_id: l.variant_id ?? null, name: l.name, qty: l.qty, price: l.price };
    });
    const { data, error } = await supabase.rpc("submit_return", { _order_number: orderNumber, _email: email, _items: chosen, _reason: reason.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res.ok) { toast.error(res.error ?? "Could not submit the return."); return; }
    setSent(true);
    toast.success("Return request submitted. We'll review it shortly.");
    onDone?.();
  }

  if (sent) {
    return (
      <div className="rounded border border-gold bg-gold-soft/40 p-5 text-sm">
        <p className="font-display text-xl">Return request received.</p>
        <p className="mt-1 text-muted-foreground">Our team will review it and update your order timeline.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded border bg-card p-5">
      <p className="eyebrow text-muted-foreground">Request a return</p>
      <div className="space-y-2">
        {items.map((l, i) => (
          <label key={i} className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="size-4 accent-[hsl(var(--gold))]" />
            <span>{l.name} × {l.qty}{l.options && Object.keys(l.options).length > 0 && <span className="text-xs text-muted-foreground"> ({Object.values(l.options).join(" / ")})</span>}</span>
          </label>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Reason</Label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required minLength={5} className="w-full rounded border bg-background px-3 py-2 text-sm" placeholder="Why are you returning these items?" />
      </div>
      <Button type="submit" variant="gold" disabled={busy}>{busy ? "Submitting…" : "Submit return request"}</Button>
    </form>
  );
}
