import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { myAddressesQuery, type Address } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPTY = { label: "Home", line1: "", line2: "", city: "", state: "", postal: "", country: "", phone: "", is_default: false };
type Draft = typeof EMPTY & { id?: string };

export function AddressesTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data: addresses = [] } = useQuery(myAddressesQuery(userId));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof Draft, v: string | boolean) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      if (draft.is_default) {
        const { error } = await supabase.from("addresses").update({ is_default: false }).eq("user_id", userId);
        if (error) throw error;
      }
      const row = {
        user_id: userId, label: draft.label.trim() || "Home", line1: draft.line1.trim(), line2: draft.line2.trim() || null,
        city: draft.city.trim(), state: draft.state.trim() || null, postal: draft.postal.trim() || null,
        country: draft.country.trim().toUpperCase(), phone: draft.phone.trim() || null, is_default: draft.is_default,
      };
      const { error } = draft.id
        ? await supabase.from("addresses").update(row).eq("id", draft.id)
        : await supabase.from("addresses").insert(row);
      if (error) throw error;
      toast.success("Address saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["addresses", userId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["addresses", userId] });
  }

  const field = (k: keyof Draft, label: string, opts: { required?: boolean; placeholder?: string } = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{opts.required && " *"}</Label>
      <Input required={opts.required} placeholder={opts.placeholder} value={String(draft?.[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  if (draft) {
    return (
      <form onSubmit={save} className="grid max-w-2xl gap-4 rounded border bg-card p-6 sm:grid-cols-2">
        <h3 className="text-2xl sm:col-span-2">{draft.id ? "Edit address" : "New address"}</h3>
        {field("label", "Label", { placeholder: "Home, Office…" })}
        {field("phone", "Phone")}
        <div className="sm:col-span-2">{field("line1", "Address", { required: true })}</div>
        <div className="sm:col-span-2">{field("line2", "Apartment, suite (optional)")}</div>
        {field("city", "City", { required: true })}
        {field("state", "State / Province")}
        {field("postal", "Postal code")}
        {field("country", "Country code", { required: true, placeholder: "e.g. US, GB, PK" })}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={draft.is_default} onChange={(e) => set("is_default", e.target.checked)} className="size-4 accent-[hsl(var(--gold))]" /> Set as default address
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="gold" disabled={busy}>{busy ? "Saving…" : "Save address"}</Button>
          <Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <p className="rounded border border-dashed py-16 text-center text-muted-foreground">No saved addresses yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded border bg-card p-5 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{a.label}</p>
                {a.is_default && <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs text-gold">Default</span>}
              </div>
              <p className="mt-2 text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{[a.city, a.state, a.postal].filter(Boolean).join(", ")}<br />{a.country}{a.phone ? ` · ${a.phone}` : ""}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft({ ...a, line2: a.line2 ?? "", state: a.state ?? "", postal: a.postal ?? "", phone: a.phone ?? "" })}><Pencil className="size-3.5" /> Edit</Button>
                <Button size="sm" variant="outline" onClick={() => remove(a.id)}><Trash2 className="size-3.5" /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Button variant="gold" onClick={() => setDraft({ ...EMPTY, is_default: addresses.length === 0 })}>Add address</Button>
    </div>
  );
}
