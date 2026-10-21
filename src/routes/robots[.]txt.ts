import { createFileRoute } from "@tanstack/react-router";
import { originOf, publicClient } from "@/lib/public-db";
import { buildRobots } from "@/lib/seo-files";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { data } = await publicClient().from("store_settings").select("robots_txt").eq("id", 1).maybeSingle();
        return new Response(buildRobots(data?.robots_txt, originOf(request)), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" },
        });
      },
    },
  },
});
