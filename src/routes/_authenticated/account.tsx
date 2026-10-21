import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, productsQuery, settingsQuery } from "@/lib/store";
import { StoreLayout } from "@/components/store/StoreLayout";
import { ProductCard } from "@/components/store/ProductCard";
import { StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MfaSettings } from "@/components/MfaSettings";
import { AddressesTab } from "@/components/AddressesTab";
import { SupportTab } from "@/components/SupportTab";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "My account" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Account() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: s } = useQuery(settingsQuery);
  const { data: products = [] } = useQuery(productsQuery);
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: wish = [] } = useQuery({
    queryKey: ["wishlist", user.id],
    queryFn: async () => (await supabase.from("wishlists").select("product_id")).data?.map((w) => w.product_id) ?? [],
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  const wished = products.filter((p) => wish.includes(p.id) && p.status === "active");

  return (
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="eyebrow text-gold">My account</p><h1 className="mt-2 text-6xl">Hello</h1><p className="text-muted-foreground">{user.email}</p></div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </div>
        <Tabs defaultValue="orders" className="mt-10">
          <TabsList>
            <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
            <TabsTrigger value="wishlist">Wishlist ({wished.length})</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
          </TabsList>
          <TabsContent value="orders" className="mt-6">
            {orders.length === 0 ? (
              <div className="rounded border border-dashed py-20 text-center text-muted-foreground">No orders yet. <Link to="/{-$lang}/shop" params={{ lang: undefined }} className="text-gold">Start shopping</Link></div>
            ) : (
              <div className="divide-y rounded border bg-card">
                {orders.map((o) => (
                  <Link key={o.id} to="/order/$id" params={{ id: o.id }} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-muted">
                    <div><p className="font-medium">Order #{o.order_number}</p><p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {(o.items as unknown[]).length} items</p></div>
                    <div className="flex items-center gap-4"><StatusPill value={o.status} /><span>{money(o.total, o.currency)}</span></div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="wishlist" className="mt-6">
            {wished.length === 0 ? (
              <div className="rounded border border-dashed py-20 text-center text-muted-foreground">Your wishlist is empty. Tap the heart on any product to save it.</div>
            ) : (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{wished.map((p) => <ProductCard key={p.id} p={p} currency={s?.currency} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="addresses" className="mt-6">
            <AddressesTab userId={user.id} />
          </TabsContent>
          <TabsContent value="support" className="mt-6">
            <SupportTab userId={user.id} email={user.email ?? ""} />
          </TabsContent>
          <TabsContent value="security" className="mt-6">
            <MfaSettings />
          </TabsContent>
        </Tabs>
      </div>
    </StoreLayout>
  );
}
