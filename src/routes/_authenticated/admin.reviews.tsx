import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { productsQuery } from "@/lib/store";
import { PageHeader, StatusPill } from "@/components/admin/PageHeader";
import { Stars } from "@/components/store/ReviewsQA";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/reviews")({ component: ReviewsPage });

function ReviewsPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(productsQuery);
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";
  const [filter, setFilter] = useState("pending");
  const reviews = useQuery({ queryKey: ["admin-reviews"], queryFn: async () => (await supabase.from("reviews").select("*").order("created_at", { ascending: false })).data ?? [] });
  const questions = useQuery({ queryKey: ["admin-questions"], queryFn: async () => (await supabase.from("product_questions").select("*").order("created_at", { ascending: false })).data ?? [] });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-reviews"] }); qc.invalidateQueries({ queryKey: ["admin-questions"] }); qc.invalidateQueries({ queryKey: ["reviews"] }); qc.invalidateQueries({ queryKey: ["questions"] }); };
  async function setReview(id: string, status: string) {
    const { error } = await supabase.from("reviews").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Review ${status}`); refresh();
  }
  async function delReview(id: string) {
    if (!confirm("Delete this review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }
  async function answer(id: string, publish: boolean) {
    const text = (answers[id] ?? "").trim();
    if (publish && !text) { toast.error("Write an answer first"); return; }
    const { error } = await supabase.from("product_questions").update(publish ? { answer: text, answered_at: new Date().toISOString(), status: "published" } : { status: "hidden" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(publish ? "Answer published" : "Question hidden"); refresh();
  }
  async function delQ(id: string) {
    if (!confirm("Delete this question?")) return;
    const { error } = await supabase.from("product_questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  const rs = (reviews.data ?? []).filter((r) => filter === "all" || r.status === filter);
  const pendingQ = (questions.data ?? []).filter((q) => q.status === "pending").length;

  return (
    <>
      <PageHeader title="Reviews & Q&A" subtitle="Approve customer reviews and answer product questions. Only approved reviews and answered questions appear on the store." />
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Reviews ({(reviews.data ?? []).filter((r) => r.status === "pending").length} pending)</TabsTrigger>
          <TabsTrigger value="qa">Questions ({pendingQ} pending)</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews">
          <div className="mb-4 flex gap-2">{["pending", "approved", "rejected", "all"].map((s) => <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)} className="capitalize">{s}</Button>)}</div>
          <Card className="divide-y p-0">
            {rs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start gap-4 p-5">
                <div className="min-w-64 flex-1">
                  <div className="flex items-center gap-3"><Stars value={r.rating} /><span className="font-medium">{r.title}</span><StatusPill value={r.status} /></div>
                  <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{r.author_name} · {pname(r.product_id)}{r.verified_purchase && " · ✓ Verified buyer"} · {new Date(r.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {r.status !== "approved" && <Button size="sm" variant="gold" onClick={() => setReview(r.id, "approved")}>Approve</Button>}
                  {r.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setReview(r.id, "rejected")}>Reject</Button>}
                  <Button size="icon" variant="ghost" onClick={() => delReview(r.id)} aria-label="Delete"><Trash2 /></Button>
                </div>
              </div>
            ))}
            {rs.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing here.</p>}
          </Card>
        </TabsContent>
        <TabsContent value="qa">
          <Card className="divide-y p-0">
            {(questions.data ?? []).map((q) => (
              <div key={q.id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-3"><p className="font-medium">{q.question}</p><StatusPill value={q.status} /></div>
                <p className="text-xs text-muted-foreground">{q.author_name} · {pname(q.product_id)} · {new Date(q.created_at).toLocaleString()}</p>
                <Textarea placeholder="Your answer" defaultValue={q.answer ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" variant="gold" onClick={() => answer(q.id, true)}>{q.answer ? "Update answer" : "Publish answer"}</Button>
                  {q.status !== "hidden" && <Button size="sm" variant="outline" onClick={() => answer(q.id, false)}>Hide</Button>}
                  <Button size="icon" variant="ghost" onClick={() => delQ(q.id)} aria-label="Delete"><Trash2 /></Button>
                </div>
              </div>
            ))}
            {(questions.data ?? []).length === 0 && <p className="p-6 text-sm text-muted-foreground">No questions yet.</p>}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
