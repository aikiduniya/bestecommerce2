/** Customer-facing identifiers must come from the stored generated code, never a numeric ID. */
export function publicOrderCode(order: { order_code?: string | null }): string | null {
  return order.order_code?.trim() || null;
}