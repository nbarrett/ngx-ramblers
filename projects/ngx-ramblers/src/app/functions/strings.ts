import { isBoolean, isString, kebabCase } from "es-toolkit/compat";

export function toKebabCase(...strings: any[]) {
  return strings
    .flat()
    .filter(item => item)
    .map(item => kebabCase(item))
    .join("-");
}

export function toDotCase(...strings: any[]) {
  return toKebabCase(...strings).replace(/-+/g, ".");
}

export function normaliseEmail(email: string): string {
  if (!email) {
    return null;
  } else {
    return email.trim().toLowerCase();
  }
}

export function toSlug(input: string): string {
  if (!input) {
    return "";
  } else {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function extractErrorMessage(err: any): string {
  if (err?.error?.error?.message) {
    return err.error.error.message;
  }
  if (isString(err?.error?.error)) {
    return err.error.error;
  }
  if (err?.error?.message) {
    return err.error.message;
  }
  if (err?.message) {
    return err.message;
  }
  if (isString(err?.error)) {
    return err.error;
  }
  if (isString(err)) {
    return err;
  }
  return "An unexpected error occurred";
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
