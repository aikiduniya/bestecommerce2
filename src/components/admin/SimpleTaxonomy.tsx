import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Row = { id: string; name: string; slug: string; is_active: boolean };

export function SimpleTaxonomy({ table, rows, noun }: { table: "categories" | "brands"; rows: Row[]; noun: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: [table] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from(table).insert({ name: name.trim(), slug: slugify(name) });
    if (error) { toast.error(error.message); return; }
    setName("");
    toast.success(`${noun} added`);
    refresh();
  }
  async function update(id: string, patch: Partial<Row>) {
    const { error } = await supabase.from(table).update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function remove(r: Row) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <Card className="p-6">
      <form onSubmit={add} className="mb-6 flex gap-3">
        <Input placeholder={`New ${noun.toLowerCase()} name`} value={name} onChange={(e) => setName(e.target.value)} />
        <Button variant="gold" type="submit">Add</Button>
      </form>
      <div className="divide-y">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-4 py-3">
            <Input
              defaultValue={r.name}
              className="max-w-xs"
              onBlur={(e) => e.target.value !== r.name && update(r.id, { name: e.target.value })}
            />
            <span className="flex-1 text-xs text-muted-foreground">/{r.slug}</span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={r.is_active} onCheckedChange={(v) => update(r.id, { is_active: v })} /> Visible
            </label>
            <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Delete"><Trash2 /></Button>
          </div>
        ))}
        {rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">Nothing here yet.</p>}
      </div>
    </Card>
  );
}
