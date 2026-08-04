export function apexHost(host: string | undefined | null): string {
  return (host || "").replace(/^www\./, "");
}

export const RAMBLERS_NATIONAL_DOMAIN = "ramblers.org.uk";

export function hostFromUrl(url: string | undefined | null): string {
  try {
    return new URL(url || "").hostname;
  } catch {
    return "";
  }
}

export function ramblersNationalUrl(url: string | undefined | null): boolean {
  return isHostUnderDomain(hostFromUrl(url), RAMBLERS_NATIONAL_DOMAIN);
}

export function isHostUnderDomain(host: string | undefined | null, baseDomain: string | undefined | null): boolean {
  const normalisedHost = apexHost(host).toLowerCase();
  const normalisedDomain = (baseDomain || "").toLowerCase();
  return !!normalisedHost && !!normalisedDomain
    && (normalisedHost === normalisedDomain || normalisedHost.endsWith(`.${normalisedDomain}`));
}
