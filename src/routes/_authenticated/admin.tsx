import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Package, FolderTree, Tag, ShoppingBag, Settings, LogOut, Store, Layers, Image, Truck, Users, ShieldCheck, History, BarChart3, TicketPercent, MessageSquareText, FileText, Newspaper, LayoutTemplate, MenuSquare, BadgePercent, PanelLeftClose, PanelLeftOpen, Globe, Mail, RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", context.user.id);
    const roles = (data ?? []).map((r) => r.role);
    const isAdmin = roles.includes("admin");
    let perms: string[] = [];
    let isStaff = isAdmin;
    if (!isAdmin && roles.includes("staff")) {
      const { data: m } = await supabase.from("staff_members").select("is_active, staff_roles(permissions)").eq("user_id", context.user.id).maybeSingle();
      isStaff = !!m?.is_active;
      perms = m?.is_active ? ((m.staff_roles as { permissions: string[] } | null)?.permissions ?? []) : [];
    }
    return { isAdmin, isStaff, perms };
  },
  component: AdminLayout,
});

const groups = [
  { label: "Overview", items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true, perm: null }] },
  {
    label: "Catalog",
    items: [
      { perm: "catalog", to: "/admin/products", label: "Products", icon: Package },
      { perm: "catalog", to: "/admin/categories", label: "Categories", icon: FolderTree },
      { perm: "catalog", to: "/admin/collections", label: "Collections", icon: Layers },
      { perm: "catalog", to: "/admin/brands", label: "Brands", icon: Tag },
      { perm: "catalog", to: "/admin/media", label: "Media library", icon: Image },
    ],
  },
  {
    label: "Sales",
    items: [
      { perm: "orders", to: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { perm: "orders", to: "/admin/returns", label: "Returns", icon: RotateCcw },
      { perm: "customers", to: "/admin/customers", label: "Customers", icon: Users },
      { perm: "admin", to: "/admin/shipping", label: "Shipping", icon: Truck },
    ],
  },
  {
    label: "Marketing & content",
    items: [
      { perm: "marketing", to: "/admin/coupons", label: "Coupons & promos", icon: TicketPercent },
      { perm: "marketing", to: "/admin/discounts", label: "Automatic discounts", icon: BadgePercent },
      { perm: "content", to: "/admin/homepage", label: "Homepage builder", icon: LayoutTemplate },
      { perm: "content", to: "/admin/navigation", label: "Navigation", icon: MenuSquare },
      { perm: "content", to: "/admin/reviews", label: "Reviews & Q&A", icon: MessageSquareText },
      { perm: "content", to: "/admin/pages", label: "Pages", icon: FileText },
      { perm: "content", to: "/admin/blog", label: "Blog", icon: Newspaper },
      { perm: "content", to: "/admin/translations", label: "Translations", icon: Globe },
    ],
  },
  {
    label: "Store",
    items: [
      { perm: "orders", to: "/admin/reports", label: "Reports", icon: BarChart3 },
      { perm: "admin", to: "/admin/staff", label: "Staff & roles", icon: ShieldCheck },
      { perm: "admin", to: "/admin/activity", label: "Activity log", icon: History },
      { perm: "admin", to: "/admin/emails", label: "Emails", icon: Mail },
      { perm: "admin", to: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

function AdminLayout() {
  const { isStaff, isAdmin, perms, user } = Route.useRouteContext();
  const { pathname } = useLocation();
  const can = (p: string | null) => p === null || isAdmin || (p !== "admin" && perms.includes(p));
  const { data: settings } = useQuery(settingsQuery);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("admin_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem("admin_sidebar_collapsed", c ? "0" : "1"); } catch { /* ignore */ }
    return !c;
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // Two-factor gate: staff/admins with an active authenticator must confirm a code
  // once per session before the dashboard opens.
  const [mfaState, setMfaState] = useState<"loading" | "ok" | "challenge">("loading");
  const [mfaFactor, setMfaFactor] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  useEffect(() => {
    void (async () => {
      const { data: f } = await supabase.auth.mfa.listFactors();
      const v = (f?.totp ?? []).find((x) => x.status === "verified");
      if (!v) { setMfaState("ok"); return; }
      const { data: a } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (a?.currentLevel === "aal2") { setMfaState("ok"); return; }
      setMfaFactor(v.id);
      setMfaState("challenge");
    })();
  }, []);

  async function verifyMfa() {
    if (!mfaFactor || mfaCode.trim().length !== 6) { toast.error("Enter the 6-digit code from your app"); return; }
    setMfaBusy(true);
    const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: mfaFactor });
    if (e1) { setMfaBusy(false); toast.error(e1.message); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactor, challengeId: ch.id, code: mfaCode.trim() });
    setMfaBusy(false);
    if (error) { toast.error("That code didn't work — try again"); return; }
    setMfaState("ok");
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

  if (mfaState === "loading") return null;
  if (mfaState === "challenge") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-4xl">Two-factor check</h1>
        <p className="max-w-sm text-muted-foreground">Your account has two-factor authentication. Enter the 6-digit code from your authenticator app to open the dashboard.</p>
        <div className="flex gap-2">
          <Input inputMode="numeric" maxLength={6} placeholder="123456" value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))} className="w-36 text-center" onKeyDown={(e) => { if (e.key === "Enter") void verifyMfa(); }} />
          <Button variant="gold" onClick={verifyMfa} disabled={mfaBusy}>{mfaBusy ? "Checking…" : "Verify"}</Button>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
      </div>
    );
  }

  const visible = groups.map((g) => ({ ...g, items: g.items.filter((n) => can(n.perm)) })).filter((g) => g.items.length);
  const flat = visible.flatMap((g) => g.items);
  const current = groups.flatMap((g) => g.items as readonly { to: string; perm: string | null }[]).find((n) => n.to !== "/admin" && pathname.startsWith(n.to));
  const allowed = !current || can(current.perm);

  return (
    <div className="flex min-h-screen bg-muted">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] md:flex ${collapsed ? "w-16" : "w-64"}`}>
        <div className={`flex items-center border-b border-sidebar-border py-6 ${collapsed ? "justify-center px-2" : "justify-between px-6"}`}>
          {!collapsed && (
            <div className="min-w-0">
              <p className="eyebrow text-sidebar-primary">{isAdmin ? "Super Admin" : "Staff"}</p>
              <p className="mt-1 truncate font-display text-2xl text-sidebar-accent-foreground">{settings?.store_name ?? "Store"}</p>
            </div>
          )}
          <button onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="rounded-md p-1.5 hover:bg-sidebar-accent">
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {visible.map((g) => (
            <div key={g.label}>
              {!collapsed && <p className="eyebrow mb-1 px-3 text-[10px] opacity-40">{g.label}</p>}
              {g.items.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  title={n.label}
                  activeOptions={{ exact: "exact" in n }}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : ""}`}
                  activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
                >
                  <n.icon className="size-4 shrink-0" />
                  {!collapsed && n.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <Link to="/" title="View storefront" className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : ""}`}><Store className="size-4 shrink-0" /> {!collapsed && "View storefront"}</Link>
          <button onClick={signOut} title="Sign out" className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent ${collapsed ? "justify-center px-0" : ""}`}><LogOut className="size-4 shrink-0" /> {!collapsed && "Sign out"}</button>
          {!collapsed && <p className="truncate px-3 pt-2 text-xs opacity-50">{user.email}</p>}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <AdminTopbar isAdmin={isAdmin} perms={perms} />
        <div className="flex gap-1 overflow-x-auto border-b bg-sidebar p-2 text-sidebar-foreground md:hidden">
          {flat.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: "exact" in n }} className="flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-xs" activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}>
              <n.icon className="size-3.5" />{n.label}
            </Link>
          ))}
        </div>
        <main className="mx-auto max-w-7xl p-5 md:p-10">
          {allowed ? <Outlet /> : <div className="py-24 text-center"><h1 className="text-4xl">No permission</h1><p className="mt-2 text-muted-foreground">Ask the Super Admin to give your role access to this section.</p></div>}
        </main>
      </div>
    </div>
  );
}
