import { escapeRegExp, isBoolean, isNumber } from "es-toolkit/compat";

export const uidFormat = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";

export function generateUid() {
  return uidFormat.replace(/[xy]/g, value => {
    const r = Math.random() * 16 | 0;
    const v = value === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function replaceAll(find: string, replace: string, str: string): string | number {
  let replacedValue;
  let initialValue = "" + str;
  while (true) {
    replacedValue = initialValue.replace(new RegExp(escapeRegExp("" + find), "g"), replace);
    if (replacedValue !== initialValue) {
      initialValue = replacedValue;
    } else {
      break;
    }
  }
  return isNumber(str) ? +replacedValue : replacedValue;
}

export function asBoolean(val: any): boolean {
  return booleanOf(val);
}

export function tail<T>(results: T[]) {
  const [headItem, ...tailItems] = results;
  return tailItems;
}

export function pluraliseWithCount(count: number, singular: string, plural?: string) {
  return `${count} ${pluralise(count, singular, plural)}`;
}

export function pluralise(count: number, singular: string, plural?: string) {
  return `${count === 1 ? singular : plural || (singular + "s")}`;
}

export function lastItemFrom(key: string) {
  return key?.split("/").filter(item => item)?.pop();
}


export function titleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
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

export function booleanOf(value: any, fallback: boolean = false): boolean {
  const normalized = (value == null ? "" : value.toString()).trim().toLowerCase();
  if (isBoolean(value)) {
    return value;
  } else if (["true", "1", "yes"].includes(normalized)) {
    return true;
  } else if (["false", "0", "no"].includes(normalized)) {
    return false;
  } else {
    return fallback;
  }
}

export function hasFileExtension(fileName: string, extension: string): boolean {
  if (!fileName) return false;
  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  return fileName.toLowerCase().endsWith(normalizedExtension.toLowerCase());
}

export function splitOnDashSegments(line: string): string[] {
  return line
    .split(/\s+-\s+/)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

export function capitalise(value: string): string {
  if (!value) {
    return value;
  }
  if (value.length === 1) {
    return value.toUpperCase();
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function truncateWithEllipsis(value: string, maxLength: number, ellipsis: string = "..."): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || maxLength <= 0) {
    return "";
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  const sliceLength = Math.max(1, maxLength - ellipsis.length);
  return `${trimmed.slice(0, sliceLength).trim()}${ellipsis}`;
}

export function textBeforeSeparators(value: string, separators: string[]): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || separators.length === 0) {
    return trimmed;
  }

  const indexes = separators
    .map(separator => ({ separator, index: trimmed.indexOf(separator) }))
    .filter(entry => entry.index > -1);

  if (indexes.length === 0) {
    return trimmed;
  }

  const earliest = indexes.reduce((best, current) => current.index < best.index ? current : best);
  return trimmed.slice(0, earliest.index).trim();
}

export function uniqueCommaDelimitedList(...values: (string | null | undefined)[]): string {
  return Array.from(new Set(
    values
      .filter(Boolean)
      .flatMap(value => value.split(","))
      .map(item => item.trim())
      .filter(item => item.length > 0)
  )).join(",");
}
