import { isObject, isString, keys } from "es-toolkit/compat";

export function mostCommonBannerId(configs: unknown[]): string | null {
  const counts = (configs || []).reduce((accumulator: Record<string, number>, config) => {
    const bannerId = isObject(config) && "bannerId" in config ? config.bannerId : null;
    if (isString(bannerId) && bannerId) {
      accumulator[bannerId] = (accumulator[bannerId] || 0) + 1;
    }
    return accumulator;
  }, {});
  return keys(counts).sort((left, right) => counts[right] - counts[left])[0] || null;
}

export function pickCommitteeRole(roles: {type?: string; description?: string; vacant?: boolean}[], preferred = "membership"): string | null {
  const available = (roles || []).filter(role => role?.type && !role.vacant);
  if (available.length === 0) {
    return (roles || []).find(role => role?.type)?.type || null;
  }
  const exact = available.find(role => role.type === preferred);
  if (exact) {
    return exact.type;
  }
  const needle = preferred.toLowerCase();
  const typeMatch = available.find(role => {
    const type = role.type.toLowerCase();
    return type.includes(needle) || needle.includes(type);
  });
  if (typeMatch) {
    return typeMatch.type;
  }
  const descriptionMatch = available.find(role => {
    const description = (role.description || "").toLowerCase();
    return description && (description.includes(needle) || needle.includes(description));
  });
  if (descriptionMatch) {
    return descriptionMatch.type;
  }
  const fallbacks = ["secretary", "chairman", "chair", "walks"];
  const fallback = fallbacks
    .map(name => available.find(role => {
      const type = role.type.toLowerCase();
      const description = (role.description || "").toLowerCase();
      return type === name || type.includes(name) || description.includes(name);
    }))
    .find(role => !!role);
  return fallback?.type || available[0].type;
}
