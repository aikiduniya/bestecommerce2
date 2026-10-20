import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pagesQuery } from "@/lib/store";
import { ContentEditor } from "@/components/admin/ContentEditor";

export const Route = createFileRoute("/_authenticated/admin/pages")({ component: PagesAdmin });

function PagesAdmin() {
  const { data = [] } = useQuery(pagesQuery);
  return <ContentEditor kind="pages" rows={data} queryKey="pages" />;
}
