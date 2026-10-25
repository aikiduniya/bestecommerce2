import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOrderVars, formatItemsList, renderEmailText, unresolvedPlaceholders } from "@/lib/email-render";

const state = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, smtp: vi.fn() }));

class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: ((r: any) => boolean)[] = [];
  private op = "select";
  private payload: any;
  private one = false;
  constructor(private table: string) {}
  select(_c?: string) { return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
  filter() { return this; }
  limit() { return this; }
  update(p: any) { this.op = "update"; this.payload = p; return this; }
  insert(p: any) { this.op = "insert"; this.payload = p; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then<A = { data: any; error: any }, B = never>(f?: ((v: { data: any; error: any }) => A | PromiseLike<A>) | null, r?: ((e: any) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => {
      const rows: any[] = (state.rows[this.table] ??= []);
      let m = rows.filter((x) => this.filters.every((fn) => fn(x)));
      if (this.op === "update") m.forEach((x) => Object.assign(x, this.payload));
      if (this.op === "insert") {
        m = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: any, i: number) => ({ id: rows.length + i + 1, ...p }));
        rows.push(...m);
      }
      return { data: this.one ? structuredClone(m[0] ?? null) : structuredClone(m), error: null };
    }).then(f, r);
  }
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => new Query(t) } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/smtp.server", () => ({ smtpSend: state.smtp, decryptSecret: vi.fn() }));

import { processSend } from "@/lib/email-pipeline.server";
import { notifyOrderPlacedCore } from "@/lib/order-notifications.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// The real saved templates (copied from the store's email_templates table).
const ORDER_CONFIRMATION = {
  subject: "Your order {{order_number}} is confirmed",
  body: "Hello {{customer_name}},\n\nThank you for your order {{order_number}} at {{store_name}}.\n\nItems:\n{{items_list}}\n\nTotal: {{order_total}}\nPayment method: {{payment_method}}\n\nWe will notify you when your order ships.\n\n{{store_name}}\n{{footer_text}}",
};
const ADMIN_NEW_ORDER = {
  subject: "New order {{order_number}} ({{order_total}})",
  body: "A new order was placed.\n\nOrder: {{order_number}}\nCustomer: {{customer_name}} ({{customer_email}})\nTotal: {{order_total}}\nPayment: {{payment_method}}\n\n{{items_list}}",
};
const COD_CONFIRM = {
  subject: "Please confirm your COD order {{order_number}}",
  body: "Hello {{customer_name}},\n\nYour cash-on-delivery order {{order_number}} is waiting for confirmation.\n\n{{store_name}}",
};

const order8 = {
  id: "00000000-0000-4000-8000-000000000008", user_id: null, guest_token: "g8", payment_method: "cod",
  customer_name: "Waseem Akhtar", customer_email: "buyer@example.test", customer_phone: null,
  order_number: 8, total: 590, subtotal: 580, shipping_total: 10, tax_total: 0, discount_total: 0,
  currency: "USD", status: "pending", tracking_number: null, tracking_url: null,
  items: [
    { name: "Heritage Chronograph", qty: 2, price: 250, options: { Strap: "Leather" } },
    { name: "Travel Case", qty: 1, price: 80, options: {} },
  ],
};

const smtpBody = (to: string) => state.smtp.mock.calls.find((c) => c[1] === to)?.[3] as string;
const smtpSubject = (to: string) => state.smtp.mock.calls.find((c) => c[1] === to)?.[2] as string;

beforeEach(() => {
  state.smtp.mockReset().mockResolvedValue({ ok: true });
  state.rows = {
    orders: [structuredClone(order8)],
    store_settings: [{ id: 1, store_name: "Elegant Watch", support_email: "owner@example.test" }],
    email_settings: [{ id: 1, delivery_enabled: true, provider: "smtp", footer_text: "Elegant Watch · Karachi" }],
    notification_rules: [
      { event: "order_placed", is_enabled: true, template_key: "order_confirmation", smtp_profile: "orders" },
      { event: "order_placed_admin", is_enabled: true, template_key: "admin_new_order", smtp_profile: "orders" },
      { event: "cod_confirmation_needed", is_enabled: true, template_key: "cod_confirmation_needed", smtp_profile: "orders" },
    ],
    email_templates: [
      { key: "order_confirmation", is_enabled: true, ...ORDER_CONFIRMATION },
      { key: "admin_new_order", is_enabled: true, ...ADMIN_NEW_ORDER },
      { key: "cod_confirmation_needed", is_enabled: true, ...COD_CONFIRM },
    ],
    smtp_profiles: [{ purpose: "orders", is_enabled: true, last_test_ok: true }],
    email_logs: [],
  };
});

