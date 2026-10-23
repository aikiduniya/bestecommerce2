import { SITE } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, KeyRound, RefreshCw, ShieldCheck, Undo2, Webhook } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { recheckStripeOrder, refundStripePayment, savePaymentSettings, setStripeEnabled, testStripeConnection } from "@/lib/payments.functions";
import { money } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "Payments · Admin" }, { name: "robots", content: "noindex" }] }),
  component: Payments,
});

const METHODS = [
  ["card", "Cards"], ["link", "Link"], ["paypal", "PayPal"], ["klarna", "Klarna"], ["afterpay_clearpay", "Afterpay / Clearpay"],
  ["us_bank_account", "US bank account"], ["sepa_debit", "SEPA debit"], ["ideal", "iDEAL"], ["bancontact", "Bancontact"], ["alipay", "Alipay"], ["wechat_pay", "WeChat Pay"],
] as const;
const EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired", "payment_intent.payment_failed", "charge.refunded"];

function Payments() {
  const qc = useQueryClient();
  const { data: s, isLoading } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_settings")
        .select("stripe_enabled, stripe_mode, test_publishable_key, live_publishable_key, test_secret_set, live_secret_set, test_webhook_set, live_webhook_set, test_verified_at, live_verified_at, currencies, payment_methods")
        .eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });
  const save = useServerFn(savePaymentSettings);
  const test = useServerFn(testStripeConnection);
  const toggle = useServerFn(setStripeEnabled);
  const [f, setF] = useState({ mode: "test" as "test" | "live", tpk: "", lpk: "", tsk: "", lsk: "", twh: "", lwh: "", currencies: "", methods: ["card"] as string[] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (s) setF((x) => ({ ...x, mode: s.stripe_mode as "test" | "live", tpk: s.test_publishable_key ?? "", lpk: s.live_publishable_key ?? "", currencies: s.currencies.join(", "), methods: s.payment_methods }));
  }, [s]);
  const refresh = () => qc.invalidateQueries({ queryKey: ["payment-settings"] });

  async function onSave(clear: ("test_secret" | "live_secret" | "test_webhook" | "live_webhook")[] = []) {
    setBusy(true);
    try {
      await save({ data: {
        stripe_mode: f.mode, test_publishable_key: f.tpk, live_publishable_key: f.lpk,
        test_secret_key: f.tsk, live_secret_key: f.lsk, test_webhook_secret: f.twh, live_webhook_secret: f.lwh, clear,
        currencies: f.currencies.split(/[\s,]+/).filter(Boolean), payment_methods: f.methods as never,
      } });
      setF((x) => ({ ...x, tsk: "", lsk: "", twh: "", lwh: "" }));
      toast.success("Payment settings saved");
      refresh();
    } catch (e) { toast.error((e as Error).message.replace(/^\[.*?\]\s*/, "")); }
    setBusy(false);
  }
  async function onTest(mode: "test" | "live") {
    const r = await test({ data: { mode } });
    r.ok ? toast.success(`${mode === "live" ? "Live" : "Test"} key works`) : toast.error(r.error ?? "Connection failed");
    refresh();
  }
  async function onToggle(enabled: boolean) {
    try { await toggle({ data: { enabled } }); toast.success(enabled ? "Card payments enabled" : "Card payments disabled"); refresh(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const webhookUrl = typeof window !== "undefined" ? `${SITE || window.location.origin}/api/public/stripe-webhook` : "";
  const keyState = (set: boolean | null, verified: string | null) => !set ? <span className="text-muted-foreground">Not saved</span> : verified ? <span className="text-success">Saved · verified</span> : <span className="text-gold">Saved · not tested</span>;

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" subtitle="Stripe card payments. Cash on Delivery is managed separately in Settings." />
      <Tabs defaultValue="stripe">
        <TabsList><TabsTrigger value="stripe">Stripe</TabsTrigger><TabsTrigger value="orders">Card orders</TabsTrigger><TabsTrigger value="logs">Transaction log</TabsTrigger></TabsList>
        <TabsContent value="stripe" className="space-y-6">
          {isLoading || !s ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-5">
                <div className="flex items-center gap-3">
                  <CreditCard className="size-6 text-gold" />
                  <div>
                    <p className="font-medium">Card payments are {s.stripe_enabled ? <span className="text-success">ON</span> : <span className="text-destructive">OFF</span>} · {s.stripe_mode === "live" ? "Live mode" : "Test mode"}</p>
                    <p className="text-xs text-muted-foreground">Turning on requires the publishable key, secret key, webhook secret and a successful connection test for the active mode.</p>
                  </div>
                </div>
                <Switch checked={s.stripe_enabled} onCheckedChange={onToggle} aria-label="Enable Stripe payments" />
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-4">
                <Label className="text-sm font-medium">Mode</Label>
                <div className="flex gap-2">
                  {(["test", "live"] as const).map((m) => <Button key={m} type="button" variant={f.mode === m ? "default" : "outline"} onClick={() => setF({ ...f, mode: m })}>{m === "test" ? "Test mode" : "Live mode"}</Button>)}
                </div>
                <p className="text-xs text-muted-foreground">Switching mode turns card payments off until you re-enable them.</p>
              </div>

              {(["test", "live"] as const).map((m) => (
                <div key={m} className="rounded-lg border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg"><KeyRound className="size-4 text-gold" />{m === "test" ? "Test keys" : "Live keys"}</h3>
                    <Button type="button" size="sm" variant="outline" onClick={() => onTest(m)} disabled={!(m === "test" ? s.test_secret_set : s.live_secret_set)}><ShieldCheck className="mr-1 size-4" />Test connection</Button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-1.5"><Label className="text-xs">Publishable key</Label><Input value={m === "test" ? f.tpk : f.lpk} placeholder={`pk_${m}_...`} onChange={(e) => setF({ ...f, [m === "test" ? "tpk" : "lpk"]: e.target.value })} /></div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Secret key — {keyState(m === "test" ? s.test_secret_set : s.live_secret_set, m === "test" ? s.test_verified_at : s.live_verified_at)}</Label>
                      <Input type="password" autoComplete="off" value={m === "test" ? f.tsk : f.lsk} placeholder={(m === "test" ? s.test_secret_set : s.live_secret_set) ? "•••••••• (leave blank to keep)" : `sk_${m}_...`} onChange={(e) => setF({ ...f, [m === "test" ? "tsk" : "lsk"]: e.target.value })} />
                      {(m === "test" ? s.test_secret_set : s.live_secret_set) && <button type="button" className="text-xs text-destructive underline" onClick={() => onSave([`${m}_secret`])}>Remove saved key</button>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Webhook signing secret — {(m === "test" ? s.test_webhook_set : s.live_webhook_set) ? <span className="text-success">Saved</span> : <span className="text-muted-foreground">Not saved</span>}</Label>
                      <Input type="password" autoComplete="off" value={m === "test" ? f.twh : f.lwh} placeholder={(m === "test" ? s.test_webhook_set : s.live_webhook_set) ? "•••••••• (leave blank to keep)" : "whsec_..."} onChange={(e) => setF({ ...f, [m === "test" ? "twh" : "lwh"]: e.target.value })} />
                      {(m === "test" ? s.test_webhook_set : s.live_webhook_set) && <button type="button" className="text-xs text-destructive underline" onClick={() => onSave([`${m}_webhook`])}>Remove saved secret</button>}
                    </div>
                  </div>
                </div>
              ))}

              <div className="rounded-lg border bg-card p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Supported currencies (blank = store currency only)</Label>
                  <Input value={f.currencies} placeholder="USD, EUR, GBP" onChange={(e) => setF({ ...f, currencies: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label className="text-xs">Payment methods (must also be turned on in your Stripe account)</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {METHODS.map(([k, label]) => (
                      <label key={k} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-sm ${f.methods.includes(k) ? "border-gold bg-gold-soft/40" : ""}`}>
                        <input type="checkbox" checked={f.methods.includes(k)} onChange={(e) => setF({ ...f, methods: e.target.checked ? [...f.methods, k] : f.methods.filter((x) => x !== k) })} />{label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-5 space-y-2 text-sm">
                <h3 className="flex items-center gap-2 text-lg"><Webhook className="size-4 text-gold" />Webhook</h3>
                <p className="text-muted-foreground">In Stripe → Developers → Webhooks, add this endpoint and copy its signing secret above:</p>
                <code className="block break-all rounded bg-muted px-3 py-2 text-xs">{webhookUrl}</code>
                <p className="text-xs text-muted-foreground">Events: {EVENTS.join(", ")}</p>
              </div>

              <Button onClick={() => onSave()} disabled={busy}>{busy ? "Saving…" : "Save payment settings"}</Button>
              <p className="text-xs text-muted-foreground">Secret keys are encrypted on the server and never shown again or sent to shoppers' browsers.</p>
            </>
          )}
        </TabsContent>
        <TabsContent value="orders"><CardOrders /></TabsContent>
        <TabsContent value="logs"><TxLog /></TabsContent>
      </Tabs>
    </div>
  );
}

function CardOrders() {
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "failed" | "refunded">("all");
  const qc = useQueryClient();
  const refund = useServerFn(refundStripePayment);
  const recheck = useServerFn(recheckStripeOrder);
  const { data = [] } = useQuery({
    queryKey: ["card-orders", filter],
    queryFn: async () => {
      let q = supabase.from("orders").select("id, order_number, customer_name, total, refunded_total, currency, payment_status, status, created_at").eq("payment_method", "stripe").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("payment_status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
  async function doRefund(o: (typeof data)[number]) {
    const left = Number(o.total) - Number(o.refunded_total);
    const v = window.prompt(`Refund amount (max ${left})`, String(left));
    if (!v) return;
    try { await refund({ data: { orderId: o.id, amount: Number(v) } }); toast.success("Refund issued"); qc.invalidateQueries({ queryKey: ["card-orders"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  async function doRecheck(id: string) {
    try { const r = await recheck({ data: { orderId: id } }); r.paid ? toast.success(r.message) : toast.info(r.message); qc.invalidateQueries({ queryKey: ["card-orders"] }); }
    catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{(["all", "pending", "paid", "failed", "refunded"] as const).map((k) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{k.charAt(0).toUpperCase() + k.slice(1)}</Button>)}</div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No card orders yet.</td></tr>}
            {data.map((o) => (
              <tr key={o.id} className="border-b last:border-0">
                <td className="p-3">#{o.order_number}</td><td className="p-3">{o.customer_name}</td>
                <td className="p-3">{money(o.total, o.currency)}{Number(o.refunded_total) > 0 && <span className="block text-xs text-muted-foreground">Refunded {money(o.refunded_total, o.currency)}</span>}</td>
                <td className="p-3 capitalize">{o.payment_status}</td><td className="p-3 capitalize">{o.status}</td>
                <td className="p-3 text-right space-x-2">
                  {(o.payment_status === "pending" || o.payment_status === "failed") && <Button size="sm" variant="outline" onClick={() => doRecheck(o.id)}><RefreshCw className="mr-1 size-3" />Re-check</Button>}
                  {o.payment_status === "paid" && <Button size="sm" variant="outline" onClick={() => doRefund(o)}><Undo2 className="mr-1 size-3" />Refund</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TxLog() {
  const { data = [] } = useQuery({
    queryKey: ["payment-tx"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_transactions").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Type</th><th className="p-3">Status</th><th className="p-3">Amount</th><th className="p-3">Mode</th><th className="p-3">Details</th></tr></thead>
        <tbody>
          {data.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No transactions yet.</td></tr>}
          {data.map((t) => (
            <tr key={t.id} className="border-b last:border-0">
              <td className="p-3 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td><td className="p-3 capitalize">{t.kind}</td>
              <td className={`p-3 ${/fail|mismatch|needs/.test(t.status) ? "text-destructive" : ""}`}>{t.status}</td>
              <td className="p-3">{t.currency ? money(t.amount, t.currency) : "—"}</td><td className="p-3">{t.mode}</td>
              <td className="p-3 text-xs text-muted-foreground">{t.message}{t.stripe_refund_id ? ` · ${t.stripe_refund_id}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
