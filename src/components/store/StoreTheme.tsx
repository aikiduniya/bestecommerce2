import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { settingsQuery } from "@/lib/store";
import { BUTTON_RADIUS } from "@/lib/theme";

const HEX = /^#[0-9a-f]{6}$/i;
const SAFE_FONT = /^[A-Za-z0-9 ]{2,40}$/;

/** Applies admin branding (colors, fonts, favicon) to the live storefront. */
export function StoreTheme() {
  const { data: s } = useQuery(settingsQuery);

  useEffect(() => {
    if (!s) return;
    const root = document.documentElement.style;
    if (s.primary_color && HEX.test(s.primary_color)) {
      root.setProperty("--primary", s.primary_color);
      root.setProperty("--gradient-hero", `linear-gradient(135deg, ${s.primary_color}, color-mix(in oklab, ${s.primary_color} 75%, ${s.accent_color ?? "#b08d57"}))`);
    }
    if (s.accent_color && HEX.test(s.accent_color)) {
      root.setProperty("--gold", s.accent_color);
      root.setProperty("--accent", s.accent_color);
      root.setProperty("--ring", s.accent_color);
      root.setProperty("--gold-soft", `color-mix(in oklab, ${s.accent_color} 22%, white)`);
    }
    const fonts = [s.font_display, s.font_body].filter((f) => f && SAFE_FONT.test(f));
    if (fonts.length) {
      const id = "store-fonts";
      const href = `https://fonts.googleapis.com/css2?${fonts
        .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
        .join("&")}&display=swap`;
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = href;
      if (s.font_display && SAFE_FONT.test(s.font_display)) root.setProperty("--font-display", `"${s.font_display}", Georgia, serif`);
      if (s.font_body && SAFE_FONT.test(s.font_body)) root.setProperty("--font-body", `"${s.font_body}", system-ui, sans-serif`);
    }
    const x = s as typeof s & { background_color?: string | null; surface_color?: string | null; button_style?: string; card_style?: string };
    if (x.background_color && HEX.test(x.background_color)) {
      root.setProperty("--background", x.background_color);
      root.setProperty("--secondary", `color-mix(in oklab, ${x.background_color} 92%, ${s.primary_color ?? "#1c1917"})`);
      root.setProperty("--muted", `color-mix(in oklab, ${x.background_color} 94%, ${s.primary_color ?? "#1c1917"})`);
    }
    if (x.surface_color && HEX.test(x.surface_color)) {
      root.setProperty("--card", x.surface_color);
      root.setProperty("--popover", x.surface_color);
    }
    root.setProperty("--btn-radius", BUTTON_RADIUS[x.button_style ?? ""] ?? "calc(var(--radius) - 2px)");
    document.documentElement.dataset["card"] = x.card_style ?? "minimal";
    if (s.favicon_url) {
      let icon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
      if (icon) icon.href = s.favicon_url;
    }
  }, [s]);

  return null;
}
