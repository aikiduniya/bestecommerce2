import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : undefined);

async function destination(next?: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const safe = safeNext(next);
  if (safe) return safe;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  const roles = (data ?? []).map((r) => r.role);
  return roles.includes("admin") || roles.includes("staff") ? "/admin" : "/account";
}

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, follow" },
      { title: "Sign in" },
      { name: "description", content: "Sign in to your account or the store dashboard." },
      { property: "og:title", content: "Sign in" },
      { property: "og:description", content: "Sign in to your account or the store dashboard." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const go = async () => {
    const to = await destination(next);
    if (to) nav({ to, replace: true });
  };
  useEffect(() => {
    go();
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") go(); });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await go();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" + (safeNext(next) ? `?next=${encodeURIComponent(next!)}` : "") },
        });
        if (error) throw error;
        if (data.session) await go();
        else toast.success("Check your email to confirm your account.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) { toast.error(r.error.message); return; }
    if (r.redirected) return;
    await go();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="bg-hero hidden flex-col justify-between p-12 text-primary-foreground lg:flex">
        <Link to="/{-$lang}" params={{ lang: undefined }} className="font-display text-2xl">← Storefront</Link>
        <div>
          <p className="eyebrow text-gold">Your account</p>
          <h1 className="mt-4 text-6xl leading-tight">Orders, wishlist and faster checkout — all in one place.</h1>
        </div>
        <span />
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-4xl">{mode === "in" ? "Welcome back" : "Create account"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to track orders, save favourites and check out faster.
            </p>
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
          <div className="eyebrow text-center text-muted-foreground">or</div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}
          </Button>
          <button type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "No account? Sign up" : "Have an account? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
