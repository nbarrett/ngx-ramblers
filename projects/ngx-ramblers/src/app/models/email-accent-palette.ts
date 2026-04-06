export interface AccentColour {
  name: string;
  hex: string;
}

export const RAMBLERS_EMAIL_ACCENT_PALETTE: Record<string, AccentColour> = {
  "sunrise": {name: "Sunrise", hex: "#F9B104"},
  "rosie-cheeks": {name: "Rosie cheeks", hex: "#F6B09D"},
  "mint-cake": {name: "Mint cake", hex: "#9BC8AB"},
};

export const DEFAULT_ACCENT_COLOR = RAMBLERS_EMAIL_ACCENT_PALETTE["sunrise"].hex;

export function resolveAccentColor(token?: string): string {
  if (!token) {
    return DEFAULT_ACCENT_COLOR;
  }
  const entry = RAMBLERS_EMAIL_ACCENT_PALETTE[token];
  return entry?.hex || token;
}
