import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return <span className="inline-flex">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`${size} ${i <= Math.round(value) ? "fill-gold text-gold" : "text-muted-foreground/40"}`} />)}</span>;
}

export function ReviewsQA({ productId, reviewsEnabled }: { productId: string; reviewsEnabled: boolean }) {
  const { user } = useSessionUser();
  const qc = useQueryClient();
  const reviews = useQuery({
    queryKey: ["reviews", productId, user?.id],
    queryFn: async () => (await supabase.from("reviews").select("*").eq("product_id", productId).order("created_at", { ascending: false })).data ?? [],
  });
  const questions = useQuery({
    queryKey: ["questions", productId, user?.id],
    queryFn: async () => (await supabase.from("product_questions").select("*").eq("product_id", productId).order("created_at", { ascending: false })).data ?? [],
  });
  const [r, setR] = useState({ rating: 5, title: "", body: "", name: "" });
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const approved = (reviews.data ?? []).filter((x) => x.status === "approved");
  const mine = (reviews.data ?? []).find((x) => x.user_id === user?.id);
  const avg = approved.length ? approved.reduce((a, b) => a + b.rating, 0) / approved.length : 0;
  const displayName = r.name.trim() || user?.email?.split("@")[0] || "Customer";

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (r.body.trim().length < 3) { toast.error("Please write a few words"); return; }
    setBusy(true);
    const { error } = await supabase.from("reviews").insert({ product_id: productId, user_id: user.id, author_name: displayName, rating: r.rating, title: r.title.trim() || null, body: r.body.trim() });
    setBusy(false);
    if (error) { toast.error(error.code === "23505" ? "You've already reviewed this product" : error.message); return; }
    toast.success("Thanks! Your review was submitted.");
    setR({ rating: 5, title: "", body: "", name: "" });
    qc.invalidateQueries({ queryKey: ["reviews", productId] });
  }
  async function submitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!user || q.trim().length < 3) return;
    setBusy(true);
    const { error } = await supabase.from("product_questions").insert({ product_id: productId, user_id: user.id, author_name: displayName, question: q.trim() });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Question sent — we'll answer it soon.");
    setQ("");
    qc.invalidateQueries({ queryKey: ["questions", productId] });
  }

  const visibleQs = (questions.data ?? []).filter((x) => x.status === "published" || x.user_id === user?.id);

  return (
    <section className="mt-24 grid gap-14 md:grid-cols-2">
      <div>
        <h2 className="text-4xl">Reviews</h2>
        <p className="mt-2 flex items-center gap-3 text-sm text-muted-foreground"><Stars value={avg} /> {approved.length ? `${avg.toFixed(1)} · ${approved.length} review${approved.length > 1 ? "s" : ""}` : "No reviews yet"}</p>
        <div className="mt-6 divide-y">
          {approved.map((x) => (
            <div key={x.id} className="py-5">
              <div className="flex items-center gap-3"><Stars value={x.rating} /><span className="text-sm font-medium">{x.title}</span></div>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{x.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">{x.author_name}{x.verified_purchase && <span className="ml-2 text-success">✓ Verified buyer</span>} · {new Date(x.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
        {reviewsEnabled && (
          !user ? <p className="mt-6 text-sm text-muted-foreground">Sign in to write a review.</p>
          : mine ? <p className="mt-6 text-sm text-muted-foreground">{mine.status === "pending" ? "Your review is waiting for approval." : mine.status === "rejected" ? "Your review was not published." : "Thanks for your review!"}</p>
          : (
            <form onSubmit={submitReview} className="mt-6 space-y-3 rounded border p-5">
              <p className="text-sm font-medium">Write a review</p>
              <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} aria-label={`${i} stars`} onClick={() => setR({ ...r, rating: i })}><Star className={`size-6 ${i <= r.rating ? "fill-gold text-gold" : "text-muted-foreground/40"}`} /></button>)}</div>
              <Input placeholder="Your name (shown publicly)" value={r.name} maxLength={60} onChange={(e) => setR({ ...r, name: e.target.value })} />
              <Input placeholder="Title" value={r.title} maxLength={120} onChange={(e) => setR({ ...r, title: e.target.value })} />
              <Textarea placeholder="What did you think?" value={r.body} maxLength={3000} onChange={(e) => setR({ ...r, body: e.target.value })} />
              <Button type="submit" disabled={busy}>Submit review</Button>
            </form>
          )
        )}
      </div>
      <div>
        <h2 className="text-4xl">Questions & answers</h2>
        <div className="mt-6 divide-y">
          {visibleQs.length === 0 && <p className="py-4 text-sm text-muted-foreground">No questions yet.</p>}
          {visibleQs.map((x) => (
            <div key={x.id} className="py-5 text-sm">
              <p className="font-medium">Q: {x.question}</p>
              {x.answer ? <p className="mt-2 text-muted-foreground">A: {x.answer}</p> : <p className="mt-2 text-xs text-muted-foreground">Awaiting answer</p>}
            </div>
          ))}
        </div>
        {!user ? <p className="mt-6 text-sm text-muted-foreground">Sign in to ask a question.</p> : (
          <form onSubmit={submitQuestion} className="mt-6 flex gap-2">
            <Input placeholder="Ask about this product" value={q} maxLength={1000} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" variant="outline" disabled={busy}>Ask</Button>
          </form>
        )}
      </div>
    </section>
  );
}
