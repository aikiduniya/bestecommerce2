import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Save an admin reply to a contact inquiry and email it through the "contact" SMTP profile
// when delivery is enabled; otherwise it is logged as queued_disabled.
export const replyInquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), reply: z.string().trim().min(2).max(5000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS: only staff with the customers permission can see/update the inquiry.
    const { data: msg, error } = await supabase.from("contact_messages")
      .update({ admin_reply: data.reply, replied_at: new Date().toISOString(), replied_by: userId, status: "replied", is_read: true })
      .eq("id", data.id).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!msg) throw new Error("Not allowed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin.from("email_settings").select("delivery_enabled").eq("id", 1).single();
    const { data: store } = await supabaseAdmin.from("store_settings").select("store_name").eq("id", 1).single();
    const subject = `Re: ${msg.subject || "Your message"} — ${store?.store_name ?? ""}`.trim();
    const body = `Hi ${msg.name},\n\n${data.reply}\n\n— ${store?.store_name ?? ""}\n\nYour original message:\n${msg.message}`;
    let status = "queued_disabled";
    let err: string | null = null;
    if (settings?.delivery_enabled) {
      const { data: prof } = await supabaseAdmin.from("smtp_profiles").select("*").eq("purpose", "contact").single();
      if (prof?.is_enabled && prof.last_test_ok) {
        const { smtpSend } = await import("@/lib/smtp.server");
        const r = await smtpSend(prof as never, msg.email, subject, body);
        status = r.ok ? "sent" : "failed";
        err = r.error ?? null;
      }
    }
    await supabaseAdmin.from("email_logs").insert({
      template_key: "contact_reply", event: "contact_reply", recipient_email: msg.email, subject, status, error: err,
      attempts: 1, payload: { body }, last_attempt_at: new Date().toISOString(), smtp_profile: "contact",
    });
    return { status };
  });
