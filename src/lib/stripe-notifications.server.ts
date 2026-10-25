// Only the winner of the atomic unpaid -> paid update calls this helper.
// Reserve both delivery logs before sending; email errors never escape to Stripe.
import { processSend } from "@/lib/email-pipeline.server";
import type { Database } from "@/integrations/supabase/types";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];
type Order = Pick<Database["public"]["Tables"]["orders"]["Row"],
  "id" | "customer_name" | "customer_email" | "order_number" | "total" | "currency" | "items">;

export async function notifyPaidStripeOrder(db: AdminClient, order: Order): Promise<void> {
  try {
    const { data: store, error: storeError } = await db.from("store_settings").select("support_email").eq("id", 1).single();
    if (storeError) throw new Error("Could not load store notification recipient");
    const total = new Intl.NumberFormat("en-US", { style: "currency", currency: order.currency }).format(Number(order.total));
    const items = Array.isArray(order.items) ? order.items : [];
    const vars = {
      order_id: order.id, customer_name: order.customer_name, customer_email: order.customer_email,
      order_number: String(order.order_number), order_total: total, total: String(order.total),
      currency: order.currency, payment_method: "Stripe",
      items_list: items.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        return [`${item["qty"] ?? 0} × ${item["name"] ?? ""}`];
      }).join(", "),
    };
    const notifications = [
      { event: "order_placed", recipientEmail: order.customer_email },
      { event: "order_placed_admin", recipientEmail: store?.support_email ?? "" },
    ];
    const { data: logs, error } = await db.from("email_logs").insert(notifications.map((n) => ({
      event: n.event, recipient_email: n.recipientEmail, subject: "", status: "processing",
      attempts: 0, payload: vars,
    }))).select("id, event, recipient_email");
    if (error || !logs || logs.length !== 2) throw new Error("Could not reserve Stripe notification logs");
    await Promise.all(logs.map(async (log) => {
      try {
        if (!log.recipient_email) throw new Error("Notification recipient is not configured");
        await processSend(db, { event: log.event ?? "", recipientEmail: log.recipient_email, vars, logId: log.id });
      } catch {
        // Keep each failed attempt visible and manually retryable, without resending its sibling.
        const { error: logError } = await db.from("email_logs").update({
          status: "failed", error: "Stripe notification delivery could not complete; check email configuration and retry this log",
          attempts: 1, last_attempt_at: new Date().toISOString(),
        }).eq("id", log.id);
        if (logError) console.error("Stripe notification result could not be recorded", { orderId: order.id, logId: log.id });
      }
    }));
  } catch {
    // Preparation failed before any delivery log was reserved. Leave a visible,
    // retryable record instead of disappearing silently into the server log.
    console.error("Stripe payment confirmed but notification preparation failed", { orderId: order.id });
    try {
      await db.from("email_logs").insert({
        event: "order_placed", recipient_email: order.customer_email, subject: "",
        status: "failed", error: "Notification preparation failed after payment confirmation; retry from the delivery log",
        attempts: 0, payload: { order_id: order.id, order_number: String(order.order_number) },
      });
    } catch (fallbackError) {
      console.error("Could not record the Stripe notification failure", { orderId: order.id, fallbackError });
    }
  }
}