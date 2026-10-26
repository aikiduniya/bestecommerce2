import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({ search: {} as any, navigate: vi.fn(), rpc: vi.fn(), readCode: vi.fn(), notify: vi.fn(), verify: vi.fn(), clear: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: any) => ({ ...opts, useSearch: () => state.search }),
  Link: ({ children, search }: any) => <a href={search ? `/track?n=${search.n}&e=${search.e}` : "/"}>{children}</a>,
  notFound: vi.fn(), useNavigate: () => state.navigate,
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }), useQuery: (q: any) => ({ data:
  q.queryKey[0] === "settings" ? { currency: "USD", cod_enabled: true, cod_countries: [], cod_excluded_zones: [], cod_fee: 0 } :
  q.queryKey[0] === "zones" ? [{ id: "zone", name: "QA Shipping", countries: ["*"], is_active: true, rate: 0, free_over: null }] :
  q.queryKey[0] === "payment-options" ? { stripe: false } : [],
}) }));
vi.mock("@/lib/store", () => ({
  settingsQuery: { queryKey: ["settings"] }, zonesQuery: { queryKey: ["zones"] }, taxRatesQuery: { queryKey: ["tax"] },
  myAddressesQuery: () => ({ queryKey: ["addresses"] }), myLoyaltyQuery: () => ({ queryKey: ["loyalty"] }),
  taxPreview: () => ({ tax: 0, inclusive: false }), money: (n: any) => `$${n}`, optionLabel: () => "",
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: state.rpc } }));
vi.mock("@/lib/order-reference.functions", () => ({ getPlacedOrderCode: state.readCode }));
vi.mock("@/lib/payments.functions", () => ({ createStripeCheckout: vi.fn(), verifyStripeSession: state.verify }));
vi.mock("@/lib/email.functions", () => ({ notifyOrderPlaced: state.notify }));
vi.mock("@/lib/cart", () => ({ useCart: () => ({ items: [{ product_id: "qa-product", name: "QA Product", price: 20, qty: 1 }], subtotal: 20, clear: state.clear }) }));
vi.mock("@/lib/auth", () => ({ useSessionUser: () => ({ user: null, ready: true }) }));
vi.mock("@/lib/currency", () => ({ useDisplayCurrency: () => null }));
vi.mock("@/lib/i18n", () => ({ useLang: () => undefined, isValidLang: () => true }));
vi.mock("@/lib/analytics", () => ({ trackBeginCheckout: vi.fn(), trackPurchase: vi.fn() }));
vi.mock("@/components/store/StoreLayout", () => ({ StoreLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/store/ReturnRequestForm", () => ({ ReturnRequestForm: () => null }));
import { Route as CheckoutRoute } from "@/routes/{-$lang}/checkout";
import { Route as TrackRoute } from "@/routes/{-$lang}/track";
import { Route as SuccessRoute } from "@/routes/payment.success";
const order = { order_number: 15, order_code: "ELE-261026-9520", customer_name: "QA Customer", customer_email: "qa@example.test", items: [{ name: "QA Product", qty: 1, price: 20 }], status: "pending", payment_status: "pending", payment_method: "cod", total: 20, subtotal: 20, currency: "USD", created_at: "2026-10-26", shipping_total: 0 };
beforeEach(() => {
  cleanup(); vi.clearAllMocks(); state.search = {};
  state.readCode.mockResolvedValue({ orderCode: order.order_code }); state.notify.mockResolvedValue({ ok: true });
  state.rpc.mockImplementation(async (name: string) => ({ data: name === "place_order" ? { id: "qa-order", order_number: 15, guest_token: "disposable-token" } : order, error: null }));
});
describe("checkout to tracking using disposable transport doubles", () => {
  it("places COD with a legacy response, reads the code, redirects and automatically looks up the same order", async () => {
    const Checkout = CheckoutRoute.component as any;
    render(<Checkout />);
    const form = screen.getByRole("button", { name: "Place order" }).closest("form");
    if (!form) throw new Error("Missing checkout form");
    fireEvent.submit(form);
    await waitFor(() => expect(state.navigate).toHaveBeenCalled());
    expect(state.rpc).toHaveBeenCalledWith("place_order", expect.objectContaining({ _payment: "cod" }));
    expect(state.readCode).toHaveBeenCalledWith({ data: { orderId: "qa-order", guestToken: "disposable-token" } });
    const destination = state.navigate.mock.calls[0]?.[0];
    expect(destination.search.n).toBe("ELE-261026-9520");
    expect(state.notify).toHaveBeenCalledWith({ data: { orderId: "qa-order", guestToken: "disposable-token" } });
    cleanup(); state.search = { ...destination.search, e: "qa@example.test" };
    const Track = TrackRoute.component as any; render(<Track />);
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("track_guest_order_code", { _code: "ELE-261026-9520", _email: "qa@example.test" }));
    expect(screen.getByDisplayValue("ELE-261026-9520")).toBeTruthy();
    await screen.findByText(/Your order ELE-261026-9520 has been placed/);
  });
  it("manually entered public code looks up the order", async () => {
    const Track = TrackRoute.component as any; render(<Track />);
    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: order.order_code } });
    fireEvent.change(inputs[1], { target: { value: "qa@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Find my order" }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("track_guest_order_code", { _code: order.order_code, _email: "qa@example.test" }));
    await screen.findByText(order.order_code);
  });
  it("legacy numeric tracking still works and normalizes the input to the public code", async () => {
    state.search = { n: 15, e: "qa@example.test" };
    const Track = TrackRoute.component as any; render(<Track />);
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith("track_guest_order", { _order_number: 15, _email: "qa@example.test" }));
    await screen.findByDisplayValue(order.order_code);
  });
  it("card success displays and links the public code without enabling Stripe", async () => {
    state.search = { session_id: "cs_test_abc" };
    state.verify.mockResolvedValue({ paid: true, orderNumber: "15", orderCode: order.order_code, email: "qa@example.test" });
    const Success = SuccessRoute.component as any; render(<Success />);
    await screen.findByText(/Payment confirmed for order ELE-261026-9520/);
    expect(screen.getByRole("link", { name: "View order details" }).getAttribute("href")).toContain("n=ELE-261026-9520");
  });
});