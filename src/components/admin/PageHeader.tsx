import type { ComponentType, ReactNode } from "react";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-gold/20 pb-6">
      <div className="min-w-0">
        <p className="eyebrow text-gold">Super Admin</p>
        <h1 className="mt-1 text-4xl md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Premium KPI tile used across admin pages. */
export function KpiCard({ label, value, sub, icon: Icon, tone = "default" }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ComponentType<{ className?: string }>; tone?: "default" | "warn" | "good" }) {
  return (
    <div className="kpi-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow text-muted-foreground">{label}</p>
        {Icon && (
          <span className={`flex size-8 items-center justify-center rounded-full ${tone === "warn" ? "bg-destructive/10 text-destructive" : tone === "good" ? "bg-success/10 text-success" : "bg-gold-soft text-gold"}`}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-3xl md:text-4xl">{value}</p>
      {sub && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
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
