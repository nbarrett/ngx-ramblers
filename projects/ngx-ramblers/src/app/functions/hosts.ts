export function apexHost(host: string | undefined | null): string {
  return (host || "").replace(/^www\./, "");
}

export function isHostUnderDomain(host: string | undefined | null, baseDomain: string | undefined | null): boolean {
  const normalisedHost = apexHost(host).toLowerCase();
  const normalisedDomain = (baseDomain || "").toLowerCase();
  if (!normalisedHost || !normalisedDomain) {
    return false;
  }
  return normalisedHost === normalisedDomain || normalisedHost.endsWith(`.${normalisedDomain}`);
}
