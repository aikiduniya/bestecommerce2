import { useQuery } from "@tanstack/react-query";
import { allVariantsQuery } from "@/lib/store";

/** Lowest variant price per product (for "From $X" labels). */
export function useFromPrice() {
  const { data: variants = [] } = useQuery(allVariantsQuery);
  return (productId: string) => {
    const ps = variants.filter((v) => v.product_id === productId && v.price !== null).map((v) => Number(v.price));
    return ps.length ? Math.min(...ps) : undefined;
  };
}
