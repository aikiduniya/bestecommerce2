import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { faqCategoriesQuery, faqsQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/faqs")({ component: FaqsAdmin });

function FaqsAdmin() {
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery(faqCategoriesQuery);
  const { data: faqs = [] } = useQuery(faqsQuery);
  const [catName, setCatName] = useState("");
  const [draft, setDraft] = useState({ question: "", answer: "", category_id: "" });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["faqs"] }); void qc.invalidateQueries({ queryKey: ["faq_categories"] }); };
  const err = (e: { message: string } | null) => { if (e) { toast.error(e.message); return true; } return false; };

  async function addCat(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;
    if (err((await supabase.from("faq_categories").insert({ name: catName.trim(), sort_order: cats.length + 1 })).error)) return;
    setCatName(""); refresh();
  }
  async function addFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.question.trim() || !draft.answer.trim()) { toast.error("Question and answer are required"); return; }
    if (err((await supabase.from("faqs").insert({ question: draft.question.trim(), answer: draft.answer.trim(), category_id: draft.category_id || null, sort_order: faqs.length + 1 })).error)) return;
    setDraft({ question: "", answer: "", category_id: draft.category_id }); toast.success("FAQ added"); refresh();
  }
  async function upd(id: string, patch: Record<string, unknown>) { if (!err((await supabase.from("faqs").update(patch as never).eq("id", id)).error)) refresh(); }
  async function updCat(id: string, patch: Record<string, unknown>) { if (!err((await supabase.from("faq_categories").update(patch as never).eq("id", id)).error)) refresh(); }
  async function move(list: { id: string; sort_order: number }[], i: number, dir: -1 | 1, table: "faqs" | "faq_categories") {
    const a = list[i], b = list[i + dir];
    if (!a || !b) return;
    await supabase.from(table).update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from(table).update({ sort_order: a.sort_order === b.sort_order ? a.sort_order + dir : a.sort_order }).eq("id", b.id);
    refresh();
  }
  const sel = "h-9 rounded-md border bg-background px-3 text-sm";
  const groups = [...cats.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null, name: "No category" }];

  return (
    <>
      <PageHeader title="FAQs" subtitle="Questions shown on the FAQs page and in the homepage FAQ section." />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit space-y-4 p-6">
          <p className="text-sm font-medium">Categories</p>
          <form onSubmit={addCat} className="flex gap-2"><Input aria-label="New category" placeholder="New category" value={catName} onChange={(e) => setCatName(e.target.value)} /><Button type="submit" variant="gold" size="icon" aria-label="Add category"><Plus /></Button></form>
          <div className="divide-y">
            {cats.map((c, i) => (
              <div key={c.id} className="flex items-center gap-1 py-2">
                <Input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && void updCat(c.id, { name: e.target.value })} />
                <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => void move(cats, i, -1, "faq_categories")}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => void move(cats, i, 1, "faq_categories")}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" aria-label="Delete category" onClick={async () => { if (confirm(`Delete "${c.name}"? Its questions move to No category.`) && !err((await supabase.from("faq_categories").delete().eq("id", c.id)).error)) refresh(); }}><Trash2 /></Button>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="p-6">
            <form onSubmit={addFaq} className="space-y-3">
              <p className="text-sm font-medium">Add a question</p>
              <Input aria-label="Question" placeholder="Question" value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
              <Textarea aria-label="Answer" placeholder="Answer" rows={3} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
              <div className="flex gap-2"><select aria-label="Category" className={sel} value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button type="submit" variant="gold"><Plus /> Add FAQ</Button></div>
            </form>
          </Card>
          {groups.map((g) => {
            const items = faqs.filter((f) => f.category_id === g.id);
            if (!items.length) return null;
            return (
              <Card key={g.id ?? "none"} className="p-6">
                <p className="eyebrow mb-3 text-gold">{g.name}</p>
                <div className="divide-y">
                  {items.map((f, i) => (
                    <div key={f.id} className="space-y-2 py-4">
                      <div className="flex gap-2">
                        <Input defaultValue={f.question} onBlur={(e) => e.target.value !== f.question && void upd(f.id, { question: e.target.value })} />
                        <Button size="icon" variant="ghost" aria-label="Move up" onClick={() => void move(items, i, -1, "faqs")}><ArrowUp /></Button>
                        <Button size="icon" variant="ghost" aria-label="Move down" onClick={() => void move(items, i, 1, "faqs")}><ArrowDown /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete FAQ" onClick={async () => { if (confirm("Delete this FAQ?") && !err((await supabase.from("faqs").delete().eq("id", f.id)).error)) refresh(); }}><Trash2 /></Button>
                      </div>
                      <Textarea rows={2} defaultValue={f.answer} onBlur={(e) => e.target.value !== f.answer && void upd(f.id, { answer: e.target.value })} />
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <select aria-label="Move to category" className="h-8 rounded border bg-background px-2" value={f.category_id ?? ""} onChange={(e) => void upd(f.id, { category_id: e.target.value || null })}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                        <label className="flex items-center gap-2"><Switch checked={f.is_published} onCheckedChange={(v) => void upd(f.id, { is_published: v })} /> Published</label>
                        <label className="flex items-center gap-2"><Switch checked={f.show_on_home} onCheckedChange={(v) => void upd(f.id, { show_on_home: v })} /> On homepage</label>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
