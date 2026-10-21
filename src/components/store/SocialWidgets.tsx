import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Facebook, Globe, Instagram, Linkedin, MessageCircle, Music2, Pin, Twitter, Youtube } from "lucide-react";
import { settingsQuery, socialLinks } from "@/lib/store";

const ICONS: Record<string, typeof Globe> = { instagram: Instagram, facebook: Facebook, x: Twitter, youtube: Youtube, linkedin: Linkedin, tiktok: Music2, pinterest: Pin, whatsapp: MessageCircle };

export function SocialIcons({ className = "" }: { className?: string }) {
  const { data: s } = useQuery(settingsQuery);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const links = mounted ? socialLinks(s?.social_links) : [];
  if (!links.length) return null;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {links.map((l, i) => {
        const I = ICONS[l.network] ?? Globe;
        return <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.network} className="rounded-full border border-current/20 p-2 opacity-80 transition hover:border-gold hover:text-gold hover:opacity-100"><I className="size-4" /></a>;
      })}
    </div>
  );
}

/** Floating WhatsApp chat button (admin-configured). */
export function WhatsAppButton() {
  const { data: s } = useQuery(settingsQuery);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !s?.whatsapp_enabled || !s.whatsapp_number) return null;
  const num = s.whatsapp_number.replace(/[^0-9]/g, "");
  if (num.length < 7) return null;
  const href = `https://wa.me/${num}${s.whatsapp_message ? `?text=${encodeURIComponent(s.whatsapp_message)}` : ""}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
      className={`fixed bottom-5 z-50 flex size-14 items-center justify-center rounded-full bg-success text-primary-foreground shadow-elegant transition hover:scale-105 ${s.whatsapp_position === "left" ? "left-5" : "right-5"} ${s.whatsapp_mobile ? "" : "hidden md:flex"}`}>
      <MessageCircle className="size-7" />
    </a>
  );
}

/** Loads the Tawk.to widget when enabled with valid IDs. */
export function TawkChat() {
  const { data: s } = useQuery(settingsQuery);
  useEffect(() => {
    if (!s?.tawk_enabled) return;
    const pid = s.tawk_property_id ?? "", wid = s.tawk_widget_id ?? "";
    if (!/^[a-z0-9]{6,40}$/i.test(pid) || !/^[a-z0-9]{6,40}$/i.test(wid)) return;
    if (document.getElementById("tawk-script")) return;
    const el = document.createElement("script");
    el.id = "tawk-script";
    el.async = true;
    el.src = `https://embed.tawk.to/${pid}/${wid}`;
    el.charset = "UTF-8";
    el.setAttribute("crossorigin", "*");
    document.body.appendChild(el);
  }, [s?.tawk_enabled, s?.tawk_property_id, s?.tawk_widget_id]);
  return null;
}
