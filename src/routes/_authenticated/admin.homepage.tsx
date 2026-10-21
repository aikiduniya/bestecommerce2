import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Copy, Trash2, Plus, RotateCcw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sectionsQuery, sectionLabel, SECTION_TYPES, defaultConfig, type HomeSection } from "@/lib/sections";
import { collectionsQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/homepage")({ component: HomepageBuilder });

type Cfg = any;

const DEFAULT_SECTIONS: { type: string; title?: string }[] = [
  { type: "hero" },
  { type: "trust_badges" },
  { type: "categories", title: "Shop by category" },
  { type: "featured_products", title: "Selected pieces" },
  { type: "new_arrivals", title: "New arrivals" },
  { type: "newsletter" },
];

function HomepageBuilder() {
  const { data: sections = [], isLoading } = useQuery(sectionsQuery);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const [adding, setAdding] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["homepage_sections"] });

  const reorder = useMutation({
    mutationFn: async (ordered: HomeSection[]) => {
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase.from("homepage_sections").update({ sort_order: i }).eq("id", ordered[i]!.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase.from("homepage_sections").update({ is_enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (s: HomeSection) => {
      const { error } = await supabase.from("homepage_sections").insert({
        type: s.type, title: s.title, subtitle: s.subtitle, config: s.config, sort_order: s.sort_order + 1, is_enabled: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Section duplicated (disabled)"); },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("homepage_sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Section removed"); },
    onError: (e) => toast.error(e.message),
  });

  const addSection = useMutation({
    mutationFn: async (type: string) => {
      const max = sections.reduce((m, s) => Math.max(m, s.sort_order), -1);
      const { error } = await supabase.from("homepage_sections").insert({ type, sort_order: max + 1, config: defaultConfig(type) as import("@/integrations/supabase/types").Json });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setAdding(false); toast.success("Section added"); },
    onError: (e) => toast.error(e.message),
  });

  const resetDefaults = useMutation({
    mutationFn: async () => {
      const max = sections.reduce((m, s) => Math.max(m, s.sort_order), -1);
      const rows = DEFAULT_SECTIONS.map((d, i) => ({ type: d.type, title: d.title ?? null, sort_order: max + 1 + i, config: defaultConfig(d.type) as import("@/integrations/supabase/types").Json }));
      const { error } = await supabase.from("homepage_sections").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Default sections added"); },
    onError: (e) => toast.error(e.message),
  });

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = sections.findIndex((s) => s.id === active.id);
    const newI = sections.findIndex((s) => s.id === over.id);
    reorder.mutate(arrayMove(sections, oldI, newI));
  }

  return (
    <>
      <PageHeader title="Homepage builder" subtitle="Add, arrange and configure the sections on your storefront homepage. Changes go live immediately.">
        <div className="flex gap-2">
          {sections.length === 0 && (
            <Button variant="outline" onClick={() => resetDefaults.mutate()} disabled={resetDefaults.isPending}>
              <RotateCcw className="size-4" /> Start with defaults
            </Button>
          )}
          <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add section</Button>
        </div>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : sections.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="font-display text-2xl">No custom sections yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            The homepage currently shows the built-in layout. Add sections here to take full control — once you add your first section, this builder drives the whole homepage.
          </p>
        </Card>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map((s) => (
                <SortableRow key={s.id} section={s} onEdit={() => setEditing(s)} onDuplicate={() => duplicate.mutate(s)} onDelete={() => remove.mutate(s.id)} onToggle={(v) => toggle.mutate({ id: s.id, is_enabled: v })} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add a section</DialogTitle></DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTION_TYPES.map((t) => (
              <button key={t.type} onClick={() => addSection.mutate(t.type)} className="rounded border p-4 text-left text-sm hover:border-gold">
                {t.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {editing && <EditDialog section={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); invalidate(); }} />}
    </>
  );
}

function SortableRow({ section, onEdit, onDuplicate, onDelete, onToggle }: {
  section: HomeSection; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onToggle: (v: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return (
    <Card ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex items-center gap-3 p-3 ${isDragging ? "z-10 opacity-80 shadow-lg" : ""} ${section.is_enabled ? "" : "opacity-60"}`}>
      <button {...attributes} {...listeners} className="cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground" aria-label="Drag to reorder">
        <GripVertical className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{section.title || sectionLabel(section.type)}</p>
        <p className="text-xs text-muted-foreground">{sectionLabel(section.type)}</p>
      </div>
      <div className="flex items-center gap-1">
        {section.is_enabled ? <Eye className="mr-1 size-4 text-success" /> : <EyeOff className="mr-1 size-4 text-muted-foreground" />}
        <Switch checked={section.is_enabled} onCheckedChange={onToggle} aria-label="Enable section" />
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit"><Pencil className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onDuplicate} aria-label="Duplicate"><Copy className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete"><Trash2 className="size-4 text-destructive" /></Button>
      </div>
    </Card>
  );
}

function EditDialog({ section, onClose, onSaved }: { section: HomeSection; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(section.title ?? "");
  const [subtitle, setSubtitle] = useState(section.subtitle ?? "");
  const [cfg, setCfg] = useState<Cfg>((section.config ?? {}) as Cfg);
  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("homepage_sections").update({ title: title || null, subtitle: subtitle || null, config: cfg }).eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Section saved"); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>Edit {sectionLabel(section.type)}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Section heading" />
          </div>
          <div>
            <label className="text-xs font-medium">Subtitle</label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Optional" />
          </div>
          <ConfigFields type={section.type} cfg={cfg} set={set} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save section</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfigFields({ type, cfg, set }: { type: string; cfg: Cfg; set: (k: string, v: unknown) => void }) {
  const { data: cols = [] } = useQuery(collectionsQuery);
  const num = (k: string, label: string) => (
    <div>
      <label className="text-xs font-medium">{label}</label>
      <Input type="number" min={1} max={24} value={cfg[k] ?? ""} onChange={(e) => set(k, Number(e.target.value))} />
    </div>
  );
  const txt = (k: string, label: string, placeholder?: string) => (
    <div>
      <label className="text-xs font-medium">{label}</label>
      <Input value={cfg[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={placeholder} />
    </div>
  );

  switch (type) {
    case "hero":
      return (
        <>
          {txt("eyebrow", "Eyebrow text", "e.g. New season")}
          <div>
            <label className="text-xs font-medium">Background image</label>
            <ImagePicker value={cfg.image_url ?? ""} onChange={(v) => set("image_url", v)} />
          </div>
          {txt("cta_label", "Button label", "Shop now")}
          {txt("cta_link", "Button link", "/shop")}
        </>
      );
    case "categories":
    case "featured_products":
    case "best_sellers":
    case "new_arrivals":
    case "brands":
      return num("count", "How many to show");
    case "collection":
      return (
        <>
          <div>
            <label className="text-xs font-medium">Collection</label>
            <Select value={cfg.collection_id ?? ""} onValueChange={(v) => set("collection_id", v)}>
              <SelectTrigger><SelectValue placeholder="Choose a collection" /></SelectTrigger>
              <SelectContent>
                {cols.map((c: { id: string; name: string }) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {num("count", "How many products to show")}
        </>
      );
    case "promo_banner":
      return (
        <>
          <div>
            <label className="text-xs font-medium">Background image</label>
            <ImagePicker value={cfg.image_url ?? ""} onChange={(v) => set("image_url", v)} />
          </div>
          {txt("cta_label", "Button label")}
          {txt("cta_link", "Button link", "/shop")}
          <div>
            <label className="text-xs font-medium">Theme</label>
            <Select value={cfg.theme ?? "dark"} onValueChange={(v) => set("theme", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
    case "newsletter":
      return <>{txt("cta_label", "Button label", "Subscribe")}{txt("note", "Note under the title")}</>;
    case "text":
      return (
        <div>
          <label className="text-xs font-medium">Text</label>
          <Textarea rows={6} value={cfg.body ?? ""} onChange={(e) => set("body", e.target.value)} />
        </div>
      );
    case "image":
      return (
        <>
          <div>
            <label className="text-xs font-medium">Image</label>
            <ImagePicker value={cfg.image_url ?? ""} onChange={(v) => set("image_url", v)} />
          </div>
          {txt("link", "Link when clicked (optional)", "/shop")}
        </>
      );
    case "video":
      return (
        <>
          {txt("video_url", "Video URL", "YouTube link or .mp4 URL")}
          <div>
            <label className="text-xs font-medium">Poster image (mp4 only)</label>
            <ImagePicker value={cfg.poster ?? ""} onChange={(v) => set("poster", v)} />
          </div>
        </>
      );
    case "trust_badges":
      return <ItemsEditor items={cfg.items ?? []} onChange={(v) => set("items", v)} fields={[{ k: "text", label: "Text" }, { k: "icon", label: "Icon (truck, shield, rotate)" }]} addLabel="Add badge" />;
    case "testimonials":
      return <ItemsEditor items={cfg.items ?? []} onChange={(v) => set("items", v)} fields={[{ k: "name", label: "Name" }, { k: "text", label: "Quote" }, { k: "rating", label: "Rating (1-5)", num: true }]} addLabel="Add testimonial" />;
    case "faq":
      return <ItemsEditor items={cfg.items ?? []} onChange={(v) => set("items", v)} fields={[{ k: "q", label: "Question" }, { k: "a", label: "Answer" }]} addLabel="Add question" />;
    default:
      return <p className="text-xs text-muted-foreground">This section has no extra settings.</p>;
  }
}

function ItemsEditor({ items, onChange, fields, addLabel }: {
  items: Cfg[];
  onChange: (items: Cfg[]) => void;
  fields: { k: string; label: string; num?: boolean }[];
  addLabel: string;
}) {
  const update = (i: number, k: string, v: unknown) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="space-y-2 rounded border p-3">
          <div className="flex justify-between">
            <p className="text-xs font-medium text-muted-foreground">Item {i + 1}</p>
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-xs text-destructive">Remove</button>
          </div>
          {fields.map((f) => (
            <Input
              key={f.k}
              type={f.num ? "number" : "text"}
              placeholder={f.label}
              value={it[f.k] ?? ""}
              onChange={(e) => update(i, f.k, f.num ? Number(e.target.value) : e.target.value)}
            />
          ))}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, {}])}><Plus className="size-3.5" /> {addLabel}</Button>
    </div>
  );
}
