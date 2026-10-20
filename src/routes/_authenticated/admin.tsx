import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Package, FolderTree, Tag, ShoppingBag, Settings, LogOut, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role);
    return { isAdmin: roles.includes("admin"), isStaff: roles.includes("admin") || roles.includes("staff") };
  },
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/brands", label: "Brands", icon: Tag },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/settings", label: "Store Settings", icon: Settings },
] as const;

function AdminLayout() {
  const { isStaff, user } = Route.useRouteContext();
  const { data: settings } = useQuery(settingsQuery);
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-4xl">Access restricted</h1>
        <p className="text-muted-foreground">Your account ({user.email}) does not have admin access.</p>
        <Button onClick={signOut}>Sign out</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-6 py-6">
          <p className="eyebrow text-sidebar-primary">Super Admin</p>
          <p className="mt-1 font-display text-2xl text-sidebar-accent-foreground">{settings?.store_name ?? "Store"}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
            <Store className="size-4" /> View storefront
          </Link>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
            <LogOut className="size-4" /> Sign out
          </button>
          <p className="truncate px-3 pt-2 text-xs opacity-50">{user.email}</p>
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex gap-2 overflow-x-auto border-b bg-card p-2 md:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="whitespace-nowrap rounded px-3 py-1.5 text-sm" activeProps={{ className: "bg-primary text-primary-foreground" }}>
              {n.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto max-w-7xl p-6 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

