import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { postsQuery } from "@/lib/store";
import { ContentEditor } from "@/components/admin/ContentEditor";

export const Route = createFileRoute("/_authenticated/admin/blog")({ component: BlogAdmin });

function BlogAdmin() {
  const { data = [] } = useQuery(postsQuery);
  return <ContentEditor kind="blog_posts" rows={data} queryKey="posts" />;
}
