import { BuiltInPath } from "../models/content-text.model";

export const ROOT_PATH = "/";

export function redirectPathFrom(path: string): string {
  const trimmed = (path || "").trim().replace(/^\/+/, "");
  return !trimmed || trimmed === BuiltInPath.HOME ? ROOT_PATH : `/${trimmed}`;
}
