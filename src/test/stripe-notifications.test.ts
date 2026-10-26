import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: {} as Record<string, any[]>,
  smtp: vi.fn(), failLogReservation: false, failLogReservationOnce: false, failUpdate: false, cancelOnUpdate: false,
}));

// Stateful database double: filters are applied when awaited, including atomic updates.
// Concurrent confirmations therefore exercise the same compare-and-set contract as PostgreSQL.
class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: ((r: any) => boolean)[] = [];
  private operation = "select";
  private payload: any;
  private one = false;
  constructor(private table: string) {}
  select(_columns?: string) { return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
  in(k: string, v: unknown[]) { this.filters.push((r) => v.includes(r[k])); return this; }
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
      if (this.operation === "insert" && this.table === "email_logs" && (state.failLogReservation || state.failLogReservationOnce)) {
        state.failLogReservationOnce = false;
        return { data: null, error: { message: "offline" } };
      }
      // Mirror the real email_logs status CHECK constraint so an invalid status fails like production.
      const ALLOWED = ["queued_disabled", "sent", "failed", "retrying", "skipped_rule_disabled", "skipped_template_disabled"];
      if (this.table === "email_logs" && (this.operation === "insert" || this.operation === "update")) {
        const ps = Array.isArray(this.payload) ? this.payload : [this.payload];
        if (ps.some((p: any) => p.status !== undefined && !ALLOWED.includes(p.status))) return { data: null, error: { code: "23514", message: "email_logs_status_check" } };
      }
      if (this.operation === "update" && this.table === "orders" && state.failUpdate) return { data: null, error: { message: "offline" } };
      if (this.operation === "update" && this.table === "orders" && state.cancelOnUpdate && rows[0]) rows[0].status = "cancelled";
      let matches = rows.filter((r) => this.filters.every((f) => f(r)));
      if (this.operation === "update") matches.forEach((r) => Object.assign(r, this.payload));
      if (this.operation === "insert") {
        matches = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((p: any) => ({ id: rows.length + 1, ...p }));
        matches.forEach((r, i) => { r.id = rows.length + i + 1; });
        rows.push(...matches);
      }
      return { data: this.one ? structuredClone(matches[0] ?? null) : structuredClone(matches), error: null };
    }).then(onfulfilled, onrejected);
  }
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => new Query(table) } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/smtp.server", () => ({ decryptSecret: vi.fn(), smtpSend: state.smtp }));

import { applyPaidSession } from "@/lib/stripe.server";
import { processSend } from "@/lib/email-pipeline.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const session = {
  id: "cs_test_paid", payment_status: "paid", status: "complete", amount_total: 12000,
  currency: "usd", payment_intent: "pi_test", metadata: { order_id: "qa-order" },
};
const tableRows = (table: string): any[] => {
  const rows = state.rows[table];
  if (!rows) throw new Error(`Missing test table ${table}`);
  return rows;
};
const order = (): any => tableRows("orders")[0];
const logs = (): any[] => tableRows("email_logs");

beforeEach(() => {
  state.failLogReservation = false; state.failLogReservationOnce = false; state.failUpdate = false; state.cancelOnUpdate = false;
  state.smtp.mockReset().mockResolvedValue({ ok: true });
  state.rows = {
    orders: [{ id: "qa-order", customer_name: "QA Customer", customer_email: "customer@example.test",
      order_number: 42, total: 120, currency: "USD", payment_method: "stripe", payment_status: "pending",
      status: "pending", stripe_session_id: session.id, items: [{ name: "QA Item", qty: 2, price: 60 }] }],
    store_settings: [{ id: 1, store_name: "QA Store", support_email: "support@example.test" }],
    email_settings: [{ id: 1, delivery_enabled: true, provider: "smtp" }],
    notification_rules: ["order_placed", "order_placed_admin"].map((event) => ({ event, is_enabled: true, template_key: event, smtp_profile: "orders" })),
    email_templates: ["order_placed", "order_placed_admin"].map((key) => ({ key, is_enabled: true, subject: "Order #{{order_number}} — {{store_name}}", body: "{{customer_name}} {{customer_email}} {{order_total}} {{currency}} {{payment_method}} {{items_list}}" })),
    smtp_profiles: [{ purpose: "orders", is_enabled: true, last_test_ok: true }],
    email_logs: [], payment_transactions: [],
  };
});

