import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NotifyMe({ productId }: { productId: string }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast.error("Enter a valid email address"); return; }
    setBusy(true);
    const { error } = await supabase.from("stock_alerts").upsert({ product_id: productId, email: e }, { onConflict: "product_id,email" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
    toast.success("We'll email you when it's back in stock");
  }

  if (done) return <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">You're on the list — we'll email you as soon as this is back in stock.</p>;

  return (
    <div className="space-y-2 rounded border p-3">
      <p className="text-sm font-medium">Out of stock — get notified</p>
      <div className="flex gap-2">
        <Input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void subscribe(); }} />
        <Button variant="outline" onClick={subscribe} disabled={busy}>{busy ? "Saving…" : "Notify me"}</Button>
      </div>
    </div>
  );
}
