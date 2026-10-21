// Storefront ecommerce events for GA4 (gtag) and Meta Pixel (fbq).
// No-ops unless the matching IDs are configured in Settings → Marketing (scripts load via Tracking.tsx).

type TrackItem = { id: string; name: string; price: number; qty: number; variant?: string | undefined };

const gaItems = (items: TrackItem[]) =>
  items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty, ...(i.variant ? { item_variant: i.variant } : {}) }));

const metaContents = (items: TrackItem[]) => items.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price }));

function ga(event: string, params: Record<string, unknown>) {
  if (typeof window !== "undefined") window.gtag?.("event", event, params);
}
function meta(event: string, params: Record<string, unknown>) {
  if (typeof window !== "undefined") window.fbq?.("track", event, params);
}

export function trackViewItem(p: { id: string; name: string; price: number }, currency?: string) {
  const item = { id: p.id, name: p.name, price: p.price, qty: 1 };
  ga("view_item", { currency, value: p.price, items: gaItems([item]) });
  meta("ViewContent", { content_ids: [p.id], content_name: p.name, content_type: "product", value: p.price, currency });
}

export function trackAddToCart(item: TrackItem, currency?: string) {
  const value = item.price * item.qty;
  ga("add_to_cart", { currency, value, items: gaItems([item]) });
  meta("AddToCart", { content_ids: [item.id], content_type: "product", value, currency });
}

export function trackBeginCheckout(items: TrackItem[], value: number, currency?: string) {
  ga("begin_checkout", { currency, value, items: gaItems(items) });
  meta("InitiateCheckout", { contents: metaContents(items), value, currency, num_items: items.reduce((s, i) => s + i.qty, 0) });
}

export function trackPurchase(orderId: string, items: TrackItem[], value: number, currency?: string) {
  ga("purchase", { transaction_id: orderId, currency, value, items: gaItems(items) });
  meta("Purchase", { content_ids: items.map((i) => i.id), content_type: "product", value, currency, order_id: orderId });
}
