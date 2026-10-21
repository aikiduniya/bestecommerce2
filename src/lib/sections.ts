import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type HomeSection = Database["public"]["Tables"]["homepage_sections"]["Row"];
export type NavMenu = Database["public"]["Tables"]["navigation_menus"]["Row"];

export type NavItem = { label: string; url: string; children?: NavItem[] };

export const sectionsQuery = queryOptions({
  queryKey: ["homepage_sections"],
  queryFn: async () => {
    const { data, error } = await supabase.from("homepage_sections").select("*").order("sort_order");
    if (error) throw error;
    return data;
  },
});

export const menusQuery = queryOptions({
  queryKey: ["navigation_menus"],
  queryFn: async () => {
    const { data, error } = await supabase.from("navigation_menus").select("*");
    if (error) throw error;
    return data;
  },
});

export function navItems(menu: NavMenu | undefined): NavItem[] {
  return Array.isArray(menu?.items) ? (menu!.items as NavItem[]) : [];
}

export const SECTION_TYPES = [
  { type: "hero", label: "Hero banner" },
  { type: "trust_badges", label: "Trust badges" },
  { type: "categories", label: "Category grid" },
  { type: "featured_products", label: "Featured products" },
  { type: "collection", label: "Product collection" },
  { type: "best_sellers", label: "Best sellers" },
  { type: "new_arrivals", label: "New arrivals" },
  { type: "promo_banner", label: "Promotional banner" },
  { type: "brands", label: "Brand showcase" },
  { type: "testimonials", label: "Testimonials" },
  { type: "newsletter", label: "Newsletter signup" },
  { type: "text", label: "Custom text" },
  { type: "image", label: "Image banner" },
  { type: "video", label: "Video" },
  { type: "faq", label: "FAQ" },
  { type: "recently_viewed", label: "Recently viewed" },
] as const;

export type SectionType = (typeof SECTION_TYPES)[number]["type"];

export function sectionLabel(type: string) {
  return SECTION_TYPES.find((t) => t.type === type)?.label ?? type;
}

/** Default config when adding a new section of a given type. */
export function defaultConfig(type: string): Record<string, unknown> {
  switch (type) {
    case "hero":
      return { eyebrow: "", image_url: "", cta_label: "Shop now", cta_link: "/shop" };
    case "trust_badges":
      return { items: [{ icon: "truck", text: "Free worldwide shipping" }, { icon: "shield", text: "Secure payment" }, { icon: "rotate", text: "Easy returns" }] };
    case "categories":
      return { count: 5 };
    case "featured_products":
      return { count: 8 };
    case "collection":
      return { collection_id: "", count: 4 };
    case "best_sellers":
      return { count: 4 };
    case "new_arrivals":
      return { count: 4 };
    case "promo_banner":
      return { image_url: "", cta_label: "Shop the sale", cta_link: "/shop", theme: "dark" };
    case "brands":
      return { count: 8 };
    case "testimonials":
      return { items: [{ name: "A happy customer", text: "Beautiful quality and fast delivery.", rating: 5 }] };
    case "newsletter":
      return { cta_label: "Subscribe", note: "Get new arrivals and offers in your inbox." };
    case "text":
      return { body: "Write your own text here." };
    case "image":
      return { image_url: "", link: "" };
    case "video":
      return { video_url: "", poster: "" };
    case "faq":
      return { items: [{ q: "How long does shipping take?", a: "Most orders arrive within 5–10 business days." }] };
    default:
      return {};
  }
}
