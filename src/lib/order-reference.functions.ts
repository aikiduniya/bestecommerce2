import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { publicOrderCode } from "@/lib/order-reference";

/** Legacy place_order responses omit order_code. Read it back only for the owner. */
export const getPlacedOrderCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid(), guestToken: z.string().max(100).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin.from("orders")
      .select("order_code, user_id, guest_token").eq("id", data.orderId).maybeSingle();
    if (error) throw new Error("Could not load your order reference");
    if (!order) throw new Error("Order not found");
    if (order.user_id) {
      const header = getRequestHeader("authorization");
      if (!header?.startsWith("Bearer ")) throw new Error("Order not found");
      const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(header.slice(7));
      if (authError || auth.user?.id !== order.user_id) throw new Error("Order not found");
    } else if (!order.guest_token || data.guestToken !== order.guest_token) {
      throw new Error("Order not found");
    }
    return { orderCode: publicOrderCode(order) };
  });