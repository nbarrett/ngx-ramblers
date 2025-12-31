import { isBoolean, kebabCase } from "es-toolkit/compat";

export function toKebabCase(...strings: any[]) {
  return strings
    .flat()
    .filter(item => item)
    .map(item => kebabCase(item))
    .join("-");
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
