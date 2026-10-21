import type { Product, Variant } from "@/lib/store";

/** True when the product's sale window is currently active. */
export function saleActive(p: Pick<Product, "sale_starts_at" | "sale_ends_at">, now = new Date()): boolean {
  if (p.sale_starts_at && new Date(p.sale_starts_at) > now) return false;
  if (p.sale_ends_at && new Date(p.sale_ends_at) < now) return false;
  return true;
}

/**
 * Effective selling price, mirroring the database effective_price() function:
 * variant sale price > product sale price > variant price > product price,
 * with sale prices only while the product's sale window is active.
 */
export function effectivePrice(
  p: Pick<Product, "price" | "sale_price" | "sale_starts_at" | "sale_ends_at">,
  v?: Pick<Variant, "price" | "sale_price"> | null,
): number {
  if (!saleActive(p)) return Number(v?.price ?? p.price);
  return Number(v?.sale_price ?? p.sale_price ?? v?.price ?? p.price);
}

/** The regular (non-sale) price, used for the struck-through amount. */
export function regularPrice(
  p: Pick<Product, "price">,
  v?: Pick<Variant, "price"> | null,
): number {
  return Number(v?.price ?? p.price);
}
