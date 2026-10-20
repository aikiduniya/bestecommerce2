import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brandsQuery, categoriesQuery, productsQuery, settingsQuery, money, slugify, type Product } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

type Form = Partial<Product> & { imagesText?: string; tagsText?: string };

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const list = products.filter(
    (p) =>
      (status === "all" || p.status === status) &&
      (p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(q.toLowerCase())),
  );

  function open(p?: Product) {
    setForm(
      p
        ? { ...p, imagesText: p.images.join("\n"), tagsText: p.tags.join(", ") }
        : { status: "draft", price: 0, stock: 0, low_stock_threshold: 5, is_featured: false, imagesText: "", tagsText: "" },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form?.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      sku: form.sku || null,
      short_description: form.short_description || null,
      description: form.description || null,
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      price: Number(form.price ?? 0),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      stock: Number(form.stock ?? 0),
      low_stock_threshold: Number(form.low_stock_threshold ?? 5),
      images: (form.imagesText ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
      tags: (form.tagsText ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      status: form.status ?? "draft",
      is_featured: !!form.is_featured,
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
    };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Product saved");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const set = (k: keyof Form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const margin =
    form?.price && form?.cost_price ? Math.round(((Number(form.price) - Number(form.cost_price)) / Number(form.price)) * 100) : null;

  return (
    <>
      <PageHeader title="Products" subtitle={`${products.length} products in catalog`}>
        <Button variant="gold" onClick={() => open()}><Plus /> Add product</Button>
      </PageHeader>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="size-10 overflow-hidden rounded bg-muted">
                      {p.images[0] && <img src={p.images[0]} alt="" className="size-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-medium">{p.name}{p.is_featured && <span className="ml-2 text-xs text-gold">★</span>}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{cats.find((c) => c.id === p.category_id)?.name ?? "—"}</TableCell>
                <TableCell>{money(p.price, settings?.currency)}</TableCell>
                <TableCell className={p.stock <= p.low_stock_threshold ? "text-destructive" : ""}>{p.stock}</TableCell>
                <TableCell><StatusPill value={p.status} /></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => open(p)} aria-label="Edit"><Pencil /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p)} aria-label="Delete"><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No products found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-3xl">{form?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <F label="Name" className="sm:col-span-2"><Input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
              <F label="Slug (auto if empty)"><Input value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value)} /></F>
              <F label="SKU"><Input value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} /></F>
              <F label="Category">
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
                  <option value="">—</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </F>
              <F label="Brand">
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.brand_id ?? ""} onChange={(e) => set("brand_id", e.target.value)}>
                  <option value="">—</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </F>
              <F label="Price"><Input type="number" step="0.01" min="0" required value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} /></F>
              <F label="Compare-at price"><Input type="number" step="0.01" min="0" value={form.compare_at_price ?? ""} onChange={(e) => set("compare_at_price", e.target.value)} /></F>
              <F label={`Cost price${margin !== null ? ` · ${margin}% margin` : ""}`}><Input type="number" step="0.01" min="0" value={form.cost_price ?? ""} onChange={(e) => set("cost_price", e.target.value)} /></F>
              <F label="Stock"><Input type="number" min="0" value={form.stock ?? 0} onChange={(e) => set("stock", e.target.value)} /></F>
              <F label="Low-stock threshold"><Input type="number" min="0" value={form.low_stock_threshold ?? 5} onChange={(e) => set("low_stock_threshold", e.target.value)} /></F>
              <F label="Status">
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.status ?? "draft"} onChange={(e) => set("status", e.target.value)}>
                  <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
                </select>
              </F>
              <F label="Short description" className="sm:col-span-2"><Input value={form.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} /></F>
              <F label="Description" className="sm:col-span-2"><Textarea rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></F>
              <F label="Image URLs (one per line)" className="sm:col-span-2"><Textarea rows={3} value={form.imagesText} onChange={(e) => set("imagesText", e.target.value)} /></F>
              <F label="Tags (comma separated)" className="sm:col-span-2"><Input value={form.tagsText} onChange={(e) => set("tagsText", e.target.value)} /></F>
              <F label="SEO title"><Input value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} /></F>
              <F label="SEO description"><Input value={form.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} /></F>
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <Switch checked={!!form.is_featured} onCheckedChange={(v) => set("is_featured", v)} /> Featured on homepage
              </label>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save product"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
