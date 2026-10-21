import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Loader2, Package, Search, ShoppingBag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Hit = { kind: "product" | "order" | "customer"; label: string; sub: string; to: string };

function useGlobalSearch(q: string, open: boolean) {
  return useQuery({
    queryKey: ["admin-search", q],
    enabled: open && q.trim().length >= 2,
    queryFn: async (): Promise<Hit[]> => {
      const like = `%${q.trim()}%`;
      const num = /^\d+$/.test(q.trim()) ? Number(q.trim()) : null;
      const [p, o] = await Promise.all([
        supabase.from("products").select("id, name, sku, status").or(`name.ilike.${like},sku.ilike.${like}`).limit(6),
        supabase.from("orders").select("id, order_number, customer_name, customer_email, total").or(`customer_name.ilike.${like},customer_email.ilike.${like}${num !== null ? `,order_number.eq.${num}` : ""}`).limit(8),
      ]);
      const orders = o.data ?? [];
      const seen = new Set<string>();
      const customers = orders.filter((x) => { const k = x.customer_email.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
      return [
        ...(p.data ?? []).map((x): Hit => ({ kind: "product", label: x.name, sub: `${x.sku ?? "No SKU"} · ${x.status}`, to: "/admin/products" })),
        ...orders.map((x): Hit => ({ kind: "order", label: `Order #${x.order_number} — ${x.customer_name}`, sub: x.customer_email, to: "/admin/orders" })),
        ...customers.map((x): Hit => ({ kind: "customer", label: x.customer_name, sub: x.customer_email, to: "/admin/customers" })),
      ];
    },
    staleTime: 10_000,
  });
}

function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: hits = [], isFetching } = useGlobalSearch(q, open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); else setQ(""); }, [open]);

  const icon = { product: Package, order: ShoppingBag, customer: Users } as const;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 w-56 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:border-gold/50"
      >
        <Search className="size-4" /> Search… <kbd className="ml-auto rounded border px-1 text-[10px]">⌘K</kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-24 max-w-lg translate-y-0 p-0">
          <div className="flex items-center gap-2 border-b px-4">
            {isFetching ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Search className="size-4 text-muted-foreground" />}
            <Input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products, orders, customers…"
              className="h-12 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {q.trim().length >= 2 && hits.length === 0 && !isFetching && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches for “{q}”.</p>
            )}
            {hits.map((h, i) => {
              const Icon = icon[h.kind];
              return (
                <button
                  key={i}
                  onClick={() => { setOpen(false); navigate({ to: h.to }); }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{h.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">{h.kind}</span>
                </button>
              );
            })}
            {q.trim().length < 2 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Type at least 2 characters.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Notifications({ isAdmin, perms }: { isAdmin: boolean; perms: string[] }) {
  const { data: s } = useQuery(settingsQuery);
  const can = (p: string) => isAdmin || perms.includes(p);
  const { data } = useQuery({
    queryKey: ["admin-notifications"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
      const lowStockCount = async () => {
        const { data } = await supabase.from("products").select("stock, low_stock_threshold").eq("status", "active").gt("stock", 0);
        return (data ?? []).filter((p) => p.stock <= p.low_stock_threshold).length;
      };
      const [reviews, questions, lowStock, unconfirmedCod] = await Promise.all([
        can("content") ? count(supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending")) : 0,
        can("content") ? count(supabase.from("product_questions").select("id", { count: "exact", head: true }).eq("status", "pending")) : 0,
        can("catalog") ? lowStockCount() : 0,
        can("orders") ? count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_method", "cod").is("cod_confirmed_at", null).neq("status", "cancelled")) : 0,
      ]);
      const items = [
        reviews > 0 && { label: `${reviews} review${reviews > 1 ? "s" : ""} awaiting moderation`, to: "/admin/reviews" },
        questions > 0 && { label: `${questions} customer question${questions > 1 ? "s" : ""} to answer`, to: "/admin/reviews" },
        lowStock > 0 && { label: `${lowStock} product${lowStock > 1 ? "s" : ""} low on stock`, to: "/admin/products" },
        unconfirmedCod > 0 && { label: `${unconfirmedCod} COD order${unconfirmedCod > 1 ? "s" : ""} to confirm`, to: "/admin/orders" },
      ].filter(Boolean) as { label: string; to: string }[];
      return items;
    },
  });
  const items = data ?? [];
  const total = items.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-4" />
          {total > 0 && <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-semibold text-gold-foreground">{total}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="eyebrow px-2 pb-2">Needs attention</p>
        {items.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">All caught up.</p>}
        {items.map((n) => (
          <a key={n.label} href={n.to} className="block rounded-md px-3 py-2 text-sm hover:bg-muted">{n.label}</a>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AdminTopbar({ isAdmin, perms }: { isAdmin: boolean; perms: string[] }) {
  return (
    <div className="sticky top-0 z-10 hidden items-center justify-end gap-2 border-b bg-background/80 px-6 py-2.5 backdrop-blur md:flex">
      <GlobalSearch />
      <Notifications isAdmin={isAdmin} perms={perms} />
    </div>
  );
}
