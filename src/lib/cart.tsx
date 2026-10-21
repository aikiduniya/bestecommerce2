import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  product_id: string;
  variant_id: string | null;
  qty: number;
  name: string;
  slug: string;
  price: number;
  image?: string | null;
  options?: Record<string, string>;
};

type Ctx = {
  items: CartItem[];
  saved: CartItem[];
  count: number;
  subtotal: number;
  add: (item: CartItem) => void;
  setQty: (product_id: string, variant_id: string | null, qty: number) => void;
  remove: (product_id: string, variant_id: string | null) => void;
  clear: () => void;
  saveForLater: (product_id: string, variant_id: string | null) => void;
  moveToCart: (product_id: string, variant_id: string | null) => void;
  removeSaved: (product_id: string, variant_id: string | null) => void;
};

const CartContext = createContext<Ctx | null>(null);
const KEY = "store_cart_v1";
const SAVED_KEY = "store_saved_v1";
const same = (a: CartItem, p: string, v: string | null) => a.product_id === p && (a.variant_id ?? null) === (v ?? null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [saved, setSaved] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
      setSaved(JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]"));
    } catch {
      setItems([]);
      setSaved([]);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);
  useEffect(() => {
    if (ready) localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
  }, [saved, ready]);

  const value: Ctx = {
    items,
    saved,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.qty * i.price, 0),
    add: (item) =>
      setItems((cur) => {
        const ex = cur.find((c) => same(c, item.product_id, item.variant_id));
        if (ex) return cur.map((c) => (c === ex ? { ...c, qty: Math.min(100, c.qty + item.qty) } : c));
        return [...cur, item];
      }),
    setQty: (p, v, qty) =>
      setItems((cur) => (qty < 1 ? cur.filter((c) => !same(c, p, v)) : cur.map((c) => (same(c, p, v) ? { ...c, qty: Math.min(100, qty) } : c)))),
    remove: (p, v) => setItems((cur) => cur.filter((c) => !same(c, p, v))),
    clear: () => setItems([]),
    saveForLater: (p, v) => {
      const item = items.find((c) => same(c, p, v));
      if (!item) return;
      setItems((cur) => cur.filter((c) => !same(c, p, v)));
      setSaved((cur) => (cur.some((c) => same(c, p, v)) ? cur : [...cur, item]));
    },
    moveToCart: (p, v) => {
      const item = saved.find((c) => same(c, p, v));
      if (!item) return;
      setSaved((cur) => cur.filter((c) => !same(c, p, v)));
      setItems((cur) => {
        const ex = cur.find((c) => same(c, p, v));
        if (ex) return cur.map((c) => (c === ex ? { ...c, qty: Math.min(100, c.qty + item.qty) } : c));
        return [...cur, item];
      });
    },
    removeSaved: (p, v) => setSaved((cur) => cur.filter((c) => !same(c, p, v))),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

const RV = "store_recent_v1";
export function pushRecentlyViewed(id: string) {
  try {
    const cur: string[] = JSON.parse(localStorage.getItem(RV) ?? "[]");
    localStorage.setItem(RV, JSON.stringify([id, ...cur.filter((x) => x !== id)].slice(0, 12)));
  } catch {
    /* ignore */
  }
}
export function getRecentlyViewed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RV) ?? "[]");
  } catch {
    return [];
  }
}
