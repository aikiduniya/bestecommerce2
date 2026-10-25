// Shared email renderer used by every send, retry and the admin preview.
// Emails are delivered as text/plain, so values are never interpreted as HTML;
// they are still cleaned of control characters (and of line breaks in subjects
// to prevent header injection). Rendering is single-pass, so a customer name that
// itself contains "{{order_total}}" is printed literally, never re-expanded.

export type OrderLike = {
  id?: string | null;
  order_number?: number | string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  total?: number | string | null;
  subtotal?: number | string | null;
  shipping_total?: number | string | null;
  tax_total?: number | string | null;
  discount_total?: number | string | null;
  currency?: string | null;
  payment_method?: string | null;
  status?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  items?: unknown;
};

// Placeholders saved templates rely on, with the value used when data is absent.
// Anything not listed here falls back to an empty string in sent emails.
export const PLACEHOLDER_FALLBACKS: Record<string, string> = {
  customer_name: "Customer",
  store_name: "our store",
  payment_method: "Not specified",
  items_list: "(no items)",
};

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  stripe: "Card (Stripe)",
};

export function paymentLabel(method: string | null | undefined): string {
  if (!method) return "";
  return PAYMENT_LABELS[method] ?? method;
}

export function formatMoney(amount: number | string | null | undefined, currency: string | null | undefined): string {
  const n = Number(amount ?? 0);
  const cur = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${(Number.isFinite(n) ? n : 0).toFixed(2)} ${cur}`;
  }
}

// One readable line per purchased item: "• 2 × Heritage Chronograph (Color: Black) — $540.00"
export function formatItemsList(items: unknown, currency: string | null | undefined): string {
  if (!Array.isArray(items)) return "";
  return items
    .flatMap((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const it = raw as Record<string, unknown>;
      const name = String(it["name"] ?? "").trim() || "Item";
      const qty = Number(it["qty"] ?? 1) || 1;
      const opts = it["options"];
      const optText = opts && typeof opts === "object" && !Array.isArray(opts)
        ? Object.entries(opts as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(", ")
        : "";
      const price = it["price"];
      const line = `• ${qty} × ${name}${optText ? ` (${optText})` : ""}`;
      return [price === undefined || price === null ? line : `${line} — ${formatMoney(Number(price) * qty, currency)}`];
    })
    .join("\n");
}

// Template variables for any order-related email, built from the stored order.
export function buildOrderVars(order: OrderLike, label?: string): Record<string, string> {
  const cur = order.currency || "USD";
  const vars: Record<string, string> = {
    order_number: order.order_number === null || order.order_number === undefined ? "" : String(order.order_number),
    customer_name: order.customer_name ?? "",
    customer_email: order.customer_email ?? "",
    order_total: formatMoney(order.total, cur),
    total: order.total === null || order.total === undefined ? "" : String(order.total),
    currency: cur,
    payment_method: label || paymentLabel(order.payment_method),
    items_list: formatItemsList(order.items, cur),
  };
  if (order.id) vars["order_id"] = order.id;
  if (order.customer_phone) vars["customer_phone"] = order.customer_phone;
  if (order.subtotal !== undefined && order.subtotal !== null) vars["order_subtotal"] = formatMoney(order.subtotal, cur);
  if (order.shipping_total !== undefined && order.shipping_total !== null) vars["shipping_total"] = formatMoney(order.shipping_total, cur);
  if (order.tax_total !== undefined && order.tax_total !== null) vars["tax_total"] = formatMoney(order.tax_total, cur);
  if (order.discount_total !== undefined && order.discount_total !== null) vars["discount_total"] = formatMoney(order.discount_total, cur);
  if (order.status) vars["order_status"] = order.status;
  if (order.tracking_number) vars["tracking_number"] = order.tracking_number;
  if (order.tracking_url) vars["tracking_url"] = order.tracking_url;
  return vars;
}

// Editors (and copy/paste from rich text) can leave invisible characters,
// entity-encoded braces or stray tags inside a placeholder. Normalise them so
// "{{ Customer_Name }}", "&#123;&#123;customer_name&#125;&#125;" and
// "{{<b>customer_name</b>}}" all resolve like "{{customer_name}}".
function normalizeTemplate(text: string): string {
  return text
    .replace(/&#123;|&#x7b;|&lbrace;/gi, "{")
    .replace(/&#125;|&#x7d;|&rbrace;/gi, "}")
    .replace(/\{\{([^{}]*)\}\}/g, (_m, inner: string) => {
      const key = inner.replace(/<[^>]*>/g, "").replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, "");
      return `{{${key}}}`;
    });
}

const TOKEN = /\{\{([a-z0-9_]+)\}\}/gi;

function clean(value: string, singleLine: boolean): string {
  // eslint-disable-next-line no-control-regex
  let v = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  if (singleLine) v = v.replace(/[\r\n]+/g, " ").trim();
  return v;
}

export type RenderOptions = {
  // true for the subject line: line breaks are flattened.
  singleLine?: boolean;
  // Admin preview keeps unknown tokens visible so mistakes are obvious.
  keepUnknown?: boolean;
};

export function renderEmailText(text: string, vars: Record<string, string>, opts: RenderOptions = {}): string {
  const lookup: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined && v !== null && String(v) !== "") lookup[k.toLowerCase()] = String(v);
  }
  const out = normalizeTemplate(text ?? "").replace(TOKEN, (m, rawKey: string) => {
    const key = rawKey.toLowerCase();
    const value = lookup[key] ?? PLACEHOLDER_FALLBACKS[key];
    if (value === undefined) return opts.keepUnknown ? m : "";
    return clean(value, !!opts.singleLine);
  });
  return opts.singleLine ? out.replace(/[\r\n]+/g, " ").trim() : out;
}

export function unresolvedPlaceholders(text: string): string[] {
  return Array.from(normalizeTemplate(text).matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g), (m) => m[1] ?? "");
}
