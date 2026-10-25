import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, myAddressesQuery, myLoyaltyQuery, optionLabel, settingsQuery, taxPreview, taxRatesQuery, zonesQuery } from "@/lib/store";
import { useCart } from "@/lib/cart";
import { trackBeginCheckout, trackPurchase } from "@/lib/analytics";
import { sendNotification } from "@/lib/email.functions";
import { createStripeCheckout } from "@/lib/payments.functions";
import { useDisplayCurrency } from "@/lib/currency";
import { isValidLang, useLang } from "@/lib/i18n";
import { useSessionUser } from "@/lib/auth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/{-$lang}/checkout")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Checkout" },
      { name: "description", content: "Complete your order securely." },
      { property: "og:title", content: "Checkout" },
      { property: "og:description", content: "Complete your order securely." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const lang = useLang();
  const cart = useCart();
  const { user, ready } = useSessionUser();
  const { data: s } = useQuery(settingsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: taxRates = [] } = useQuery(taxRatesQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", email: "", phone: "", line1: "", line2: "", city: "", state: "", postal: "", country: "", notes: "" });
  const [zoneId, setZoneId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; free_shipping: boolean } | null>(null);
  const [giftInput, setGiftInput] = useState("");
  const [gift, setGift] = useState<{ code: string; balance: number } | null>(null);
  const [pointsInput, setPointsInput] = useState("");
  const { data: loyaltyTx = [] } = useQuery({ ...myLoyaltyQuery(user?.id ?? ""), enabled: !!user && !!s?.loyalty_enabled });
  const pointsBalance = loyaltyTx.reduce((a, t) => a + t.points, 0);
  const [saveAddr, setSaveAddr] = useState(true);
  const { data: addresses = [] } = useQuery({ ...myAddressesQuery(user?.id ?? ""), enabled: !!user });
  const cur = s?.currency;
  const { data: payOpts } = useQuery({
    queryKey: ["payment-options"],
    queryFn: async () => { const { data } = await supabase.rpc("public_payment_options"); return (data ?? { stripe: false }) as { stripe: boolean }; },
  });
  const stripeOn = !!payOpts?.stripe;
  const codOn = !!s?.cod_enabled;
  const [payChoice, setPayChoice] = useState<"cod" | "stripe">("cod");
  const pay: "cod" | "stripe" | null = payChoice === "stripe" && stripeOn ? "stripe" : codOn ? "cod" : stripeOn ? "stripe" : null;
  const dc = useDisplayCurrency();

  useEffect(() => { if (user?.email) setF((x) => ({ ...x, email: x.email || user.email! })); }, [user]);

  const trackItems = cart.items.map((i) => ({ id: i.product_id, name: i.name, price: i.price, qty: i.qty, variant: i.options ? Object.values(i.options).join(" / ") : undefined }));
  const beganRef = useRef(false);
  useEffect(() => {
    if (!beganRef.current && cart.items.length > 0) {
      beganRef.current = true;
      trackBeginCheckout(trackItems, cart.subtotal, cur);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items.length > 0]);

  const country = f.country.trim().toUpperCase();
  const available = zones.filter((z) => z.is_active && (z.countries.length === 0 || z.countries.includes("*") || (country && z.countries.includes(country))));
  const zone = available.find((z) => z.id === zoneId) ?? available[0];
  const baseShipping = zone ? (zone.free_over !== null && cart.subtotal >= Number(zone.free_over) ? 0 : Number(zone.rate)) : 0;
  const shipping = coupon?.free_shipping ? 0 : baseShipping;
  const discount = coupon ? Math.min(coupon.discount, cart.subtotal) : 0;

  const { data: autoDisc } = useQuery({
    queryKey: ["auto-discount-preview", cart.subtotal, cart.items.map((i) => `${i.product_id}:${i.qty}`).join(",")],
    enabled: cart.items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("check_automatic_discount", {
        _items: cart.items.map((i) => ({ product_id: i.product_id, price: i.price, qty: i.qty })),
        _subtotal: cart.subtotal,
      });
      if (error) return null;
      return data as { name: string; discount: number } | null;
    },
  });
  const autoDiscount = autoDisc ? Math.min(Number(autoDisc.discount), cart.subtotal) : 0;

  async function applyCoupon() {
    if (!codeInput.trim()) return;
    const { data, error } = await supabase.rpc("check_coupon", { _code: codeInput, _subtotal: cart.subtotal });
    if (error) { setCoupon(null); toast.error(error.message); return; }
    const c = data as { code: string; discount: number; free_shipping: boolean };
    setCoupon({ code: c.code, discount: Number(c.discount), free_shipping: c.free_shipping });
    toast.success(`Coupon ${c.code} applied`);
  }
  // Re-check if cart changes after applying
  useEffect(() => { if (coupon) setCoupon(null); }, [cart.subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const codFee = pay === "cod" ? Number(s?.cod_fee ?? 0) : 0;
  const pointsToRedeem = s?.loyalty_enabled && user ? Math.min(Math.max(parseInt(pointsInput) || 0, 0), pointsBalance) : 0;
  const pointsValue = Math.round(pointsToRedeem * Number(s?.loyalty_redeem_value ?? 0) * 100) / 100;
  const merchandise = Math.max(cart.subtotal - autoDiscount - discount - pointsValue, 0);
  const taxInfo = taxPreview(s, taxRates, country, merchandise, shipping, codFee);
  const preGiftTotal = merchandise + shipping + codFee + (taxInfo.inclusive ? 0 : taxInfo.tax);
  const giftApplied = gift ? Math.min(gift.balance, preGiftTotal) : 0;
  const grandTotal = preGiftTotal - giftApplied;

  async function applyGiftCard() {
    if (!giftInput.trim()) return;
    const { data, error } = await supabase.rpc("check_gift_card", { _code: giftInput });
    if (error) { setGift(null); toast.error(error.message); return; }
    const g = data as { code: string; balance: number };
    setGift({ code: g.code, balance: Number(g.balance) });
    toast.success(`Gift card ${g.code} applied`);
  }

  // Capture the cart for abandoned-cart recovery (signed-in customers only).
  const snapRef = useRef("");
  useEffect(() => {
    if (!user?.email || cart.items.length === 0) return;
    const key = JSON.stringify(cart.items.map((i) => [i.product_id, i.qty]));
    if (snapRef.current === key) return;
    snapRef.current = key;
    void supabase.from("cart_snapshots").upsert({
      user_id: user.id, email: user.email,
      items: cart.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })),
      subtotal: cart.subtotal, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cart.items, cart.subtotal]);
  const codIssue = !s || pay !== "cod" ? null
    : s.cod_countries.length && country && !s.cod_countries.includes(country) ? `Cash on Delivery is not available in ${country}.`
    : zone && s.cod_excluded_zones.includes(zone.id) ? `Cash on Delivery is not available with ${zone.name}.`
    : s.cod_min_order !== null && cart.subtotal < Number(s.cod_min_order) ? `Cash on Delivery requires a minimum order of ${money(s.cod_min_order, cur)}.`
    : s.cod_max_order !== null && cart.subtotal > Number(s.cod_max_order) ? `Cash on Delivery is limited to orders up to ${money(s.cod_max_order, cur)}.`
    : null;

  async function place(e: React.FormEvent) {
    e.preventDefault();
    if (!zone) { toast.error("No shipping method available for this country"); return; }
    setPlacing(true);
    const { data, error } = await supabase.rpc("place_order", {
      _items: cart.items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, qty: i.qty })),
      _customer: { name: f.name, email: f.email, phone: f.phone },
      _address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, postal: f.postal, country },
      _zone_id: zone.id,
      _notes: f.notes,
      ...(coupon ? { _coupon: coupon.code } : {}),
      ...(gift ? { _gift_card: gift.code } : {}),
      ...(pointsToRedeem > 0 ? { _points: pointsToRedeem } : {}),
      _payment: pay ?? "cod",
    });
    if (error) { setPlacing(false); toast.error(error.message); return; }
    const res = data as { id: string; order_number: number; guest_token: string | null };
    if (pay === "stripe") {
      try {
        const r = await createStripeCheckout({ data: { orderId: res.id, guestToken: res.guest_token ?? undefined, origin: window.location.origin } });
        cart.clear();
        window.location.href = r.url;
      } catch (err) {
        setPlacing(false);
        toast.error(`${(err as Error).message}. Your order #${res.order_number} is saved — you can retry payment.`);
        navigate({ to: "/payment/cancelled", search: { order: res.id, t: res.guest_token ?? undefined } });
      }
      return;
    }
    setPlacing(false);
    if (user && saveAddr) {
      void supabase.from("addresses").insert({
        user_id: user.id, label: addresses.length ? `Address ${addresses.length + 1}` : "Home",
        line1: f.line1, line2: f.line2 || null, city: f.city, state: f.state || null, postal: f.postal || null,
        country, phone: f.phone || null, is_default: addresses.length === 0,
      }).then(() => qc.invalidateQueries({ queryKey: ["addresses", user.id] }));
    }
    trackPurchase(res.id, trackItems, grandTotal, cur);
    // Queue order emails (logged only until live delivery is enabled by the owner).
    // The server builds the email content from the stored order; guests use their order token.
    void notifyOrderPlaced({ data: { orderId: res.id, guestToken: res.guest_token ?? undefined } })
      .catch((err) => console.error("Order notification request failed", err));
    cart.clear();
    qc.invalidateQueries();
    if (user) {
      navigate({ to: "/order/$id", params: { id: res.id } });
    } else {
      navigate({ to: "/{-$lang}/track", params: { lang: lang ?? undefined }, search: { n: res.order_number, e: f.email, placed: 1 } });
    }
  }

  const field = (k: keyof typeof f, label: string, opts: { required?: boolean; type?: string; placeholder?: string } = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{opts.required && " *"}</Label>
      <Input type={opts.type ?? "text"} required={opts.required} placeholder={opts.placeholder} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  if (cart.items.length === 0) {
    return <StoreLayout><div className="py-32 text-center"><h1 className="text-5xl">Your cart is empty</h1><Button className="mt-6" asChild><Link to="/{-$lang}/shop" params={{ lang: lang ?? undefined }}>Shop now</Link></Button></div></StoreLayout>;
  }

  return (
    <StoreLayout>
      <form onSubmit={place} className="mx-auto grid max-w-6xl gap-12 px-6 py-14 md:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <h1 className="text-6xl">Checkout</h1>
          {ready && !user && (
            <p className="rounded border bg-card p-4 text-sm text-muted-foreground">
              Checking out as a guest — you can track your order with your order number and email.{" "}
              <Link to="/auth" search={{ next: "/checkout" }} className="text-gold underline">Sign in</Link> to keep your order history.
            </p>
          )}
          <section className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">Contact</h2>
            {field("name", "Full name", { required: true })}
            {field("email", "Email", { required: true, type: "email" })}
            {field("phone", "Phone", { type: "tel" })}
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">Shipping address</h2>
            {user && addresses.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Use a saved address</Label>
                <select
                  className="w-full rounded border bg-background px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const a = addresses.find((x) => x.id === e.target.value);
                    if (a) setF((x) => ({ ...x, line1: a.line1, line2: a.line2 ?? "", city: a.city, state: a.state ?? "", postal: a.postal ?? "", country: a.country, phone: x.phone || a.phone || "" }));
                  }}
                >
                  <option value="">Choose…</option>
                  {addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.line1}, {a.city}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">{field("line1", "Address", { required: true })}</div>
            <div className="sm:col-span-2">{field("line2", "Apartment, suite (optional)")}</div>
            {field("city", "City", { required: true })}
            {field("state", "State / Province")}
            {field("postal", "Postal code")}
            {field("country", "Country code", { required: true, placeholder: "e.g. US, GB, PK" })}
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl">Shipping method</h2>
            {available.length === 0 && <p className="text-sm text-destructive">No shipping method delivers to this country yet.</p>}
            {available.map((z) => (
              <label key={z.id} className={`flex cursor-pointer items-center justify-between rounded border p-4 ${zone?.id === z.id ? "border-gold bg-gold-soft/40" : ""}`}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="zone" checked={zone?.id === z.id} onChange={() => setZoneId(z.id)} />
                  <span><span className="block text-sm font-medium">{z.name}</span>{z.estimated_days && <span className="text-xs text-muted-foreground">{z.estimated_days}</span>}</span>
                </span>
                <span className="text-sm">{z.free_over !== null && cart.subtotal >= Number(z.free_over) ? "Free" : money(z.rate, cur)}</span>
              </label>
            ))}
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl">Payment</h2>
            {codOn && (
              <label className={`flex cursor-pointer items-center gap-3 rounded border p-4 text-sm ${pay === "cod" ? "border-gold bg-gold-soft/40" : ""}`}>
                <input type="radio" name="pay" checked={pay === "cod"} onChange={() => setPayChoice("cod")} /> <span><span className="block font-medium">Cash on Delivery</span><span className="text-xs text-muted-foreground">Pay in cash when your order arrives.</span></span>
              </label>
            )}
            {stripeOn && (
              <label className={`flex cursor-pointer items-center gap-3 rounded border p-4 text-sm ${pay === "stripe" ? "border-gold bg-gold-soft/40" : ""}`}>
                <input type="radio" name="pay" checked={pay === "stripe"} onChange={() => setPayChoice("stripe")} /> <span><span className="block font-medium">Credit / debit card</span><span className="text-xs text-muted-foreground">Pay securely on the next page. Your card details never touch our servers.</span></span>
              </label>
            )}
            {!codOn && !stripeOn && (
              <p className="text-sm text-destructive">No payment method is currently available. Please contact the store.</p>
            )}
          </section>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Order notes</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          {user && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="size-4 accent-[hsl(var(--gold))]" />
              Save this address to my account
            </label>
          )}
        </div>
        <aside className="h-fit rounded border bg-card p-6 md:sticky md:top-24">
          <h2 className="text-2xl">Summary</h2>
          <div className="mt-4 divide-y text-sm">
            {cart.items.map((i) => (
              <div key={i.product_id + (i.variant_id ?? "")} className="flex justify-between gap-3 py-3">
                <span>{i.name} × {i.qty}{i.options && <span className="block text-xs text-muted-foreground">{optionLabel(i.options)}</span>}</span>
                <span>{money(i.price * i.qty, cur)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 border-t pt-4">
            <Input placeholder="Coupon code" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())} />
            <Button type="button" variant="outline" onClick={applyCoupon}>Apply</Button>
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Gift card code" value={giftInput} onChange={(e) => setGiftInput(e.target.value.toUpperCase())} />
            <Button type="button" variant="outline" onClick={applyGiftCard}>Apply</Button>
          </div>
          {s?.loyalty_enabled && user && pointsBalance > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Input type="number" min={0} max={pointsBalance} placeholder={`Points (you have ${pointsBalance})`} value={pointsInput} onChange={(e) => setPointsInput(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => setPointsInput(String(pointsBalance))}>Use all</Button>
            </div>
          )}
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(cart.subtotal, cur)}</span></div>
            {autoDiscount > 0 && <div className="flex justify-between text-success"><span>Discount{autoDisc?.name ? ` (${autoDisc.name})` : ""}</span><span>−{money(autoDiscount, cur)}</span></div>}
            <div className="flex justify-between"><span>Shipping</span><span>{zone ? money(shipping, cur) : "—"}</span></div>
            {coupon && <div className="flex justify-between text-success"><span>Coupon {coupon.code} <button type="button" className="ml-1 text-xs underline" onClick={() => setCoupon(null)}>remove</button></span><span>{coupon.free_shipping ? "Free shipping" : `−${money(discount, cur)}`}</span></div>}
            {pointsToRedeem > 0 && <div className="flex justify-between text-success"><span>Points ({pointsToRedeem})</span><span>−{money(pointsValue, cur)}</span></div>}
            {gift && <div className="flex justify-between text-success"><span>Gift card {gift.code} <button type="button" className="ml-1 text-xs underline" onClick={() => setGift(null)}>remove</button></span><span>−{money(giftApplied, cur)}</span></div>}
            {codFee > 0 && <div className="flex justify-between"><span>Cash on Delivery fee</span><span>{money(codFee, cur)}</span></div>}
            {taxInfo.tax > 0 && !taxInfo.inclusive && <div className="flex justify-between"><span>{s?.tax_label ?? "Tax"}{taxInfo.name ? ` (${taxInfo.name})` : ""}</span><span>{money(taxInfo.tax, cur)}</span></div>}
            <div className="flex justify-between pt-2 font-display text-2xl"><span>Total</span><span>{money(grandTotal, cur)}</span></div>
            {taxInfo.tax > 0 && taxInfo.inclusive && <p className="text-xs text-muted-foreground">Includes {money(taxInfo.tax, cur)} {s?.tax_label ?? "tax"}.</p>}
            {codIssue && <p className="text-xs text-destructive">{codIssue}</p>}
          </div>
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={placing || !pay || !zone || !!codIssue}>
            {placing ? (pay === "stripe" ? "Redirecting to payment…" : "Placing order…") : pay === "stripe" ? "Continue to payment" : "Place order"}
          </Button>
          {dc && dc.code !== cur && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Prices are shown in {dc.code} for reference — your order is charged in {cur}.
            </p>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">Prices and stock are verified when you place the order.</p>
        </aside>
      </form>
    </StoreLayout>
  );
}
