import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const mfaFactorsQuery = {
  queryKey: ["mfa-factors"] as const,
  queryFn: async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data.totp;
  },
};

/** Account security: enroll / verify / remove TOTP two-factor authentication. */
export function MfaSettings() {
  const qc = useQueryClient();
  const { data: factors = [] } = useQuery(mfaFactorsQuery);
  const verified = factors.filter((f) => f.status === "verified");
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    // Clear abandoned (never-verified) setups first, otherwise a retry fails with "friendly name already exists".
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnroll() {
    if (!enroll || code.trim().length !== 6) { toast.error("Enter the 6-digit code from your app"); return; }
    setBusy(true);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enroll.id });
    if (e1) { setBusy(false); toast.error(e1.message); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: code.trim() });
    setBusy(false);
    if (error) { toast.error("That code didn't work — check the time on your device and try again"); return; }
    toast.success("Two-factor authentication is now on");
    setEnroll(null);
    setCode("");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Two-factor authentication removed");
    qc.invalidateQueries({ queryKey: ["mfa-factors"] });
  }

  return (
    <div className="max-w-lg space-y-5">
      <div>
        <h2 className="font-display text-2xl">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Require a code from an authenticator app (Google Authenticator, 1Password, …) in addition to your password.
          Admin accounts with 2FA enabled must enter a code before opening the dashboard.
        </p>
      </div>

      {verified.length > 0 ? (
        <div className="space-y-3">
          {verified.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded border p-4 text-sm">
              <span><span className="font-medium">{f.friendly_name ?? "Authenticator app"}</span> <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success">Active</span></span>
              <Button variant="ghost" size="sm" onClick={() => remove(f.id)}>Remove</Button>
            </div>
          ))}
        </div>
      ) : !enroll ? (
        <Button variant="gold" onClick={startEnroll} disabled={busy}>{busy ? "Preparing…" : "Set up two-factor authentication"}</Button>
      ) : null}

      {enroll && (
        <div className="space-y-4 rounded border bg-card p-5">
          <p className="text-sm">1. Scan this code with your authenticator app:</p>
          <img src={enroll.qr.startsWith("data:") ? enroll.qr : `data:image/svg+xml;utf8,${encodeURIComponent(enroll.qr)}`} alt="Authenticator QR code" className="h-44 w-44 rounded border bg-white p-2" />
          <details className="text-xs text-muted-foreground">
            <summary>Can't scan? Enter this key manually</summary>
            <code className="mt-1 block select-all break-all rounded bg-muted p-2">{enroll.secret}</code>
          </details>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">2. Enter the 6-digit code shown in your app</Label>
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="w-40" />
          </div>
          <div className="flex gap-2">
            <Button variant="gold" onClick={verifyEnroll} disabled={busy}>{busy ? "Verifying…" : "Turn on 2FA"}</Button>
            <Button variant="ghost" onClick={() => { setEnroll(null); setCode(""); }}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
