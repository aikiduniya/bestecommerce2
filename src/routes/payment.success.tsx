import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { verifyStripeSession } from "@/lib/payments.functions";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/payment/success")({
  validateSearch: (s: Record<string, unknown>) => ({ session_id: typeof s["session_id"] === "string" ? s["session_id"] : "" }),
  head: () => ({
    meta: [
      { title: "Payment received" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Your card payment is being confirmed." },
      { property: "og:title", content: "Payment received" },
      { property: "og:description", content: "Your card payment is being confirmed." },
    ],
  }),
  component: Success,
});

function Success() {
  const { session_id } = Route.useSearch();
  const [state, setState] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [num, setNum] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!session_id) { setState("error"); return; }
    verifyStripeSession({ data: { sessionId: session_id } })
      .then((r) => { setNum(r.orderCode ?? (r.orderNumber ? `#${r.orderNumber}` : null)); setEmail(r.email); setState(r.paid ? "paid" : "pending"); })
      .catch(() => setState("error"));
  }, [session_id]);
  return (
    <StoreLayout>
      <div className="mx-auto max-w-xl px-6 py-28 text-center">
        {state === "loading" && <><Loader2 className="mx-auto size-10 animate-spin text-gold" /><h1 className="mt-6 text-4xl">Confirming your payment…</h1></>}
        {state === "paid" && <><CheckCircle2 className="mx-auto size-12 text-success" /><h1 className="mt-6 text-5xl">Thank you</h1><p className="mt-4 text-muted-foreground">Payment confirmed{num ? ` for order ${num}` : ""}. We'll start preparing it right away.</p></>}
        {state === "pending" && <><Loader2 className="mx-auto size-10 text-gold" /><h1 className="mt-6 text-4xl">Payment processing</h1><p className="mt-4 text-muted-foreground">Your bank is still confirming the payment{num ? ` for order ${num}` : ""}. Your order updates automatically once it's done.</p></>}
        {state === "error" && <><AlertCircle className="mx-auto size-10 text-destructive" /><h1 className="mt-6 text-4xl">We couldn't confirm this payment</h1><p className="mt-4 text-muted-foreground">If you were charged, your order will update automatically. Contact us if you need help.</p></>}
        {num && state !== "loading" && <p className="mt-6 font-display text-3xl">{num}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {num && email && state !== "loading" && <Button asChild variant="gold"><Link to="/{-$lang}/track" params={{ lang: undefined }} search={{ n: num, e: email }}>View order details</Link></Button>}
          <Button asChild variant="outline"><Link to="/">Continue shopping</Link></Button>
        </div>
      </div>
    </StoreLayout>
  );
}
