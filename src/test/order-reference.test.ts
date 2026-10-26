import { beforeEach, describe, expect, it, vi } from "vitest";
import { publicOrderCode } from "@/lib/order-reference";
import { buildOrderVars } from "@/lib/email-render";

const state = vi.hoisted(() => ({ order: null as any, header: undefined as string | undefined, user: null as any, filters: [] as unknown[], session: {} as any }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: (_value: any) => builder, inputValidator: (_value: any) => builder, handler: (fn: any) => fn };
  return builder;
} }));
vi.mock("@tanstack/react-start/server", () => ({ getRequestHeader: () => state.header }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  from: () => ({ select: () => ({ eq: (key: string, value: unknown) => { state.filters.push([key, value]); return { maybeSingle: async () => ({ data: state.order, error: null }) }; } }) }),
  auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
} }));
vi.mock("@/lib/stripe.server", () => ({ loadStripeConfig: async () => ({ secretKey: "isolated-test-double" }), stripeApi: async () => state.session, applyPaidSession: async () => ({ ok: true }) }));
import { getPlacedOrderCode } from "@/lib/order-reference.functions";
import { verifyStripeSession } from "@/lib/payments.functions";
const callCode = (data: any) => (getPlacedOrderCode as any)({ data });
beforeEach(() => {
  state.order = { order_code: "ELE-261026-9520", order_number: 15, guest_token: "disposable-token", user_id: null, customer_email: "qa@example.test" };
  state.header = undefined; state.user = null; state.filters = [];
  state.session = { id: "cs_test_abc", metadata: { order_number: "999" } };
});
describe("public order code data flow", () => {
  it("uses the stored code ELE-261026-9520, never internal number 15", () => {
    expect(publicOrderCode(state.order)).toBe("ELE-261026-9520");
    expect(buildOrderVars(state.order).order_number).toBe(publicOrderCode(state.order));
    expect(state.order.order_number).toBe(15);
  });
  it("does not fabricate a numeric public reference when a code is missing", () => {
    expect(publicOrderCode({ order_code: null })).toBeNull();
    expect(publicOrderCode({ order_code: " " })).toBeNull();
  });
  it("reads back a guest's generated code for legacy place_order responses", async () => {
    expect(await callCode({ orderId: "qa-order", guestToken: "disposable-token" })).toEqual({ orderCode: "ELE-261026-9520" });
    expect(state.filters).toEqual([["id", "qa-order"]]);
  });
  it("rejects an incorrect guest token", async () => {
    await expect(callCode({ orderId: "qa-order", guestToken: "wrong" })).rejects.toThrow("Order not found");
  });
  it("requires the authenticated owner for signed-in orders", async () => {
    state.order.user_id = "owner"; state.header = "Bearer disposable"; state.user = { id: "owner" };
    expect((await callCode({ orderId: "qa-order" })).orderCode).toBe("ELE-261026-9520");
    state.user = { id: "someone-else" };
    await expect(callCode({ orderId: "qa-order", guestToken: "disposable-token" })).rejects.toThrow("Order not found");
  });
  it("card success reads code from the linked session, not numeric metadata", async () => {
    const result = await (verifyStripeSession as any)({ data: { sessionId: "cs_test_abc" } });
    expect(result).toEqual({ paid: true, orderNumber: "15", orderCode: "ELE-261026-9520", email: "qa@example.test" });
    expect(state.filters).toEqual([["stripe_session_id", "cs_test_abc"]]);
  });
  it("does not expose references for an unlinked card session", async () => {
    state.order = null;
    expect(await (verifyStripeSession as any)({ data: { sessionId: "cs_test_abc" } })).toEqual({ paid: true, orderNumber: null, orderCode: null, email: null });
  });
});