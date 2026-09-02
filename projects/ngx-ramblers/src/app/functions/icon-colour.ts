import { isString, uniq } from "es-toolkit/compat";
import { ICON_COLOURS, PaletteColor } from "../models/content-text.model";
import { enumValues } from "./enums";

const DEFAULT_ICON_COLOUR = "rgb(155, 200, 171)";
const DEFAULT_ICON_COLOUR_HEX = "#9bc8ab";

export function resolvedIconColour(iconColour: string | null): string {
  if (!iconColour) {
    return DEFAULT_ICON_COLOUR;
  } else {
    const named = ICON_COLOURS.find(item => item.cssClass === iconColour || item.displayClass === iconColour);
    if (named) {
      return named.swatch;
    } else {
      return iconColour;
    }
  }
}

export function namedIconColourClass(iconColour: string | null): string | null {
  if (!iconColour) {
    return null;
  } else {
    const named = ICON_COLOURS.find(item => item.cssClass === iconColour || item.displayClass === iconColour);
    if (named?.cssClass) {
      return named.cssClass;
    } else if (named?.displayClass) {
      return named.displayClass;
    } else {
      return null;
    }
  }
}

export function explicitIconColour(iconColour: string | null): string | null {
  if (!iconColour || namedIconColourClass(iconColour)) {
    return null;
  } else {
    return iconColourAsHex(iconColour);
  }
}

export function iconColourAsHex(iconColour: string | null): string {
  const resolved = resolvedIconColour(iconColour);
  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(resolved);
  if (rgb) {
    const hex = [rgb[1], rgb[2], rgb[3]].map(part => Number(part).toString(16).padStart(2, "0")).join("");
    return `#${hex.toLowerCase()}`;
  } else if (isString(resolved) && resolved.startsWith("#") && resolved.length === 7) {
    return resolved.toLowerCase();
  } else {
    return DEFAULT_ICON_COLOUR_HEX;
  }
}

export function iconColourChoices(): string[] {
  const named = ICON_COLOURS.map(item => iconColourAsHex(item.swatch));
  const palette = enumValues(PaletteColor).map(item => iconColourAsHex(item));
  return uniq([...named, ...palette]);
}
