import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const tone: Record<string, string> = {
    active: "bg-success/15 text-success",
    delivered: "bg-success/15 text-success",
    paid: "bg-success/15 text-success",
    draft: "bg-muted text-muted-foreground",
    pending: "bg-warning/20 text-foreground",
    processing: "bg-gold-soft text-foreground",
    shipped: "bg-gold-soft text-foreground",
    archived: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
    refunded: "bg-destructive/15 text-destructive",
    failed: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${tone[value] ?? "bg-muted"}`}>
      {value}
    </span>
  );
}
