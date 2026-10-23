// Server-only Stripe helpers. Talks to the Stripe REST API with fetch (Worker-safe, no SDK).
import { decryptSecret } from "@/lib/smtp.server";

export type StripeMode = "test" | "live";
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

export function toMinor(amount: number, currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
}
export function fromMinor(minor: number, currency: string) {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? minor : minor / 100;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadStripeConfig(mode?: StripeMode) {
  const db = await admin();
  const { data, error } = await db.from("payment_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new Error("Payment settings are missing");
  const m = (mode ?? data.stripe_mode) as StripeMode;
  const enc = m === "live" ? data.live_secret_enc : data.test_secret_enc;
  return { settings: data, mode: m, secretKey: enc ? await decryptSecret(enc) : null };
}

export async function webhookSecrets(): Promise<{ mode: StripeMode; secret: string }[]> {
  const db = await admin();
  const { data } = await db.from("payment_settings").select("test_webhook_enc, live_webhook_enc").eq("id", 1).single();
  const out: { mode: StripeMode; secret: string }[] = [];
  if (data?.test_webhook_enc) out.push({ mode: "test", secret: await decryptSecret(data.test_webhook_enc) });
  if (data?.live_webhook_enc) out.push({ mode: "live", secret: await decryptSecret(data.live_webhook_enc) });
  return out;
}

function encode(params: Record<string, unknown>, prefix = "", out: string[] = []) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encode(item as Record<string, unknown>, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === "object") encode(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export async function stripeApi<T = Record<string, unknown>>(
  secretKey: string, method: "GET" | "POST", path: string,
  params?: Record<string, unknown>, idempotencyKey?: string,
): Promise<T> {
  const qs = method === "GET" && params ? `?${encode(params)}` : "";
  const res = await fetch(`https://api.stripe.com/v1/${path}${qs}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" && params ? encode(params) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe request failed (${res.status})`);
  return json as T;
}

/** Verify a Stripe-Signature header (t=...,v1=...) over the raw body. */
export async function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]).filter((p) => p.length === 2));
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts["t"]);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === expected.length && timingSafe(s, expected));
}
function timingSafe(a: string, b: string) {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type Session = { id: string; payment_status: string; status: string; amount_total: number | null; currency: string | null; payment_intent: string | null; metadata?: Record<string, string> };

/** Mark an order paid after confirming the Stripe session matches it exactly. Idempotent. */
export async function applyPaidSession(session: Session, mode: StripeMode, eventId?: string) {
  const db = await admin();
  const orderId = session.metadata?.["order_id"];
  if (!orderId) return { ok: false, reason: "no order" };
  const { data: o } = await db.from("orders").select("id, total, currency, payment_status, status, stripe_session_id, order_number").eq("id", orderId).maybeSingle();
  if (!o) return { ok: false, reason: "order not found" };
  const log = (status: string, message: string) => db.from("payment_transactions").insert({
    order_id: o.id, mode, kind: "payment", status, amount: fromMinor(session.amount_total ?? 0, session.currency ?? o.currency),
    currency: (session.currency ?? o.currency).toUpperCase(), stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent, stripe_event_id: eventId ?? null, message,
  });
  if (session.payment_status !== "paid") return { ok: false, reason: "not paid" };
  if (o.payment_status === "paid" || o.payment_status === "refunded") return { ok: true, already: true, order: o };
  const expected = toMinor(Number(o.total), o.currency);
  if (session.amount_total !== expected || (session.currency ?? "").toUpperCase() !== o.currency.toUpperCase()) {
    await log("mismatch", `Amount/currency mismatch: expected ${expected} ${o.currency}`);
    return { ok: false, reason: "mismatch" };
  }
  if (o.status === "cancelled") {
    await log("needs_refund", "Payment received for a cancelled order — refund it from Payments");
    return { ok: false, reason: "cancelled" };
  }
  const { data: upd } = await db.from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString(), stripe_payment_intent: session.payment_intent, stripe_session_id: session.id })
    .eq("id", o.id).in("payment_status", ["pending", "failed"]).select("id").maybeSingle();
  if (upd) await log("succeeded", "Payment confirmed");
  return { ok: true, order: o };
}
