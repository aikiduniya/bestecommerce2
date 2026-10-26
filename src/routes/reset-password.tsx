import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { name: "robots", content: "noindex" },
      { title: "Set a new password" },
      { name: "description", content: "Choose a new password for your account." },
      { property: "og:title", content: "Set a new password" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: d }) => { if (d.session) setReady(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { toast.error("Passwords do not match"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated. You are signed in.");
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <h1 className="text-4xl">Set a new password</h1>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Open this page from the reset link in your email. If the link expired, request a new one from the sign-in page.</p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="np">New password</Label>
              <Input id="np" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="np2">Confirm password</Label>
              <Input id="np2" type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Please wait…" : "Update password"}</Button>
          </>
        )}
      </form>
    </div>
  );
}
