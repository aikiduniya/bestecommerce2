import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Heart, Search, ShoppingBag, User, Menu, X, ChevronDown } from "lucide-react";
import { categoriesQuery, pagesQuery, settingsQuery } from "@/lib/store";
import { menusQuery, navItems } from "@/lib/sections";
import { useCart } from "@/lib/cart";
import { useIsStaff, useSessionUser } from "@/lib/auth";
import { extraCurrencies, initDisplayCurrency, setDisplayCurrency, useDisplayCurrency } from "@/lib/currency";
import { DEFAULT_LANG, extraLanguages, initLang, langDir, langUrl, setLang, translate, useLang, useLangParam } from "@/lib/i18n";

export function StoreLayout({ children }: { children: ReactNode }) {
  const { data: s } = useQuery(settingsQuery);
  const { data: cats = [] } = useQuery(categoriesQuery);
  const { data: pages = [] } = useQuery(pagesQuery);
  const { data: menus = [] } = useQuery(menusQuery);
  const { user } = useSessionUser();
  const isStaff = useIsStaff(user?.id);
  const { count } = useCart();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  // Banner content depends on client-only state (settings fetch, staff check);
  // render it only after mount so SSR and first client render match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const topCats = cats.filter((c) => c.is_active && !c.parent_id);
  const headerItems = navItems(menus.find((m) => m.handle === "header"));
  const footerItems = navItems(menus.find((m) => m.handle === "footer"));

  // Multi-currency display: restore the visitor's choice after mount, keep it valid.
  const dc = useDisplayCurrency();
  const baseCurrency = s?.currency ?? "USD";
  const extras = extraCurrencies(s?.currencies);
  useEffect(() => { initDisplayCurrency(); }, []);

  // Storefront language: restore the visitor's choice after mount, keep it valid,
  // and reflect language + direction on <html> for correct RTL rendering.
  const lang = useLang();
  const langs = extraLanguages(s?.languages);
  const t = (key: string) => translate(s?.translations, lang, key);
  const urlLang = useLangParam();
  const { pathname } = useLocation();
  useEffect(() => { initLang(); }, []);
  // The URL prefix is the source of truth when present (/ur/shop → Urdu).
  useEffect(() => {
    if (urlLang && urlLang !== lang) setLang(urlLang);
  }, [urlLang, lang]);
  useEffect(() => {
    if (!s || !lang) return;
    if (!langs.some((l) => l.code === lang)) setLang(null);
  }, [s, lang, langs]);
  useEffect(() => {
    const code = lang ?? DEFAULT_LANG.code;
    document.documentElement.lang = code;
    document.documentElement.dir = langDir(lang);
  }, [lang]);
  // Params object reused by every storefront link so the language prefix is kept.
  const lp = { lang: lang ?? undefined };
  const langPicker = langs.length > 0 && (
    <select
      aria-label={t("nav.language")}
      className="h-8 rounded-full border bg-card px-2 text-xs outline-none focus:border-gold"
      value={lang ?? DEFAULT_LANG.code}
      onChange={(e) => {
        const code = e.target.value === DEFAULT_LANG.code ? null : e.target.value;
        setLang(code);
        // Keep the visitor on the same page, under the new language prefix.
        // Full navigation so the page re-renders server-side with the new language.
        const base = urlLang ? pathname.slice(urlLang.length + 1) || "/" : pathname;
        window.location.assign(langUrl(base, code));
      }}
    >
      <option value={DEFAULT_LANG.code}>{DEFAULT_LANG.label}</option>
      {langs.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
  useEffect(() => {
    if (!s || !dc) return;
    if (dc.code !== baseCurrency && !extras.some((c) => c.code === dc.code)) setDisplayCurrency(null);
  }, [s, dc, baseCurrency, extras]);
  const currencyPicker = extras.length > 0 && (
    <select
      aria-label="Currency"
      className="h-8 rounded-full border bg-card px-2 text-xs outline-none focus:border-gold"
      value={dc?.code ?? baseCurrency}
      onChange={(e) => {
        const code = e.target.value;
        setDisplayCurrency(code === baseCurrency ? null : { code, rate: extras.find((c) => c.code === code)!.rate });
      }}
    >
      <option value={baseCurrency}>{baseCurrency}</option>
      {extras.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
    </select>
  );

  if (s?.maintenance_mode && !isStaff) {
    return (
      <div className="bg-hero flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center text-primary-foreground">
        <p className="eyebrow text-gold">{t("maintenance.closed")}</p>
        <h1 className="text-6xl">{s.store_name}</h1>
        <p className="opacity-70">{t("maintenance.message")}</p>
        <Link to="/auth" className="mt-6 text-xs opacity-50 hover:opacity-100">{t("maintenance.staff_signin")}</Link>
      </div>
    );
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/{-$lang}/shop", params: lp, search: { q: q || undefined } });
    setOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {mounted && s?.maintenance_mode && isStaff && (
        <div className="bg-warning py-1.5 text-center text-xs font-medium text-foreground">{t("maintenance.banner")}</div>
      )}
      {mounted && s?.announcement_enabled && s.announcement && (
        <div className="bg-primary py-2 text-center text-xs tracking-wide text-primary-foreground">{s.announcement}</div>
      )}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-4 md:px-6">
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label={t("nav.menu")}>{open ? <X /> : <Menu />}</button>
          <Link to="/{-$lang}" params={lp} className="shrink-0">
            {mounted && s?.logo_url ? <img src={s.logo_url} alt={s.store_name} className="h-8" /> : <span className="font-display text-3xl">{mounted ? (s?.store_name ?? "\u00a0") : "\u00a0"}</span>}
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
                <Link to="/{-$lang}/shop" params={lp} className="hover:text-gold" activeProps={{ className: "text-gold" }} activeOptions={{ includeSearch: false, exact: true }}>{t("nav.shop_all")}</Link>
                {topCats.slice(0, 6).map((c) => (
                  <Link key={c.id} to="/{-$lang}/shop" params={lp} search={{ category: c.slug }} className="hover:text-gold">{c.name}</Link>
                ))}
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-4 md:ml-0">
            {langPicker}
            {currencyPicker}
            <form onSubmit={search} className="relative hidden lg:block">
              <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("nav.search")} className="h-8 w-44 rounded-full border bg-card pl-8 pr-3 text-sm outline-none focus:border-gold" />
            </form>
            <Link to="/account" aria-label={t("nav.wishlist")} className="hover:text-gold"><Heart className="size-5" /></Link>
            <Link to={user ? (isStaff ? "/admin" : "/account") : "/auth"} aria-label={t("nav.account")} className="hover:text-gold"><User className="size-5" /></Link>
            <Link to="/{-$lang}/cart" params={lp} aria-label={t("nav.cart")} className="relative hover:text-gold">
              <ShoppingBag className="size-5" />
              {count > 0 && <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-accent-foreground">{count}</span>}
            </Link>
          </div>
        </div>
        {open && (
          <div className="space-y-3 border-t px-4 py-4 md:hidden">
            {langPicker}
            {currencyPicker}
            <form onSubmit={search}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("nav.search_products")} className="h-10 w-full rounded border bg-card px-3 text-sm" /></form>
            {headerItems.length > 0 ? (
              headerItems.map((item, i) => (
                <div key={i}>
                  <a href={item.url} className="block py-1" onClick={() => setOpen(false)}>{item.label}</a>
                  {item.children?.map((ch, j) => <a key={j} href={ch.url} className="block py-1 pl-4 text-muted-foreground" onClick={() => setOpen(false)}>{ch.label}</a>)}
                </div>
              ))
            ) : (
              <>
                <Link to="/{-$lang}/shop" params={lp} className="block py-1" onClick={() => setOpen(false)}>{t("nav.shop_all")}</Link>
                {topCats.map((c) => <Link key={c.id} to="/{-$lang}/shop" params={lp} search={{ category: c.slug }} className="block py-1" onClick={() => setOpen(false)}>{c.name}</Link>)}
              </>
            )}
          </div>
        )}
      </header>
      <main className="flex-1" key={`${dc?.code ?? baseCurrency}-${lang ?? DEFAULT_LANG.code}`}>{children}</main>
      <footer className="mt-20 border-t bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 md:grid-cols-4">
          <div>
            <p className="font-display text-2xl">{mounted ? s?.store_name : ""}</p>
            <p className="mt-2 text-sm text-muted-foreground">{mounted ? s?.tagline : ""}</p>
          </div>
          {footerItems.length > 0 ? (
            footerItems.map((col, i) => (
              <div key={i} className="text-sm">
                {col.children?.length ? (
                  <>
                    <p className="eyebrow mb-3 text-muted-foreground">{col.label}</p>
                    {col.children.map((ch, j) => <a key={j} href={ch.url} className="block py-1 hover:text-gold">{ch.label}</a>)}
                  </>
                ) : (
                  <a href={col.url} className="block py-1 hover:text-gold">{col.label}</a>
                )}
              </div>
            ))
          ) : (
            <>
              <div className="text-sm">
                <p className="eyebrow mb-3 text-muted-foreground">{t("footer.shop")}</p>
                {topCats.slice(0, 5).map((c) => <Link key={c.id} to="/{-$lang}/shop" params={lp} search={{ category: c.slug }} className="block py-1 hover:text-gold">{c.name}</Link>)}
              </div>
              <div className="text-sm">
                <p className="eyebrow mb-3 text-muted-foreground">{t("footer.information")}</p>
                <Link to="/{-$lang}/blog" params={lp} className="block py-1 hover:text-gold">{t("footer.journal")}</Link>
                <a href={lp.lang ? `/${lp.lang}/track` : "/track"} className="block py-1 hover:text-gold">Track your order</a>
                {pages.filter((pg) => pg.is_published && pg.show_in_footer).map((pg) => <Link key={pg.id} to="/{-$lang}/pages/$slug" params={{ ...lp, slug: pg.slug }} className="block py-1 hover:text-gold">{pg.title}</Link>)}
              </div>
            </>
          )}
          <div className="text-sm">
            <p className="eyebrow mb-3 text-muted-foreground">{t("footer.contact")}</p>
            {mounted && s?.support_email && <p>{s.support_email}</p>}
            {mounted && s?.support_phone && <p>{s.support_phone}</p>}
          </div>
        </div>
        <p className="border-t py-5 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {mounted ? s?.store_name : ""}</p>
      </footer>
    </div>
  );
}
