import { SITE } from "@/lib/seo-head";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { cartSnapshotsQuery, money, settingsQuery } from "@/lib/store";
import { sendNotification } from "@/lib/email.functions";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/carts")({
  head: () => ({ meta: [{ title: "Abandoned Carts — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Carts,
});

type CartItem = { name: string; qty: number; price: number };

function Carts() {
  const { data: snaps = [] } = useQuery(cartSnapshotsQuery);
  const { data: s } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const [sending, setSending] = useState<string | null>(null);

  async function remind(id: string, email: string, items: CartItem[], subtotal: number) {
    setSending(id);
    try {
      await sendNotification({
        data: {
          event: "abandoned_cart",
          recipientEmail: email,
          vars: {
            customer_name: email.split("@")[0],
            store_name: s?.store_name ?? "our store",
            items_list: items.map((i) => `${i.qty} × ${i.name}`).join(", "),
            cart_total: money(subtotal, s?.currency),
            cart_url: (SITE || window.location.origin) + "/cart",
            footer_text: "",
          },
        },
      });
      toast.success(`Reminder logged for ${email} (delivery stays off until a provider is configured)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
    setSending(null);
  }

  const hours = (d: string) => Math.round((Date.now() - new Date(d).getTime()) / 36e5);

  return (
    <div>
      <PageHeader title="Abandoned carts" subtitle="Signed-in customers who started checkout but haven't ordered" />
      <div className="mt-6 overflow-x-auto rounded border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="p-3">Customer</th><th className="p-3">Items</th><th className="p-3">Value</th><th className="p-3">Idle</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {snaps.map((c) => {
              const items = (c.items as CartItem[]) ?? [];
              return (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="p-3">{c.email}</td>
                  <td className="p-3 text-muted-foreground">{items.map((i) => `${i.qty}× ${i.name}`).join(", ") || "—"}</td>
                  <td className="p-3 font-medium">{money(c.subtotal, s?.currency)}</td>
                  <td className="p-3"><StatusPill value={`${hours(c.updated_at)}h idle`} /></td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="outline" disabled={sending === c.id} onClick={() => remind(c.id, c.email, items, Number(c.subtotal))}>
                      {sending === c.id ? "Sending…" : "Send reminder"}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {snaps.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No abandoned carts right now.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
