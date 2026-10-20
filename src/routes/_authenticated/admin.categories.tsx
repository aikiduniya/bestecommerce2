import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { categoriesQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { SimpleTaxonomy } from "@/components/admin/SimpleTaxonomy";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: () => {
    const { data = [] } = useQuery(categoriesQuery);
    return (
      <>
        <PageHeader title="Categories" subtitle="Organize your catalog. Rename inline; toggle visibility on the storefront." />
        <SimpleTaxonomy table="categories" rows={data} noun="Category" />
      </>
    );
  },
});
