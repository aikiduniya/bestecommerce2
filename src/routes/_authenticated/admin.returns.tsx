import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { money, returnRequestsQuery, type ReturnRequest } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/returns")({
  head: () => ({ meta: [{ title: "Returns — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminReturns,
});

type Row = ReturnRequest & { orders: { order_number: number } | null };

const FILTERS = ["all", "requested", "approved", "received", "refunded", "rejected"] as const;

function AdminReturns() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery(returnRequestsQuery);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [note, setNote] = useState<Record<string, string>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const visible = rows.filter((r) => filter === "all" || r.status === filter);

  async function act(r: Row, action: string) {
    setBusy(r.id + action);
    const { data, error } = await supabase.rpc("process_return", { _id: r.id, _action: action, _note: note[r.id] ?? "", _restock: action === "refund" ? (restock[r.id] ?? true) : false });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    const res = data as { ok: boolean; error?: string };
    if (!res.ok) { toast.error(res.error ?? "Action failed."); return; }
    toast.success(`Return ${action}d.`);
    qc.invalidateQueries({ queryKey: ["return_requests"] });
  }

  return (
    <div>
      <PageHeader title="Returns" subtitle="Review return requests, approve them, and refund with optional restocking." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs capitalize ${filter === f ? "border-gold bg-gold-soft/50" : "text-muted-foreground"}`}>
            {f} {f !== "all" && `(${rows.filter((r) => r.status === f).length})`}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : visible.length === 0 ? (
        <p className="rounded border bg-card p-10 text-center text-sm text-muted-foreground">No return requests{filter !== "all" ? ` with status “${filter}”` : ""}.</p>
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <div key={r.id} className="rounded border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-xl">Order #{r.orders?.order_number ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{r.email} · {new Date(r.created_at).toLocaleString()}</p>
                </div>
                <StatusPill value={r.status} />
              </div>
              <div className="mt-3 divide-y rounded border text-sm">
                {r.items.map((l, i) => (
                  <div key={i} className="flex justify-between px-3 py-2"><span>{l.name} × {l.qty}</span><span>{money(l.price * l.qty)}</span></div>
                ))}
              </div>
              <p className="mt-3 text-sm"><span className="text-muted-foreground">Reason:</span> {r.reason}</p>
              {r.admin_note && <p className="mt-1 text-sm"><span className="text-muted-foreground">Note:</span> {r.admin_note}</p>}
              {r.restocked && <p className="mt-1 text-xs text-success">Items restocked</p>}
              {r.status !== "refunded" && r.status !== "rejected" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Input placeholder="Note (optional)" value={note[r.id] ?? ""} onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))} className="max-w-xs" />
                  {r.status === "requested" && (
                    <>
                      <Button size="sm" variant="gold" disabled={busy !== null} onClick={() => act(r, "approve")}>Approve</Button>
                      <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(r, "reject")}>Reject</Button>
                    </>
                  )}
                  {r.status === "approved" && <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(r, "receive")}>Mark received</Button>}
                  {(r.status === "approved" || r.status === "received") && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={restock[r.id] ?? true} onChange={(e) => setRestock((s) => ({ ...s, [r.id]: e.target.checked }))} className="size-3.5 accent-[hsl(var(--gold))]" /> Restock items</label>
                      <Button size="sm" variant="gold" disabled={busy !== null} onClick={() => act(r, "refund")}>{busy === r.id + "refund" ? "Working…" : "Mark refunded"}</Button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
