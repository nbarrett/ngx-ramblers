import { toPairs } from "es-toolkit/compat";

export const MACHINES_API_BASE = "https://api.machines.dev/v1";

export function missingFlyConfig(required: Record<string, string>): string | null {
  const missing = toPairs(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  return missing.length ? missing.join(", ") : null;
}

export function flyAuthorizationHeader(token: string): string {
  if (token.startsWith("FlyV1 ")) {
    return token;
  }
  if (token.startsWith("fm2_")) {
    return `FlyV1 ${token}`;
  }
  return `Bearer ${token}`;
}
