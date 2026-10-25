// SMTP profile management (server-only logic inside handlers).
// Passwords are AES-GCM encrypted with SMTP_ENCRYPTION_KEY before storage and
// are never returned to the browser (the column is not granted to clients).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SmtpRow } from "@/lib/smtp-types";

const PURPOSES = ["general", "contact", "orders", "security"] as const;

async function requireAdmin(supabase: { from: (t: "user_roles") => any }, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
}

const saveInput = z.object({
  purpose: z.enum(PURPOSES),
  host: z.string().trim().max(255).regex(/^[a-z0-9.-]*$/i, "Host may only contain letters, numbers, dots and dashes"),
  port: z.number().int().min(1).max(65535),
  encryption: z.enum(["starttls", "ssl", "none"]),
  username: z.string().trim().max(255),
  password: z.string().max(500).optional(),
  clearPassword: z.boolean().optional(),
  sender_name: z.string().trim().max(100),
  sender_email: z.union([z.literal(""), z.string().trim().email().max(255)]),
  is_enabled: z.boolean(),
});

export const saveSmtpProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      host: data.host || null, port: data.port, encryption: data.encryption, username: data.username || null,
      sender_name: data.sender_name || null, sender_email: data.sender_email || null, updated_at: new Date().toISOString(),
    };
    const { encryptSecret } = await import("@/lib/smtp.server");
    if (data.password) patch["password_encrypted"] = await encryptSecret(data.password);
    if (data.clearPassword) patch["password_encrypted"] = null;
    const { data: cur } = await supabaseAdmin.from("smtp_profiles").select("host, port, encryption, username, sender_email, last_test_ok, password_encrypted").eq("purpose", data.purpose).single();
    // Any connection or sender change invalidates the previous successful test.
    const connChanged = !!cur && (
      (cur.host ?? null) !== (data.host || null) || cur.port !== data.port ||
      cur.encryption !== data.encryption || (cur.username ?? null) !== (data.username || null) ||
      (cur.sender_email ?? null) !== (data.sender_email || null));
    const credsChanged = !!data.password || !!data.clearPassword || connChanged;
    if (credsChanged) { patch["last_test_ok"] = null; patch["last_test_at"] = null; patch["last_test_error"] = null; }
    // A profile can only be switched on after a successful test with the current credentials.
    const tested = credsChanged ? false : !!cur?.last_test_ok;
    if (data.is_enabled && !tested) return { ok: false, error: "Send a successful test email before enabling this profile" };
    patch["is_enabled"] = data.is_enabled;
    const { error } = await supabaseAdmin.from("smtp_profiles").update(patch as never).eq("purpose", data.purpose);
    if (error) throw new Error(error.message);
    return { ok: true, hasPassword: !!(patch["password_encrypted"] ?? (data.clearPassword ? null : cur?.password_encrypted)) };
  });

export const smtpPasswordStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("smtp_profiles").select("purpose, password_encrypted");
    return Object.fromEntries((data ?? []).map((r) => [r.purpose, !!r.password_encrypted])) as Record<string, boolean>;
  });

export const testSmtpProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ purpose: z.enum(PURPOSES), to: z.string().trim().email().max(255) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("smtp_profiles").select("*").eq("purpose", data.purpose).single();
    if (!p) throw new Error("Profile not found");
    const subject = `SMTP test (${data.purpose})`;
    const { smtpSend } = await import("@/lib/smtp.server");
    const r = await smtpSend(p as SmtpRow, data.to, subject, "This is a test email from your store's SMTP settings. If you received it, this profile works.");
    const now = new Date().toISOString();
    await supabaseAdmin.from("smtp_profiles").update({ last_test_at: now, last_test_ok: r.ok, last_test_error: r.error ?? null }).eq("purpose", data.purpose);
    await supabaseAdmin.from("email_logs").insert({
      template_key: "smtp_test", event: "smtp_test", recipient_email: data.to, subject, status: r.ok ? "sent" : "failed",
      error: r.error ?? null, attempts: 1, payload: {}, last_attempt_at: now, smtp_profile: data.purpose,
    });
    return r;
  });

// Public: notify the owner about a just-submitted contact inquiry (once per inquiry).
export const notifyContactInquiry = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Check the recipient BEFORE claiming the message, so a missing recipient
    // does not permanently burn the one notification attempt.
    const { data: st } = await supabaseAdmin.from("store_settings").select("contact_notify_email, support_email").eq("id", 1).single();
    const to = st?.contact_notify_email || st?.support_email;
    if (!to) return { status: "no_recipient" };
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: claimed } = await supabaseAdmin.from("contact_messages").update({ notified_at: new Date().toISOString() })
      .eq("id", data.id).is("notified_at", null).gte("created_at", since).select("*").maybeSingle();
    if (!claimed) return { status: "skipped" };
    const { processSend } = await import("@/lib/email-pipeline.server");
    return processSend(supabaseAdmin, {
      event: "contact_received", recipientEmail: to,
      vars: { name: claimed.name, email: claimed.email, phone: claimed.phone ?? "-", subject: claimed.subject ?? "(no subject)", message: claimed.message },
    });
  });
