import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Heart, Search, ShoppingBag, User, Menu, X, ChevronDown } from "lucide-react";
import { categoriesQuery, pagesQuery, settingsQuery } from "@/lib/store";
import { menusQuery, navItems } from "@/lib/sections";
import { useCart } from "@/lib/cart";
import { useIsStaff, useSessionUser } from "@/lib/auth";

export function StoreLayout({ children }: { children: ReactNode }) {
  const { data: s, isLoading } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: pages = [] } = useQuery(pagesQuery);
  const { data: menus = [] } = useQuery(menusQuery);
  const { user } = useSessionUser();
  const isStaff = useIsStaff(user?.id);
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const topCats = cats.filter((c) => c.is_active && !c.parent_id);
  const headerItems = navItems(menus.find((m) => m.handle === "header"));
  const footerItems = navItems(menus.find((m) => m.handle === "footer"));

  if (s?.maintenance_mode && !isStaff) {
    return (
      <div className="bg-hero flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center text-primary-foreground">
        <p className="eyebrow text-gold">Temporarily closed</p>
        <h1 className="text-6xl">{s.store_name}</h1>
        <p className="opacity-70">We're polishing things up. Please check back shortly.</p>
        <Link to="/auth" className="mt-6 text-xs opacity-50 hover:opacity-100">Staff sign in</Link>
      </div>
    );
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: q || undefined } });
    setOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {s?.maintenance_mode && isStaff && (
        <div className="bg-warning py-1.5 text-center text-xs font-medium text-foreground">Maintenance mode is ON — only staff can see the store.</div>
      )}
      {s?.announcement_enabled && s.announcement && (
        <div className="bg-primary py-2 text-center text-xs tracking-wide text-primary-foreground">{s.announcement}</div>
      )}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 md:px-6">
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
          <Link to="/" className="shrink-0">
            {s?.logo_url ? <img src={s.logo_url} alt={s.store_name} className="h-8" /> : <span className="font-display text-3xl">{isLoading ? "\u00a0" : s?.store_name}</span>}
          </Link>
          <nav className="hidden flex-1 justify-center gap-7 text-sm md:flex">
            {headerItems.length > 0 ? (
              headerItems.map((item, i) =>
                item.children?.length ? (
                  <div key={i} className="group relative">
                    <a href={item.url} className="flex items-center gap-1 hover:text-gold">{item.label}<ChevronDown className="size-3.5" /></a>
                    <div className="invisible absolute left-1/2 top-full z-50 min-w-44 -translate-x-1/2 rounded border bg-card p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                      {item.children.map((ch, j) => (
                        <a key={j} href={ch.url} className="block rounded px-3 py-2 hover:bg-secondary hover:text-gold">{ch.label}</a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <a key={i} href={item.url} className="hover:text-gold">{item.label}</a>
                ),
              )
            ) : (
              <>
                <Link to="/shop" className="hover:text-gold" activeProps={{ className: "text-gold" }} activeOptions={{ includeSearch: false, exact: true }}>Shop all</Link>
                {topCats.slice(0, 6).map((c) => (
                  <Link key={c.id} to="/shop" search={{ category: c.slug }} className="hover:text-gold">{c.name}</Link>
                ))}
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-4 md:ml-0">
            <form onSubmit={search} className="relative hidden lg:block">
              <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-8 w-44 rounded-full border bg-card pl-8 pr-3 text-sm outline-none focus:border-gold" />
            </form>
            <Link to="/account" aria-label="Wishlist" className="hover:text-gold"><Heart className="size-5" /></Link>
            <Link to={user ? (isStaff ? "/admin" : "/account") : "/auth"} aria-label="Account" className="hover:text-gold"><User className="size-5" /></Link>
            <Link to="/cart" aria-label="Cart" className="relative hover:text-gold">
              <ShoppingBag className="size-5" />
              {count > 0 && <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-accent-foreground">{count}</span>}
            </Link>
          </div>
        </div>
        {open && (
          <div className="space-y-3 border-t px-4 py-4 md:hidden">
            <form onSubmit={search}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="h-10 w-full rounded border bg-card px-3 text-sm" /></form>
            <Link to="/shop" className="block py-1" onClick={() => setOpen(false)}>Shop all</Link>
            {topCats.map((c) => <Link key={c.id} to="/shop" search={{ category: c.slug }} className="block py-1" onClick={() => setOpen(false)}>{c.name}</Link>)}
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-20 border-t bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-4">
          <div>
            <p className="font-display text-2xl">{s?.store_name}</p>
            <p className="mt-2 text-sm text-muted-foreground">{s?.tagline}</p>
          </div>
          <div className="text-sm">
            <p className="eyebrow mb-3 text-muted-foreground">Shop</p>
            {topCats.slice(0, 5).map((c) => <Link key={c.id} to="/shop" search={{ category: c.slug }} className="block py-1 hover:text-gold">{c.name}</Link>)}
          </div>
          <div className="text-sm">
            <p className="eyebrow mb-3 text-muted-foreground">Information</p>
            <Link to="/blog" className="block py-1 hover:text-gold">Journal</Link>
            {pages.filter((pg) => pg.is_published && pg.show_in_footer).map((pg) => <Link key={pg.id} to="/pages/$slug" params={{ slug: pg.slug }} className="block py-1 hover:text-gold">{pg.title}</Link>)}
          </div>
          <div className="text-sm">
            <p className="eyebrow mb-3 text-muted-foreground">Contact</p>
            {s?.support_email && <p>{s.support_email}</p>}
            {s?.support_phone && <p>{s.support_phone}</p>}
          </div>
        </div>
        <p className="border-t py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {s?.store_name}</p>
      </footer>
    </div>
  );
}
