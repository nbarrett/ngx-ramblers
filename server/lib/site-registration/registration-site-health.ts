import { RegistrationSiteHealth, SiteRegistration } from "../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { hostFromUrl } from "../../../projects/ngx-ramblers/src/app/functions/hosts";
import { probeHttp } from "../health/public-http-probe";
import { DEFAULT_BASE_DOMAIN } from "../environment-setup/environment-context";

export function registrationFlyUrl(environmentName: string): string {
  return environmentName ? `https://ngx-ramblers-${environmentName}.fly.dev` : "";
}

export function registrationAdvertisedUrl(registration: Pick<SiteRegistration, "siteUrl" | "environmentName">): string {
  return registration.siteUrl || (registration.environmentName ? `https://${registration.environmentName}.${DEFAULT_BASE_DOMAIN}` : "");
}

export async function registrationSiteHealth(
  registration: Pick<SiteRegistration, "siteUrl" | "environmentName">,
  probe: (hostname: string) => Promise<{httpStatus: number}> = probeHttp
): Promise<RegistrationSiteHealth | null> {
  const advertisedUrl = registrationAdvertisedUrl(registration);
  const workingUrl = registrationFlyUrl(registration.environmentName);
  if (!advertisedUrl) {
    return null;
  } else {
    const advertisedHost = hostFromUrl(advertisedUrl);
    const workingHost = hostFromUrl(workingUrl);
    const advertised = advertisedHost ? await probe(advertisedHost) : {httpStatus: 0};
    const advertisedReachable = advertised.httpStatus >= 200 && advertised.httpStatus < 400;
    if (advertisedReachable) {
      return {
        advertisedUrl,
        advertisedReachable: true,
        workingUrl: advertisedUrl,
        title: null,
        detail: null,
        action: null
      };
    } else {
      const fallback = workingHost && workingHost !== advertisedHost ? await probe(workingHost) : {httpStatus: 0};
      const fallbackReachable = fallback.httpStatus >= 200 && fallback.httpStatus < 400;
      return {
        advertisedUrl,
        advertisedReachable: false,
        workingUrl: fallbackReachable ? workingUrl : null,
        title: "The public hostname is not live",
        detail: `${advertisedHost} does not resolve, so visitors cannot open the advertised site.`,
        action: fallbackReachable
          ? "Review the site on the working Fly address. On Environment Setup for this environment, tick Setup subdomain and Run selected steps so the public hostname exists."
          : "On Environment Setup for this environment, tick Deploy to Fly.io and Setup subdomain, then Run selected steps."
      };
    }
  }
}
