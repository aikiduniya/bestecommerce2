// Password reset through the store's own SMTP (the "password_reset" rule picks
// the SMTP profile in Admin → SMTP). Always answers the same way so the form
// never reveals whether an email has an account.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(255) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { currentSiteUrl } = await import("@/lib/site-origin");
    const { processSend } = await import("@/lib/email-pipeline.server");
    const { data: s } = await db.from("store_settings").select("site_url").eq("id", 1).maybeSingle();
    const origin = currentSiteUrl((s as { site_url?: string } | null)?.site_url ?? null);
    const redirectTo = `${origin}/reset-password`;
    try {
      const { data: link, error } = await db.auth.admin.generateLink({ type: "recovery", email: data.email, options: { redirectTo } });
      if (error || !link?.properties?.action_link) return { ok: true }; // unknown email: same answer
      const { data: log, error: logErr } = await db.from("email_logs").insert({
        event: "password_reset", recipient_email: data.email, subject: "", status: "retrying", attempts: 0, payload: {},
      }).select("id").single();
      if (logErr || !log) throw new Error("log");
      const r = await processSend(db, { event: "password_reset", recipientEmail: data.email, vars: { reset_link: link.properties.action_link }, logId: log.id });
      // Never keep the one-time link in the delivery log.
      await db.from("email_logs").update({ payload: { reset_link: "[hidden]" } }).eq("id", log.id);
      if (r.status !== "sent") {
        // Store SMTP not live yet: fall back to the built-in reset email.
        await db.auth.resetPasswordForEmail(data.email, { redirectTo });
      }
    } catch (e) {
      console.error("Password reset request failed", e instanceof Error ? e.message : e);
    }
    return { ok: true };
  });
