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
