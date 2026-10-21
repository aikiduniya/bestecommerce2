import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/store";
import { Button } from "@/components/ui/button";

const KEY = "store_cookie_consent_v1";

export function CookieConsent() {
  const { data: s } = useQuery(settingsQuery);
  const [mounted, setMounted] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    setMounted(true);
    try { setChoice(localStorage.getItem(KEY)); } catch { /* ignore */ }
  }, []);

  if (!mounted || !s?.cookie_consent_enabled || choice) return null;

  function decide(v: "accepted" | "declined") {
    try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
    setChoice(v);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-card p-4 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{s.cookie_consent_text}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => decide("declined")}>Decline</Button>
          <Button variant="gold" size="sm" onClick={() => decide("accepted")}>Accept</Button>
        </div>
      </div>
    </div>
  );
}
