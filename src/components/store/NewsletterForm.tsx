import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const emailSchema = z.string().trim().email().max(255);

/** Stores newsletter signups (duplicate emails count as success). */
export function NewsletterForm({ cta = "Subscribe", compact = false }: { cta?: string; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) { toast.error("Please enter a valid email address"); return; }
    setBusy(true);
    const { error } = await supabase.from("newsletter_subscribers").insert({ email: parsed.data.toLowerCase() });
    setBusy(false);
    if (error && error.code !== "23505") { toast.error("Could not subscribe — please try again"); return; }
    toast.success("Thank you for subscribing!");
    setEmail("");
  }
  return (
    <form onSubmit={submit} className={`flex gap-2 ${compact ? "" : "mx-auto mt-6 max-w-md"}`}>
      <div className="relative flex-1">
        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input type="email" required aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email address"
          className="h-11 w-full rounded border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-gold" />
      </div>
      <Button type="submit" variant="gold" className="h-11" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : cta}</Button>
    </form>
  );
}
