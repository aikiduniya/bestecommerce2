import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, ShoppingBag, Sparkles, Star, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Slide = {
  eyebrow?: string; title?: string; subtitle?: string; description?: string;
  image_url?: string; mobile_image_url?: string; image_alt?: string; video_url?: string;
  cta_label?: string; cta_link?: string; cta_icon?: string;
  cta2_label?: string; cta2_link?: string;
  align?: "left" | "center" | "right"; tone?: "light" | "dark"; overlay?: number;
};

/** Embed URL for YouTube/Vimeo links (muted autoplay loop), or null for direct video files. */
export function videoEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0&playsinline=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?background=1&autoplay=1&muted=1&loop=1`;
  return null;
}

const ICONS = { arrow: ArrowRight, bag: ShoppingBag, sparkles: Sparkles, star: Star, play: Play } as const;
const HEIGHTS: Record<string, string> = { compact: "min-h-[420px]", medium: "min-h-[520px]", tall: "min-h-[620px] md:min-h-[720px]", full: "min-h-[calc(100svh-4.5rem)]" };

/** Admin-driven homepage banner: one or more slides, split or full-bleed layout. */
export function HeroSlider({ slides, layout = "split", height = "tall", autoplay = 6 }: { slides: Slide[]; layout?: "split" | "full"; height?: string; autoplay?: number }) {
  const [i, setI] = useState(0);
  const n = slides.length;
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);
  const paused = useRef(false);
  const touch = useRef<number | null>(null);
  useEffect(() => {
    if (n < 2 || !autoplay) return;
    const t = setInterval(() => { if (!paused.current) go(1); }, Math.max(3, autoplay) * 1000);
    return () => clearInterval(t);
  }, [n, autoplay, go]);
  if (!n) return null;

  return (
    <section
      className={`relative overflow-hidden bg-hero text-primary-foreground ${HEIGHTS[height] ?? HEIGHTS["tall"]}`}
      aria-roledescription="carousel" aria-label="Featured"
      onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => { const s = touch.current; const x = e.changedTouches[0]?.clientX; if (s !== null && x !== undefined && Math.abs(x - s) > 50) go(x < s ? 1 : -1); touch.current = null; }}
    >
      {slides.map((s, k) => {
        const Icon = ICONS[(s.cta_icon ?? "arrow") as keyof typeof ICONS] ?? ArrowRight;
        const align = s.align ?? (layout === "split" ? "left" : "left");
        const dark = s.tone === "dark";
        const overlay = Math.min(90, Math.max(0, s.overlay ?? 35)) / 100;
        const text = (
          <div className={`relative z-10 flex flex-col justify-center px-6 py-16 md:px-12 ${align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start"} ${dark ? "text-foreground" : ""}`}>
            {s.eyebrow && <p className="eyebrow flex items-center gap-3 text-gold"><span className="h-px w-10 bg-gold" />{s.eyebrow}</p>}
            {s.title && <h1 className="mt-6 max-w-3xl text-5xl leading-[1.02] md:text-7xl lg:text-8xl">{s.title}</h1>}
            {s.subtitle && <p className="mt-5 max-w-xl font-display text-2xl italic opacity-90">{s.subtitle}</p>}
            {s.description && <p className="mt-4 max-w-lg text-sm leading-relaxed opacity-75 md:text-base">{s.description}</p>}
            {(s.cta_label || s.cta2_label) && (
              <div className="mt-10 flex flex-wrap gap-3">
                {s.cta_label && <Button variant="gold" size="lg" asChild><a href={s.cta_link || "/shop"}>{s.cta_label} <Icon /></a></Button>}
                {s.cta2_label && <Button variant="outline" size="lg" className={dark ? "" : "border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"} asChild><a href={s.cta2_link || "/shop"}>{s.cta2_label}</a></Button>}
              </div>
            )}
          </div>
        );
        const video = s.video_url && /^https:\/\//.test(s.video_url) ? s.video_url : "";
        const embed = video ? videoEmbed(video) : null;
        const img = video ? (
          embed
            ? <iframe src={k === i ? embed : undefined} title={s.image_alt || s.title || "Banner video"} allow="autoplay; encrypted-media" className="pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0" style={s.image_url ? { backgroundImage: `url(${s.image_url})`, backgroundSize: "cover" } : undefined} />
            : <video src={video} poster={s.image_url || undefined} autoPlay muted loop playsInline preload={k === 0 ? "auto" : "metadata"} className="size-full object-cover" aria-label={s.image_alt || undefined} />
        ) : s.image_url ? (
          <picture>
            {s.mobile_image_url && <source media="(max-width: 767px)" srcSet={s.mobile_image_url} />}
            <img src={s.image_url} alt={s.image_alt ?? ""} className="size-full object-cover" loading={k === 0 ? "eager" : "lazy"} {...(k === 0 ? { fetchPriority: "high" as const } : {})} />
          </picture>
        ) : null;
        return (
          <div key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${n}`} aria-hidden={k !== i}
            className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "pointer-events-none opacity-0"} ${dark ? "bg-background" : ""}`}>
            {layout === "split" ? (
              <div className="mx-auto grid h-full max-w-7xl md:grid-cols-2">
                {text}
                <div className="relative hidden md:block">{img && <div className="absolute inset-y-10 right-6 left-0 overflow-hidden rounded-sm border border-gold/30 shadow-elegant">{img}</div>}</div>
                {img && <div className="absolute inset-0 -z-0 md:hidden" style={{ opacity: 1 - overlay }}>{img}</div>}
              </div>
            ) : (
              <>
                {img && <div className="absolute inset-0">{img}</div>}
                <div className={`absolute inset-0 ${dark ? "bg-background" : "bg-primary"}`} style={{ opacity: img ? overlay : 0 }} />
                <div className="relative mx-auto flex h-full max-w-7xl">{<div className="w-full">{text}</div>}</div>
              </>
            )}
          </div>
        );
      })}
      {/* keeps section height from the active slide's content */}
      <div className="invisible" aria-hidden="true"><div className="px-6 py-16 md:px-12"><p className="eyebrow">.</p><h1 className="mt-6 text-5xl md:text-7xl lg:text-8xl">.<br />.</h1><div className="mt-10 h-11" /></div></div>
      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous slide" className="absolute left-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-primary-foreground/30 p-2 backdrop-blur hover:border-gold md:block"><ChevronLeft /></button>
          <button onClick={() => go(1)} aria-label="Next slide" className="absolute right-3 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-primary-foreground/30 p-2 backdrop-blur hover:border-gold md:block"><ChevronRight /></button>
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
            {slides.map((_, k) => <button key={k} onClick={() => setI(k)} aria-label={`Go to slide ${k + 1}`} className={`h-1 rounded-full transition-all ${k === i ? "w-10 bg-gold" : "w-5 bg-primary-foreground/40"}`} />)}
          </div>
        </>
      )}
    </section>
  );
}
