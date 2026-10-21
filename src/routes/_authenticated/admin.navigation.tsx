import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { menusQuery, navItems, type NavItem } from "@/lib/sections";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/navigation")({ component: NavigationAdmin });

function NavigationAdmin() {
  const { data: menus = [] } = useQuery(menusQuery);
  const header = menus.find((m) => m.handle === "header");
  const footer = menus.find((m) => m.handle === "footer");

  return (
    <>
      <PageHeader title="Navigation" subtitle="Header and footer menus. Leave a menu empty to use the built-in links." />
      <div className="grid gap-6 lg:grid-cols-2">
        <MenuEditor menuId={header?.id} handle="header" title="Header menu" hint="Top-level items show in the header. Add sub-items to create a dropdown (mega menu)." items={navItems(header)} />
        <MenuEditor menuId={footer?.id} handle="footer" title="Footer menu" hint="Top-level items become footer columns; their sub-items are the links. Items without sub-items show as single links." items={navItems(footer)} />
      </div>
    </>
  );
}

function MenuEditor({ menuId, handle, title, hint, items: initial }: { menuId?: string; handle: string; title: string; hint: string; items: NavItem[] }) {
  const [items, setItems] = useState<NavItem[]>(initial);
  const [dirty, setDirty] = useState(false);
  const qc = useQueryClient();
  useEffect(() => setItems(initial), [JSON.stringify(initial)]);

  const save = useMutation({
    mutationFn: async () => {
      const clean = items.filter((i) => i.label.trim());
      if (menuId) {
        const { error } = await supabase.from("navigation_menus").update({ items: clean }).eq("id", menuId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("navigation_menus").insert({ handle, items: clean });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["navigation_menus"] }); setDirty(false); toast.success(`${title} saved`); },
    onError: (e) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<NavItem>) => { setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it))); setDirty(true); };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next); setDirty(true);
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Save</Button>
      </div>
      <div className="mt-5 space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded border p-3">
            <div className="flex items-center gap-2">
              <Input value={item.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Label" className="h-8" />
              <Input value={item.url} onChange={(e) => update(i, { url: e.target.value })} placeholder="/shop" className="h-8" />
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, -1)} aria-label="Move up">↑</Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, 1)} aria-label="Move down">↓</Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => { setItems(items.filter((_, j) => j !== i)); setDirty(true); }} aria-label="Remove"><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="ml-4 mt-2 space-y-2">
              {(item.children ?? []).map((ch, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <Input value={ch.label} onChange={(e) => { const children = [...(item.children ?? [])]; children[ci] = { ...ch, label: e.target.value }; update(i, { children }); }} placeholder="Sub-item label" className="h-7 text-xs" />
                  <Input value={ch.url} onChange={(e) => { const children = [...(item.children ?? [])]; children[ci] = { ...ch, url: e.target.value }; update(i, { children }); }} placeholder="/shop?category=…" className="h-7 text-xs" />
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => update(i, { children: (item.children ?? []).filter((_, j) => j !== ci) })} aria-label="Remove sub-item"><Trash2 className="size-3.5 text-destructive" /></Button>
                </div>
              ))}
              <button className="text-xs text-gold" onClick={() => update(i, { children: [...(item.children ?? []), { label: "", url: "/shop" }] })}>+ Add sub-item</button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => { setItems([...items, { label: "", url: "/shop" }]); setDirty(true); }}><Plus className="size-3.5" /> Add item</Button>
      </div>
    </Card>
  );
}
