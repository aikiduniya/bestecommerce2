import { Plus, Trash2, Wand2 } from "lucide-react";
import type { ProductOption } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type VariantDraft = {
  id?: string | undefined;
  options: Record<string, string>;
  sku: string;
  price: string;
  compare_at_price: string;
  sale_price: string;
  stock: number;
  image_url: string;
  is_active: boolean;
};

const key = (o: Record<string, string>) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));

function cartesian(opts: ProductOption[]): Record<string, string>[] {
  return opts.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))),
    [{}],
  );
}

export function VariantsEditor({
  options, setOptions, variants, setVariants, images, baseSku,
}: {
  options: ProductOption[];
  setOptions: (o: ProductOption[]) => void;
  variants: VariantDraft[];
  setVariants: (v: VariantDraft[]) => void;
  images: string[];
  baseSku?: string | null | undefined;
}) {
  function generate() {
    const clean = options.filter((o) => o.name.trim() && o.values.length);
    if (!clean.length) return setVariants([]);
    const combos = cartesian(clean);
    const existing = new Map(variants.map((v) => [key(v.options), v]));
    setVariants(
      combos.map((c) => existing.get(key(c)) ?? {
        options: c,
        sku: baseSku ? `${baseSku}-${Object.values(c).join("-").toUpperCase().replace(/\s+/g, "")}` : "",
        price: "", compare_at_price: "", sale_price: "", stock: 0, image_url: "", is_active: true,
      }),
    );
  }
  const upd = (i: number, patch: Partial<VariantDraft>) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input className="w-40" placeholder="Option (e.g. Size)" value={o.name} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <Input
              placeholder="Values, comma separated (e.g. S, M, L)"
              defaultValue={o.values.join(", ")}
              onBlur={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => setOptions(options.filter((_, j) => j !== i))} aria-label="Remove option"><Trash2 /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOptions([...options, { name: "", values: [] }])}><Plus /> Add option</Button>
          {options.length > 0 && <Button type="button" size="sm" variant="gold" onClick={generate}><Wand2 /> Generate variants</Button>}
        </div>
      </div>
      {variants.length > 0 && (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr><th className="p-2">Variant</th><th className="p-2">SKU</th><th className="p-2">Price</th><th className="p-2">Compare</th><th className="p-2">Sale</th><th className="p-2">Stock</th><th className="p-2">Image</th><th className="p-2">On</th></tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={key(v.options)} className="border-t">
                  <td className="whitespace-nowrap p-2 font-medium">{Object.values(v.options).join(" / ")}</td>
                  <td className="p-1"><Input className="h-8 w-32 text-xs" value={v.sku} onChange={(e) => upd(i, { sku: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 w-20 text-xs" type="number" step="0.01" min="0" placeholder="Base" value={v.price} onChange={(e) => upd(i, { price: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 w-20 text-xs" type="number" step="0.01" min="0" value={v.compare_at_price} onChange={(e) => upd(i, { compare_at_price: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 w-20 text-xs" type="number" step="0.01" min="0" placeholder="Sale" value={v.sale_price} onChange={(e) => upd(i, { sale_price: e.target.value })} /></td>
                  <td className="p-1"><Input className="h-8 w-16 text-xs" type="number" min="0" value={v.stock} onChange={(e) => upd(i, { stock: Math.max(0, Number(e.target.value)) })} /></td>
                  <td className="p-1">
                    <select className="h-8 w-24 rounded border bg-background text-xs" value={v.image_url} onChange={(e) => upd(i, { image_url: e.target.value })}>
                      <option value="">Default</option>
                      {images.map((u, k) => <option key={u} value={u}>Image {k + 1}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><Switch checked={v.is_active} onCheckedChange={(c) => upd(i, { is_active: c })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-2 text-[11px] text-muted-foreground">Leave price empty to use the base price. Product stock is the total of all variants.</p>
        </div>
      )}
    </div>
  );
}
