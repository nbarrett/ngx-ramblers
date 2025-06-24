import escapeRegExp from "lodash/escapeRegExp";
import isNumber from "lodash/isNumber";

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
  return val === true || ["true", "yes"].includes(val?.toString().toLowerCase());
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

export function toKebabCase(input: string): string {
  if (!input) return "";
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
