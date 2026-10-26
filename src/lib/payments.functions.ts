import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const METHODS = ["card", "link", "paypal", "klarna", "afterpay_clearpay", "us_bank_account", "sepa_debit", "ideal", "bancontact", "alipay", "wechat_pay"] as const;

async function requireAdmin(supabase: { rpc: (...a: never[]) => unknown }, userId: string) {
  const { data } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: boolean | null }>)("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Only the Super Admin can manage payment settings");
}
async function requireOrdersPerm(supabase: unknown, userId: string) {
  const { data } = await (supabase as { rpc: (f: string, a: object) => Promise<{ data: boolean | null }> }).rpc("has_permission", { _user_id: userId, _perm: "orders" });
  if (!data) throw new Error("You do not have permission to manage payments");
}

const opt = (re: RegExp, msg: string) => z.string().trim().max(400).refine((v) => v === "" || re.test(v), msg).optional();

/** Save Stripe settings. Secret values are encrypted server-side and never returned. */
export const savePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    stripe_mode: z.enum(["test", "live"]),
    test_publishable_key: opt(/^pk_test_/, "Test publishable key must start with pk_test_"),
    live_publishable_key: opt(/^pk_live_/, "Live publishable key must start with pk_live_"),
    test_secret_key: opt(/^(sk|rk)_test_/, "Test secret key must start with sk_test_ or rk_test_"),
    live_secret_key: opt(/^(sk|rk)_live_/, "Live secret key must start with sk_live_ or rk_live_"),
    test_webhook_secret: opt(/^whsec_/, "Webhook secret must start with whsec_"),
    live_webhook_secret: opt(/^whsec_/, "Webhook secret must start with whsec_"),
    clear: z.array(z.enum(["test_secret", "live_secret", "test_webhook", "live_webhook"])).default([]),
    currencies: z.array(z.string().regex(/^[A-Za-z]{3}$/)).max(50),
    payment_methods: z.array(z.enum(METHODS)).min(1),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { encryptSecret } = await import("@/lib/smtp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: { [k: string]: unknown } & Record<string, unknown> = {
      stripe_mode: data.stripe_mode,
      test_publishable_key: data.test_publishable_key || null,
      live_publishable_key: data.live_publishable_key || null,
      currencies: data.currencies.map((c) => c.toUpperCase()),
      payment_methods: data.payment_methods,
      updated_at: new Date().toISOString(),
    };
    if (data.test_secret_key) { patch["test_secret_enc"] = await encryptSecret(data.test_secret_key); patch["test_verified_at"] = null; }
    if (data.live_secret_key) { patch["live_secret_enc"] = await encryptSecret(data.live_secret_key); patch["live_verified_at"] = null; }
    if (data.test_webhook_secret) patch["test_webhook_enc"] = await encryptSecret(data.test_webhook_secret);
    if (data.live_webhook_secret) patch["live_webhook_enc"] = await encryptSecret(data.live_webhook_secret);
    for (const c of data.clear) { patch[`${c}_enc`] = null; if (c.endsWith("secret")) patch[`${c.split("_")[0]}_verified_at`] = null; }
    const { data: cur } = await supabaseAdmin.from("payment_settings").select("stripe_mode").eq("id", 1).single();
    // Changing mode or replacing the active key turns card payments off until re-verified.
    if (cur?.stripe_mode !== data.stripe_mode || patch[`${data.stripe_mode}_secret_enc`] !== undefined) patch["stripe_enabled"] = false;
    const { error } = await supabaseAdmin.from("payment_settings").update(patch as never).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Check the saved secret key against Stripe (read-only call). */
export const testStripeConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ mode: z.enum(["test", "live"]) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { loadStripeConfig, stripeApi } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cfg = await loadStripeConfig(data.mode);
    if (!cfg.secretKey) return { ok: false, error: `No ${data.mode} secret key saved` };
    try {
      const acct = await stripeApi<{ livemode: boolean }>(cfg.secretKey, "GET", "balance");
      if (acct.livemode !== (data.mode === "live")) return { ok: false, error: `This key is not a ${data.mode} key` };
      await supabaseAdmin.from("payment_settings").update({ [`${data.mode}_verified_at`]: new Date().toISOString() } as never).eq("id", 1);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });

