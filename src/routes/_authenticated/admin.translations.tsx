import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  postsQuery, brandsQuery, categoriesQuery, collectionsQuery, contentTranslationsQuery, pagesQuery, productsQuery, settingsQuery, allVariantsQuery,
} from "@/lib/store";
import { ENTITY_FIELDS, ENTITY_LABELS, extraLanguages, indexTranslations, type ContentTranslation } from "@/lib/i18n";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/translations")({
  component: TranslationsPage,
});

type EntityOption = { id: string; label: string };

function TranslationsPage() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const { data: rows = [] } = useQuery(contentTranslationsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: variants = [] } = useQuery(allVariantsQuery);
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: brands = [] } = useQuery(brandsQuery);
  const { data: collections = [] } = useQuery(collectionsQuery);
  const { data: pages = [] } = useQuery(pagesQuery);
  const { data: posts = [] } = useQuery(postsQuery);

  const langs = extraLanguages(s?.languages);
  const index = useMemo(() => indexTranslations(rows as ContentTranslation[]), [rows]);

  const [entityType, setEntityType] = useState<string>("product");
  const [entityId, setEntityId] = useState<string>("");
  const [lang, setLang] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  const entities: EntityOption[] = useMemo(() => {
    switch (entityType) {
      case "product": return products.map((p) => ({ id: p.id, label: p.name }));
      case "variant": return variants.map((v) => {
        const p = products.find((x) => x.id === v.product_id);
        const opts = Object.entries((v.options ?? {}) as Record<string, string>).map(([k, val]) => `${k}: ${val}`).join(" · ");
        return { id: v.id, label: `${p?.name ?? "Product"} — ${opts || v.sku || v.id.slice(0, 8)}` };
      });
      case "category": return categories.map((c) => ({ id: c.id, label: c.name }));
      case "brand": return brands.map((b) => ({ id: b.id, label: b.name }));
      case "collection": return collections.map((c) => ({ id: c.id, label: c.name }));
      case "page": return pages.map((p) => ({ id: p.id, label: p.title }));
      case "blog_post": return posts.map((p) => ({ id: p.id, label: p.title }));
      default: return [];
    }
  }, [entityType, products, variants, categories, brands, collections, pages, posts]);

  const activeLang = lang || langs[0]?.code || "";
  const fields = ENTITY_FIELDS[entityType] ?? [];
  const existing = entityId && activeLang ? (index[entityType]?.[entityId]?.[activeLang] ?? {}) : {};
  const current = draft ?? existing;

  // Base (English) values for placeholder/fallback display.
  const baseEntity = useMemo(() => {
    const all: Record<string, ({ id: string } & Record<string, unknown>)[]> = {
      product: products, variant: variants, category: categories, brand: brands,
      collection: collections, page: pages, blog_post: posts,
    };
    return (all[entityType] ?? []).find((e) => e["id"] === entityId) as Record<string, unknown> | undefined;
  }, [entityType, entityId, products, variants, categories, brands, collections, pages, posts]);

  function pick(type: string, id: string, lg: string) {
    setEntityType(type); setEntityId(id); setLang(lg); setDraft(null);
  }

  async function save() {
    if (!entityId || !activeLang || !draft) return;
    for (const [k, v] of Object.entries(draft)) {
      if (k === "slug" && v.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.trim())) {
        toast.error("Slugs must be lowercase letters, numbers and hyphens only");
        return;
      }
    }
    setSaving(true);
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft)) if (v.trim()) clean[k] = v.trim();
    const { error } = await supabase.from("content_translations").upsert(
      { entity_type: entityType, entity_id: entityId, lang: activeLang, fields: clean },
      { onConflict: "entity_type,entity_id,lang" },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Translation saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["content_translations"] });
  }

  if (langs.length === 0) {
    return (
      <>
        <PageHeader title="Translations" subtitle="Translate your catalog and content into every language your store offers." />
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No languages added yet. Add languages in <b>Settings → Languages</b> first, then come back here to translate your content.
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Translations" subtitle="Translate products, categories, pages and more. Blank fields fall back to the original text.">
        <Button variant="gold" onClick={save} disabled={!draft || saving}>{saving ? "Saving…" : "Save translation"}</Button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit space-y-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Content type</Label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={entityType}
              onChange={(e) => pick(e.target.value, "", lang)}>
              {Object.entries(ENTITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Item</Label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={entityId}
              onChange={(e) => pick(entityType, e.target.value, lang)}>
              <option value="">Choose…</option>
              {entities.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Language</Label>
            <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={activeLang}
              onChange={(e) => pick(entityType, entityId, e.target.value)}>
              {langs.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.code})</option>)}
            </select>
          </div>
          {entityId && activeLang && (
            <p className="text-xs text-muted-foreground">
              {fields.filter((f) => (current[f.key] ?? "").trim()).length} of {fields.length} fields translated
            </p>
          )}
        </Card>
        <Card className="space-y-4 p-6">
          {!entityId ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Choose a content type and item to translate.</p>
          ) : (
            fields.map((f) => {
              const base = String(baseEntity?.[f.key] ?? "");
              const val = current[f.key] ?? "";
              return (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}{base ? ` — original: “${base.length > 80 ? base.slice(0, 80) + "…" : base}”` : ""}</Label>
                  {f.multiline ? (
                    <Textarea rows={4} dir="auto" value={val} placeholder={base || f.label}
                      onChange={(e) => setDraft({ ...current, [f.key]: e.target.value })} />
                  ) : (
                    <Input dir="auto" value={val} placeholder={base || f.label}
                      onChange={(e) => setDraft({ ...current, [f.key]: e.target.value })} />
                  )}
                </div>
              );
            })
          )}
        </Card>
      </div>
    </>
  );
}
