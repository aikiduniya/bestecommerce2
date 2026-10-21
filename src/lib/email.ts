// Email module — client-safe queries and template rendering.
// Sending itself lives in email.functions.ts (server-only).

import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type EmailTemplate = Database["public"]["Tables"]["email_templates"]["Row"];
export type EmailSettings = Database["public"]["Tables"]["email_settings"]["Row"];
export type NotificationRule = Database["public"]["Tables"]["notification_rules"]["Row"];
export type EmailLog = Database["public"]["Tables"]["email_logs"]["Row"];

export const emailTemplatesQuery = queryOptions({
  queryKey: ["email_templates"],
  queryFn: async () => {
    const { data, error } = await supabase.from("email_templates").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const emailSettingsQuery = queryOptions({
  queryKey: ["email_settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("email_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export const notificationRulesQuery = queryOptions({
  queryKey: ["notification_rules"],
  queryFn: async () => {
    const { data, error } = await supabase.from("notification_rules").select("*").order("event");
    if (error) throw error;
    return data;
  },
});

export const emailLogsQuery = queryOptions({
  queryKey: ["email_logs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },
});

// Replace {{placeholder}} tokens with values; unknown tokens are left visible
// so mistakes are obvious in previews and logs.
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) => vars[k] ?? m);
}

// Sample data used for the admin live preview.
export const SAMPLE_VARS: Record<string, string> = {
  customer_name: "Ayesha Khan",
  customer_email: "ayesha@example.com",
  order_number: "1042",
  order_total: "$269.10",
  payment_method: "Cash on Delivery",
  items_list: "1 × Heritage Chronograph — $269.10",
  store_name: "Your Store",
  product_name: "Heritage Chronograph",
  stock: "3",
  reset_link: "https://example.com/reset/abc123",
};

export const EVENT_LABELS: Record<string, string> = {
  order_placed: "Order placed → customer",
  order_placed_admin: "Order placed → admin",
  order_shipped: "Order shipped → customer",
  order_cancelled: "Order cancelled → customer",
  cod_confirmation_needed: "COD confirmation needed → customer",
  low_stock: "Low stock → admin",
  password_reset: "Password reset → customer",
  welcome: "Welcome (new account) → customer",
};
