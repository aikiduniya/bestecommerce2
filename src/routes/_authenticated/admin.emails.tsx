import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_LABELS, SAMPLE_VARS, emailLogsQuery, emailSettingsQuery, emailTemplatesQuery, notificationRulesQuery,
  renderTemplate, type EmailSettings, type EmailTemplate,
} from "@/lib/email";
import { retryEmail } from "@/lib/email.functions";
import { PageHeader } from "@/components/admin/PageHeader";
import { ImagePicker } from "@/components/admin/ImagePicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  component: EmailsPage,
});

function EmailsPage() {
  const { isAdmin } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery(emailTemplatesQuery);
  const { data: settings } = useQuery(emailSettingsQuery);
  const { data: rules = [] } = useQuery(notificationRulesQuery);
  const { data: logs = [] } = useQuery(emailLogsQuery);

  const [sel, setSel] = useState<string>("");
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [es, setEs] = useState<EmailSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState<number | null>(null);

  useEffect(() => { if (settings) setEs(settings); }, [settings]);
  const tpl = templates.find((t) => t.key === sel) ?? templates[0];
  const editing = draft ?? tpl ?? null;

  async function saveTemplate() {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase.from("email_templates")
      .update({ name: draft.name, subject: draft.subject, body: draft.body, is_enabled: draft.is_enabled })
      .eq("id", draft.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Template saved");
    setDraft(null);
    qc.invalidateQueries({ queryKey: ["email_templates"] });
  }

  async function saveSettings() {
    if (!es) return;
    if (es.delivery_enabled && es.provider === "none") { toast.error("Choose a provider before enabling delivery"); return; }
    if (es.delivery_enabled && !es.sender_email.includes("@")) { toast.error("A valid sender email is required before enabling delivery"); return; }
    setSaving(true);
    const { id: _id, updated_at: _u, ...rest } = es;
    const { error } = await supabase.from("email_settings").update(rest).eq("id", 1);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email settings saved");
    qc.invalidateQueries({ queryKey: ["email_settings"] });
  }

  async function updateRule(id: string, patch: { is_enabled?: boolean; template_key?: string | null }) {
    const { error } = await supabase.from("notification_rules").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["notification_rules"] });
  }

  async function retry(logId: number) {
    setRetrying(logId);
    try {
      const r = await retryEmail({ data: { logId } });
      toast.success(`Retry result: ${r.status}`);
      qc.invalidateQueries({ queryKey: ["email_logs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    }
    setRetrying(null);
  }

  const providerCfg = (es?.provider_config ?? {}) as Record<string, string>;
  const setCfg = (k: string, v: string) => es && setEs({ ...es, provider_config: { ...providerCfg, [k]: v } });

  return (
    <>
      <PageHeader title="Emails & notifications" subtitle="Templates, sender settings, notification rules and delivery logs.">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${es?.delivery_enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
          {es?.delivery_enabled ? "Delivery ON" : "Delivery disabled — emails are logged, not sent"}
        </span>
      </PageHeader>
      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="rules">Notification rules</TabsTrigger>
          <TabsTrigger value="settings">Sender & provider</TabsTrigger>
          <TabsTrigger value="logs">Delivery log</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <Card className="h-fit divide-y p-0">
              {templates.map((t) => (
                <button key={t.key} onClick={() => { setSel(t.key); setDraft(null); }}
                  className={`block w-full px-4 py-3 text-left text-sm hover:bg-secondary ${editing?.key === t.key ? "bg-secondary font-medium" : ""}`}>
                  {t.name}
                  {!t.is_enabled && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">off</span>}
                </button>
              ))}
            </Card>
            {editing && (
              <Card className="space-y-4 p-6">
                <div className="flex items-center justify-between gap-4">
                  <Input className="max-w-xs font-medium" value={editing.name} disabled={!isAdmin}
                    onChange={(e) => setDraft({ ...editing, name: e.target.value })} />
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={editing.is_enabled} disabled={!isAdmin}
                      onCheckedChange={(v) => setDraft({ ...editing, is_enabled: v })} />
                    Enabled
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Subject line</Label>
                  <Input value={editing.subject} disabled={!isAdmin}
                    onChange={(e) => setDraft({ ...editing, subject: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email body — use {"{{placeholders}}"} like {"{{customer_name}}"}, {"{{order_number}}"}, {"{{order_total}}"}, {"{{store_name}}"}</Label>
                  <Textarea rows={12} className="font-mono text-xs" value={editing.body} disabled={!isAdmin}
                    onChange={(e) => setDraft({ ...editing, body: e.target.value })} />
                </div>
                <div className="rounded-md border bg-secondary/40 p-4">
                  <p className="eyebrow mb-2 text-muted-foreground">Preview (sample data)</p>
                  <p className="text-sm font-medium">Subject: {renderTemplate(editing.subject, SAMPLE_VARS)}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{renderTemplate(editing.body, SAMPLE_VARS)}</pre>
                </div>
                {isAdmin && <Button variant="gold" onClick={saveTemplate} disabled={!draft || saving}>{saving ? "Saving…" : "Save template"}</Button>}
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rules">
          <Card className="divide-y p-0">
            {rules.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-56">
                  <p className="text-sm font-medium">{EVENT_LABELS[r.event] ?? r.event}</p>
                  <p className="text-xs text-muted-foreground">Recipient: {r.recipient}</p>
                </div>
                <select className="h-9 rounded-md border bg-background px-3 text-sm" value={r.template_key ?? ""} disabled={!isAdmin}
                  onChange={(e) => updateRule(r.id, { template_key: e.target.value || null })}>
                  <option value="">No template</option>
                  {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                </select>
                <label className="ml-auto flex items-center gap-2 text-sm">
                  <Switch checked={r.is_enabled} disabled={!isAdmin} onCheckedChange={(v) => updateRule(r.id, { is_enabled: v })} />
                  {r.is_enabled ? "On" : "Off"}
                </label>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          {es && (
            <Card className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Sender name</Label>
                <Input value={es.sender_name} disabled={!isAdmin} onChange={(e) => setEs({ ...es, sender_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Sender email</Label>
                <Input type="email" value={es.sender_email} disabled={!isAdmin} onChange={(e) => setEs({ ...es, sender_email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Reply-to email (optional)</Label>
                <Input type="email" value={es.reply_to ?? ""} disabled={!isAdmin} onChange={(e) => setEs({ ...es, reply_to: e.target.value || null })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Email provider</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={es.provider} disabled={!isAdmin}
                  onChange={(e) => setEs({ ...es, provider: e.target.value })}>
                  <option value="none">None (delivery disabled)</option>
                  <option value="resend">Resend</option>
                  <option value="sendgrid">SendGrid</option>
                  <option value="smtp">SMTP (uses your SMTP profiles)</option>
                </select></div>
              {es.provider !== "none" && es.provider !== "smtp" && (
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Provider API key (stored securely, never shown to customers)</Label>
                  <Input type="password" value={providerCfg["api_key"] ?? ""} disabled={!isAdmin} onChange={(e) => setCfg("api_key", e.target.value)} placeholder="••••••••" /></div>
              )}
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Email logo</Label>
                <ImagePicker multiple={false} value={es.brand_logo_url ? [es.brand_logo_url] : []} onChange={(v) => setEs({ ...es, brand_logo_url: v[0] ?? null })} /></div>
              <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Brand color</Label>
                <Input type="color" value={es.brand_color ?? "#1c1917"} disabled={!isAdmin} onChange={(e) => setEs({ ...es, brand_color: e.target.value })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label className="text-xs text-muted-foreground">Email footer text</Label>
                <Textarea rows={2} value={es.footer_text ?? ""} disabled={!isAdmin} onChange={(e) => setEs({ ...es, footer_text: e.target.value || null })} /></div>
              <label className="flex items-center justify-between gap-4 rounded-md border p-4 sm:col-span-2">
                <span><span className="block text-sm font-medium">Enable live email delivery</span>
                  <span className="text-xs text-muted-foreground">Off: every email is recorded in the delivery log as “queued” and nothing is sent. Turn on only after your provider account is verified.</span></span>
                <Switch checked={es.delivery_enabled} disabled={!isAdmin} onCheckedChange={(v) => setEs({ ...es, delivery_enabled: v })} />
              </label>
              {isAdmin && <Button variant="gold" className="w-fit" onClick={saveSettings} disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card className="divide-y p-0">
            {logs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No emails logged yet. Emails appear here as orders and events happen.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  l.status === "sent" ? "bg-success/15 text-success"
                  : l.status === "failed" ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"}`}>
                  {l.status === "queued_disabled" ? "queued (delivery off)" : l.status}
                </span>
                <div className="min-w-56">
                  <p className="font-medium">{l.subject}</p>
                  <p className="text-xs text-muted-foreground">to {l.recipient_email} · {l.event ?? l.template_key} · {new Date(l.created_at).toLocaleString()} · {l.attempts} attempt{l.attempts === 1 ? "" : "s"}</p>
                  {l.error && <p className="text-xs text-destructive">{l.error}</p>}
                </div>
                {isAdmin && l.status !== "sent" && (
                  <Button variant="outline" size="sm" className="ml-auto" disabled={retrying === l.id} onClick={() => retry(l.id)}>
                    {retrying === l.id ? "Retrying…" : "Retry"}
                  </Button>
                )}
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
