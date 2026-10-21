import { useEffect, useState } from "react";

const KEY = "store_compare_v1";
const MAX = 4;

export function getCompare(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function setCompare(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX)));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("compare-changed"));
}

export function toggleCompare(id: string): string[] {
  const cur = getCompare();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-MAX);
  setCompare(next);
  return next;
}

export function useCompare(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const read = () => setIds(getCompare());
    read();
    window.addEventListener("compare-changed", read);
    return () => window.removeEventListener("compare-changed", read);
  }, []);
  return ids;
}
