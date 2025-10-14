import { kebabCase } from "es-toolkit/compat";

export function toKebabCase(...strings: any[]) {
  return strings
    .flat()
    .filter(item => item)
    .map(item => kebabCase(item))
    .join("-");
}

export function humaniseFileStemFromUrl(input: string): string {
  try {
    const url = new URL(input || "");
    const name = decodeURIComponent((url.pathname.split("/").pop() || "").replace(/\.[^.]+$/, ""));
    return name.replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();
  } catch (_) {
    const raw = decodeURIComponent((input || "").split("/").pop() || "").replace(/\.[^.]+$/, "");
    return raw.replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();
  }
}
