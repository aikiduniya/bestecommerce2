import { useSyncExternalStore } from "react";

export type DisplayCurrency = { code: string; rate: number };

const KEY = "store_display_currency";
let current: DisplayCurrency | null = null;
const listeners = new Set<() => void>();

/** Restore the visitor's saved choice after mount (never during SSR/first render). */
export function initDisplayCurrency() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DisplayCurrency;
      if (parsed && /^[A-Z]{3}$/.test(parsed.code) && parsed.rate > 0) current = parsed;
    }
  } catch {
    /* ignore corrupt value */
  }
  listeners.forEach((l) => l());
}

export function getDisplayCurrency(): DisplayCurrency | null {
  return current;
}

export function setDisplayCurrency(c: DisplayCurrency | null) {
  current = c;
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Re-renders the caller (and its subtree) when the display currency changes. */
export function useDisplayCurrency() {
  return useSyncExternalStore(subscribe, getDisplayCurrency, () => null);
}

/** Parse the admin-managed list of extra currencies from settings. */
export function extraCurrencies(raw: unknown): DisplayCurrency[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is DisplayCurrency =>
      !!c && typeof c === "object" && /^[A-Z]{3}$/.test(String((c as DisplayCurrency).code)) && Number((c as DisplayCurrency).rate) > 0,
  ).map((c) => ({ code: c.code, rate: Number(c.rate) }));
}
