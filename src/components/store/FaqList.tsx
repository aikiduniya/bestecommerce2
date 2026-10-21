import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { faqCategoriesQuery, faqsQuery } from "@/lib/store";

/** Published FAQs grouped by category. `homeOnly` limits to FAQs marked for the homepage. */
export function FaqList({ homeOnly = false, limit }: { homeOnly?: boolean; limit?: number }) {
  const { data: cats = [] } = useQuery(faqCategoriesQuery);
  const { data: all = [] } = useQuery(faqsQuery);
  let faqs = all.filter((f) => f.is_published && (!homeOnly || f.show_on_home));
  if (limit) faqs = faqs.slice(0, limit);
  if (!faqs.length) return null;
  const groups = [...cats.map((c) => ({ id: c.id as string | null, name: c.name })), { id: null, name: "General" }]
    .map((g) => ({ ...g, items: faqs.filter((f) => f.category_id === g.id) }))
    .filter((g) => g.items.length);
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <div key={g.id ?? "none"}>
          {groups.length > 1 && <p className="eyebrow mb-3 text-gold">{g.name}</p>}
          <div className="divide-y rounded border bg-card">
            {g.items.map((f) => (
              <details key={f.id} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium group-open:text-gold">
                  {f.question}<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
