import { createFileRoute } from "@tanstack/react-router";

type Obj = Record<string, unknown> & { id: string; metadata?: Record<string, string> };

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("stripe-signature");
        const { webhookSecrets, verifyStripeSignature, applyPaidSession, fromMinor } = await import("@/lib/stripe.server");
        let mode: "test" | "live" | null = null;
        for (const w of await webhookSecrets()) {
          if (await verifyStripeSignature(raw, sig, w.secret)) { mode = w.mode; break; }
        }
        if (!mode) return new Response("Invalid signature", { status: 400 });

        let event: { id: string; type: string; livemode: boolean; data: { object: Obj } };
        try { event = JSON.parse(raw); } catch { return new Response("Bad payload", { status: 400 }); }
        if (typeof event?.id !== "string" || !event.data?.object) return new Response("Bad payload", { status: 400 });

        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        // Idempotency: each Stripe event is processed once. Only a unique-violation is a
        // genuine duplicate — any other insert error (permissions, connectivity) means the
        // event was NOT processed, so return a retryable error instead of a false 200.
        const { error: dupErr } = await db.from("stripe_events").insert({ event_id: event.id, type: event.type });
        if (dupErr) {
          if (dupErr.code === "23505") return new Response("duplicate", { status: 200 });
          console.error("stripe webhook: could not record event", event.id, dupErr.message);
          return new Response("error", { status: 500 });
        }

        try {
          const obj = event.data.object;
          const orderId = obj.metadata?.["order_id"];
          const log = async (status: string, message: string, extra: Record<string, unknown> = {}) => {
            const { error } = await db.from("payment_transactions").insert({ order_id: orderId ?? null, mode: mode!, kind: "webhook", status, message, stripe_event_id: event.id, ...extra });
            if (error) console.error("stripe webhook: could not write transaction log", event.id, status, error.message);
          };

          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await applyPaidSession(obj as never, mode, event.id);
              break;
            case "checkout.session.expired":
              if (orderId) {
                const { data: o } = await db.from("orders").select("id, payment_status, status, stripe_session_id").eq("id", orderId).maybeSingle();
                // Only cancel if this is still the order's current session and nothing was paid; cancelling restores stock.
                if (o && o.stripe_session_id === obj.id && o.payment_status !== "paid" && o.payment_status !== "refunded" && o.status === "pending") {
                  const { error: cancelErr } = await db.from("orders").update({ status: "cancelled", payment_status: "failed" }).eq("id", o.id);
                  if (cancelErr) throw new Error("Could not cancel the expired order");
                  await log("expired", "Checkout expired — order cancelled and stock restored", { stripe_session_id: obj.id });
                }
              }
              break;
            case "checkout.session.async_payment_failed":
            case "payment_intent.payment_failed": {
              const msg = ((obj["last_payment_error"] as { message?: string } | undefined)?.message) ?? "Payment failed";
              if (orderId) await db.from("orders").update({ payment_status: "failed" }).eq("id", orderId).eq("payment_status", "pending");
              await log("failed", msg);
              break;
            }
            case "charge.refunded": {
              const pi = obj["payment_intent"] as string | undefined;
              if (pi) {
                const { data: o } = await db.from("orders").select("id, total, currency").eq("stripe_payment_intent", pi).maybeSingle();
                if (o) {
                  const refunded = fromMinor(Number(obj["amount_refunded"] ?? 0), o.currency);
                  await db.from("orders").update({ refunded_total: refunded, ...(refunded >= Number(o.total) - 0.001 ? { payment_status: "refunded" } : {}) }).eq("id", o.id);
                  await db.from("payment_transactions").insert({ order_id: o.id, mode, kind: "webhook", status: "refund_synced", amount: refunded, currency: o.currency, stripe_payment_intent: pi, stripe_event_id: event.id, message: "Refund confirmed by Stripe" });
                }
              }
              break;
            }
            default:
              break;
          }
          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("stripe webhook", e);
          await db.from("stripe_events").delete().eq("event_id", event.id); // allow Stripe's retry
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
