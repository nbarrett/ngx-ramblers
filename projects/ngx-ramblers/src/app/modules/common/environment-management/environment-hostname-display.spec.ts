import { CustomDomainStatus } from "../../../models/environment-config.model";
import {
  DnsProvider,
  HostnameHealth,
  HostnameOrigin,
  HostnameStatus
} from "../../../models/environment-setup.model";
import {
  canUseAsSiteUrl,
  domainStatusLabel,
  hostnameActionStatement,
  hostnameHealthBadgeClass,
  subdomainStepBadgeLabel
} from "./environment-hostname-display";

function status(overrides: Partial<HostnameStatus>): HostnameStatus {
  return {
    hostname: "www.group.org.uk",
    origin: HostnameOrigin.SITE_URL,
    health: HostnameHealth.SERVING,
    healthy: true,
    dnsRecordType: "A",
    dnsContent: "1.2.3.4",
    proxied: false,
    redirectRuleTarget: "",
    httpStatus: 200,
    httpRedirectLocation: "",
    nameservers: [],
    dnsProvider: DnsProvider.CLOUDFLARE,
    dnsProviderLabel: "Cloudflare",
    message: "Serving the site",
    ...overrides
  };
}

describe("environment-hostname-display", () => {

  it("should not treat an unused free host as a danger badge", () => {
    const hostname = status({
      origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
      health: HostnameHealth.NOT_CREATED,
      healthy: true,
      message: "Not created. Optional: the site is already served on another address."
    });
    expect(hostnameHealthBadgeClass(hostname)).toBe("badge bg-warning");
    expect(hostnameActionStatement(hostname, "group.ngx-ramblers.org.uk")).toBe("Not used.");
  });

  it("should not offer Use as Site URL unless the host is serving", () => {
    const dead = status({
      origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
      health: HostnameHealth.NO_DNS,
      healthy: false,
      hostname: "group.ngx-ramblers.org.uk"
    });
    expect(canUseAsSiteUrl(dead, [dead])).toBe(false);
  });

  it("should label Setup subdomain as optional when the live site is a custom domain", () => {
    expect(subdomainStepBadgeLabel(false, true)).toBe("optional");
    expect(subdomainStepBadgeLabel(true, false)).toBe("done");
    expect(subdomainStepBadgeLabel(false, false)).toBe("needed");
  });

  it("should label an attached custom domain as attached", () => {
    expect(domainStatusLabel(CustomDomainStatus.ATTACHED)).toBe("Attached");
  });
});
