// Shared order-placed notification helper (server-only).
// Used by the Stripe payment confirmation (label "Stripe") and by the COD
// checkout notification endpoint. Reserves both delivery logs before sending;
// email errors never escape to the caller, so they cannot undo an order or payment.
import { processSend } from "@/lib/email-pipeline.server";
import { buildOrderVars } from "@/lib/email-render";
import type { Database } from "@/integrations/supabase/types";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
export type OrderForNotification = Pick<Database["public"]["Tables"]["orders"]["Row"],
  "id" | "customer_name" | "customer_email" | "order_number" | "total" | "currency" | "items">;

// Authorize + dedupe + dispatch for a just-placed non-card order. The caller
// must own the order (signed-in user id) or present its guest token. All
// template variables come from the stored order — nothing from the browser.
export async function notifyOrderPlacedCore(
  db: AdminClient,
  input: { orderId: string; guestToken?: string | undefined; userId?: string | null | undefined },
): Promise<{ status: string }> {
  const { data: o } = await db.from("orders")
    .select("id, user_id, guest_token, payment_method, customer_name, customer_email, order_number, total, currency, items")
    .eq("id", input.orderId).maybeSingle();
  if (!o) throw new Error("Order not found");
  const allowed = (o.user_id && input.userId === o.user_id) || (!o.user_id && o.guest_token && input.guestToken === o.guest_token);
  if (!allowed) throw new Error("Order not found");
  if (o.payment_method === "stripe") return { status: "skipped_card_order" };
  // Idempotent: a repeat call (page reload, double submit) must not resend.
  const { data: existing } = await db.from("email_logs").select("id")
    .eq("event", "order_placed").filter("payload->>order_id", "eq", o.id)
    .neq("status", "failed").limit(1);
  if (existing?.length) return { status: "already_notified" };
  const label = o.payment_method === "cod" ? "Cash on Delivery" : o.payment_method;
  await notifyOrderPlacedEmail(db, o, label);
  return { status: "ok" };
}

export async function notifyOrderPlacedEmail(db: AdminClient, order: OrderForNotification, paymentLabel: string): Promise<void> {
  try {
    const { data: store, error: storeError } = await db.from("store_settings").select("support_email").eq("id", 1).single();
    if (storeError) throw new Error("Could not load store notification recipient");
    const vars = buildOrderVars(order, paymentLabel);
    const notifications = [
      { event: "order_placed", recipientEmail: order.customer_email },
      { event: "order_placed_admin", recipientEmail: store?.support_email ?? "" },
    ];
    const { data: logs, error } = await db.from("email_logs").insert(notifications.map((n) => ({
      event: n.event, recipient_email: n.recipientEmail, subject: "", status: "processing",
      attempts: 0, payload: vars,
    }))).select("id, event, recipient_email");
    if (error || !logs || logs.length !== 2) throw new Error("Could not reserve order notification logs");
    await Promise.all(logs.map(async (log) => {
      try {
        if (!log.recipient_email) throw new Error("Notification recipient is not configured");
        await processSend(db, { event: log.event ?? "", recipientEmail: log.recipient_email, vars, logId: log.id });
      } catch {
        // Keep each failed attempt visible and manually retryable, without resending its sibling.
        const { error: logError } = await db.from("email_logs").update({
          status: "failed", error: "Notification delivery could not complete; check email configuration and retry this log",
          attempts: 1, last_attempt_at: new Date().toISOString(),
        }).eq("id", log.id);
        if (logError) console.error("Notification result could not be recorded", { orderId: order.id, logId: log.id });
      }
    }));
  } catch {
    // Preparation failed before any delivery log was reserved. Leave a visible,
    // retryable record instead of disappearing silently into the server log.
    console.error("Order notification preparation failed", { orderId: order.id });
    try {
      await db.from("email_logs").insert({
        event: "order_placed", recipient_email: order.customer_email, subject: "",
        status: "failed", error: "Notification preparation failed; retry from the delivery log",
        attempts: 0, payload: { order_id: order.id, order_number: String(order.order_number) },
      });
    } catch (fallbackError) {
      console.error("Could not record the order notification failure", { orderId: order.id, fallbackError });
    }
  }
}