describe("renderer", () => {
  it("replaces every placeholder with order data", () => {
    const vars = { ...buildOrderVars(order8), store_name: "Elegant Watch", footer_text: "Footer line" };
    const out = renderEmailText(ORDER_CONFIRMATION.body, vars);
    expect(out).toContain("Hello Waseem Akhtar,");
    expect(out).toContain("order 8 at Elegant Watch");
    expect(out).toContain("• 2 × Heritage Chronograph (Strap: Leather) — $500.00");
    expect(out).toContain("• 1 × Travel Case — $80.00");
    expect(out).toContain("Total: $590.00");
    expect(out).toContain("Payment method: Cash on Delivery");
    expect(out).toContain("Footer line");
    expect(unresolvedPlaceholders(out)).toEqual([]);
  });

  it("tolerates spacing, casing, entities, invisible characters and tags inside placeholders", () => {
    const out = renderEmailText("{{ Customer_Name }}|&#123;&#123;order_total&#125;&#125;|{{\u200bpayment_method\u00a0}}|{{<b>items_list</b>}}", buildOrderVars(order8));
    expect(out).toBe("Waseem Akhtar|$590.00|Cash on Delivery|• 2 × Heritage Chronograph (Strap: Leather) — $500.00\n• 1 × Travel Case — $80.00");
  });

  it("uses safe fallbacks instead of exposing raw placeholders", () => {
    const out = renderEmailText("{{customer_name}} {{payment_method}} {{items_list}} {{footer_text}} {{cart_url}}", {});
    expect(out).toBe("Customer Not specified (no items)  ");
    expect(unresolvedPlaceholders(out)).toEqual([]);
  });

  it("never re-expands placeholders typed into customer data and strips subject line breaks", () => {
    const out = renderEmailText("{{customer_name}}", { customer_name: "{{order_total}}" });
    expect(out).toBe("{{order_total}}");
    expect(renderEmailText("Hi {{customer_name}}", { customer_name: "A\r\nBcc: x@y.z" }, { singleLine: true })).toBe("Hi A Bcc: x@y.z");
  });

  it("formats cart items for abandoned-cart reminders", () => {
    expect(formatItemsList([{ name: "Watch", qty: 3, price: 10 }], "EUR")).toBe("• 3 × Watch — €30.00");
  });
});

describe("delivered order emails", () => {
  it("customer confirmation contains real order data and no raw placeholders", async () => {
    await notifyOrderPlacedCore(supabaseAdmin, { orderId: order8.id, guestToken: "g8" });
    const body = smtpBody("buyer@example.test");
    expect(smtpSubject("buyer@example.test")).toBe("Your order 8 is confirmed");
    expect(body).toContain("Hello Waseem Akhtar,");
    expect(body).toContain("Total: $590.00");
    expect(body).toContain("Payment method: Cash on Delivery");
    expect(body).toContain("Heritage Chronograph");
    expect(body).toContain("Elegant Watch · Karachi");
    expect(body).not.toMatch(/\{\{/);
  });

  it("admin notification contains real order data and no raw placeholders", async () => {
    await notifyOrderPlacedCore(supabaseAdmin, { orderId: order8.id, guestToken: "g8" });
    expect(smtpSubject("owner@example.test")).toBe("New order 8 ($590.00)");
    const body = smtpBody("owner@example.test");
    expect(body).toContain("Customer: Waseem Akhtar (buyer@example.test)");
    expect(body).toContain("Payment: Cash on Delivery");
    expect(body).not.toMatch(/\{\{/);
  });

  it("COD confirmation renders from just an order id", async () => {
    await processSend(supabaseAdmin, { event: "cod_confirmation_needed", recipientEmail: "buyer@example.test", vars: { order_id: order8.id } });
    expect(smtpSubject("buyer@example.test")).toBe("Please confirm your COD order 8");
    expect(smtpBody("buyer@example.test")).toBe("Hello Waseem Akhtar,\n\nYour cash-on-delivery order 8 is waiting for confirmation.\n\nElegant Watch");
  });

  it("retrying a log whose payload holds only the order number still sends full order data", async () => {
    state.rows["email_logs"]!.push({ id: 1, event: "order_placed", recipient_email: "buyer@example.test", status: "failed", attempts: 1, payload: { order_number: "8" } });
    await processSend(supabaseAdmin, { event: "order_placed", recipientEmail: "buyer@example.test", vars: { order_number: "8" }, logId: 1 });
    const body = smtpBody("buyer@example.test");
    expect(body).toContain("Hello Waseem Akhtar,");
    expect(body).toContain("Total: $590.00");
    expect(body).toContain("Payment method: Cash on Delivery");
    expect(body).not.toMatch(/\{\{/);
    const log = state.rows["email_logs"]![0];
    expect(log.status).toBe("sent");
    expect(log.attempts).toBe(2);
    expect(log.payload.customer_name).toBe("Waseem Akhtar");
  });

  it("store name always comes from Store settings, and Stripe keeps its label", async () => {
    await processSend(supabaseAdmin, { event: "order_placed", recipientEmail: "buyer@example.test", vars: { order_id: order8.id, store_name: "Old Name", payment_method: "Stripe" } });
    const body = smtpBody("buyer@example.test");
    expect(body).toContain("at Elegant Watch.");
    expect(body).toContain("Payment method: Stripe");
  });
});
