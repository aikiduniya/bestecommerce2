import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Row = Record<string, unknown> & { id: string; slug: string; title: string; is_published: boolean };

/** Shared editor for CMS pages and blog posts. */
export function ContentEditor({ kind, rows, queryKey }: { kind: "pages" | "blog_posts"; rows: Row[]; queryKey: string }) {
  const qc = useQueryClient();
  const isBlog = kind === "blog_posts";
  const [edit, setEdit] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (edit && !rows.find((r) => r.id === edit.id) && edit.id) setEdit(null); }, [rows, edit]);

  const blank: Row = isBlog
    ? { id: "", slug: "", title: "", excerpt: "", body: "", cover_image: null, author: "", tags: [], seo_title: "", seo_description: "", is_published: false }
    : { id: "", slug: "", title: "", body: "", seo_title: "", seo_description: "", is_published: false, show_in_footer: true, sort_order: rows.length + 1 };

  async function save() {
    if (!edit) return;
    const title = String(edit.title ?? "").trim();
    if (!title) { toast.error("Title is required"); return; }
    const slug = slugify(String(edit.slug || title));
    if (!slug) { toast.error("Please enter a valid URL slug"); return; }
    setSaving(true);
    const { id, created_at: _c, updated_at: _u, ...rest } = edit;
    const payload: Record<string, unknown> = { ...rest, title, slug };
    for (const k of ["seo_title", "seo_description", "excerpt", "author"]) if (k in payload && payload[k] === "") payload[k] = null;
    if (isBlog && payload["is_published"] && !payload["published_at"]) payload["published_at"] = new Date().toISOString();
    const q = id ? supabase.from(kind).update(payload as never).eq("id", id) : supabase.from(kind).insert(payload as never);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "That URL slug is already used" : error.message); return; }
    toast.success("Saved");
    setEdit(null);
    qc.invalidateQueries({ queryKey: [queryKey] });
  }
  async function remove(r: Row) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    const { error } = await supabase.from(kind).delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: [queryKey] });
  }
  const set = (k: string, v: unknown) => setEdit((e) => (e ? { ...e, [k]: v } : e));
  const str = (k: string) => String(edit?.[k] ?? "");

  if (edit) {
    return (
      <>
        <PageHeader title={edit.id ? `Edit ${isBlog ? "article" : "page"}` : `New ${isBlog ? "article" : "page"}`}>
          <div className="flex gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button variant="gold" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
        </PageHeader>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="space-y-4 p-6">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Title *</Label><Input value={str("title")} onChange={(e) => set("title", e.target.value)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">URL slug</Label><Input value={str("slug")} placeholder={slugify(str("title"))} onChange={(e) => set("slug", e.target.value)} />
              <p className="text-xs text-muted-foreground">{isBlog ? "/blog/" : "/pages/"}{slugify(str("slug") || str("title"))}</p></div>
            {isBlog && <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Excerpt</Label><Textarea rows={2} value={str("excerpt")} onChange={(e) => set("excerpt", e.target.value)} /></div>}
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Content</Label>
              <Textarea rows={18} value={str("body")} onChange={(e) => set("body", e.target.value)} />
              <p className="text-xs text-muted-foreground">Blank line = new paragraph · start a line with "## " for a heading · "- " for bullet lists.</p></div>
          </Card>
          <div className="space-y-6">
            <Card className="space-y-4 p-6">
              <label className="flex items-center justify-between text-sm">Published <Switch checked={edit.is_published} onCheckedChange={(v) => set("is_published", v)} /></label>
              {!isBlog && <label className="flex items-center justify-between text-sm">Show in footer <Switch checked={!!edit["show_in_footer"]} onCheckedChange={(v) => set("show_in_footer", v)} /></label>}
              {!isBlog && <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Footer order</Label><Input type="number" value={str("sort_order")} onChange={(e) => set("sort_order", Number(e.target.value))} /></div>}
              {isBlog && <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Author</Label><Input value={str("author")} onChange={(e) => set("author", e.target.value)} /></div>}
              {isBlog && <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Tags (comma separated)</Label><Input value={((edit["tags"] as string[]) ?? []).join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} /></div>}
              {isBlog && <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Cover image</Label><ImagePicker multiple={false} value={edit["cover_image"] ? [String(edit["cover_image"])] : []} onChange={(v) => set("cover_image", v[0] ?? null)} /></div>}
            </Card>
            <Card className="space-y-4 p-6">
              <p className="text-sm font-medium">Search engine listing</p>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">SEO title ({str("seo_title").length}/60)</Label><Input value={str("seo_title")} onChange={(e) => set("seo_title", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">SEO description ({str("seo_description").length}/160)</Label><Textarea rows={3} value={str("seo_description")} onChange={(e) => set("seo_description", e.target.value)} /></div>
              <div className="rounded border p-3 text-xs"><p className="truncate text-base text-[color:var(--gold)]">{str("seo_title") || str("title") || "Title"}</p><p className="line-clamp-2 text-muted-foreground">{str("seo_description") || str(isBlog ? "excerpt" : "body").slice(0, 160)}</p></div>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={isBlog ? "Blog" : "Pages"} subtitle={isBlog ? "Write journal articles for your store." : "About, FAQ, shipping & returns, privacy and other information pages."}>
        <Button variant="gold" onClick={() => setEdit(blank)}><Plus /> New {isBlog ? "article" : "page"}</Button>
      </PageHeader>
      <Card className="divide-y p-0">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-4 p-4">
            <div className="flex-1"><p className="font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{isBlog ? "/blog/" : "/pages/"}{r.slug}</p></div>
            <StatusPill value={r.is_published ? "active" : "draft"} />
            <Button size="icon" variant="ghost" onClick={() => setEdit(r)} aria-label="Edit"><Pencil /></Button>
            <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label="Delete"><Trash2 /></Button>
          </div>
        ))}
        {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing yet.</p>}
      </Card>
    </>
  );
}
