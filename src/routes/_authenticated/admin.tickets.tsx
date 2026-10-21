import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ticketsQuery, ticketMessagesQuery, type SupportTicket } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/tickets")({
  component: TicketsPage,
});

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

function TicketsPage() {
  const qc = useQueryClient();
  const { data: tickets = [] } = useQuery(ticketsQuery);
  const [view, setView] = useState<SupportTicket | null>(null);
  const [filter, setFilter] = useState<string>("all");

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setView((v) => (v && v.id === id ? { ...v, status } as SupportTicket : v));
    qc.invalidateQueries({ queryKey: ["support_tickets"] });
  }

  const list = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const open = tickets.filter((t) => t.status === "open").length;

  return (
    <>
      <PageHeader title="Support tickets" subtitle={`${open} open · ${tickets.length} total`}>
        <select aria-label="Filter by status" className="h-9 rounded-md border bg-card px-3 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s.replace("_", " ")}</option>)}
        </select>
      </PageHeader>
      <Card className="p-4">
        <Table>
          <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Opened</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {list.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.subject}</TableCell>
                <TableCell>{t.email}</TableCell>
                <TableCell><StatusPill value={t.status} /></TableCell>
                <TableCell className="capitalize">{t.priority}</TableCell>
                <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setView(t)}>Open</Button></TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No tickets{filter !== "all" ? " with this status" : ""}.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.subject}</DialogTitle></DialogHeader>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{view.email}</span>
                <span>·</span>
                <span>{new Date(view.created_at).toLocaleString()}</span>
                <select aria-label="Ticket status" className="ml-auto h-8 rounded-md border bg-card px-2 text-sm" value={view.status} onChange={(e) => setStatus(view.id, e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              <TicketThread ticket={view} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TicketThread({ ticket }: { ticket: SupportTicket }) {
  const qc = useQueryClient();
  const { data: messages = [] } = useQuery(ticketMessagesQuery(ticket.id));
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_id: u.user?.id ?? null, body, is_staff: true });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setReply("");
    if (ticket.status === "open") await supabase.from("support_tickets").update({ status: "in_progress", updated_at: new Date().toISOString() }).eq("id", ticket.id);
    qc.invalidateQueries({ queryKey: ["ticket_messages", ticket.id] });
    qc.invalidateQueries({ queryKey: ["support_tickets"] });
  }

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto rounded border p-3">
        {messages.map((m) => (
          <div key={m.id} className={`rounded p-2 text-sm ${m.is_staff ? "bg-muted" : "border bg-card"}`}>
            <p className="mb-1 text-xs text-muted-foreground">{m.is_staff ? "Support" : "Customer"} · {new Date(m.created_at).toLocaleString()}</p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No messages.</p>}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
        <Button variant="gold" onClick={send} disabled={busy}>{busy ? "Sending…" : "Reply"}</Button>
      </div>
    </div>
  );
}
