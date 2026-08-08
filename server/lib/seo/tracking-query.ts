import { isArray, isString, keys } from "es-toolkit/compat";

export const TRACKING_QUERY_PARAM_NAMES = [
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "yclid",
  "dclid",
  "_ga",
  "igshid"
];

const TRACKING_QUERY_PARAM_SET = new Set(TRACKING_QUERY_PARAM_NAMES.map(name => name.toLowerCase()));

export function isTrackingQueryParam(name: string): boolean {
  return TRACKING_QUERY_PARAM_SET.has((name || "").toLowerCase());
}

function queryValueAsStrings(value: unknown): string[] {
  if (isArray(value)) {
    return value.filter(entry => isString(entry)) as string[];
  } else if (isString(value)) {
    return [value];
  } else {
    return [];
  }
}

export function pathWithTrackingQueryStripped(path: string, query: Record<string, unknown>): string | null {
  const names = keys(query || {});
  if (names.length === 0) {
    return null;
  } else {
    const trackingNames = names.filter(name => isTrackingQueryParam(name));
    if (trackingNames.length === 0) {
      return null;
    } else {
      const kept = new URLSearchParams();
      names.filter(name => !isTrackingQueryParam(name)).forEach(name => {
        queryValueAsStrings(query[name]).forEach(value => kept.append(name, value));
      });
      const queryString = kept.toString();
      const normalisedPath = path || "/";
      return queryString.length > 0 ? `${normalisedPath}?${queryString}` : normalisedPath;
    }
  }
}
