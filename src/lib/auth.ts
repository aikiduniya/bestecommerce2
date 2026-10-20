import { queryOptions, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Client-side session hook for showing account state in the storefront header. */
export function useSessionUser() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return { user, ready };
}

export const rolesQuery = (uid: string | undefined) =>
  queryOptions({
    queryKey: ["roles", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid!);
      return (data ?? []).map((r) => r.role);
    },
  });

export function useIsStaff(uid: string | undefined) {
  const { data = [] } = useQuery(rolesQuery(uid));
  return data.includes("admin") || data.includes("staff");
}
