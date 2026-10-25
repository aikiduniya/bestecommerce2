import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  insertError: null as { code?: string; message: string } | null,
  deleted: [] as string[],
  applyPaidSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async () => ({ error: table === "stripe_events" ? state.insertError : null }),
      delete: () => ({ eq: async (_k: string, v: string) => { state.deleted.push(v); return { error: null }; } }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}));
vi.mock("@/lib/stripe.server", () => ({
  webhookSecrets: async () => [{ mode: "test", secret: "whsec_test" }],
  verifyStripeSignature: async () => true,
  applyPaidSession: state.applyPaidSession,
  fromMinor: (n: number) => n / 100,
}));

import { Route } from "@/routes/api/public/stripe-webhook";

const POST = (Route.options.server?.handlers as Record<string, (ctx: { request: Request }) => Promise<Response>>)["POST"]!;
const event = { id: "evt_1", type: "checkout.session.completed", livemode: false, data: { object: { id: "cs_test_1", metadata: { order_id: "o1" } } } };
const call = () => POST({ request: new Request("http://x/api/public/stripe-webhook", { method: "POST", body: JSON.stringify(event), headers: { "stripe-signature": "t=1,v1=x" } }) });

beforeEach(() => {
  state.insertError = null;
  state.deleted = [];
  state.applyPaidSession.mockReset().mockResolvedValue({ ok: true });
});

describe("stripe webhook idempotency classification", () => {
  it("treats a unique-violation as a genuine duplicate (200, no reprocessing)", async () => {
    state.insertError = { code: "23505", message: "duplicate key" };
    const res = await call();
    expect(res.status).toBe(200);
    expect(state.applyPaidSession).not.toHaveBeenCalled();
  });
  it("returns a retryable 500 when the event record fails for any other reason", async () => {
    state.insertError = { code: "42501", message: "permission denied" };
    const res = await call();
    expect(res.status).toBe(500);
    expect(state.applyPaidSession).not.toHaveBeenCalled();
  });
  it("returns 500 and frees the event for retry when processing throws", async () => {
    state.applyPaidSession.mockRejectedValue(new Error("database offline"));
    const res = await call();
    expect(res.status).toBe(500);
    expect(state.deleted).toEqual(["evt_1"]);
  });
  it("processes a fresh event and answers 200", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(state.applyPaidSession).toHaveBeenCalledTimes(1);
  });
});
