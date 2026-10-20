import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(n ?? 0));
  } catch {
    return `${currency} ${Number(n ?? 0).toFixed(2)}`;
  }
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
