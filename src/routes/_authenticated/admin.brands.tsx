import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { brandsQuery } from "@/lib/store";
import { PageHeader } from "@/components/admin/PageHeader";
import { SimpleTaxonomy } from "@/components/admin/SimpleTaxonomy";

export const Route = createFileRoute("/_authenticated/admin/brands")({
  component: () => {
    const { data = [] } = useQuery(brandsQuery);
    return (
      <>
        <PageHeader title="Brands" subtitle="Manage the brands you carry." />
        <SimpleTaxonomy table="brands" rows={data} noun="Brand" />
      </>
    );
  },
});
