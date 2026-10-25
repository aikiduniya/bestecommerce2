// Only the winner of the atomic unpaid -> paid update calls this helper.
// Delegates to the shared order-notification pipeline with the "Stripe" label.
import { notifyOrderPlacedEmail, type OrderForNotification } from "@/lib/order-notifications.server";

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

export async function notifyPaidStripeOrder(db: AdminClient, order: OrderForNotification): Promise<void> {
  return notifyOrderPlacedEmail(db, order, "Stripe");
}
