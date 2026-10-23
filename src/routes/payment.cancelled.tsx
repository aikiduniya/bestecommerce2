import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CreditCard, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createStripeCheckout } from "@/lib/payments.functions";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/cancelled")({
  validateSearch: (s: Record<string, unknown>) => ({
    order: typeof s.order === "string" ? s.order : "",
    t: typeof s.t === "string" ? s.t : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment not completed" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Your card payment was not completed." },
      { property: "og:title", content: "Payment not completed" },
      { property: "og:description", content: "Your card payment was not completed." },
    ],
  }),
  component: Cancelled,
});

function Cancelled() {
  const { order, t } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      const r = await createStripeCheckout({ data: { orderId: order, guestToken: t, origin: window.location.origin } });
      window.location.href = r.url;
    } catch (e) { toast.error((e as Error).message); setBusy(false); }
  }
  return (
    <StoreLayout>
      <div className="mx-auto max-w-xl px-6 py-28 text-center">
        <XCircle className="mx-auto size-12 text-destructive" />
        <h1 className="mt-6 text-5xl">Payment not completed</h1>
        <p className="mt-4 text-muted-foreground">You weren't charged. Your items are held for a short time — try again to complete your order. Unpaid orders are cancelled automatically when the payment window expires.</p>
        <div className="mt-8 flex justify-center gap-3">
          {order && <Button onClick={retry} disabled={busy}><CreditCard className="mr-2 size-4" />{busy ? "Opening…" : "Try payment again"}</Button>}
          <Button variant="outline" asChild><Link to="/">Back to store</Link></Button>
        </div>
      </div>
    </StoreLayout>
  );
}
