import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { collectionsQuery, productCollectionsQuery, slugify, type Collection } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  component: CollectionsPage,
});

function CollectionsPage() {
  const qc = useQueryClient();
  const { data: cols = [] } = useQuery(collectionsQuery);
  const { data: pcs = [] } = useQuery(productCollectionsQuery);
  const [name, setName] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["collections"] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("collections").insert({ name: name.trim(), slug: slugify(name), sort_order: cols.length + 1 });
    if (error) { toast.error(error.message); return; }
    setName("");
    toast.success("Collection created — assign products from the product editor");
    refresh();
  }
  async function update(id: string, patch: Partial<Collection>) {
    const { error } = await supabase.from("collections").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function remove(c: Collection) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    const { error } = await supabase.from("collections").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  return (
    <>
      <PageHeader title="Collections" subtitle="Group products into curated sets (e.g. Summer Edit, Best Sellers). Turn on “Homepage” to feature a collection on the storefront." />
      <Card className="p-6">
        <form onSubmit={add} className="mb-6 flex gap-3">
          <Input placeholder="New collection name" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="gold" type="submit">Create</Button>
        </form>
        <div className="divide-y">
          {cols.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-4 py-4">
              <ImagePicker multiple={false} value={c.image_url ? [c.image_url] : []} onChange={(v) => update(c.id, { image_url: v[0] ?? null })} />
              <div className="min-w-56 flex-1 space-y-2">
                <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && update(c.id, { name: e.target.value })} />
                <Input defaultValue={c.description ?? ""} placeholder="Short description" onBlur={(e) => update(c.id, { description: e.target.value || null })} />
                <p className="text-xs text-muted-foreground">/{c.slug} · {pcs.filter((x) => x.collection_id === c.id).length} products</p>
              </div>
              <Input type="number" className="w-20" defaultValue={c.sort_order} title="Sort order" onBlur={(e) => update(c.id, { sort_order: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={c.show_on_home} onCheckedChange={(v) => update(c.id, { show_on_home: v })} /> Homepage</label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={c.is_active} onCheckedChange={(v) => update(c.id, { is_active: v })} /> Visible</label>
              <Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Delete"><Trash2 /></Button>
            </div>
          ))}
          {cols.length === 0 && <p className="py-6 text-sm text-muted-foreground">No collections yet.</p>}
        </div>
      </Card>
    </>
  );
}
