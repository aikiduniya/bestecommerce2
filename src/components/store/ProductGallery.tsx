import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Minus, Plus, X, RotateCcw } from "lucide-react";

type Img = { src: string; alt: string };

/** Product images: thumbnails, hover zoom, swipe, and a fullscreen lightbox with zoom/pinch. */
export function ProductGallery({ images, fallback, index, onIndex }: { images: Img[]; fallback: string; index: number; onIndex: (i: number) => void }) {
  const n = images.length;
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [open, setOpen] = useState(false);
  const touch = useRef<number | null>(null);
  const go = useCallback((d: number) => n && onIndex((index + d + n) % n), [index, n, onIndex]);
  const cur = images[index];
  // Auto-advance every 5 seconds; pauses while zooming (hover) or in fullscreen. Timer restarts after manual changes.
  useEffect(() => {
    if (n < 2 || hover || open) return;
    const t = setTimeout(() => onIndex((index + 1) % n), 5000);
    return () => clearTimeout(t);
  }, [index, n, hover, open, onIndex]);

  return (
    <div>
      <div
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded bg-secondary"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
        onMouseLeave={() => setHover(null)}
        onClick={() => cur && setOpen(true)}
        onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => { const s = touch.current; const x = e.changedTouches[0]?.clientX; if (s !== null && x !== undefined && Math.abs(x - s) > 40) { e.preventDefault(); go(x < s ? 1 : -1); } touch.current = null; }}
      >
        {cur ? (
          <img src={cur.src} alt={cur.alt} className="size-full object-cover transition-transform duration-200"
            style={hover ? { transform: "scale(2)", transformOrigin: `${hover.x}% ${hover.y}%` } : undefined} />
        ) : <div className="flex size-full items-center justify-center font-display text-8xl text-muted-foreground/30">{fallback}</div>}
        {cur && <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-card/80 p-2 opacity-0 transition group-hover:opacity-100 max-md:opacity-100"><Expand className="size-4" /></span>}
        {n > 1 && (
          <>
            <button type="button" aria-label="Previous image" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-2 opacity-0 transition group-hover:opacity-100 max-md:opacity-100"><ChevronLeft className="size-4" /></button>
            <button type="button" aria-label="Next image" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-card/80 p-2 opacity-0 transition group-hover:opacity-100 max-md:opacity-100"><ChevronRight className="size-4" /></button>
            <span className="absolute bottom-3 left-3 rounded-full bg-card/80 px-2.5 py-0.5 text-xs">{index + 1} / {n}</span>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-3">
          {images.map((im, i) => (
            <button key={im.src + i} type="button" aria-label={`Show image ${i + 1}`} onClick={() => onIndex(i)} className={`aspect-square overflow-hidden rounded border-2 ${i === index ? "border-gold" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <img src={im.src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {open && cur && <Lightbox images={images} index={index} onIndex={onIndex} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Lightbox({ images, index, onIndex, onClose }: { images: Img[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const n = images.length;
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ d: number; z: number } | null>(null);
  const swipe = useRef<number | null>(null);
  const reset = () => { setZ(1); setPan({ x: 0, y: 0 }); };
  const go = (d: number) => { reset(); onIndex((index + d + n) % n); };
  const zoom = (d: number) => setZ((v) => { const nz = Math.min(4, Math.max(1, +(v + d).toFixed(2))); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") zoom(0.5);
      else if (e.key === "-") zoom(-0.5);
    };
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  });
  const dist = (t: React.TouchList) => Math.hypot((t[0]?.clientX ?? 0) - (t[1]?.clientX ?? 0), (t[0]?.clientY ?? 0) - (t[1]?.clientY ?? 0));
  const im = images[index]!;
  const btn = "rounded-full border border-primary-foreground/30 p-2.5 text-primary-foreground hover:border-gold hover:text-gold disabled:opacity-30";

  return (
    <div role="dialog" aria-modal="true" aria-label="Image viewer" className="fixed inset-0 z-[100] flex flex-col bg-primary/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm text-primary-foreground/80">{index + 1} / {n}</span>
        <div className="flex gap-2">
          <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoom(-0.5)} disabled={z <= 1}><Minus className="size-4" /></button>
          <span className="flex w-14 items-center justify-center text-xs text-primary-foreground">{Math.round(z * 100)}%</span>
          <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoom(0.5)} disabled={z >= 4}><Plus className="size-4" /></button>
          <button type="button" aria-label="Reset zoom" className={btn} onClick={reset}><RotateCcw className="size-4" /></button>
          <button type="button" aria-label="Close" className={btn} onClick={onClose}><X className="size-4" /></button>
        </div>
      </div>
      <div
        className={`relative flex flex-1 touch-none items-center justify-center overflow-hidden ${z > 1 ? "cursor-grab" : "cursor-zoom-in"}`}
        onWheel={(e) => zoom(e.deltaY < 0 ? 0.25 : -0.25)}
        onDoubleClick={() => (z > 1 ? reset() : setZ(2))}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onPointerDown={(e) => { if (z > 1 && e.pointerType === "mouse") drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }}
        onPointerMove={(e) => { const d = drag.current; if (d) setPan({ x: d.px + (e.clientX - d.x) / z, y: d.py + (e.clientY - d.y) / z }); }}
        onPointerUp={() => (drag.current = null)}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z };
          else if (e.touches[0]) { swipe.current = e.touches[0].clientX; drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y }; }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinch.current) setZ(Math.min(4, Math.max(1, pinch.current.z * (dist(e.touches) / pinch.current.d))));
          else if (z > 1 && drag.current && e.touches[0]) { const d = drag.current; setPan({ x: d.px + (e.touches[0].clientX - d.x) / z, y: d.py + (e.touches[0].clientY - d.y) / z }); }
        }}
        onTouchEnd={(e) => {
          const s = swipe.current; const x = e.changedTouches[0]?.clientX;
          if (z === 1 && !pinch.current && s !== null && x !== undefined && Math.abs(x - s) > 50 && n > 1) go(x < s ? 1 : -1);
          if (e.touches.length < 2) pinch.current = null;
          if (e.touches.length === 0) { drag.current = null; swipe.current = null; }
        }}
      >
        <img src={im.src} alt={im.alt} draggable={false} className="max-h-full max-w-full select-none object-contain transition-transform duration-100"
          style={{ transform: `scale(${z}) translate(${pan.x}px, ${pan.y}px)` }} />
        {n > 1 && (
          <>
            <button type="button" aria-label="Previous image" className={`absolute left-3 top-1/2 -translate-y-1/2 ${btn}`} onClick={() => go(-1)}><ChevronLeft /></button>
            <button type="button" aria-label="Next image" className={`absolute right-3 top-1/2 -translate-y-1/2 ${btn}`} onClick={() => go(1)}><ChevronRight /></button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto p-3">
          {images.map((t, i) => (
            <button key={t.src + i} type="button" aria-label={`Show image ${i + 1}`} onClick={() => { reset(); onIndex(i); }} className={`size-14 shrink-0 overflow-hidden rounded border-2 ${i === index ? "border-gold" : "border-transparent opacity-60"}`}><img src={t.src} alt="" className="size-full object-cover" /></button>
          ))}
        </div>
      )}
    </div>
  );
}
