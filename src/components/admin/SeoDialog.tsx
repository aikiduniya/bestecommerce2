import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type SeoRow = {
  id: string;
  name: string;
  slug: string;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  image_alt?: string | null;
  robots_noindex?: boolean;
};

const FIELDS = ["meta_title", "meta_description", "meta_keywords", "canonical_url", "og_image_url", "image_alt"] as const;

/** SEO + image alt editor for categories, brands and collections. */
export function SeoDialog({ table, row, imageLabel = "Image alt text" }: { table: "categories" | "brands" | "collections"; row: SeoRow; imageLabel?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({});
  const [noindex, setNoindex] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setF(Object.fromEntries(FIELDS.map((k) => [k, (row[k] as string | null) ?? ""])));
    setNoindex(!!row.robots_noindex);
  }
  async function save() {
    if (f.canonical_url && !/^https?:\/\//.test(f.canonical_url)) { toast.error("Canonical URL must start with https://"); return; }
    if (f.og_image_url && !/^https?:\/\//.test(f.og_image_url)) { toast.error("Sharing image must be a full https:// link"); return; }
    setBusy(true);
    const patch = { ...Object.fromEntries(FIELDS.map((k) => [k, f[k]?.trim() || null])), robots_noindex: noindex };
    const { error } = await supabase.from(table).update(patch as never).eq("id", row.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("SEO saved");
    void qc.invalidateQueries({ queryKey: [table] });
    setOpen(false);
  }
  const set = (k: (typeof FIELDS)[number]) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const title = f.meta_title || row.name;
  const desc = f.meta_description || "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) load(); setOpen(o); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" aria-label={`SEO for ${row.name}`}><Search className="size-3.5" /> SEO{row.meta_title || row.meta_description ? " ✓" : ""}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>SEO · {row.name}</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="truncate font-medium text-primary">{title}</p>
          <p className="truncate text-xs text-success">/shop?{table === "categories" ? "category" : table === "brands" ? "brand" : "collection"}={row.slug}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{desc || "Add a description so search engines show something useful."}</p>
        </div>
        <div className="space-y-3">
          <div><Label>Meta title <span className="text-xs text-muted-foreground">({(f.meta_title ?? "").length}/60)</span></Label><Input name="meta_title" value={f.meta_title ?? ""} onChange={set("meta_title")} placeholder={row.name} /></div>
          <div><Label>Meta description <span className="text-xs text-muted-foreground">({(f.meta_description ?? "").length}/160)</span></Label><Textarea name="meta_description" rows={3} value={f.meta_description ?? ""} onChange={set("meta_description")} /></div>
          <div><Label>Keywords</Label><Input name="meta_keywords" value={f.meta_keywords ?? ""} onChange={set("meta_keywords")} placeholder="comma, separated" /></div>
          <div><Label>Canonical URL</Label><Input name="canonical_url" value={f.canonical_url ?? ""} onChange={set("canonical_url")} placeholder="Leave empty to use this page's own address" /></div>
          <div><Label>Sharing image (https link)</Label><Input name="og_image_url" value={f.og_image_url ?? ""} onChange={set("og_image_url")} /></div>
          <div>
            <Label>{imageLabel}</Label>
            <div className="flex gap-2">
              <Input name="image_alt" value={f.image_alt ?? ""} onChange={set("image_alt")} />
              <Button type="button" variant="outline" size="sm" onClick={() => setF((p) => ({ ...p, image_alt: `${row.name} collection` }))}>Suggest</Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={noindex} onCheckedChange={setNoindex} /> Hide from search engines</label>
        </div>
        <Button variant="gold" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save SEO"}</Button>
      </DialogContent>
    </Dialog>
  );
}