describe("confirmed Stripe payment notification flow (isolated transports)", () => {
  it("marks paid, sends both existing rules through SMTP and records both completed delivery logs", async () => {
    expect((await applyPaidSession(session, "test", "evt_1")).ok).toBe(true);
    expect(order().payment_status).toBe("paid");
    expect(state.smtp).toHaveBeenCalledTimes(2);
    expect(logs().map((l) => [l.event, l.recipient_email, l.status, l.attempts, l.smtp_profile])).toEqual([
      ["order_placed", "customer@example.test", "sent", 1, "orders"],
      ["order_placed_admin", "support@example.test", "sent", 1, "orders"],
    ]);
    expect(state.smtp.mock.calls[0]?.slice(1)).toEqual([
      "customer@example.test", "Order #42 — QA Store", "QA Customer customer@example.test $120.00 USD Stripe • 2 × QA Item — $120.00",
    ]);
    expect(logs()[0].payload).toMatchObject({ order_id: "qa-order", total: "120", currency: "USD", payment_method: "Stripe" });
  });
  it("does not resend when a webhook is replayed or the success handler runs again", async () => {
    await applyPaidSession(session, "test", "evt_1");
    await applyPaidSession(session, "test", "evt_2");
    await applyPaidSession(session, "test");
    expect(logs()).toHaveLength(2); expect(state.smtp).toHaveBeenCalledTimes(2);
  });
  it("allows only one notification pair when webhook and success handler race", async () => {
    await Promise.all([applyPaidSession(session, "test", "evt_1"), applyPaidSession(session, "test")]);
    expect(logs()).toHaveLength(2); expect(state.smtp).toHaveBeenCalledTimes(2);
  });
  it.each(["unpaid", "pending", "failed"])("does not confirm or notify a %s Stripe session", async (payment_status) => {
    expect((await applyPaidSession({ ...session, payment_status }, "test")).ok).toBe(false);
    expect(order().payment_status).toBe("pending"); expect(logs()).toHaveLength(0);
  });
  it("does not notify a cancelled order even when Stripe reports paid", async () => {
    order().status = "cancelled";
    expect((await applyPaidSession(session, "test")).ok).toBe(false);
    expect(logs()).toHaveLength(0); expect(state.smtp).not.toHaveBeenCalled();
  });
  it("does not notify if cancellation wins a race with the paid update", async () => {
    state.cancelOnUpdate = true;
    expect((await applyPaidSession(session, "test")).ok).toBe(false);
    expect(order().payment_status).toBe("pending"); expect(logs()).toHaveLength(0);
  });
  it.each([{ amount_total: 11999 }, { currency: "eur" }, { id: "cs_test_other" }])("rejects a session that does not match the stored order: %j", async (change) => {
    expect((await applyPaidSession({ ...session, ...change }, "test")).ok).toBe(false);
    expect(logs()).toHaveLength(0);
  });
  it("keeps payment successful and both logs present when SMTP fails", async () => {
    state.smtp.mockResolvedValue({ ok: false, error: "QA SMTP unavailable" });
    expect((await applyPaidSession(session, "test")).ok).toBe(true);
    expect(order().payment_status).toBe("paid");
    expect(logs().map((l) => l.status)).toEqual(["failed", "failed"]);
    await applyPaidSession(session, "test"); expect(state.smtp).toHaveBeenCalledTimes(2);
  });
  it("still sends the admin email if the customer delivery unexpectedly throws", async () => {
    state.smtp.mockImplementation(async (_p, to) => { if (to === "customer@example.test") throw new Error("QA transport failure"); return { ok: true }; });
    expect((await applyPaidSession(session, "test")).ok).toBe(true);
    expect(logs().map((l) => l.status)).toEqual(["failed", "sent"]);
  });
  it("does not undo payment or send unlogged messages if log reservation fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    state.failLogReservation = true;
    expect((await applyPaidSession(session, "test")).ok).toBe(true);
    expect(order().payment_status).toBe("paid"); expect(state.smtp).not.toHaveBeenCalled();
    error.mockRestore();
  });
  it("leaves a visible, retryable failed log when only the reservation insert fails", async () => {
    state.failLogReservationOnce = true;
    expect((await applyPaidSession(session, "test")).ok).toBe(true);
    expect(order().payment_status).toBe("paid");
    expect(logs()).toHaveLength(1);
    expect(logs()[0]).toMatchObject({ event: "order_placed", status: "failed", recipient_email: "customer@example.test" });
    expect(state.smtp).not.toHaveBeenCalled();
  });
  it("records a visible skipped log when a fresh send hits a disabled rule", async () => {
    tableRows("notification_rules")[0].is_enabled = false;
    const r = await processSend(supabaseAdmin, { event: "order_placed", recipientEmail: "customer@example.test", vars: {} });
    expect(r.status).toBe("skipped_rule_disabled");
    expect(logs()).toHaveLength(1);
    expect(logs()[0]).toMatchObject({ event: "order_placed", status: "skipped_rule_disabled" });
  });
  it("fails loudly when live delivery is on but no tested profile or provider exists", async () => {
    tableRows("smtp_profiles")[0].is_enabled = false;
    tableRows("email_settings")[0].provider = "none";
    const r = await processSend(supabaseAdmin, { event: "order_placed", recipientEmail: "customer@example.test", vars: {} });
    expect(r.status).toBe("failed");
    expect(logs()[0].error).toContain("not enabled and tested");
    expect(state.smtp).not.toHaveBeenCalled();
  });
  it("does not send before the paid database update succeeds", async () => {
    state.failUpdate = true;
    await expect(applyPaidSession(session, "test")).rejects.toThrow("Could not confirm order payment");
    expect(state.smtp).not.toHaveBeenCalled(); expect(logs()).toHaveLength(0);
  });
  it("honors the live-delivery switch and records disabled attempts", async () => {
    tableRows("email_settings")[0].delivery_enabled = false;
    await applyPaidSession(session, "test");
    expect(logs().map((l) => l.status)).toEqual(["queued_disabled", "queued_disabled"]);
    expect(state.smtp).not.toHaveBeenCalled();
  });
  it("honors disabled rules/templates with visible skipped logs", async () => {
    tableRows("notification_rules")[0].is_enabled = false;
    tableRows("email_templates")[1].is_enabled = false;
    await applyPaidSession(session, "test");
    expect(logs().map((l) => l.status)).toEqual(["skipped_rule_disabled", "skipped_template_disabled"]);
    expect(state.smtp).not.toHaveBeenCalled();
  });
  it("records missing support recipient without blocking customer confirmation", async () => {
    tableRows("store_settings")[0].support_email = "";
    await applyPaidSession(session, "test");
    expect(logs().map((l) => l.status)).toEqual(["sent", "failed"]);
    expect(state.smtp).toHaveBeenCalledTimes(1);
  });
  it("leaves COD dispatch through the existing pipeline unchanged", async () => {
    await processSend(supabaseAdmin, { event: "order_placed", recipientEmail: "customer@example.test", vars: { payment_method: "Cash on Delivery" } });
    expect(logs()).toHaveLength(1); expect(logs()[0].status).toBe("sent");
    expect(logs()[0].payload).toMatchObject({ payment_method: "Cash on Delivery" });
  });
});