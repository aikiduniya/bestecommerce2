import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Settings } from "@/lib/store";
import { extraCurrencies, type DisplayCurrency } from "@/lib/currency";
import { LANG_CATALOG, UI_STRINGS, extraLanguages, type StoreLanguage, type Translations } from "@/lib/i18n";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { THEME_PRESETS, BUTTON_RADIUS } from "@/lib/theme";
import { zonesQuery, taxRatesQuery, type TaxRate } from "@/lib/store";

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
  const [transLang, setTransLang] = useState<string>("");
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: taxRates = [] } = useQuery(taxRatesQuery);
  const [rateDraft, setRateDraft] = useState<{ name: string; country: string; rate: string; applies_to_shipping: boolean; priority: string }>({ name: "", country: "*", rate: "", applies_to_shipping: false, priority: "0" });
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const currencyList: DisplayCurrency[] = Array.isArray(s.currencies) ? (s.currencies as DisplayCurrency[]) : [];
  const updateCurrency = (i: number, c: DisplayCurrency | null) => {
    const raw = currencyList.slice();
    if (i === -1 && c) raw.push(c);
    else if (c) raw[i] = c;
    else raw.splice(i, 1);
    set("currencies", raw as never);
  };

  // Languages: enabled list + per-language UI text translations.
  const langList: StoreLanguage[] = Array.isArray(s.languages) ? (s.languages as StoreLanguage[]) : [];
  const translations: Translations = (s.translations && typeof s.translations === "object" ? s.translations : {}) as Translations;
  const updateLang = (i: number, l: StoreLanguage | null) => {
    const raw = langList.slice();
    if (i === -1 && l) raw.push(l);
    else if (l) raw[i] = l;
    else raw.splice(i, 1);
    set("languages", raw as never);
  };
  const setTranslation = (lang: string, key: string, value: string) => {
    const table: Record<string, string> = { ...(translations[lang] ?? {}) };
    if (value.trim()) table[key] = value;
    else delete table[key];
    set("translations", { ...translations, [lang]: table } as never);
  };

  async function addRate() {
    const rate = Number(rateDraft.rate);
    if (!rateDraft.name.trim() || !(rate > 0) || rate > 100) { toast.error("Enter a name and a rate between 0 and 100"); return; }
    const country = rateDraft.country.trim().toUpperCase() || "*";
    if (country !== "*" && !/^[A-Z]{2}$/.test(country)) { toast.error("Country must be a 2-letter code or * for all"); return; }
    const { error } = await supabase.from("tax_rates").insert({ name: rateDraft.name.trim(), country, rate, applies_to_shipping: rateDraft.applies_to_shipping, priority: Number(rateDraft.priority || 0) });
    if (error) { toast.error(error.message); return; }
    setRateDraft({ name: "", country: "*", rate: "", applies_to_shipping: false, priority: "0" });
    qc.invalidateQueries({ queryKey: ["tax_rates"] });
    toast.success("Tax rate added");
  }
  async function toggleRate(r: TaxRate) {
    const { error } = await supabase.from("tax_rates").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tax_rates"] });
  }
  async function removeRate(r: TaxRate) {
    const { error } = await supabase.from("tax_rates").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["tax_rates"] });
    toast.success("Tax rate removed");
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    const { id: _id, updated_at: _u, ...rest } = s;
    if (rest.currency && !/^[A-Z]{3}$/.test(rest.currency.toUpperCase())) { setSaving(false); toast.error("Currency must be a 3-letter code like USD"); return; }
    rest.currency = rest.currency.toUpperCase();
    const curList = extraCurrencies(rest.currencies);
    const rawList = Array.isArray(rest.currencies) ? rest.currencies : [];
    if (rawList.length !== curList.length) { setSaving(false); toast.error("Each currency needs a 3-letter code and a rate above 0"); return; }
    if (new Set(curList.map((c) => c.code)).size !== curList.length) { setSaving(false); toast.error("Duplicate currency codes"); return; }
    if (curList.some((c) => c.code === rest.currency)) { setSaving(false); toast.error("The store currency cannot also be an extra currency"); return; }
    rest.currencies = curList;
    const langList = extraLanguages(rest.languages);
    const rawLangs = Array.isArray(rest.languages) ? rest.languages : [];
    if (rawLangs.length !== langList.length) { setSaving(false); toast.error("Each language must be picked from the list"); return; }
    if (new Set(langList.map((l) => l.code)).size !== langList.length) { setSaving(false); toast.error("Duplicate languages"); return; }
    rest.languages = langList;
    if (rest.cod_min_order !== null && rest.cod_max_order !== null && Number(rest.cod_min_order) > Number(rest.cod_max_order)) { setSaving(false); toast.error("COD minimum cannot be above the maximum"); return; }
    for (const [k, re, label] of [["ga4_id", /^G-[A-Z0-9]{4,20}$/i, "GA4 ID should look like G-XXXXXXX"], ["gtm_id", /^GTM-[A-Z0-9]{4,12}$/i, "GTM ID should look like GTM-XXXXXX"], ["meta_pixel_id", /^\d{6,20}$/, "Meta Pixel ID should be numbers only"]] as const) {
      const v = String(rest[k] ?? "").trim();
      if (v && !re.test(v)) { setSaving(false); toast.error(label); return; }
      rest[k] = v || null;
    }
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

  const pick = (k: string, label: string, opts: [string, string][]) => (
    <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>
      <select aria-label={label} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={String((s as Record<string, unknown>)[k] ?? opts[0]?.[0] ?? "")} onChange={(e) => setS({ ...s, [k]: /^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value } as never)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select></div>
  );
  const pageSeo = (s.page_seo && typeof s.page_seo === "object" ? s.page_seo : {}) as Record<string, { title?: string; keywords?: string; description?: string; og_image?: string; noindex?: boolean }>;
  const setPageSeo = (page: string, k: string, v: string | boolean) => setS({ ...s, page_seo: { ...pageSeo, [page]: { ...(pageSeo[page] ?? {}), [k]: v } } } as never);

  return (
    <>
      <PageHeader title="Store Settings" subtitle={isAdmin ? "Everything here updates your live store." : "Only the Super Admin can save changes."}>
        <Button variant="gold" onClick={save} disabled={saving || !isAdmin}>{saving ? "Saving…" : "Save changes"}</Button>
      </PageHeader>
      <Tabs defaultValue="brand">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="brand">Branding</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="home">Homepage</TabsTrigger>
          <TabsTrigger value="store">Store</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="marketing">Marketing & tracking</TabsTrigger>
          <TabsTrigger value="languages">Languages</TabsTrigger>
        </TabsList>
        <TabsContent value="brand">
          <Card className="mb-6 p-6">
            <p className="text-sm font-medium">Theme presets</p>
            <p className="text-xs text-muted-foreground">Switch the whole look in one click. Only colors, fonts and styles change — products, pages and content stay as they are. Press Save to publish.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {THEME_PRESETS.map((t) => {
                const active = (s as { theme_preset?: string }).theme_preset === t.id;
                return (
                  <button type="button" key={t.id} onClick={() => { const { id, name: _n, description: _d, ...look } = t; setS({ ...s, ...look, theme_preset: id } as never); }}
                    className={`rounded border p-3 text-left transition-colors ${active ? "border-gold ring-1 ring-gold" : "hover:border-gold"}`}>
                    <div className="flex gap-1">{[t.primary_color, t.accent_color, t.background_color, t.surface_color].map((c) => <span key={c} className="size-6 rounded-full border" style={{ background: c }} />)}</div>
                    <p className="mt-2 text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </button>
                );
              })}
            </div>
            <ThemePreview s={s as never} />
          </Card>
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Background color</Label>
              <Input type="color" value={(s as { background_color?: string | null }).background_color ?? "#fbf9f4"} onChange={(e) => setS({ ...s, background_color: e.target.value } as never)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Card / surface color</Label>
              <Input type="color" value={(s as { surface_color?: string | null }).surface_color ?? "#ffffff"} onChange={(e) => setS({ ...s, surface_color: e.target.value } as never)} />
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Button style</Label>
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={(s as { button_style?: string }).button_style ?? "square"} onChange={(e) => setS({ ...s, button_style: e.target.value } as never)}>
                <option value="square">Square</option><option value="rounded">Rounded</option><option value="pill">Pill</option></select></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Product card style</Label>
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={(s as { card_style?: string }).card_style ?? "minimal"} onChange={(e) => setS({ ...s, card_style: e.target.value } as never)}>
                <option value="minimal">Minimal</option><option value="framed">Gold frame</option><option value="elevated">Elevated shadow</option></select></div>
          </Card>
        </TabsContent>
        <TabsContent value="layout">
          <Card className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">Header & navigation</p>
            {pick("header_style", "Header layout", [["classic", "Classic — logo left, menu centre"], ["centered", "Centred — logo on top, menu below"], ["minimal", "Minimal — compact, menu left"]])}
            {pick("header_tone", "Header colour", [["light", "Light"], ["dark", "Dark (brand colour)"]])}
            {pick("nav_style", "Menu text style", [["plain", "Plain"], ["uppercase", "Uppercase, spaced"], ["underline", "Gold underline on hover"]])}
            {toggle("header_sticky" as never, "Sticky header", "Header stays visible while scrolling")}
            {pick("announcement_style", "Announcement bar", [["solid", "Solid brand colour"], ["gold", "Gold"], ["outline", "Light with gold line"]])}
            <p className="mt-2 text-sm font-medium sm:col-span-2 lg:col-span-3">Banners & page layout</p>
            {pick("hero_height", "Banner height", [["compact", "Compact"], ["medium", "Medium"], ["tall", "Tall"], ["full", "Full screen"]])}
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Banner photo strength ({s.hero_overlay}%)</Label>
              <input aria-label="Banner photo strength" type="range" min={0} max={90} step={5} value={s.hero_overlay} onChange={(e) => setS({ ...s, hero_overlay: Number(e.target.value) })} className="w-full accent-[var(--gold)]" /></div>
            {pick("container_width", "Page width", [["narrow", "Narrow"], ["standard", "Standard"], ["wide", "Wide"], ["full", "Full width"]])}
            {pick("section_spacing", "Space between sections", [["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]])}
            {pick("product_grid_cols", "Products per row (shop, desktop)", [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]])}
            <p className="mt-2 text-sm font-medium sm:col-span-2 lg:col-span-3">Footer</p>
            {pick("footer_style", "Footer layout", [["columns", "Columns (light)"], ["dark", "Columns (dark)"], ["minimal", "Single line"]])}
            <div className="sm:col-span-2">{text("footer_text" as never, "Copyright line (leave empty for © year + store name)")}</div>
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">Colours, fonts, buttons and product cards are on the Branding tab. Menu links are edited in Navigation, homepage sections in the Homepage builder.</p>
          </Card>
        </TabsContent>
        <TabsContent value="home">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {text("hero_eyebrow", "Hero small label")}
            {text("hero_cta", "Hero button text")}
            {text("hero_image_alt" as never, "Hero image alt text (describes the photo for search engines)")}
            <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Hero background image (headline uses the tagline)</Label><ImagePicker multiple={false} value={s.hero_image_url ? [s.hero_image_url] : []} onChange={(v) => set("hero_image_url", v[0] ?? null)} /></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Featured products and homepage collections are controlled from Products (★ Featured) and Collections (Homepage switch).</p>
          </Card>
        </TabsContent>
        <TabsContent value="store">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {text("support_email", "Support email", "email")}
            {text("support_phone", "Support phone")}
            {text("currency", "Store currency code (e.g. USD, EUR, PKR) — orders are charged in this currency")}
            {text("announcement", "Announcement bar text")}
            {toggle("announcement_enabled", "Show announcement bar", "Displayed at the top of every page")}
            {toggle("maintenance_mode", "Maintenance mode", "Hides the storefront from visitors")}
            {toggle("cookie_consent_enabled", "Cookie consent banner", "Asks visitors to accept or decline cookies")}
            {text("cookie_consent_text", "Cookie consent text")}
            <div className="space-y-2 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Extra display currencies (visitors can switch; rates are per 1 {s.currency || "USD"})</Label>
              {currencyList.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="w-24 uppercase" maxLength={3} placeholder="PKR" value={c.code}
                    onChange={(e) => updateCurrency(i, { ...c, code: e.target.value.toUpperCase() })} />
                  <Input type="number" min="0" step="0.0001" placeholder="Rate" value={c.rate || ""}
                    onChange={(e) => updateCurrency(i, { ...c, rate: Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground">1 {s.currency || "USD"} = {c.rate || "?"} {c.code}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => updateCurrency(i, null)}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => updateCurrency(-1, { code: "", rate: 0 } as DisplayCurrency)}>Add currency</Button>
              <p className="text-xs text-muted-foreground">Display only — checkout and orders always use the store currency. Update rates yourself; they do not refresh automatically.</p>
            </div>
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
              <span><span className="block text-sm font-medium">Card payments (Stripe)</span><span className="text-xs text-muted-foreground">Pending — card payments stay off until the owner sets up Stripe.</span></span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">Pending</span>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="taxes">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {toggle("tax_enabled", "Charge tax", "Tax is calculated on the server when an order is placed")}
            {toggle("tax_inclusive", "Prices include tax", "When on, tax is already inside your prices; when off, it is added at checkout")}
            {text("tax_label", "Tax label shown to customers (e.g. Tax, VAT, GST)")}
          </Card>
          <Card className="mt-4 space-y-4 p-6">
            <h3 className="font-display text-xl">Tax rates</h3>
            <p className="text-xs text-muted-foreground">The most specific matching rate applies: an exact country match beats a * (all countries) rate; higher priority wins ties.</p>
            {taxRates.length === 0 && <p className="text-sm text-muted-foreground">No tax rates yet.</p>}
            {taxRates.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded border p-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{r.country === "*" ? "All countries" : r.country} · {Number(r.rate)}%{r.applies_to_shipping ? " · also on shipping" : ""} · priority {r.priority}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{r.is_active ? "Active" : "Off"}</span>
                <span className="ml-auto flex gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={!isAdmin} onClick={() => toggleRate(r)}>{r.is_active ? "Disable" : "Enable"}</Button>
                  <Button type="button" variant="ghost" size="sm" disabled={!isAdmin} onClick={() => removeRate(r)}>Delete</Button>
                </span>
              </div>
            ))}
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-5">
              <Input placeholder="Name (e.g. VAT)" value={rateDraft.name} onChange={(e) => setRateDraft({ ...rateDraft, name: e.target.value })} />
              <Input placeholder="Country (US or *)" value={rateDraft.country} onChange={(e) => setRateDraft({ ...rateDraft, country: e.target.value })} />
              <Input type="number" min="0" max="100" step="0.01" placeholder="Rate %" value={rateDraft.rate} onChange={(e) => setRateDraft({ ...rateDraft, rate: e.target.value })} />
              <Input type="number" placeholder="Priority" value={rateDraft.priority} onChange={(e) => setRateDraft({ ...rateDraft, priority: e.target.value })} />
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={rateDraft.applies_to_shipping} onChange={(e) => setRateDraft({ ...rateDraft, applies_to_shipping: e.target.checked })} /> Tax shipping too</label>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={!isAdmin} onClick={addRate}>Add tax rate</Button>
          </Card>
        </TabsContent>
        <TabsContent value="seo">
          <Card className="grid gap-4 p-6">
            {text("seo_title", "Homepage SEO title")}
            {text("seo_description", "Homepage SEO description")}
            {text("google_site_verification", "Google Search Console verification code")}
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Default social share image</Label><ImagePicker multiple={false} value={s.og_image_url ? [s.og_image_url] : []} onChange={(v) => set("og_image_url", v[0] ?? null)} /></div>
            <p className="text-xs text-muted-foreground">Product, page and blog SEO titles/descriptions are edited on each item. A sitemap is published at /sitemap.xml and the Google product feed at /api/public/merchant-feed.</p>
          </Card>
          <Card className="mt-6 grid gap-4 p-6">
            <p className="text-sm font-medium">Other public pages</p>
            <p className="text-xs text-muted-foreground">Categories, brands and collections have their own SEO button on their admin pages.</p>
            {([["shop", "Shop (all products)"], ["blog", "Journal / blog list"]] as const).map(([key, label]) => (
              <div key={key} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
                <p className="eyebrow text-gold sm:col-span-2">{label}</p>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">SEO title</Label><Input aria-label={`${key} SEO title`} value={String(pageSeo[key]?.title ?? "")} onChange={(e) => setPageSeo(key, "title", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Keywords</Label><Input aria-label={`${key} keywords`} value={String(pageSeo[key]?.keywords ?? "")} onChange={(e) => setPageSeo(key, "keywords", e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Meta description</Label><Input aria-label={`${key} description`} value={String(pageSeo[key]?.description ?? "")} onChange={(e) => setPageSeo(key, "description", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Sharing image (https link)</Label><Input aria-label={`${key} sharing image`} value={String(pageSeo[key]?.og_image ?? "")} onChange={(e) => setPageSeo(key, "og_image", e.target.value)} /></div>
                <label className="flex items-center gap-2 self-end text-sm"><Switch checked={!!pageSeo[key]?.noindex} onCheckedChange={(v) => setPageSeo(key, "noindex", v)} /> Hide from search engines</label>
              </div>
            ))}
          </Card>
        </TabsContent>
        <TabsContent value="marketing">
          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            {text("ga4_id", "Google Analytics 4 measurement ID (G-XXXXXXX)")}
            {text("gtm_id", "Google Tag Manager container ID (GTM-XXXXXX)")}
            {text("meta_pixel_id", "Meta Pixel ID (numbers only)")}
            {text("merchant_center_id", "Google Merchant Center ID")}
            {toggle("reviews_enabled", "Customer reviews", "Let signed-in customers write product reviews")}
            {toggle("reviews_require_approval", "Approve reviews before publishing", "New reviews wait in Reviews & Q&A")}
            <p className="text-xs text-muted-foreground sm:col-span-2">Tracking codes load only on the storefront (never in admin). Leave a field empty to turn that service off.</p>
          </Card>
        </TabsContent>
        <TabsContent value="languages">
          <Card className="grid gap-6 p-6">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Storefront languages (English is always the default; visitors switch in the header)</Label>
              {langList.map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={l.code}
                    onChange={(e) => { const meta = LANG_CATALOG[e.target.value] ?? { label: e.target.value, dir: "ltr" as const }; updateLang(i, { code: e.target.value, label: meta.label, dir: meta.dir }); }}>
                    {Object.entries(LANG_CATALOG).map(([code, meta]) => <option key={code} value={code}>{meta.label} ({code})</option>)}
                  </select>
                  <Input className="w-40" placeholder="Label shown to visitors" value={l.label}
                    onChange={(e) => updateLang(i, { ...l, label: e.target.value })} />
                  <span className="text-xs text-muted-foreground">{l.dir === "rtl" ? "Right-to-left layout" : "Left-to-right layout"}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => updateLang(i, null)}>Remove</Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => {
                  const unused = Object.keys(LANG_CATALOG).find((c) => !langList.some((l) => l.code === c));
                  const meta = unused ? LANG_CATALOG[unused] : undefined;
                  if (!unused || !meta) { toast.error("All available languages are already added"); return; }
                  updateLang(-1, { code: unused, label: meta.label, dir: meta.dir });
                }}>Add language</Button>
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Translate storefront text</Label>
              {langList.length === 0 ? (
                <p className="text-xs text-muted-foreground">Add a language above to translate the storefront text (menu, cart, checkout labels…). Anything left blank shows the English text.</p>
              ) : (
                <>
                  <select className="h-9 rounded-md border bg-background px-3 text-sm" value={transLang || langList[0]?.code || ""} onChange={(e) => setTransLang(e.target.value)}>
                    {langList.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.code})</option>)}
                  </select>
                  {(() => {
                    const code = transLang || langList[0]?.code || "";
                    if (!code) return null;
                    const table = translations[code] ?? {};
                    const done = Object.keys(UI_STRINGS).filter((k) => table[k]?.trim()).length;
                    return (
                      <>
                        <p className="text-xs text-muted-foreground">{done} of {Object.keys(UI_STRINGS).length} texts translated — blank fields use the English text shown.</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {Object.entries(UI_STRINGS).map(([key, en]) => (
                            <div key={key} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{en}</Label>
                              <Input dir={LANG_CATALOG[code]?.dir ?? "ltr"} value={table[key] ?? ""} placeholder={en}
                                onChange={(e) => setTranslation(code, key, e.target.value)} />
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ThemePreview({ s }: { s: { primary_color: string | null; accent_color: string | null; background_color?: string | null; surface_color?: string | null; font_display: string; font_body: string; button_style?: string; card_style?: string; store_name: string } }) {
  const bg = s.background_color ?? "#fbf9f4", fg = s.primary_color ?? "#1c1917", gold = s.accent_color ?? "#b08d57", card = s.surface_color ?? "#ffffff";
  const r = BUTTON_RADIUS[s.button_style ?? "square"];
  const cardCss = s.card_style === "framed" ? { outline: `1px solid ${gold}` } : s.card_style === "elevated" ? { boxShadow: "0 20px 40px -20px rgba(0,0,0,.35)" } : {};
  return (
    <div className="mt-5 overflow-hidden rounded border" aria-label="Live theme preview">
      <p className="border-b bg-muted px-3 py-1.5 text-xs text-muted-foreground">Live preview</p>
      <div style={{ background: bg, color: fg, fontFamily: `"${s.font_body}", sans-serif` }} className="grid gap-6 p-6 sm:grid-cols-[1.4fr_1fr]">
        <div style={{ background: fg, color: bg }} className="self-start rounded p-6">
          <p style={{ color: gold, letterSpacing: ".25em" }} className="text-[10px] font-semibold uppercase">New collection</p>
          <p style={{ fontFamily: `"${s.font_display}", serif` }} className="mt-2 text-3xl leading-tight">{s.store_name}</p>
          <span style={{ background: gold, color: fg, borderRadius: r }} className="mt-4 inline-block px-4 py-2 text-xs font-medium">Shop now</span>
        </div>
        <div>
          <div style={{ background: card, ...cardCss }} className="aspect-[4/5] max-h-56 w-full rounded" />
          <p style={{ fontFamily: `"${s.font_display}", serif` }} className="mt-2 text-lg">Product name</p>
          <p className="text-xs">$1,250.00</p>
        </div>
      </div>
    </div>
  );
}
