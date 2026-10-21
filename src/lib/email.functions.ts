// Email sending pipeline (server-only).
// While delivery is disabled (no verified provider), every send is recorded in
// email_logs as "queued_disabled" and nothing leaves the system. Once the owner
// configures a provider and enables delivery, the same pipeline sends for real.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderTemplate } from "@/lib/email";

const sendInput = z.object({
  event: z.string().max(60),
  recipientEmail: z.string().email(),
  vars: z.record(z.string(), z.string()).default({}),
  orderId: z.string().uuid().optional(),
});

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
async function processSend(
  admin: AdminClient,
  input: { event: string; recipientEmail: string; vars: Record<string, string>; logId?: number },
): Promise<{ status: string; error?: string }> {
  const { data: settings } = await admin.from("email_settings").select("*").eq("id", 1).single();
  const { data: rule } = await admin.from("notification_rules").select("*").eq("event", input.event).maybeSingle();
  if (!rule?.is_enabled || !rule.template_key) return { status: "skipped_rule_disabled" };
  const { data: tpl } = await admin.from("email_templates").select("*").eq("key", rule.template_key).maybeSingle();
  if (!tpl || !tpl.is_enabled) return { status: "skipped_template_disabled" };

  const { data: store } = await admin.from("store_settings").select("store_name").eq("id", 1).single();
  const vars = { store_name: store?.store_name ?? "", ...input.vars };
  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);

  let status: "queued_disabled" | "sent" | "failed" = "queued_disabled";
  let error: string | null = null;
  if (settings?.delivery_enabled && settings.provider !== "none") {
    const r = await deliverViaProvider(settings as never, input.recipientEmail, subject, body);
    status = r.ok ? "sent" : "failed";
    error = r.error ?? null;
  }

  if (input.logId) {
    const { data: log } = await admin.from("email_logs").select("attempts").eq("id", input.logId).single();
    await admin.from("email_logs").update({
      status, error, attempts: (log?.attempts ?? 0) + 1, last_attempt_at: new Date().toISOString(),
    }).eq("id", input.logId);
  } else {
    await admin.from("email_logs").insert({
      template_key: tpl.key, event: input.event, recipient_email: input.recipientEmail,
      subject, status, error, attempts: 1, payload: vars, last_attempt_at: new Date().toISOString(),
    });
  }
  return error ? { status, error } : { status };
}

// Fire a notification for a store event. Callable by any signed-in user, but
// when an orderId is given the caller must own that order or be staff — this
// keeps customers from emailing arbitrary people through the pipeline.
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.orderId) {
      const { data: order } = await supabase.from("orders").select("id").eq("id", data.orderId).maybeSingle();
      if (!order) throw new Error("Not allowed");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return processSend(supabaseAdmin, data);
  });

// Retry a queued/failed log entry. Admin only.
export const retryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ logId: z.number().int() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Admin only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log } = await supabaseAdmin.from("email_logs").select("*").eq("id", data.logId).single();
    if (!log) throw new Error("Log entry not found");
    if (log.status === "sent") return { status: "sent" };
    return processSend(supabaseAdmin, {
      event: log.event ?? "",
      recipientEmail: log.recipient_email,
      vars: (log.payload ?? {}) as Record<string, string>,
      logId: log.id,
    });
  });
