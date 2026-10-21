import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, Send, ServerCog, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveSmtpProfile, smtpPasswordStatus, testSmtpProfile } from "@/lib/smtp.functions";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/smtp")({ component: SmtpPage });

const LABELS: Record<string, { title: string; hint: string }> = {
  general: { title: "General website emails", hint: "Welcome, account and other store messages" },
  contact: { title: "Contact form inquiries", hint: "New-inquiry alerts and your replies to customers" },
  orders: { title: "Order confirmations", hint: "Order placed, shipped, cancelled and COD messages" },
  security: { title: "Admin 2FA & security", hint: "Password resets and security notices" },
};

type Profile = { purpose: string; host: string | null; port: number; encryption: string; username: string | null; sender_name: string | null; sender_email: string | null; is_enabled: boolean; last_test_at: string | null; last_test_ok: boolean | null; last_test_error: string | null };

function SmtpPage() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({
    queryKey: ["smtp_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("smtp_profiles").select("purpose, host, port, encryption, username, sender_name, sender_email, is_enabled, last_test_at, last_test_ok, last_test_error");
      if (error) throw error;
      return (data as Profile[]).sort((a, b) => Object.keys(LABELS).indexOf(a.purpose) - Object.keys(LABELS).indexOf(b.purpose));
    },
  });
  const { data: pw = {} } = useQuery({ queryKey: ["smtp_pw"], queryFn: () => smtpPasswordStatus() });
  const { data: rules = [] } = useQuery({
    queryKey: ["notification_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_rules").select("id, event, smtp_profile").order("event");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["smtp_profiles"] }); void qc.invalidateQueries({ queryKey: ["smtp_pw"] }); };

  return (
    <>
      <PageHeader title="Email Settings · SMTP" subtitle="One SMTP account per email type. Passwords are encrypted and never shown again. Nothing is sent until a profile passes a test and email delivery is switched on in Emails." />
      <div className="grid gap-6 xl:grid-cols-2">
        {profiles.map((p) => <ProfileCard key={p.purpose} p={p} hasPassword={!!pw[p.purpose]} onSaved={refresh} />)}
      </div>
      <Card className="mt-6 p-6">
        <p className="text-sm font-medium">Which SMTP profile each notification uses</p>
        <div className="mt-4 divide-y">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="font-mono text-xs">{r.event}</span>
              <select aria-label={`Profile for ${r.event}`} className="h-9 rounded-md border bg-background px-3 text-sm" value={r.smtp_profile}
                onChange={async (e) => {
                  const { error } = await supabase.from("notification_rules").update({ smtp_profile: e.target.value }).eq("id", r.id);
                  if (error) toast.error(error.message); else { toast.success("Saved"); void qc.invalidateQueries({ queryKey: ["notification_rules"] }); }
                }}>
                {Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function ProfileCard({ p, hasPassword, onSaved }: { p: Profile; hasPassword: boolean; onSaved: () => void }) {
  const [f, setF] = useState({ host: "", port: 587, encryption: "starttls", username: "", password: "", sender_name: "", sender_email: "", is_enabled: false });
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => {
    setF({ host: p.host ?? "", port: p.port, encryption: p.encryption, username: p.username ?? "", password: "", sender_name: p.sender_name ?? "", sender_email: p.sender_email ?? "", is_enabled: p.is_enabled });
  }, [p]);
  const meta = LABELS[p.purpose] ?? { title: p.purpose, hint: "" };

  async function save(clearPassword = false) {
    setBusy(true);
    try {
      const r = await saveSmtpProfile({ data: { purpose: p.purpose as never, host: f.host, port: Number(f.port), encryption: f.encryption as never, username: f.username, ...(f.password ? { password: f.password } : {}), clearPassword, sender_name: f.sender_name, sender_email: f.sender_email, is_enabled: f.is_enabled } });
      if (!r.ok) toast.error(r.error); else toast.success("SMTP profile saved");
      onSaved();
    } catch (e) { toast.error((e as Error).message.replace(/^\[.*?\]\s*/, "")); }
    setBusy(false);
  }
  async function test() {
    if (!testTo) { toast.error("Enter an address to send the test to"); return; }
    setTesting(true);
    try {
      const r = await testSmtpProfile({ data: { purpose: p.purpose as never, to: testTo } });
      if (r.ok) toast.success("Test email sent"); else toast.error(r.error ?? "Test failed");
      onSaved();
    } catch (e) { toast.error((e as Error).message); }
    setTesting(false);
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: k === "port" ? Number(e.target.value) : e.target.value });

  return (
    <Card className="space-y-4 p-6" data-profile={p.purpose}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3"><ServerCog className="mt-1 size-5 text-gold" /><div><p className="font-medium">{meta.title}</p><p className="text-xs text-muted-foreground">{meta.hint}</p></div></div>
        <label className="flex items-center gap-2 text-xs">Enabled <Switch aria-label={`Enable ${p.purpose}`} checked={f.is_enabled} onCheckedChange={(v) => setF({ ...f, is_enabled: v })} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">SMTP host</Label><Input aria-label={`${p.purpose} host`} placeholder="smtp.example.com" value={f.host} onChange={set("host")} /></div>
        <div className="space-y-1"><Label className="text-xs">Port</Label><Input aria-label={`${p.purpose} port`} type="number" value={f.port} onChange={set("port")} /></div>
        <div className="space-y-1"><Label className="text-xs">Encryption</Label>
          <select aria-label={`${p.purpose} encryption`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={f.encryption} onChange={set("encryption")}><option value="starttls">STARTTLS (587)</option><option value="ssl">SSL/TLS (465)</option><option value="none">None</option></select></div>
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Username</Label><Input aria-label={`${p.purpose} username`} autoComplete="off" value={f.username} onChange={set("username")} /></div>
        <div className="space-y-1 sm:col-span-3"><Label className="flex items-center gap-1 text-xs"><KeyRound className="size-3" /> Password {hasPassword && <span className="text-success">(saved — leave blank to keep)</span>}</Label>
          <Input aria-label={`${p.purpose} password`} type="password" autoComplete="new-password" placeholder={hasPassword ? "••••••••" : ""} value={f.password} onChange={set("password")} /></div>
        <div className="space-y-1"><Label className="text-xs">Sender name</Label><Input aria-label={`${p.purpose} sender name`} value={f.sender_name} onChange={set("sender_name")} /></div>
        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Sender email</Label><Input aria-label={`${p.purpose} sender email`} type="email" value={f.sender_email} onChange={set("sender_email")} /></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="gold" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Save</Button>
        {hasPassword && <Button variant="outline" onClick={() => void save(true)} disabled={busy}>Remove password</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <Input aria-label={`${p.purpose} test address`} className="max-w-60" type="email" placeholder="Send test to…" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        <Button variant="outline" onClick={test} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <Send />} Send test</Button>
        {p.last_test_at && (
          <span className={`flex items-center gap-1 text-xs ${p.last_test_ok ? "text-success" : "text-destructive"}`}>
            {p.last_test_ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            {p.last_test_ok ? "Last test passed" : `Last test failed: ${p.last_test_error ?? ""}`} · {new Date(p.last_test_at).toLocaleString()}
          </span>
        )}
      </div>
    </Card>
  );
}
