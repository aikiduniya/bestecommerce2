import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDisplayCurrency } from "@/lib/currency";
import type { Database } from "@/integrations/supabase/types";

export type Settings = Database["public"]["Tables"]["store_settings"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export const productsQuery = queryOptions({
  queryKey: ["products"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const brandsQuery = queryOptions({
  queryKey: ["brands"],
  queryFn: async () => {
    const { data, error } = await supabase.from("brands").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const ordersQuery = queryOptions({
  queryKey: ["orders"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function money(n: number | string | null | undefined, currency = "USD") {
  const v = Number(n ?? 0);
  const sel = getDisplayCurrency();
  const fmt = (amount: number, code: string) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(amount);
    } catch {
      return `${code} ${amount.toFixed(2)}`;
    }
  };
  if (sel && sel.code !== currency) return fmt(v * sel.rate, sel.code);
  return fmt(v, currency);
}

export type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type ShippingZone = Database["public"]["Tables"]["shipping_zones"]["Row"];
export type Media = Database["public"]["Tables"]["media"]["Row"];
export type ProductOption = { name: string; values: string[] };

export const variantsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

export const allVariantsQuery = queryOptions({
  queryKey: ["variants", "all"],
  queryFn: async () => {
    const { data, error } = await supabase.from("product_variants").select("*").eq("is_active", true);
    if (error) throw error;
    return data;
  },
});

export const collectionsQuery = queryOptions({
  queryKey: ["collections"],
  queryFn: async () => {
    const { data, error } = await supabase.from("collections").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const productCollectionsQuery = queryOptions({
  queryKey: ["product_collections"],
  queryFn: async () => {
    const { data, error } = await supabase.from("product_collections").select("*");
    if (error) throw error;
    return data;
  },
});

export type TaxRate = Database["public"]["Tables"]["tax_rates"]["Row"];

export const taxRatesQuery = queryOptions({
  queryKey: ["tax_rates"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tax_rates").select("*").order("priority", { ascending: false });
    if (error) throw error;
    return data;
  },
});

// Mirrors the tax logic inside place_order — UI preview only; the server recomputes.
export function taxPreview(
  settings: Settings | undefined,
  rates: TaxRate[],
  country: string,
  merchandise: number,
  shipping: number,
  fee: number,
): { tax: number; inclusive: boolean; name?: string } {
  if (!settings?.tax_enabled) return { tax: 0, inclusive: false };
  const c = country.trim().toUpperCase();
  const r = rates
    .filter((x) => x.is_active && (x.country === c || x.country === "*"))
    .sort((a, b) => (a.country === c ? 0 : 1) - (b.country === c ? 0 : 1) || b.priority - a.priority)[0];
  if (!r || Number(r.rate) <= 0) return { tax: 0, inclusive: settings.tax_inclusive };
  const rate = Number(r.rate);
  if (settings.tax_inclusive) {
    return { tax: Math.round(((merchandise + shipping + fee) * rate) / (100 + rate) * 100) / 100, inclusive: true, name: r.name };
  }
  const base = merchandise + (r.applies_to_shipping ? shipping : 0) + fee;
  return { tax: Math.round(base * rate) / 100, inclusive: false, name: r.name };
}

export const zonesQuery = queryOptions({
  queryKey: ["shipping_zones"],
  queryFn: async () => {
    const { data, error } = await supabase.from("shipping_zones").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const mediaQuery = queryOptions({
  queryKey: ["media"],
  queryFn: async () => {
    const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export function optionsOf(p: { options: unknown }): ProductOption[] {
  return Array.isArray(p.options) ? (p.options as ProductOption[]) : [];
}

export function optionLabel(o: unknown) {
  if (!o || typeof o !== "object") return "";
  return Object.entries(o as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(" · ");
}

export type Page = Database["public"]["Tables"]["pages"]["Row"];
export type BlogPost = Database["public"]["Tables"]["blog_posts"]["Row"];
export type Coupon = Database["public"]["Tables"]["coupons"]["Row"];

export const pagesQuery = queryOptions({
  queryKey: ["pages"],
  queryFn: async () => {
    const { data, error } = await supabase.from("pages").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const postsQuery = queryOptions({
  queryKey: ["posts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("blog_posts").select("*").order("published_at", { ascending: false, nullsFirst: true });
    if (error) throw error;
    return data;
  },
});

export type OrderEvent = Database["public"]["Tables"]["order_events"]["Row"];
export type OrderNote = Database["public"]["Tables"]["order_notes"]["Row"];
export type ActivityEntry = Database["public"]["Tables"]["activity_log"]["Row"];

export const orderEventsQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order_events", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_events").select("*").eq("order_id", orderId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

export const orderNotesQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order_notes", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_notes").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const activityQuery = queryOptions({
  queryKey: ["activity"],
  queryFn: async () => {
    const { data, error } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(12);
    if (error) throw error;
    return data;
  },
});

export const contentTranslationsQuery = queryOptions({
  queryKey: ["content_translations"],
  queryFn: async () => {
    const { data, error } = await supabase.from("content_translations").select("*");
    if (error) throw error;
    return data;
  },
});

export const couponsQuery = queryOptions({
  queryKey: ["coupons"],
  queryFn: async () => {
    const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReturnRequest = {
  id: string;
  order_id: string;
  user_id: string | null;
  email: string;
  items: { product_id?: string; variant_id?: string | null; name: string; qty: number; price: number }[];
  reason: string;
  status: "requested" | "approved" | "rejected" | "received" | "refunded";
  admin_note: string | null;
  restocked: boolean;
  created_at: string;
};

export const returnRequestsQuery = queryOptions({
  queryKey: ["return_requests"],
  queryFn: async () => {
    const { data, error } = await supabase.from("return_requests").select("*, orders(order_number)").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as (ReturnRequest & { orders: { order_number: number } | null })[];
  },
});

export const orderReturnsQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["return_requests", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from("return_requests").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ReturnRequest[];
    },
  });

export type Address = {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal: string | null;
  country: string;
  phone: string | null;
  is_default: boolean;
};

export const myAddressesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["addresses", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("addresses").select("*").eq("user_id", userId).order("created_at");
      if (error) throw error;
      return (data ?? []) as Address[];
    },
  });