/** Turn card payments on/off. Enabling requires verified keys + webhook secret for the active mode. */
export const setStripeEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("payment_settings").select("*").eq("id", 1).single();
    if (!s) throw new Error("Payment settings missing");
    if (data.enabled) {
      const m = s.stripe_mode;
      const missing = [
        !(m === "live" ? s.live_publishable_key : s.test_publishable_key) && "publishable key",
        !(m === "live" ? s.live_secret_enc : s.test_secret_enc) && "secret key",
        !(m === "live" ? s.live_webhook_enc : s.test_webhook_enc) && "webhook signing secret",
        !(m === "live" ? s.live_verified_at : s.test_verified_at) && "a successful connection test",
      ].filter(Boolean);
      if (missing.length) throw new Error(`Before enabling ${m} mode add: ${missing.join(", ")}`);
    }
    await supabaseAdmin.from("payment_settings").update({ stripe_enabled: data.enabled, updated_at: new Date().toISOString() }).eq("id", 1);
    return { ok: true };
  });

async function callerUserId(): Promise<string | null> {
  const auth = getRequestHeader("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
  return data.user?.id ?? null;
}

/** Create (or reuse) a Stripe Checkout Session for an unpaid card order owned by the caller. */
export const createStripeCheckout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid(), guestToken: z.string().max(100).optional(), origin: z.string().url() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadStripeConfig, stripeApi, toMinor } = await import("@/lib/stripe.server");
    const { data: o } = await db.from("orders").select("id, order_number, user_id, guest_token, customer_email, total, currency, payment_method, payment_status, status, stripe_session_id").eq("id", data.orderId).maybeSingle();
    if (!o) throw new Error("Order not found");
    const uid = await callerUserId();
    const owner = (o.user_id && uid === o.user_id) || (!o.user_id && o.guest_token && data.guestToken === o.guest_token);
    if (!owner) throw new Error("Order not found");
    if (o.payment_method !== "stripe") throw new Error("This order is not a card order");
    if (o.payment_status === "paid" || o.payment_status === "refunded") throw new Error("This order is already paid");
    if (o.status === "cancelled") throw new Error("This order was cancelled");
    const cfg = await loadStripeConfig();
    if (!cfg.settings.stripe_enabled || !cfg.secretKey) throw new Error("Card payments are currently unavailable");
    if (cfg.settings.currencies.length && !cfg.settings.currencies.includes(o.currency.toUpperCase())) throw new Error(`Card payments are not available in ${o.currency}`);

    // Duplicate prevention: reuse a still-open session for this order.
    if (o.stripe_session_id) {
      try {
        const s = await stripeApi<{ status: string; url: string | null; payment_status: string }>(cfg.secretKey, "GET", `checkout/sessions/${o.stripe_session_id}`);
        if (s.payment_status === "paid") throw new Error("This order is already paid");
        if (s.status === "open" && s.url) return { url: s.url };
      } catch (e) { if ((e as Error).message.includes("already paid")) throw e; }
    }
    // Return URLs use the admin primary domain when set (never trust an arbitrary browser-sent host for it).
    const { data: st } = await db.from("store_settings").select("site_url").eq("id", 1).maybeSingle();
    const { resolveSiteUrl } = await import("@/lib/site-url");
    const origin = resolveSiteUrl(st?.site_url, process.env["SITE_URL"], new URL(data.origin).origin);
    const tokenQs = o.guest_token ? `&t=${encodeURIComponent(o.guest_token)}` : "";
    const attempt = Date.now();
    const session = await stripeApi<{ id: string; url: string }>(cfg.secretKey, "POST", "checkout/sessions", {
      mode: "payment",
      customer_email: o.customer_email,
      client_reference_id: o.id,
      payment_method_types: cfg.settings.payment_methods,
      line_items: [{ quantity: 1, price_data: { currency: o.currency.toLowerCase(), unit_amount: toMinor(Number(o.total), o.currency), product_data: { name: `Order #${o.order_number}` } } }],
      metadata: { order_id: o.id, order_number: String(o.order_number) },
      payment_intent_data: { metadata: { order_id: o.id } },
      expires_at: Math.floor(attempt / 1000) + 60 * 60,
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancelled?order=${o.id}${tokenQs}`,
    }, `checkout-${o.id}-${Math.floor(attempt / 60000)}`);
    // The webhook matches payments by this stored session id — if saving it fails,
    // the order must not be left pointing at nothing while a payable session exists.
    const { data: linked, error: linkError } = await db.from("orders").update({ stripe_session_id: session.id })
      .eq("id", o.id).in("payment_status", ["pending", "failed"]).select("id").maybeSingle();
    if (linkError) throw new Error("Could not link the checkout session to your order — please retry");
    if (!linked) throw new Error("This order is no longer awaiting payment");
    const { error: txError } = await db.from("payment_transactions").insert({ order_id: o.id, mode: cfg.mode, kind: "checkout", status: "created", amount: o.total, currency: o.currency, stripe_session_id: session.id, message: "Checkout session created" });
    if (txError) console.error("Could not record checkout transaction", { orderId: o.id, error: txError.message });
    return { url: session.url };
  });

/** Server-side verification on the success page (in case the webhook is delayed). */
export const verifyStripeSession = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) }).parse(i))
  .handler(async ({ data }) => {
    const { loadStripeConfig, stripeApi, applyPaidSession } = await import("@/lib/stripe.server");
    const mode = data.sessionId.startsWith("cs_live_") ? "live" : "test";
    const cfg = await loadStripeConfig(mode);
    if (!cfg.secretKey) return { paid: false, orderNumber: null, orderCode: null as string | null, email: null as string | null };
    const session = await stripeApi<Parameters<typeof applyPaidSession>[0]>(cfg.secretKey, "GET", `checkout/sessions/${data.sessionId}`);
    const r = await applyPaidSession(session, mode);
    const orderNumber = session.metadata?.["order_number"] ?? null;
    let orderCode: string | null = null; let email: string | null = null;
    if (orderNumber && /^\d+$/.test(orderNumber)) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: o } = await supabaseAdmin.from("orders").select("order_code, customer_email, stripe_session_id").eq("order_number", Number(orderNumber)).maybeSingle();
      // Only reveal details when this session is the one linked to the order.
      if (o && (o as { stripe_session_id?: string | null }).stripe_session_id === data.sessionId) {
        orderCode = (o as { order_code?: string | null }).order_code ?? null;
        email = (o as { customer_email?: string | null }).customer_email ?? null;
      }
    }
    return { paid: r.ok, orderNumber, orderCode, email };
  });

/** Full or partial refund of a paid card order. */
export const refundStripePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid(), amount: z.number().positive().optional(), reason: z.string().max(300).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireOrdersPerm(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadStripeConfig, stripeApi, toMinor } = await import("@/lib/stripe.server");
    const { data: o } = await db.from("orders").select("id, total, currency, refunded_total, payment_status, stripe_payment_intent, stripe_session_id").eq("id", data.orderId).single();
    if (!o || o.payment_status !== "paid" || !o.stripe_payment_intent) throw new Error("Only paid card orders can be refunded");
    const remaining = Number(o.total) - Number(o.refunded_total);
    const amount = Math.min(data.amount ?? remaining, remaining);
    if (amount <= 0) throw new Error("Nothing left to refund");
    const mode = o.stripe_session_id?.startsWith("cs_live_") ? "live" : "test";
    const cfg = await loadStripeConfig(mode);
    if (!cfg.secretKey) throw new Error(`No ${mode} secret key saved`);
    try {
      const r = await stripeApi<{ id: string; status: string }>(cfg.secretKey, "POST", "refunds", {
        payment_intent: o.stripe_payment_intent, amount: toMinor(amount, o.currency), metadata: { order_id: o.id, reason: data.reason ?? "" },
      }, `refund-${o.id}-${toMinor(Number(o.refunded_total), o.currency)}-${toMinor(amount, o.currency)}`);
      const newTotal = Number(o.refunded_total) + amount;
      await db.from("orders").update({ refunded_total: newTotal, ...(newTotal >= Number(o.total) - 0.001 ? { payment_status: "refunded" } : {}) }).eq("id", o.id);
      await db.from("payment_transactions").insert({ order_id: o.id, mode, kind: "refund", status: r.status, amount, currency: o.currency, stripe_payment_intent: o.stripe_payment_intent, stripe_refund_id: r.id, message: data.reason || "Refund issued", created_by: context.userId });
      return { ok: true };
    } catch (e) {
      await db.from("payment_transactions").insert({ order_id: o.id, mode, kind: "refund", status: "failed", amount, currency: o.currency, message: (e as Error).message, created_by: context.userId });
      throw e;
    }
  });

/** Check whether a pending card order was actually paid (admin "re-check" for failed/stuck payments). */
export const recheckStripeOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orderId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireOrdersPerm(context.supabase, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { loadStripeConfig, stripeApi, applyPaidSession } = await import("@/lib/stripe.server");
    const { data: o } = await db.from("orders").select("stripe_session_id").eq("id", data.orderId).single();
    if (!o?.stripe_session_id) return { paid: false, message: "No checkout was started for this order" };
    const mode = o.stripe_session_id.startsWith("cs_live_") ? "live" : "test";
    const cfg = await loadStripeConfig(mode);
    if (!cfg.secretKey) return { paid: false, message: `No ${mode} secret key saved` };
    const s = await stripeApi<Parameters<typeof applyPaidSession>[0]>(cfg.secretKey, "GET", `checkout/sessions/${o.stripe_session_id}`);
    const r = await applyPaidSession(s, mode);
    return { paid: r.ok, message: r.ok ? "Payment confirmed" : `Not paid (${s.status}, ${s.payment_status})` };
  });
