import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { myTicketsQuery, ticketMessagesQuery, type SupportTicket } from "@/lib/store";
import { StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SupportTab({ userId, email }: { userId: string; email: string }) {
  const qc = useQueryClient();
  const { data: tickets = [] } = useQuery(myTicketsQuery(userId));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<SupportTicket | null>(null);

  async function submit() {
    if (!subject.trim() || !message.trim()) { toast.error("Add a subject and message"); return; }
    setBusy(true);
    const { data: t, error } = await supabase.from("support_tickets").insert({ user_id: userId, email, subject: subject.trim() }).select().single();
    if (error || !t) { setBusy(false); toast.error(error?.message ?? "Could not create ticket"); return; }
    const { error: e2 } = await supabase.from("ticket_messages").insert({ ticket_id: t.id, author_id: userId, body: message.trim(), is_staff: false });
    setBusy(false);
    if (e2) { toast.error(e2.message); return; }
    setSubject("");
    setMessage("");
    toast.success("Ticket sent — we'll reply here");
    qc.invalidateQueries({ queryKey: ["support_tickets", "mine", userId] });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-3 rounded border bg-card p-5">
        <h3 className="font-display text-2xl">New support ticket</h3>
        <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <Textarea placeholder="How can we help?" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
        <Button variant="gold" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send ticket"}</Button>
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-2xl">Your tickets</h3>
        {tickets.length === 0 && <p className="rounded border border-dashed py-10 text-center text-sm text-muted-foreground">No tickets yet.</p>}
        {tickets.map((t) => (
          <button key={t.id} onClick={() => setView(t)} className="flex w-full items-center justify-between gap-3 rounded border bg-card p-4 text-left hover:bg-muted">
            <div><p className="font-medium">{t.subject}</p><p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p></div>
            <StatusPill value={t.status} />
          </button>
        ))}
      </div>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.subject}</DialogTitle></DialogHeader>
              <CustomerThread ticket={view} userId={userId} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerThread({ ticket, userId }: { ticket: SupportTicket; userId: string }) {
  const qc = useQueryClient();
  const { data: messages = [] } = useQuery(ticketMessagesQuery(ticket.id));
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: ticket.id, author_id: userId, body, is_staff: false });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setReply("");
    qc.invalidateQueries({ queryKey: ["ticket_messages", ticket.id] });
  }

  return (
    <div className="space-y-3">
      <div className="max-h-72 space-y-2 overflow-y-auto rounded border p-3">
        {messages.map((m) => (
          <div key={m.id} className={`rounded p-2 text-sm ${m.is_staff ? "border bg-card" : "bg-muted"}`}>
            <p className="mb-1 text-xs text-muted-foreground">{m.is_staff ? "Support" : "You"} · {new Date(m.created_at).toLocaleString()}</p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </div>
      {ticket.status !== "closed" && (
        <div className="flex gap-2">
          <Input placeholder="Write a reply…" value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
          <Button variant="gold" onClick={send} disabled={busy}>{busy ? "Sending…" : "Reply"}</Button>
        </div>
      )}
    </div>
  );
}
