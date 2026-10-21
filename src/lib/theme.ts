export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  primary_color: string;
  accent_color: string;
  background_color: string;
  surface_color: string;
  font_display: string;
  font_body: string;
  button_style: "square" | "rounded" | "pill";
  card_style: "minimal" | "framed" | "elevated";
};

/** Built-in theme presets. Applying one only changes look-and-feel settings, never content. */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "heritage", name: "Heritage Green", description: "Deep green, champagne gold and ivory — classic luxury watchmaker feel.",
    primary_color: "#0b3d2e", accent_color: "#c8a96a", background_color: "#faf7f0", surface_color: "#ffffff",
    font_display: "Cormorant Garamond", font_body: "Manrope", button_style: "square", card_style: "framed" },
  { id: "classic", name: "Classic Noir", description: "Near-black with antique gold on warm white.",
    primary_color: "#1c1917", accent_color: "#b08d57", background_color: "#fbf9f4", surface_color: "#ffffff",
    font_display: "Cormorant Garamond", font_body: "Manrope", button_style: "square", card_style: "minimal" },
  { id: "ivory", name: "Ivory Atelier", description: "Soft ivory, taupe and bronze with rounded details.",
    primary_color: "#3d342b", accent_color: "#a67c52", background_color: "#f6f1e7", surface_color: "#fffdf8",
    font_display: "Bodoni Moda", font_body: "Jost", button_style: "pill", card_style: "minimal" },
  { id: "sapphire", name: "Midnight Sapphire", description: "Navy blue with platinum-gold accents.",
    primary_color: "#13233f", accent_color: "#c9b37e", background_color: "#f7f8fa", surface_color: "#ffffff",
    font_display: "Playfair Display", font_body: "DM Sans", button_style: "rounded", card_style: "elevated" },
];

export const BUTTON_RADIUS: Record<string, string> = { square: "2px", rounded: "8px", pill: "9999px" };
