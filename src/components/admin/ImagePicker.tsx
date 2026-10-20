import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Library, Loader2, X, ArrowLeft } from "lucide-react";
import { uploadMedia } from "@/lib/media";
import { mediaQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Multi-image field: upload new files or pick from the media library. */
export function ImagePicker({ value, onChange, multiple = true }: { value: string[]; onChange: (v: string[]) => void; multiple?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lib, setLib] = useState(false);
  const qc = useQueryClient();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      try {
        urls.push(await uploadMedia(f));
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["media"] });
    if (urls.length) onChange(multiple ? [...value, ...urls] : [urls[0]]);
    if (ref.current) ref.current.value = "";
  }

  const move = (i: number) => {
    if (i === 0) return;
    const v = [...value];
    [v[i - 1], v[i]] = [v[i], v[i - 1]];
    onChange(v);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((u, i) => (
          <div key={u + i} className="group relative size-20 overflow-hidden rounded border bg-muted">
            <img src={u} alt="" className="size-full object-cover" />
            {i === 0 && multiple && <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-center text-[9px] uppercase text-primary-foreground">Main</span>}
            <div className="absolute inset-0 hidden items-start justify-between bg-primary/40 p-1 group-hover:flex">
              {i > 0 ? <button type="button" onClick={() => move(i)} className="rounded bg-card p-0.5" aria-label="Move left"><ArrowLeft className="size-3" /></button> : <span />}
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded bg-card p-0.5" aria-label="Remove"><X className="size-3" /></button>
            </div>
          </div>
        ))}
        {(multiple || value.length === 0) && (
          <>
            <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="flex size-20 flex-col items-center justify-center gap-1 rounded border border-dashed text-xs text-muted-foreground hover:border-gold hover:text-foreground">
              {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}Upload
            </button>
            <button type="button" onClick={() => setLib(true)} className="flex size-20 flex-col items-center justify-center gap-1 rounded border border-dashed text-xs text-muted-foreground hover:border-gold hover:text-foreground">
              <Library className="size-5" />Library
            </button>
          </>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple={multiple} hidden onChange={(e) => onFiles(e.target.files)} />
      <LibraryDialog open={lib} onClose={() => setLib(false)} onPick={(u) => { onChange(multiple ? [...value, u] : [u]); setLib(false); }} />
    </div>
  );
}

function LibraryDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (u: string) => void }) {
  const { data = [] } = useQuery({ ...mediaQuery, enabled: open });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">Media library</DialogTitle></DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-4 gap-3 overflow-y-auto sm:grid-cols-6">
          {data.map((m) => (
            <button key={m.id} type="button" onClick={() => onPick(m.url)} className="aspect-square overflow-hidden rounded border hover:ring-2 hover:ring-gold">
              <img src={m.url} alt={m.filename ?? ""} className="size-full object-cover" />
            </button>
          ))}
          {data.length === 0 && <p className="col-span-full py-10 text-center text-sm text-muted-foreground">No images uploaded yet.</p>}
        </div>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  );
}
