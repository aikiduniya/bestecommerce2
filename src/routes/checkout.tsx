import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, optionLabel, settingsQuery, zonesQuery } from "@/lib/store";
import { useCart } from "@/lib/cart";
import { useSessionUser } from "@/lib/auth";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout" },
      { name: "description", content: "Complete your order securely." },
      { property: "og:title", content: "Checkout" },
      { property: "og:description", content: "Complete your order securely." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const cart = useCart();
  const { user, ready } = useSessionUser();
  const { data: s } = useQuery(settingsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", email: "", phone: "", line1: "", line2: "", city: "", state: "", postal: "", country: "", notes: "" });
  const [zoneId, setZoneId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; free_shipping: boolean } | null>(null);
  const cur = s?.currency;

  useEffect(() => { if (user?.email) setF((x) => ({ ...x, email: x.email || user.email! })); }, [user]);

  const country = f.country.trim().toUpperCase();
  const available = zones.filter((z) => z.is_active && (z.countries.length === 0 || z.countries.includes("*") || (country && z.countries.includes(country))));
  const zone = available.find((z) => z.id === zoneId) ?? available[0];
  const baseShipping = zone ? (zone.free_over !== null && cart.subtotal >= Number(zone.free_over) ? 0 : Number(zone.rate)) : 0;
  const shipping = coupon?.free_shipping ? 0 : baseShipping;
  const discount = coupon ? Math.min(coupon.discount, cart.subtotal) : 0;

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

  const codFee = Number(s?.cod_fee ?? 0);
  const codIssue = !s ? null
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
      _coupon: coupon?.code ?? undefined,
    });
    setPlacing(false);
    if (error) { toast.error(error.message); return; }
    const res = data as { id: string; order_number: number };
    cart.clear();
    qc.invalidateQueries();
    navigate({ to: "/order/$id", params: { id: res.id } });
  }

  const field = (k: keyof typeof f, label: string, opts: { required?: boolean; type?: string; placeholder?: string } = {}) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}{opts.required && " *"}</Label>
      <Input type={opts.type ?? "text"} required={opts.required} placeholder={opts.placeholder} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  if (cart.items.length === 0) {
    return <StoreLayout><div className="py-32 text-center"><h1 className="text-5xl">Your cart is empty</h1><Button className="mt-6" asChild><Link to="/shop">Shop now</Link></Button></div></StoreLayout>;
  }
  if (ready && !user) {
    return (
      <StoreLayout>
        <div className="mx-auto max-w-md py-32 text-center">
          <h1 className="text-5xl">Sign in to check out</h1>
          <p className="mt-3 text-muted-foreground">Your cart is saved. Create an account or sign in to place your order and track it later.</p>
          <Button className="mt-8" size="lg" asChild><Link to="/auth" search={{ next: "/checkout" }}>Sign in or create account</Link></Button>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <form onSubmit={place} className="mx-auto grid max-w-6xl gap-12 px-6 py-14 md:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <h1 className="text-6xl">Checkout</h1>
          <section className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">Contact</h2>
            {field("name", "Full name", { required: true })}
            {field("email", "Email", { required: true, type: "email" })}
            {field("phone", "Phone", { type: "tel" })}
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <h2 className="text-2xl sm:col-span-2">Shipping address</h2>
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
            {s?.cod_enabled ? (
              <label className="flex items-center gap-3 rounded border border-gold bg-gold-soft/40 p-4 text-sm">
                <input type="radio" checked readOnly /> <span><span className="block font-medium">Cash on Delivery</span><span className="text-xs text-muted-foreground">Pay in cash when your order arrives.</span></span>
              </label>
            ) : (
              <p className="text-sm text-destructive">No payment method is currently available. Please contact the store.</p>
            )}
          </section>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Order notes</Label>
            <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
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
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(cart.subtotal, cur)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{zone ? money(shipping, cur) : "—"}</span></div>
            {coupon && <div className="flex justify-between text-success"><span>Coupon {coupon.code} <button type="button" className="ml-1 text-xs underline" onClick={() => setCoupon(null)}>remove</button></span><span>{coupon.free_shipping ? "Free shipping" : `−${money(discount, cur)}`}</span></div>}
            {codFee > 0 && <div className="flex justify-between"><span>Cash on Delivery fee</span><span>{money(codFee, cur)}</span></div>}
            <div className="flex justify-between pt-2 font-display text-2xl"><span>Total</span><span>{money(cart.subtotal - discount + shipping + codFee, cur)}</span></div>
            {codIssue && <p className="text-xs text-destructive">{codIssue}</p>}
          </div>
          <Button type="submit" size="lg" className="mt-6 w-full" disabled={placing || !s?.cod_enabled || !zone || !!codIssue}>
            {placing ? "Placing order…" : "Place order"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">Prices and stock are verified when you place the order.</p>
        </aside>
      </form>
    </StoreLayout>
  );
}
