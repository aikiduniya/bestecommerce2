// Storefront languages & translations.
// The store's base language is English ("en"). Extra languages are managed in
// Admin → Settings → Languages and stored in store_settings.languages
// ([{code, label, dir}]) with per-language UI text in store_settings.translations
// ({lang: {key: text}}). Missing translations fall back to the English defaults
// below, so a partially translated language still renders a complete store.

import { useSyncExternalStore } from "react";

export type StoreLanguage = { code: string; label: string; dir: "ltr" | "rtl" };

export const DEFAULT_LANG: StoreLanguage = { code: "en", label: "English", dir: "ltr" };

// Languages the admin can enable (code → native label + direction).
export const LANG_CATALOG: Record<string, { label: string; dir: "ltr" | "rtl" }> = {
  ur: { label: "اردو", dir: "rtl" },
  ar: { label: "العربية", dir: "rtl" },
  hi: { label: "हिन्दी", dir: "ltr" },
  es: { label: "Español", dir: "ltr" },
  fr: { label: "Français", dir: "ltr" },
  de: { label: "Deutsch", dir: "ltr" },
  it: { label: "Italiano", dir: "ltr" },
  pt: { label: "Português", dir: "ltr" },
  tr: { label: "Türkçe", dir: "ltr" },
  zh: { label: "中文", dir: "ltr" },
};

// English defaults for every translatable storefront string.
export const UI_STRINGS: Record<string, string> = {
  "nav.shop_all": "Shop all",
  "nav.search": "Search",
  "nav.search_products": "Search products",
  "nav.wishlist": "Wishlist",
  "nav.account": "Account",
  "nav.cart": "Cart",
  "nav.menu": "Menu",
  "nav.language": "Language",
  "nav.currency": "Currency",
  "footer.shop": "Shop",
  "footer.information": "Information",
  "footer.journal": "Journal",
  "footer.contact": "Contact",
  "maintenance.closed": "Temporarily closed",
  "maintenance.message": "We're polishing things up. Please check back shortly.",
  "maintenance.staff_signin": "Staff sign in",
  "maintenance.banner": "Maintenance mode is ON — only staff can see the store.",
  "cart.title": "Your cart",
  "cart.empty": "Your cart is empty.",
  "cart.continue": "Continue shopping",
  "cart.subtotal": "Subtotal",
  "cart.checkout": "Proceed to checkout",
  "cart.remove": "Remove",
  "shop.title": "Shop",
  "shop.filters": "Filters",
  "shop.sort": "Sort",
  "shop.no_results": "No products found.",
  "product.add_to_cart": "Add to cart",
  "product.out_of_stock": "Out of stock",
  "product.reviews": "Reviews",
  "product.questions": "Questions",
  "checkout.title": "Checkout",
  "checkout.shipping": "Shipping address",
  "checkout.payment": "Payment method",
  "checkout.place_order": "Place order",
  "checkout.order_total": "Order total",
  "account.title": "My account",
  "account.orders": "Order history",
  "account.sign_out": "Sign out",
  "auth.sign_in": "Sign in",
  "auth.sign_up": "Create account",
};

export type Translations = Record<string, Record<string, string>>;

const KEY = "store_lang";
let current: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getLang(): string | null {
  return current;
}

export function setLang(code: string | null) {
  current = code && code !== DEFAULT_LANG.code ? code : null;
  try {
    if (current) localStorage.setItem(KEY, current);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

// Restore the visitor's choice after mount (never during SSR — avoids hydration mismatch).
export function initLang() {
  try {
    const code = localStorage.getItem(KEY);
    current = code && LANG_CATALOG[code] ? code : null;
  } catch {
    current = null;
  }
  emit();
}

export function useLang(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

// Validated extra languages from settings (must exist in the catalog).
export function extraLanguages(raw: unknown): StoreLanguage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoreLanguage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { code, label, dir } = item as Record<string, unknown>;
    if (typeof code !== "string" || !LANG_CATALOG[code]) continue;
    out.push({
      code,
      label: typeof label === "string" && label.trim() ? label : LANG_CATALOG[code].label,
      dir: dir === "rtl" ? "rtl" : LANG_CATALOG[code].dir,
    });
  }
  return out;
}

export function langDir(code: string | null): "ltr" | "rtl" {
  if (!code) return "ltr";
  return LANG_CATALOG[code]?.dir ?? "ltr";
}

// Translate a UI string for the active language; falls back to English.
export function translate(translations: unknown, lang: string | null, key: string): string {
  if (lang && translations && typeof translations === "object") {
    const table = (translations as Translations)[lang];
    const v = table?.[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return UI_STRINGS[key] ?? key;
}
