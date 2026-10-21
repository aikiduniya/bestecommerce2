import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, productsQuery, pagesQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { buildRobots } from "@/lib/seo-files";

export const Route = createFileRoute("/_authenticated/admin/seo")({ component: SeoAdmin });

type Redirect = { id: string; from_path: string; to_path: string; status_code: number; is_active: boolean };

function SeoAdmin() {
  const qc = useQueryClient();
  const { data: s } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: pages = [] } = useQuery(pagesQuery);
  const { data: redirects = [] } = useQuery({
    queryKey: ["redirects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("redirects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Redirect[];
    },
  });
  const [f, setF] = useState({ robots_txt: "", llms_txt: "", google_site_verification: "", bing_site_verification: "" });
  const [nr, setNr] = useState({ from_path: "", to_path: "", status_code: 301 });
  useEffect(() => {
    if (s) {
      const r = s as unknown as Record<string, string | null>;
      setF({ robots_txt: r.robots_txt ?? "", llms_txt: r.llms_txt ?? "", google_site_verification: r.google_site_verification ?? "", bing_site_verification: r.bing_site_verification ?? "" });
    }
  }, [s]);

  const save = async () => {
    const patch = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || null]));
    const { error } = await supabase.from("store_settings").update(patch as never).eq("id", 1);
    if (error) return toast.error(error.message);
    toast.success("SEO settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const addRedirect = async () => {
    const from = "/" + nr.from_path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (from === "/" || !nr.to_path.trim()) return toast.error("Enter both paths");
    const { error } = await supabase.from("redirects").insert({ from_path: from, to_path: nr.to_path.trim(), status_code: nr.status_code });
    if (error) return toast.error(error.code === "23505" ? "A redirect for that path already exists" : error.message);
    setNr({ from_path: "", to_path: "", status_code: 301 });
    qc.invalidateQueries({ queryKey: ["redirects"] });
  };
  const patchRedirect = async (id: string, p: Partial<Redirect>) => {
    const { error } = p.id === undefined && Object.keys(p).length === 0 ? { error: null } : await supabase.from("redirects").update(p).eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["redirects"] });
  };
  const delRedirect = async (id: string) => {
    const { error } = await supabase.from("redirects").delete().eq("id", id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["redirects"] });
  };

  const audit = useMemo(() => {
    const active = products.filter((p) => p.status === "active");
    const titles = new Map<string, number>();
    for (const p of active) {
      const t = (p.seo_title || p.name).trim().toLowerCase();
      titles.set(t, (titles.get(t) ?? 0) + 1);
    }
    return [
      { label: "Products missing SEO title", items: active.filter((p) => !p.seo_title?.trim()).map((p) => p.name) },
      { label: "Products missing meta description", items: active.filter((p) => !p.seo_description?.trim() && !p.short_description?.trim()).map((p) => p.name) },
      { label: "Products without images", items: active.filter((p) => !p.images?.length).map((p) => p.name) },
      { label: "Duplicate product titles", items: active.filter((p) => (titles.get((p.seo_title || p.name).trim().toLowerCase()) ?? 0) > 1).map((p) => p.name) },
      { label: "Pages missing meta description", items: pages.filter((p) => p.is_published && !p.seo_description?.trim()).map((p) => p.title) },
      { label: "Store missing default meta description", items: s && !s.seo_description?.trim() ? ["Settings → SEO"] : [] },
      { label: "No search engine verification set", items: !f.google_site_verification && !f.bing_site_verification ? ["Add a code below"] : [] },
    ];
  }, [products, pages, s, f.google_site_verification, f.bing_site_verification]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <>
      <PageHeader title="SEO & search" subtitle="Sitemap, robots.txt, llms.txt, redirects and site audit" />
      <Card className="p-6">
        <p className="eyebrow text-muted-foreground">Audit</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {audit.map((a) => (
            <div key={a.label} className="rounded border p-3 text-sm">
              <div className="flex justify-between"><span>{a.label}</span><span className={a.items.length ? "text-destructive" : "text-success"}>{a.items.length ? a.items.length : "OK"}</span></div>
              {a.items.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{a.items.slice(0, 5).join(", ")}{a.items.length > 5 ? "…" : ""}</p>}
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Live files: <a className="text-gold" href="/sitemap.xml" target="_blank" rel="noreferrer">sitemap.xml</a> · <a className="text-gold" href="/robots.txt" target="_blank" rel="noreferrer">robots.txt</a> · <a className="text-gold" href="/llms.txt" target="_blank" rel="noreferrer">llms.txt</a>. The sitemap updates automatically whenever products, pages, posts, categories, brands or collections change. Search engines decide when and whether to index pages.
        </p>
      </Card>

      <Card className="mt-6 space-y-4 p-6">
        <p className="eyebrow text-muted-foreground">Search engine verification</p>
        <label className="block text-sm">Google Search Console code (content of the google-site-verification tag)
          <Input className="mt-1" value={f.google_site_verification} onChange={(e) => setF({ ...f, google_site_verification: e.target.value })} /></label>
        <label className="block text-sm">Bing Webmaster code (content of the msvalidate.01 tag)
          <Input className="mt-1" value={f.bing_site_verification} onChange={(e) => setF({ ...f, bing_site_verification: e.target.value })} /></label>
        <p className="text-xs text-muted-foreground">After verifying, submit {origin}/sitemap.xml in Search Console.</p>
        <p className="eyebrow pt-2 text-muted-foreground">robots.txt</p>
        <p className="text-xs text-muted-foreground">Leave empty for safe defaults (blocks admin, account, cart, checkout and search pages). The sitemap line is added automatically.</p>
        <Textarea rows={8} className="font-mono text-xs" placeholder={buildRobots(null, origin)} value={f.robots_txt} onChange={(e) => setF({ ...f, robots_txt: e.target.value })} />
        <p className="eyebrow pt-2 text-muted-foreground">llms.txt</p>
        <p className="text-xs text-muted-foreground">Leave empty to generate automatically from your store info, pages, products and blog.</p>
        <Textarea rows={8} className="font-mono text-xs" value={f.llms_txt} onChange={(e) => setF({ ...f, llms_txt: e.target.value })} />
        <Button onClick={save}>Save</Button>
      </Card>

      <Card className="mt-6 p-6">
        <p className="eyebrow text-muted-foreground">Redirects</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="/old-path" value={nr.from_path} onChange={(e) => setNr({ ...nr, from_path: e.target.value })} />
          <Input className="max-w-xs" placeholder="/new-path or https://…" value={nr.to_path} onChange={(e) => setNr({ ...nr, to_path: e.target.value })} />
          <select className="rounded border bg-background px-2 text-sm" value={nr.status_code} onChange={(e) => setNr({ ...nr, status_code: Number(e.target.value) })}>
            <option value={301}>301 permanent</option><option value={302}>302 temporary</option>
          </select>
          <Button onClick={addRedirect}>Add redirect</Button>
        </div>
        <div className="mt-4 divide-y text-sm">
          {redirects.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2">
              <span className="truncate">{r.from_path} → {r.to_path} <span className="text-muted-foreground">({r.status_code})</span></span>
              <span className="flex items-center gap-3">
                <Switch checked={r.is_active} onCheckedChange={(v) => patchRedirect(r.id, { is_active: v })} />
                <Button size="icon" variant="ghost" aria-label="Delete redirect" onClick={() => delRedirect(r.id)}><Trash2 className="size-4" /></Button>
              </span>
            </div>
          ))}
          {redirects.length === 0 && <p className="py-4 text-muted-foreground">No redirects yet. Redirects apply only to paths that don't exist.</p>}
        </div>
      </Card>
    </>
  );
}
