import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Inbox, Mail, MailOpen, Search, Reply, CheckCircle2, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/store";
import { replyInquiry } from "@/lib/inbox.functions";
import { KpiCard, KpiGrid, PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/inbox")({ component: InboxPage });

const STATUSES = ["new", "open", "replied", "closed", "spam"] as const;

function InboxPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"inquiries" | "newsletter">("inquiries");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [readF, setReadF] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: msgs = [] } = useQuery({
    queryKey: ["contact_messages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["newsletter_subscribers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("newsletter_subscribers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["contact_messages"] });
  const list = useMemo(() => msgs.filter((m) =>
    (status === "all" || m.status === status) &&
    (readF === "all" || (readF === "unread" ? !m.is_read : m.is_read)) &&
    (!q || [m.name, m.email, m.subject, m.message].join(" ").toLowerCase().includes(q.toLowerCase()))), [msgs, status, readF, q]);
  const cur = msgs.find((m) => m.id === openId) ?? null;

  async function update(id: string, patch: { is_read?: boolean; status?: string }) {
    const { error } = await supabase.from("contact_messages").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function open(id: string) {
    setOpenId(id); setReply("");
    const m = msgs.find((x) => x.id === id);
    if (m && !m.is_read) await update(id, { is_read: true, ...(m.status === "new" ? { status: "open" } : {}) });
  }
  async function sendReply() {
    if (!cur || reply.trim().length < 2) { toast.error("Write a reply first"); return; }
    setBusy(true);
    try {
      const r = await replyInquiry({ data: { id: cur.id, reply: reply.trim() } });
      toast.success(r.status === "sent" ? "Reply emailed to the customer" : "Reply saved — email sending is off, so it was logged but not sent");
      setReply(""); refresh();
    } catch (e) { toast.error((e as Error).message); }
    setBusy(false);
  }
  async function remove(id: string) {
    if (!confirm("Delete this inquiry?")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setOpenId(null); refresh();
  }
  const sel = "h-9 rounded-md border bg-card px-3 text-sm";

  return (
    <>
      <PageHeader title="Inbox" subtitle="Messages from your Contact Us form and newsletter signups.">
        {tab === "newsletter" && <Button variant="outline" onClick={() => downloadCsv("newsletter.csv", [["Email", "Subscribed"], ...subs.map((s) => [s.email, s.created_at.slice(0, 10)])])}><Download className="size-4" /> Export CSV</Button>}
      </PageHeader>
      <KpiGrid>
        <KpiCard label="Unread" value={msgs.filter((m) => !m.is_read).length} icon={Mail} tone={msgs.some((m) => !m.is_read) ? "warn" : "good"} sub="Need attention" />
        <KpiCard label="Open" value={msgs.filter((m) => m.status === "open" || m.status === "new").length} icon={Inbox} sub="Awaiting a reply" />
        <KpiCard label="Replied" value={msgs.filter((m) => m.status === "replied").length} icon={CheckCircle2} sub="Answered" />
        <KpiCard label="Subscribers" value={subs.length} icon={MailOpen} sub="Newsletter list" />
      </KpiGrid>
      <div className="mb-4 flex gap-1 rounded-lg border bg-card p-1">
        {(["inquiries", "newsletter"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-2 text-sm capitalize ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t === "inquiries" ? "Contact inquiries" : "Newsletter"}</button>
        ))}
      </div>
      {tab === "newsletter" ? (
        <Card className="divide-y p-0">
          {subs.map((s) => <div key={s.id} className="flex justify-between p-4 text-sm"><span>{s.email}</span><span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span></div>)}
          {!subs.length && <p className="p-6 text-sm text-muted-foreground">No subscribers yet.</p>}
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="p-0">
            <div className="flex flex-wrap gap-2 border-b p-3">
              <div className="relative min-w-40 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search inquiries" className="pl-9" placeholder="Search name, email, text…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <select aria-label="Status filter" className={sel} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <select aria-label="Read filter" className={sel} value={readF} onChange={(e) => setReadF(e.target.value)}><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select>
            </div>
            <div className="max-h-[70vh] divide-y overflow-y-auto">
              {list.map((m) => (
                <button key={m.id} onClick={() => void open(m.id)} className={`block w-full p-4 text-left transition-colors hover:bg-muted ${openId === m.id ? "bg-gold-soft/50" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${m.is_read ? "" : "font-semibold"}`}>{!m.is_read && <span className="mr-2 inline-block size-2 rounded-full bg-gold" />}{m.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.subject || m.message}</p>
                  <div className="mt-1"><StatusPill value={m.status} /></div>
                </button>
              ))}
              {!list.length && <p className="p-6 text-sm text-muted-foreground">No inquiries match.</p>}
            </div>
          </Card>
          <Card className="p-6">
            {!cur ? <p className="py-20 text-center text-sm text-muted-foreground">Select a message to read it.</p> : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h2 className="text-2xl">{cur.subject || "(no subject)"}</h2><p className="text-sm text-muted-foreground">{cur.name} · <a className="text-gold" href={`mailto:${cur.email}`}>{cur.email}</a>{cur.phone ? ` · ${cur.phone}` : ""}</p><p className="text-xs text-muted-foreground">{new Date(cur.created_at).toLocaleString()}</p></div>
                  <div className="flex gap-2">
                    <select aria-label="Inquiry status" className={sel} value={cur.status} onChange={(e) => void update(cur.id, { status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
                    <Button variant="outline" size="sm" onClick={() => void update(cur.id, { is_read: !cur.is_read })}>{cur.is_read ? "Mark unread" : "Mark read"}</Button>
                    <Button size="icon" variant="ghost" aria-label="Delete inquiry" onClick={() => void remove(cur.id)}><Trash2 /></Button>
                  </div>
                </div>
                <p className="whitespace-pre-line rounded border bg-muted/40 p-4 text-sm">{cur.message}</p>
                {cur.admin_reply && <div className="rounded border border-gold/40 p-4 text-sm"><p className="eyebrow mb-2 text-gold">Your reply · {cur.replied_at ? new Date(cur.replied_at).toLocaleString() : ""}</p><p className="whitespace-pre-line">{cur.admin_reply}</p></div>}
                <Textarea aria-label="Reply" rows={5} placeholder={`Reply to ${cur.name}…`} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={5000} />
                <Button variant="gold" onClick={sendReply} disabled={busy}><Reply /> {busy ? "Sending…" : "Send reply"}</Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
