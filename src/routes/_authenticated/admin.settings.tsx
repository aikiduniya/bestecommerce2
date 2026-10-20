import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Settings } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { zonesQuery } from "@/lib/store";

const DISPLAY_FONTS = ["Cormorant Garamond", "Playfair Display", "DM Serif Display", "Bodoni Moda", "Fraunces", "Italiana", "Syne", "Space Grotesk"];
const BODY_FONTS = ["Manrope", "DM Sans", "Work Sans", "Figtree", "Karla", "Nunito Sans", "IBM Plex Sans", "Jost"];

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: zones = [] } = useQuery(zonesQuery);
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  async function save() {
    if (!s) return;
    setSaving(true);
    const { id: _id, updated_at: _u, ...rest } = s;
    if (rest.currency && !/^[A-Z]{3}$/.test(rest.currency.toUpperCase())) { setSaving(false); toast.error("Currency must be a 3-letter code like USD"); return; }
    rest.currency = rest.currency.toUpperCase();
    if (rest.cod_min_order !== null && rest.cod_max_order !== null && Number(rest.cod_min_order) > Number(rest.cod_max_order)) { setSaving(false); toast.error("COD minimum cannot be above the maximum"); return; }
    if (Number(rest.cod_fee) < 0) { setSaving(false); toast.error("COD fee cannot be negative"); return; }
    const { error } = await supabase.from("store_settings").update(rest).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["settings"] });
  }

  const text = (k: keyof Settings, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={(s[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );
  const toggle = (k: keyof Settings, label: string, hint: string) => (
    <label className="flex items-center justify-between gap-4 rounded-md border p-4">
      <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
      <Switch checked={!!s[k]} onCheckedChange={(v) => set(k, v as never)} />
    </label>
  );

  return (
    <>
      <PageHeader title="Store Settings" subtitle={isAdmin ? "Everything here updates your live store." : "Only the Super Admin can save changes."}>
        <Button variant="gold" onClick={save} disabled={saving || !isAdmin}>{saving ? "Saving…" : "Save changes"}</Button>
      </PageHeader>
      <Tabs defaultValue="brand">
        <TabsList>
          <TabsTrigger value="brand">Branding</TabsTrigger>
          <TabsTrigger value="home">Homepage</TabsTrigger>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>
        <TabsContent value="brand">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {text("store_name", "Store name")}
            {text("tagline", "Tagline")}
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Logo (replaces the store name in the header)</Label><ImagePicker multiple={false} value={s.logo_url ? [s.logo_url] : []} onChange={(v) => set("logo_url", v[0] ?? null)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Favicon</Label><ImagePicker multiple={false} value={s.favicon_url ? [s.favicon_url] : []} onChange={(v) => set("favicon_url", v[0] ?? null)} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Heading font</Label>
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={s.font_display} onChange={(e) => set("font_display", e.target.value)}>{DISPLAY_FONTS.map((f) => <option key={f}>{f}</option>)}</select></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Body font</Label>
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={s.font_body} onChange={(e) => set("font_body", e.target.value)}>{BODY_FONTS.map((f) => <option key={f}>{f}</option>)}</select></div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Primary color</Label>
              <Input type="color" value={s.primary_color ?? "#1c1917"} onChange={(e) => set("primary_color", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Accent color</Label>
              <Input type="color" value={s.accent_color ?? "#b08d57"} onChange={(e) => set("accent_color", e.target.value)} />
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="home">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {text("hero_eyebrow", "Hero small label")}
            {text("hero_cta", "Hero button text")}
            <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Hero background image (headline uses the tagline)</Label><ImagePicker multiple={false} value={s.hero_image_url ? [s.hero_image_url] : []} onChange={(v) => set("hero_image_url", v[0] ?? null)} /></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Featured products and homepage collections are controlled from Products (★ Featured) and Collections (Homepage switch).</p>
          </Card>
        </TabsContent>
        <TabsContent value="store">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {text("support_email", "Support email", "email")}
            {text("support_phone", "Support phone")}
            {text("currency", "Currency code (e.g. USD, EUR, PKR)")}
            {text("announcement", "Announcement bar text")}
            {toggle("announcement_enabled", "Show announcement bar", "Displayed at the top of every page")}
            {toggle("maintenance_mode", "Maintenance mode", "Hides the storefront from visitors")}
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {toggle("cod_enabled", "Cash on Delivery", "Customers pay when the order arrives")}
            {toggle("cod_requires_confirmation", "Confirm COD orders manually", "New COD orders wait for your confirmation before shipping")}
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">COD allowed countries (codes, comma separated — empty = all)</Label>
              <Input value={s.cod_countries.join(", ")} onChange={(e) => set("cod_countries", e.target.value.split(",").map((x) => x.trim().toUpperCase()).filter(Boolean))} placeholder="US, CA" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">COD handling fee</Label>
              <Input type="number" min="0" step="0.01" value={s.cod_fee ?? 0} onChange={(e) => set("cod_fee", Number(e.target.value || 0))} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">COD minimum order (empty = none)</Label>
              <Input type="number" min="0" step="0.01" value={s.cod_min_order ?? ""} onChange={(e) => set("cod_min_order", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">COD maximum order (empty = none)</Label>
              <Input type="number" min="0" step="0.01" value={s.cod_max_order ?? ""} onChange={(e) => set("cod_max_order", e.target.value === "" ? null : Number(e.target.value))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label className="text-xs text-muted-foreground">Shipping methods that do NOT allow COD</Label>
              <div className="flex flex-wrap gap-2">{zones.map((z) => {
                const on = s.cod_excluded_zones.includes(z.id);
                return <button type="button" key={z.id} onClick={() => set("cod_excluded_zones", on ? s.cod_excluded_zones.filter((x) => x !== z.id) : [...s.cod_excluded_zones, z.id])}
                  className={`rounded-full border px-3 py-1 text-xs ${on ? "border-destructive bg-destructive/10 text-destructive" : ""}`}>{z.name}{on ? " · no COD" : ""}</button>;
              })}</div>
              <p className="text-xs text-muted-foreground">Individual products can be excluded from COD in the product editor (Pricing & stock).</p></div>
            <div className="flex items-center justify-between gap-4 rounded-md border border-dashed p-4 opacity-70">
              <span><span className="block text-sm font-medium">Card payments (Stripe)</span><span className="text-xs text-muted-foreground">Not connected — cards can't be taken yet. This will be set up in the next phase.</span></span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">Not connected</span>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="seo">
          <Card className="grid gap-4 p-6">
            {text("seo_title", "Homepage SEO title")}
            {text("seo_description", "Homepage SEO description")}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
