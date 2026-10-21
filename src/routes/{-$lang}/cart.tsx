import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, X } from "lucide-react";
import { money, optionLabel, settingsQuery } from "@/lib/store";
import { useCart } from "@/lib/cart";
import { isValidLang, translate, useLang } from "@/lib/i18n";
import { StoreLayout } from "@/components/store/StoreLayout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/{-$lang}/cart")({
  beforeLoad: ({ params }) => { if (!isValidLang(params.lang)) throw notFound(); },
  head: () => ({
    meta: [
      { title: "Your cart" },
      { name: "description", content: "Review the items in your shopping cart." },
      { property: "og:title", content: "Your cart" },
      { property: "og:description", content: "Review the items in your shopping cart." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const { data: s } = useQuery(settingsQuery);
  const cur = s?.currency;
  const lang = useLang();
  const lp = { lang: lang ?? undefined };
  const t = (key: string) => translate(s?.translations, lang, key);
  return (
    <StoreLayout>
      <div className="mx-auto max-w-5xl px-6 py-14">
        <h1 className="text-6xl">{t("cart.title")}</h1>
        {cart.items.length === 0 ? (
          <div className="mt-12 rounded border border-dashed py-24 text-center">
            <p className="text-muted-foreground">{t("cart.empty")}</p>
            <Button className="mt-6" asChild><Link to="/{-$lang}/shop" params={lp}>{t("cart.continue")}</Link></Button>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 md:grid-cols-[1fr_320px]">
            <div className="divide-y border-y">
              {cart.items.map((i) => (
                <div key={i.product_id + (i.variant_id ?? "")} className="flex gap-4 py-5">
                  <div className="size-24 shrink-0 overflow-hidden rounded bg-secondary">{i.image && <img src={i.image} alt="" className="size-full object-cover" />}</div>
                  <div className="flex-1">
                    <Link to="/{-$lang}/product/$slug" params={{ ...lp, slug: i.slug }} className="font-display text-xl hover:text-gold">{i.name}</Link>
                    {i.options && <p className="text-xs text-muted-foreground">{optionLabel(i.options)}</p>}
                    <p className="mt-1 text-sm">{money(i.price, cur)}</p>
                    <div className="mt-3 inline-flex items-center rounded border">
                      <button className="p-2" onClick={() => cart.setQty(i.product_id, i.variant_id, i.qty - 1)} aria-label="Decrease"><Minus className="size-3" /></button>
                      <span className="w-8 text-center text-sm">{i.qty}</span>
                      <button className="p-2" onClick={() => cart.setQty(i.product_id, i.variant_id, i.qty + 1)} aria-label="Increase"><Plus className="size-3" /></button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => cart.remove(i.product_id, i.variant_id)} aria-label={t("cart.remove")}><X className="size-4 text-muted-foreground" /></button>
                    <p className="font-medium">{money(i.price * i.qty, cur)}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="h-fit rounded border bg-card p-6">
              <div className="flex justify-between text-sm"><span>{t("cart.subtotal")}</span><span>{money(cart.subtotal, cur)}</span></div>
              <p className="mt-2 text-xs text-muted-foreground">Shipping is calculated at checkout. Final prices are confirmed when you place your order.</p>
              <Button className="mt-6 w-full" size="lg" asChild><Link to="/{-$lang}/checkout" params={lp}>{t("cart.checkout")}</Link></Button>
              <Link to="/{-$lang}/shop" params={lp} className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground">{t("cart.continue")}</Link>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
