import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, CornerDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, productsQuery, slugify, type Category } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { SeoDialog } from "@/components/admin/SeoDialog";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["categories"] });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: name.trim(), slug: slugify(name), parent_id: parent || null, sort_order: cats.length + 1 });
    if (error) { toast.error(error.message); return; }
    setName("");
    toast.success("Category added");
    refresh();
  }
  async function update(id: string, patch: Partial<Category>) {
    const { error } = await supabase.from("categories").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function remove(c: Category) {
    if (!confirm(`Delete "${c.name}"? Products in it become uncategorized.`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  const top = cats.filter((c) => !c.parent_id);
  const ordered = top.flatMap((t) => [t, ...cats.filter((c) => c.parent_id === t.id)]);

  return (
    <>
      <PageHeader title="Categories" subtitle="Build your category tree. Subcategories show under their parent in the storefront filters." />
      <Card className="p-6">
        <form onSubmit={add} className="mb-6 flex flex-wrap gap-3">
          <Input className="flex-1" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Top level</option>
            {top.map((c) => <option key={c.id} value={c.id}>Under {c.name}</option>)}
          </select>
          <Button variant="gold" type="submit">Add category</Button>
        </form>
        <div className="divide-y">
          {ordered.map((c) => (
            <div key={c.id} className={`flex flex-wrap items-center gap-4 py-4 ${c.parent_id ? "pl-8" : ""}`}>
              {c.parent_id && <CornerDownRight className="size-4 text-muted-foreground" />}
              <ImagePicker multiple={false} value={c.image_url ? [c.image_url] : []} onChange={(v) => update(c.id, { image_url: v[0] ?? null })} hint="Recommended: 800 × 800 px (square), JPG/WebP, under 500 KB" />
              <div className="min-w-48 flex-1 space-y-1">
                <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && update(c.id, { name: e.target.value })} />
                <p className="text-xs text-muted-foreground">/{c.slug} · {products.filter((p) => p.category_id === c.id).length} products</p>
              </div>
              <select className="h-9 rounded-md border bg-background px-2 text-xs" value={c.parent_id ?? ""} onChange={(e) => update(c.id, { parent_id: e.target.value || null })}>
                <option value="">Top level</option>
                {top.filter((t) => t.id !== c.id).map((t) => <option key={t.id} value={t.id}>Under {t.name}</option>)}
              </select>
              <Input type="number" className="w-20" defaultValue={c.sort_order} title="Sort order" onBlur={(e) => update(c.id, { sort_order: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={c.is_active} onCheckedChange={(v) => update(c.id, { is_active: v })} /> Visible</label>
              <SeoDialog table="categories" row={c} />
              <Button size="icon" variant="ghost" onClick={() => remove(c)} aria-label="Delete"><Trash2 /></Button>
            </div>
          ))}
          {cats.length === 0 && <p className="py-6 text-sm text-muted-foreground">No categories yet.</p>}
        </div>
      </Card>
    </>
  );
}
