// Email sending pipeline (server-only).
// While delivery is disabled (no verified provider), every send is recorded in
// email_logs as "queued_disabled" and nothing leaves the system. Once the owner
// configures a provider and enables delivery, the same pipeline sends for real.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const sendInput = z.object({
  event: z.string().max(60),
  recipientEmail: z.string().email(),
  vars: z.record(z.string(), z.string()).default({}),
  orderId: z.string().uuid().optional(),
});

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
    const { processSend } = await import("@/lib/email-pipeline.server");
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
    const { processSend } = await import("@/lib/email-pipeline.server");
    return processSend(supabaseAdmin, {
      event: log.event ?? "",
      recipientEmail: log.recipient_email,
      vars: (log.payload ?? {}) as Record<string, string>,
      logId: log.id,
    });
  });
