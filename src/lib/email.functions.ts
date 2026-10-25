// Email sending pipeline (server-only).
// While delivery is disabled (no verified provider), every send is recorded in
// email_logs as "queued_disabled" and nothing leaves the system. Once the owner
// configures a provider and enables delivery, the same pipeline sends for real.

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function callerUserId(): Promise<string | null> {
  const auth = getRequestHeader("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
  return data.user?.id ?? null;
}

// Send the order_placed + order_placed_admin notifications for a just-placed
// non-card order. Public because guest checkout has no session: the caller must
// own the order (signed in) or present its guest token. All template variables
// are built from the stored order — nothing is trusted from the browser.
// Stripe orders are excluded: their notifications fire on payment confirmation.
export const notifyOrderPlaced = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ orderId: z.string().uuid(), guestToken: z.string().max(100).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { notifyOrderPlacedCore } = await import("@/lib/order-notifications.server");
    return notifyOrderPlacedCore(db, { orderId: data.orderId, guestToken: data.guestToken, userId: await callerUserId() });
  });

const sendInput = z.object({
  event: z.string().max(60),
  recipientEmail: z.string().email(),
  vars: z.record(z.string(), z.string()).default({}),
  orderId: z.string().uuid().optional(),
});

// Fire a notification for a store event (e.g. abandoned-cart reminders).
// Staff only — customers must not drive the template pipeline with arbitrary
// events, recipients and variables.
export const sendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: staff } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: boolean | null }>)("is_staff", { _user_id: userId });
    if (!staff) throw new Error("Staff only");
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
