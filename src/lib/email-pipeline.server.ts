// Server-only email pipeline shared by notifications, retries and contact inquiries.
// While delivery is disabled every send is logged as "queued_disabled" and nothing leaves the system.
import { renderTemplate } from "@/lib/email";
import { smtpSend } from "@/lib/smtp.server";
import type { SmtpRow } from "@/lib/smtp-types";

async function deliverViaProvider(
  settings: { provider: string; provider_config: Record<string, unknown>; sender_email: string; sender_name: string },
  to: string,
  subject: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const cfg = settings.provider_config ?? {};
  try {
    if (settings.provider === "resend") {
      const key = String(cfg["api_key"] ?? "");
      if (!key) return { ok: false, error: "Resend API key missing" };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${settings.sender_name} <${settings.sender_email}>`,
          to: [to],
          subject,
          text: body,
        }),
      });
      if (!res.ok) return { ok: false, error: `Resend HTTP ${res.status}` };
      return { ok: true };
    }
    if (settings.provider === "sendgrid") {
      const key = String(cfg["api_key"] ?? "");
      if (!key) return { ok: false, error: "SendGrid API key missing" };
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: settings.sender_email, name: settings.sender_name },
          subject,
          content: [{ type: "text/plain", value: body }],
        }),
      });
      if (!res.ok) return { ok: false, error: `SendGrid HTTP ${res.status}` };
      return { ok: true };
    }
    return { ok: false, error: `Provider "${settings.provider}" is not supported for live sending yet` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

// Core pipeline, shared by send + retry. Returns the log status written.
export async function processSend(
  admin: AdminClient,
  input: { event: string; recipientEmail: string; vars: Record<string, string>; logId?: number },
): Promise<{ status: string; error?: string }> {
  const skip = async (status: string) => {
    if (input.logId) {
      const { error } = await admin.from("email_logs").update({ status, last_attempt_at: new Date().toISOString() }).eq("id", input.logId);
      if (error) throw new Error("Could not record skipped email notification");
    } else {
      // A skipped send must still be visible in the delivery log, not vanish silently.
      const { error } = await admin.from("email_logs").insert({
        event: input.event, recipient_email: input.recipientEmail, subject: "", status,
        attempts: 0, payload: input.vars, last_attempt_at: new Date().toISOString(),
      });
      if (error) throw new Error("Could not record skipped email notification");
    }
    return { status };
  };
  const { data: settings } = await admin.from("email_settings").select("*").eq("id", 1).single();
  const { data: rule } = await admin.from("notification_rules").select("*").eq("event", input.event).maybeSingle();
  if (!rule?.is_enabled || !rule.template_key) return skip("skipped_rule_disabled");
  const { data: tpl } = await admin.from("email_templates").select("*").eq("key", rule.template_key).maybeSingle();
  if (!tpl || !tpl.is_enabled) return skip("skipped_template_disabled");

  const { data: store } = await admin.from("store_settings").select("store_name").eq("id", 1).single();
  const vars = { store_name: store?.store_name ?? "", ...input.vars };
  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);

  let status: "queued_disabled" | "sent" | "failed" = "queued_disabled";
  let error: string | null = null;
  const profileKey = rule.smtp_profile ?? "general";
  if (settings?.delivery_enabled) {
    // SMTP profile assigned to this notification wins when it is enabled and tested.
    const { data: prof } = await admin.from("smtp_profiles").select("*").eq("purpose", profileKey).maybeSingle();
    if (prof?.is_enabled && prof.last_test_ok) {
      const r = await smtpSend(prof as SmtpRow, input.recipientEmail, subject, body);
      status = r.ok ? "sent" : "failed";
      error = r.error ?? null;
    } else if (settings.provider !== "none" && settings.provider !== "smtp") {
      const r = await deliverViaProvider(settings as never, input.recipientEmail, subject, body);
      status = r.ok ? "sent" : "failed";
      error = r.error ?? null;
    } else {
      // Delivery is on but nothing can send: say so plainly instead of a misleading "queued".
      status = "failed";
      error = `Live delivery is on but the "${profileKey}" SMTP profile is not enabled and tested, and no email provider is configured`;
    }
  }

  if (input.logId) {
    const { data: log } = await admin.from("email_logs").select("attempts").eq("id", input.logId).single();
    const { error: logError } = await admin.from("email_logs").update({
      status, error, subject, template_key: tpl.key, payload: vars, smtp_profile: profileKey,
      attempts: (log?.attempts ?? 0) + 1, last_attempt_at: new Date().toISOString(),
    }).eq("id", input.logId);
    if (logError) throw new Error("Could not record email delivery result");
  } else {
    const { error: logError } = await admin.from("email_logs").insert({
      template_key: tpl.key, event: input.event, recipient_email: input.recipientEmail,
      subject, status, error, attempts: 1, payload: vars, last_attempt_at: new Date().toISOString(), smtp_profile: profileKey,
    });
    if (logError) throw new Error("Could not record email delivery result");
  }
  return error ? { status, error } : { status };
}

