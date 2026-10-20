import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Package, FolderTree, Tag, ShoppingBag, Settings, LogOut, Store, Layers, Image, Truck, Users,
} from "lucide-react";
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

const groups = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  {
    label: "Catalog",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: FolderTree },
      { to: "/admin/collections", label: "Collections", icon: Layers },
      { to: "/admin/brands", label: "Brands", icon: Tag },
      { to: "/admin/media", label: "Media library", icon: Image },
    ],
  },
  {
    label: "Sales",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { to: "/admin/customers", label: "Customers", icon: Users },
      { to: "/admin/shipping", label: "Shipping", icon: Truck },
    ],
  },
  { label: "Store", items: [{ to: "/admin/settings", label: "Settings", icon: Settings }] },
] as const;

function AdminLayout() {
  const { isStaff, user } = Route.useRouteContext();
  const { data: settings } = useQuery(settingsQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-4xl">Access restricted</h1>
        <p className="text-muted-foreground">Your account ({user.email}) does not have admin access.</p>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/account">My account</Link></Button>
          <Button onClick={signOut}>Sign out</Button>
        </div>
      </div>
    );
  }

  const flat = groups.flatMap((g) => g.items);

  return (
    <div className="flex min-h-screen bg-muted">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-6 py-6">
          <p className="eyebrow text-sidebar-primary">Super Admin</p>
          <p className="mt-1 truncate font-display text-2xl text-sidebar-accent-foreground">{settings?.store_name ?? "Store"}</p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="eyebrow mb-1 px-3 text-[10px] opacity-40">{g.label}</p>
              {g.items.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  activeOptions={{ exact: "exact" in n }}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
                >
                  <n.icon className="size-4" />
                  {n.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"><Store className="size-4" /> View storefront</Link>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"><LogOut className="size-4" /> Sign out</button>
          <p className="truncate px-3 pt-2 text-xs opacity-50">{user.email}</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex gap-1 overflow-x-auto border-b bg-sidebar p-2 text-sidebar-foreground md:hidden">
          {flat.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs" activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}>
              <n.icon className="size-3.5" />{n.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto max-w-7xl p-5 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
