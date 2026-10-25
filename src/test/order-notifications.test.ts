import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: {} as Record<string, any[]>, smtp: vi.fn() }));

// Stateful database double with the filter/limit surface notifyOrderPlacedCore uses.
class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: ((r: any) => boolean)[] = [];
  private operation = "select";
  private payload: any;
  private one = false;
  private max: number | null = null;
  constructor(private table: string) {}
  select(_c?: string) { return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
  in(k: string, v: unknown[]) { this.filters.push((r) => v.includes(r[k])); return this; }
  filter(k: string, op: string, v: unknown) {
    if (op === "eq" && k.includes("->>")) {
      const path = k.split("->>").map((s) => s.replace(/[">]/g, "")).filter(Boolean);
      this.filters.push((r) => path.reduce((acc, p) => acc?.[p], r) === v);
    }
    return this;
  }
  limit(n: number) { this.max = n; return this; }
  update(p: any) { this.operation = "update"; this.payload = p; return this; }
  insert(p: any) { this.operation = "insert"; this.payload = p; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((v: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((e: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => {
      const rows: any[] = state.rows[this.table] ?? [];
      let matches = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.operation === "update") matches.forEach((r) => Object.assign(r, this.payload));
      if (this.operation === "insert") {
        matches = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: any, i: number) => ({ id: rows.length + i + 1, ...p }));
        rows.push(...matches);
      }
      if (this.max !== null) matches = matches.slice(0, this.max);
      return { data: this.one ? structuredClone(matches[0] ?? null) : structuredClone(matches), error: null };
    }).then(onfulfilled, onrejected);
  }
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (t: string) => new Query(t) } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/smtp.server", () => ({ decryptSecret: vi.fn(), smtpSend: state.smtp }));

import { notifyOrderPlacedCore } from "@/lib/order-notifications.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const codOrder = {
  id: "cod-order", user_id: null, guest_token: "gtok", payment_method: "cod",
  customer_name: "Guest Buyer", customer_email: "guest@example.test",
  order_number: 77, total: 50, currency: "USD", items: [{ name: "Watch", qty: 1 }],
};

beforeEach(() => {
  state.smtp.mockReset().mockResolvedValue({ ok: true });
  state.rows = {
    orders: [structuredClone(codOrder)],
    store_settings: [{ id: 1, store_name: "QA Store", support_email: "support@example.test" }],
    email_settings: [{ id: 1, delivery_enabled: true, provider: "smtp" }],
    notification_rules: ["order_placed", "order_placed_admin"].map((event) => ({ event, is_enabled: true, template_key: event, smtp_profile: "orders" })),
    email_templates: ["order_placed", "order_placed_admin"].map((key) => ({ key, is_enabled: true, subject: "Order #{{order_number}}", body: "{{payment_method}} {{order_total}}" })),
    smtp_profiles: [{ purpose: "orders", is_enabled: true, last_test_ok: true }],
    email_logs: [],
  };
});
const logs = (): any[] => state.rows["email_logs"];

describe("COD order-placed notifications (guest-capable)", () => {
  it("sends customer and admin notifications for a guest with the order token", async () => {
    const r = await notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", guestToken: "gtok" });
    expect(r.status).toBe("ok");
    expect(logs().map((l) => [l.event, l.recipient_email, l.status])).toEqual([
      ["order_placed", "guest@example.test", "sent"],
      ["order_placed_admin", "support@example.test", "sent"],
    ]);
    expect(state.smtp).toHaveBeenCalledTimes(2);
    expect(state.smtp.mock.calls[0]?.[3]).toBe("Cash on Delivery $50.00");
  });
  it("rejects a guest without the matching token", async () => {
    await expect(notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", guestToken: "wrong" })).rejects.toThrow("Order not found");
    expect(logs()).toHaveLength(0);
  });
  it("allows the signed-in owner without a token", async () => {
    state.rows["orders"][0].user_id = "user-1";
    const r = await notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", userId: "user-1" });
    expect(r.status).toBe("ok");
    expect(logs()).toHaveLength(2);
  });
  it("rejects a different signed-in user", async () => {
    state.rows["orders"][0].user_id = "user-1";
    await expect(notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", userId: "user-2" })).rejects.toThrow("Order not found");
  });
  it("never notifies for a card order (Stripe notifies on payment confirmation)", async () => {
    state.rows["orders"][0].payment_method = "stripe";
    const r = await notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", guestToken: "gtok" });
    expect(r.status).toBe("skipped_card_order");
    expect(logs()).toHaveLength(0);
  });
  it("does not resend when called again for the same order", async () => {
    await notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", guestToken: "gtok" });
    const r = await notifyOrderPlacedCore(supabaseAdmin, { orderId: "cod-order", guestToken: "gtok" });
    expect(r.status).toBe("already_notified");
    expect(logs()).toHaveLength(2);
    expect(state.smtp).toHaveBeenCalledTimes(2);
  });
});
