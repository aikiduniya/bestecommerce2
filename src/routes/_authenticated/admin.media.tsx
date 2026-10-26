import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mediaQuery, type Media } from "@/lib/store";
import { uploadMedia } from "@/lib/media";
import { PageHeader } from "@/components/admin/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/media")({
  component: MediaPage,
});

function MediaPage() {
  const qc = useQueryClient();
  const { data = [] } = useQuery(mediaQuery);
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    const list = Array.from(files);
    for (const [i, f] of list.entries()) {
      try { await uploadMedia(f, (p) => setPct(`${list.length > 1 ? `${i + 1}/${list.length} · ` : ""}${p}%`)); ok++; } catch (e) { toast.error((e as Error).message); }
    }
    setBusy(false);
    setPct(null);
    if (ok) toast.success(`${ok} file(s) uploaded`);
    qc.invalidateQueries({ queryKey: ["media"] });
  }

  async function remove(m: Media) {
    if (!confirm("Delete this file? Products using it will lose the image.")) return;
    const s = await supabase.storage.from("media").remove([m.path]);
    if (s.error) { toast.error(s.error.message); return; }
    const { error } = await supabase.from("media").delete().eq("id", m.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["media"] });
  }

  return (
    <>
      <PageHeader title="Media library" subtitle={`${data.length} files · images up to 10MB (JPG, PNG, WEBP, GIF, AVIF, SVG)`}>
        <Button variant="gold" onClick={() => ref.current?.click()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} {busy && pct ? `Uploading ${pct}` : "Upload images"}</Button>
        <input ref={ref} type="file" multiple accept="image/*" hidden onChange={(e) => onFiles(e.target.files)} />
      </PageHeader>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {data.map((m) => (
            <div key={m.id} className="group">
              <div className="relative aspect-square overflow-hidden rounded border bg-muted">
                <img src={m.url} alt={m.alt_text ?? m.filename ?? ""} className="size-full object-cover" loading="lazy" />
                <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-primary/50 group-hover:flex">
                  <Button size="icon" variant="secondary" onClick={() => { navigator.clipboard.writeText(m.url); toast.success("Link copied"); }} aria-label="Copy link"><Copy /></Button>
                  <Button size="icon" variant="destructive" onClick={() => remove(m)} aria-label="Delete"><Trash2 /></Button>
                </div>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">{m.filename}</p>
              <Input key={m.alt_text ?? ""} aria-label="Alt text" className="mt-1 h-7 text-xs" placeholder={suggestAlt(m.filename)} defaultValue={m.alt_text ?? ""}
                onBlur={async (e) => { const v = e.target.value.trim() || null; if (v === m.alt_text) return; const { error } = await supabase.from("media").update({ alt_text: v }).eq("id", m.id); if (error) toast.error(error.message); else { toast.success("Alt text saved"); qc.invalidateQueries({ queryKey: ["media"] }); } }} />
            </div>
          ))}
          {data.length === 0 && <p className="col-span-full py-16 text-center text-sm text-muted-foreground">No images yet. Upload your first image.</p>}
        </div>
      </Card>
    </>
  );
}

function suggestAlt(filename: string | null) {
  const base = (filename ?? "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").replace(/\d{6,}/g, "").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "Describe this image";
}
