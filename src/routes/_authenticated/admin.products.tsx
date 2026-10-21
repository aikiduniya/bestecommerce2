import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Copy, Package, Download, Upload, Boxes, Warehouse, AlertTriangle, PackageX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  brandsQuery, categoriesQuery, collectionsQuery, productCollectionsQuery, productsQuery, settingsQuery,
  money, optionsOf, slugify, downloadCsv, parseCsv, type Product, type ProductOption,
} from "@/lib/store";
import { KpiCard, KpiGrid, PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { VariantsEditor, type VariantDraft } from "@/components/admin/VariantsEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: ProductsPage,
});

type Form = { [K in keyof Omit<Product, "sale_price" | "sale_starts_at" | "sale_ends_at">]?: Product[K] | undefined } & {
  tagsText?: string | undefined;
  specsText?: string | undefined;
  sale_price?: number | string | null | undefined;
  sale_starts_at?: string | null | undefined;
  sale_ends_at?: string | null | undefined;
};

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const { data: cols = [] } = useQuery(collectionsQuery);
  const { data: pcs = [] } = useQuery(productCollectionsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [cat, setCat] = useState("all");
  const [stockF, setStockF] = useState("all");
  const [form, setForm] = useState<Form | null>(null);
  const [opts, setOpts] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [colSel, setColSel] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [selIds, setSelIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const toggleSel = (id: string, on: boolean) => setSelIds((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });

  async function bulk(action: "active" | "draft" | "archived" | "delete") {
    const ids = [...selIds];
    if (!ids.length) return;
    if (action === "delete" && !confirm(`Delete ${ids.length} product${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkBusy(true);
    const { error } = action === "delete"
      ? await supabase.from("products").delete().in("id", ids)
      : await supabase.from("products").update({ status: action }).in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(action === "delete" ? `Deleted ${ids.length} products` : `Updated ${ids.length} products`);
    setSelIds(new Set());
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const list = useMemo(() => products.filter((p) => {
    const s = q.toLowerCase();
    return (status === "all" || p.status === status) &&
      (cat === "all" || p.category_id === cat) &&
      (stockF === "all" || (stockF === "low" ? p.stock > 0 && p.stock <= p.low_stock_threshold : p.stock === 0)) &&
      (p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
  }), [products, q, status, cat, stockF]);

  async function open(p?: Product, duplicate = false) {
    setOpts(p ? optionsOf(p) : []);
    setColSel(p ? pcs.filter((x) => x.product_id === p.id).map((x) => x.collection_id) : []);
    setVariants([]);
    if (p) {
      const { data } = await supabase.from("product_variants").select("*").eq("product_id", p.id).order("sort_order");
      setVariants((data ?? []).map((v) => ({
        id: duplicate ? undefined : v.id, options: v.options as Record<string, string>, sku: duplicate ? "" : v.sku ?? "",
        price: v.price?.toString() ?? "", compare_at_price: v.compare_at_price?.toString() ?? "", sale_price: v.sale_price?.toString() ?? "", stock: v.stock, image_url: v.image_url ?? "", is_active: v.is_active,
      })));
    }
    const cost = p ? (await supabase.from("product_costs").select("cost_price").eq("product_id", p.id).maybeSingle()).data?.cost_price ?? null : null;
    setForm(
      p
        ? { ...p, cost_price: cost, ...(duplicate ? { id: undefined, name: `${p.name} (copy)`, slug: "", sku: null, status: "draft" } : {}), tagsText: p.tags.join(", "), specsText: Object.entries((p.specifications ?? {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join("\n"), related_ids: p.related_ids ?? [], sale_price: p.sale_price?.toString() ?? "", sale_starts_at: toLocalInput(p.sale_starts_at), sale_ends_at: toLocalInput(p.sale_ends_at) }
        : { status: "draft", price: 0, stock: 0, low_stock_threshold: 5, is_featured: false, images: [], tagsText: "", specsText: "", related_ids: [] },
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form?.name) return;
    const activeVariants = variants.filter((v) => v.is_active);
    if (variants.length && new Set(variants.map((v) => v.sku).filter(Boolean)).size !== variants.filter((v) => v.sku).length) {
      toast.error("Variant SKUs must be unique");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      slug: slugify(form.slug || form.name),
      sku: form.sku || null,
      short_description: form.short_description || null,
      description: form.description || null,
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      price: Number(form.price ?? 0),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      sale_starts_at: form.sale_starts_at ? new Date(form.sale_starts_at).toISOString() : null,
      sale_ends_at: form.sale_ends_at ? new Date(form.sale_ends_at).toISOString() : null,
      stock: variants.length ? activeVariants.reduce((s, v) => s + v.stock, 0) : Math.max(0, Number(form.stock ?? 0)),
      low_stock_threshold: Number(form.low_stock_threshold ?? 5),
      images: form.images ?? [],
      tags: (form.tagsText ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      status: form.status ?? "draft",
      is_featured: !!form.is_featured,
      cod_allowed: form.cod_allowed ?? true,
      barcode: form.barcode || null,
      weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
      specifications: Object.fromEntries(
        (form.specsText ?? "").split("\n").map((l: string) => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; }).filter(Boolean) as [string, string][],
      ),
      related_ids: form.related_ids ?? [],
      seo_title: form.seo_title || null,
      seo_description: form.seo_description || null,
      meta_keywords: form.meta_keywords || null,
      canonical_url: form.canonical_url || null,
      og_image_url: form.og_image_url || null,
      robots_noindex: !!form.robots_noindex,
      image_alts: (form.images ?? []).map((_: string, i: number) => (form.image_alts?.[i] ?? "").trim()),
      options: opts.filter((o) => o.name.trim() && o.values.length),
    };
    try {
      let id = form.id;
      if (id) {
        const { error } = await supabase.from("products").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      {
        const { error } = await supabase.from("product_costs").upsert({ product_id: id!, cost_price: form.cost_price ? Number(form.cost_price) : null, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
      // sync variants
      const { data: existing } = await supabase.from("product_variants").select("id").eq("product_id", id);
      const keep = variants.filter((v) => v.id).map((v) => v.id!);
      const toDelete = (existing ?? []).map((x) => x.id).filter((x) => !keep.includes(x));
      if (toDelete.length) {
        const { error } = await supabase.from("product_variants").delete().in("id", toDelete);
        if (error) throw error;
      }
      for (const [i, v] of variants.entries()) {
        const row = {
          product_id: id!, options: v.options, sku: v.sku || null, price: v.price ? Number(v.price) : null,
          compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null, sale_price: v.sale_price ? Number(v.sale_price) : null, stock: v.stock, image_url: v.image_url || null,
          is_active: v.is_active, sort_order: i,
        };
        const { error } = v.id ? await supabase.from("product_variants").update(row).eq("id", v.id) : await supabase.from("product_variants").insert(row);
        if (error) throw error;
      }
      // sync collections
      await supabase.from("product_collections").delete().eq("product_id", id!);
      if (colSel.length) {
        const { error } = await supabase.from("product_collections").insert(colSel.map((c) => ({ product_id: id!, collection_id: c })));
        if (error) throw error;
      }
      toast.success("Product saved");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["variants"] });
      qc.invalidateQueries({ queryKey: ["product_collections"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  function exportCsv() {
    downloadCsv("products.csv", [
      ["name", "slug", "sku", "price", "sale_price", "stock", "status", "category", "brand", "description"],
      ...products.map((p) => [
        p.name, p.slug, p.sku, p.price, p.sale_price, p.stock, p.status,
        cats.find((c) => c.id === p.category_id)?.slug ?? "",
        brands.find((b) => b.id === p.brand_id)?.name ?? "",
        (p.description ?? "").replace(/\n/g, " "),
      ]),
    ]);
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
    const col = (name: string) => header.indexOf(name);
    if (col("name") < 0 || col("price") < 0) { toast.error("CSV needs at least name and price columns"); return; }
    let created = 0, updated = 0, failed = 0;
    for (const r of rows) {
      const get = (name: string) => (col(name) >= 0 ? r[col(name)]?.trim() ?? "" : "");
      const name = get("name");
      const price = Number(get("price"));
      if (!name || !(price >= 0)) { failed++; continue; }
      const slug = get("slug") || slugify(name);
      const catSlug = get("category").toLowerCase();
      const row = {
        name, slug,
        sku: get("sku") || null,
        price,
        sale_price: get("sale_price") ? Number(get("sale_price")) : null,
        stock: get("stock") ? Math.max(0, Math.round(Number(get("stock")))) : 0,
        status: ["active", "draft", "archived"].includes(get("status")) ? get("status") : "draft",
        category_id: cats.find((c) => c.slug === catSlug)?.id ?? null,
        brand_id: brands.find((b) => b.name.toLowerCase() === get("brand").toLowerCase() && get("brand"))?.id ?? null,
        description: get("description") || null,
      };
      const existing = products.find((p) => p.slug === slug);
      const { error } = existing
        ? await supabase.from("products").update(row).eq("id", existing.id)
        : await supabase.from("products").insert(row);
      if (error) { failed++; continue; }
      existing ? updated++ : created++;
    }
    toast.success(`Import done: ${created} created, ${updated} updated${failed ? `, ${failed} skipped` : ""}`);
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  const set = (k: keyof Form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const margin = form?.price && form?.cost_price ? Math.round(((Number(form.price) - Number(form.cost_price)) / Number(form.price)) * 100) : null;
  const sel = "h-9 rounded-md border bg-background px-3 text-sm";

  return (
    <>
      <PageHeader title="Products" subtitle={`${products.length} products · ${products.filter((p) => p.status === "active").length} live`}>
        <Button variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
        <Button variant="outline" onClick={() => document.getElementById("products-csv-input")?.click()}><Upload className="size-4" /> Import CSV</Button>
        <input id="products-csv-input" type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = ""; }} />
        <Button variant="gold" onClick={() => open()}><Plus /> Add product</Button>
      </PageHeader>
      <KpiGrid>
        <KpiCard label="Products" value={products.length} icon={Boxes} sub={`${products.filter((p) => p.status === "active").length} live · ${products.filter((p) => p.status === "draft").length} draft`} />
        <KpiCard label="Units in stock" value={products.reduce((n, p) => n + Math.max(0, p.stock), 0)} icon={Warehouse} sub="Across all products" />
        <KpiCard label="Low stock" value={products.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).length} icon={AlertTriangle} tone={products.some((p) => p.stock > 0 && p.stock <= p.low_stock_threshold) ? "warn" : "good"} sub="At or below threshold" />
        <KpiCard label="Out of stock" value={products.filter((p) => p.stock <= 0).length} icon={PackageX} tone={products.some((p) => p.stock <= 0) ? "warn" : "good"} sub="Need restocking" />
      </KpiGrid>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option>
          </select>
          <select className={sel} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="all">All categories</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className={sel} value={stockF} onChange={(e) => setStockF(e.target.value)}>
            <option value="all">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </select>
        </div>
        {selIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-gold/40 bg-gold/5 px-3 py-2">
            <span className="text-sm font-medium">{selIds.size} selected</span>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("active")}>Set active</Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("draft")}>Set draft</Button>
            <Button size="sm" variant="outline" disabled={bulkBusy} onClick={() => bulk("archived")}>Archive</Button>
            <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={() => bulk("delete")}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelIds(new Set())}>Clear</Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={list.length > 0 && list.every((p) => selIds.has(p.id))}
                  onCheckedChange={(on) => setSelIds(on ? new Set(list.map((p) => p.id)) : new Set())}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Stock</TableHead><TableHead>Status</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id} data-state={selIds.has(p.id) ? "selected" : undefined}>
                <TableCell><Checkbox checked={selIds.has(p.id)} onCheckedChange={(on) => toggleSel(p.id, !!on)} aria-label={`Select ${p.name}`} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center overflow-hidden rounded bg-muted">
                      {p.images[0] ? <img src={p.images[0]} alt="" className="size-full object-cover" /> : <Package className="size-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-medium">{p.name}{p.is_featured && <span className="ml-2 text-xs text-gold">★ Featured</span>}</p>
                      <p className="text-xs text-muted-foreground">{p.sku ?? "No SKU"}{optionsOf(p).length > 0 && ` · ${optionsOf(p).map((o) => o.name).join(", ")}`}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>{cats.find((c) => c.id === p.category_id)?.name ?? "—"}</TableCell>
                <TableCell>{money(p.price, settings?.currency)}</TableCell>
                <TableCell className={p.stock === 0 ? "text-destructive" : p.stock <= p.low_stock_threshold ? "text-warning" : ""}>{p.stock}</TableCell>
                <TableCell><StatusPill value={p.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" onClick={() => open(p)} aria-label="Edit"><Pencil /></Button>
                  <Button size="icon" variant="ghost" onClick={() => open(p, true)} aria-label="Duplicate"><Copy /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(p)} aria-label="Delete"><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No products found.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display text-3xl">{form?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
          {form && (
            <form onSubmit={save}>
              <Tabs defaultValue="general">
                <TabsList className="mb-4">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                  <TabsTrigger value="pricing">Pricing & stock</TabsTrigger>
                  <TabsTrigger value="variants">Variants{variants.length ? ` (${variants.length})` : ""}</TabsTrigger>
                  <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="grid gap-4 sm:grid-cols-2">
                  <F label="Name *" className="sm:col-span-2"><Input required value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} /></F>
                  <F label="URL slug (auto if empty)"><Input value={form.slug ?? ""} onChange={(e) => set("slug", e.target.value)} /></F>
                  <F label="SKU"><Input value={form.sku ?? ""} onChange={(e) => set("sku", e.target.value)} /></F>
                  <F label="Barcode (GTIN/EAN)"><Input value={form.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} /></F>
                  <F label="Category">
                    <select className={`${sel} w-full`} value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
                      <option value="">—</option>
                      {cats.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.name}</option>)}
                    </select>
                  </F>
                  <F label="Brand">
                    <select className={`${sel} w-full`} value={form.brand_id ?? ""} onChange={(e) => set("brand_id", e.target.value)}>
                      <option value="">—</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </F>
                  <F label="Status">
                    <select className={`${sel} w-full`} value={form.status ?? "draft"} onChange={(e) => set("status", e.target.value)}>
                      <option value="draft">Draft (hidden)</option><option value="active">Active (live)</option><option value="archived">Archived</option>
                    </select>
                  </F>
                  <F label="Tags (comma separated)"><Input value={form.tagsText} onChange={(e) => set("tagsText", e.target.value)} /></F>
                  <F label="Short description" className="sm:col-span-2"><Input value={form.short_description ?? ""} onChange={(e) => set("short_description", e.target.value)} /></F>
                  <F label="Description" className="sm:col-span-2"><Textarea rows={5} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} /></F>
                  <F label="Specifications (one per line, e.g. Material: Steel)" className="sm:col-span-2"><Textarea rows={4} value={form.specsText ?? ""} onChange={(e) => set("specsText", e.target.value)} /></F>
                  <F label="Related products (shown as “You may also like”)" className="sm:col-span-2">
                    <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                      {products.filter((x) => x.id !== form.id).map((x) => (
                        <button type="button" key={x.id} onClick={() => set("related_ids", (form.related_ids ?? []).includes(x.id) ? (form.related_ids ?? []).filter((r: string) => r !== x.id) : [...(form.related_ids ?? []), x.id])}
                          className={`rounded-full border px-3 py-1 text-xs ${(form.related_ids ?? []).includes(x.id) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{x.name}</button>
                      ))}
                    </div>
                  </F>
                  {cols.length > 0 && (
                    <F label="Collections" className="sm:col-span-2">
                      <div className="flex flex-wrap gap-2">
                        {cols.map((c) => (
                          <button type="button" key={c.id} onClick={() => setColSel(colSel.includes(c.id) ? colSel.filter((x) => x !== c.id) : [...colSel, c.id])}
                            className={`rounded-full border px-3 py-1 text-xs ${colSel.includes(c.id) ? "border-primary bg-primary text-primary-foreground" : ""}`}>{c.name}</button>
                        ))}
                      </div>
                    </F>
                  )}
                  <label className="flex items-center gap-3 text-sm sm:col-span-2"><Switch checked={!!form.is_featured} onCheckedChange={(v) => set("is_featured", v)} /> Featured on homepage</label>
                </TabsContent>
                <TabsContent value="media">
                  <p className="mb-3 text-sm text-muted-foreground">First image is the main image. Hover to reorder or remove.</p>
                  <ImagePicker value={form.images ?? []} onChange={(v) => set("images", v)} />
                  {(form.images ?? []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Image alt text <span className="font-normal text-muted-foreground">— describes each photo for search engines and screen readers</span></p>
                      {(form.images as string[]).map((u, i) => (
                        <div key={u + i} className="flex items-center gap-2">
                          <img src={u} alt="" className="size-10 rounded object-cover" />
                          <Input placeholder={suggestAlt(form.name, i)} value={form.image_alts?.[i] ?? ""} onChange={(e) => { const a = [...(form.image_alts ?? [])]; a[i] = e.target.value; set("image_alts", a); }} />
                          <Button type="button" variant="outline" size="sm" onClick={() => { const a = [...(form.image_alts ?? [])]; a[i] = suggestAlt(form.name, i); set("image_alts", a); }}>Suggest</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="pricing" className="grid gap-4 sm:grid-cols-3">
                  <F label="Price *"><Input type="number" step="0.01" min="0" required value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} /></F>
                  <F label="Compare-at price"><Input type="number" step="0.01" min="0" value={form.compare_at_price ?? ""} onChange={(e) => set("compare_at_price", e.target.value)} /></F>
                  <F label={`Cost price${margin !== null ? ` · ${margin}% margin` : ""}`}><Input type="number" step="0.01" min="0" value={form.cost_price ?? ""} onChange={(e) => set("cost_price", e.target.value)} /></F>
                  <F label="Sale price (flash sale)"><Input type="number" step="0.01" min="0" value={form.sale_price ?? ""} onChange={(e) => set("sale_price", e.target.value)} /></F>
                  <F label="Sale starts (optional)"><Input type="datetime-local" value={form.sale_starts_at ?? ""} onChange={(e) => set("sale_starts_at", e.target.value)} /></F>
                  <F label="Sale ends (optional)"><Input type="datetime-local" value={form.sale_ends_at ?? ""} onChange={(e) => set("sale_ends_at", e.target.value)} /></F>
                  <F label={variants.length ? "Stock (sum of variants)" : "Stock"}>
                    <Input type="number" min="0" disabled={variants.length > 0} value={variants.length ? variants.filter((v) => v.is_active).reduce((s, v) => s + v.stock, 0) : form.stock ?? 0} onChange={(e) => set("stock", e.target.value)} />
                  </F>
                  <label className="flex items-center gap-3 text-sm sm:col-span-3"><Switch checked={form.cod_allowed ?? true} onCheckedChange={(v) => set("cod_allowed", v)} /> Available for Cash on Delivery</label>
                  <F label="Low-stock alert at"><Input type="number" min="0" value={form.low_stock_threshold ?? 5} onChange={(e) => set("low_stock_threshold", e.target.value)} /></F>
                  <F label="Weight (grams)"><Input type="number" min="0" value={form.weight_grams ?? ""} onChange={(e) => set("weight_grams", e.target.value)} /></F>
                </TabsContent>
                <TabsContent value="variants">
                  <p className="mb-3 text-sm text-muted-foreground">Add options like Size, Color or Material, then generate variants to set their own price, SKU, stock and image.</p>
                  <VariantsEditor options={opts} setOptions={setOpts} variants={variants} setVariants={setVariants} images={form.images ?? []} baseSku={form.sku} />
                </TabsContent>
                <TabsContent value="seo" className="grid gap-4">
                  <F label="SEO title"><Input value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value)} /></F>
                  <F label="SEO description"><Textarea rows={3} value={form.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value)} /></F>
                  <F label="Meta keywords (optional, comma separated)"><Input value={form.meta_keywords ?? ""} onChange={(e) => set("meta_keywords", e.target.value)} /></F>
                  <F label="Canonical URL (leave empty to use this product's own URL)"><Input placeholder="https://…" value={form.canonical_url ?? ""} onChange={(e) => set("canonical_url", e.target.value)} /></F>
                  <F label="Social share image URL (defaults to first product image)"><Input placeholder="https://…" value={form.og_image_url ?? ""} onChange={(e) => set("og_image_url", e.target.value)} /></F>
                  <label className="flex items-center gap-3 text-sm"><Switch checked={!!form.robots_noindex} onCheckedChange={(v) => set("robots_noindex", v)} /> Hide from search engines (noindex)</label>
                </TabsContent>
              </Tabs>
              <div className="mt-6 flex justify-end gap-2 border-t pt-4">
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

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function suggestAlt(name: string | undefined, i: number) {
  const n = (name ?? "").trim() || "Product";
  return i === 0 ? `${n} — front view` : `${n} — detail view ${i + 1}`;
}
