import { DnsProvider } from "../models/environment-setup.model";
import {
  apexHost,
  apexHostFromUrl,
  dnsProviderFromNameservers,
  exampleStagingHostname,
  exampleWwwHostname,
  firstGroupOwnedApex,
  groupOwnedApex,
  hostFromUrl,
  hostnameMayHaveWwwCompanion,
  isHostUnderDomain,
  relatedEnvironmentName,
  stagingHostForSiteHref,
  suggestedCustomDomainHostname
} from "./hosts";

describe("apexHost", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(apexHost(null)).toBe("");
    expect(apexHost(undefined)).toBe("");
    expect(apexHost("")).toBe("");
  });

  it("strips a leading www. prefix", () => {
    expect(apexHost("www.example.com")).toBe("example.com");
    expect(apexHost("WWW.Example.com")).toBe("Example.com");
  });

  it("leaves hosts without a www prefix unchanged", () => {
    expect(apexHost("example.com")).toBe("example.com");
    expect(apexHost("group.ngx-ramblers.org.uk")).toBe("group.ngx-ramblers.org.uk");
  });
});

describe("hostFromUrl", () => {
  it("returns the hostname from a URL", () => {
    expect(hostFromUrl("https://www.example.org.uk/path")).toBe("www.example.org.uk");
  });

  it("returns empty string for missing or invalid input", () => {
    expect(hostFromUrl(null)).toBe("");
    expect(hostFromUrl("not a url")).toBe("");
  });
});

describe("apexHostFromUrl", () => {
  it("strips www and lowercases", () => {
    expect(apexHostFromUrl("https://www.Example.ORG.uk/walks")).toBe("example.org.uk");
  });

  it("leaves a host without www unchanged", () => {
    expect(apexHostFromUrl("https://example.org.uk/")).toBe("example.org.uk");
  });
});

describe("stagingHostForSiteHref", () => {
  it("builds staging.{apex} from a live site address", () => {
    expect(stagingHostForSiteHref("https://www.example.org.uk")).toBe("staging.example.org.uk");
    expect(stagingHostForSiteHref("https://example.org.uk/")).toBe("staging.example.org.uk");
    expect(stagingHostForSiteHref(null)).toBe(null);
  });
});

describe("isHostUnderDomain", () => {
  it("returns false when either input is missing", () => {
    expect(isHostUnderDomain(null, "ngx-ramblers.org.uk")).toBe(false);
    expect(isHostUnderDomain("group.ngx-ramblers.org.uk", null)).toBe(false);
    expect(isHostUnderDomain("", "")).toBe(false);
  });

  it("returns true when host equals baseDomain (apex)", () => {
    expect(isHostUnderDomain("ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
  });

  it("returns true for a subdomain of baseDomain", () => {
    expect(isHostUnderDomain("group.ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
    expect(isHostUnderDomain("a.b.ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
  });

  it("returns true after stripping a leading www. from the host", () => {
    expect(isHostUnderDomain("www.ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
  });

  it("returns false for an unrelated host", () => {
    expect(isHostUnderDomain("other.example.org.uk", "ngx-ramblers.org.uk")).toBe(false);
  });

  it("does not treat a domain that merely ends with the same string as a subdomain", () => {
    expect(isHostUnderDomain("notngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isHostUnderDomain("Group.NGX-Ramblers.ORG.UK", "ngx-ramblers.org.uk")).toBe(true);
    expect(isHostUnderDomain("ngx-ramblers.org.uk", "NGX-RAMBLERS.ORG.UK")).toBe(true);
  });
});

describe("hostnameMayHaveWwwCompanion", () => {
  it("is true for an apex on a two-label or org.uk-style domain", () => {
    expect(hostnameMayHaveWwwCompanion("example.com")).toBe(true);
    expect(hostnameMayHaveWwwCompanion("example.org.uk")).toBe(true);
  });

  it("is false for www itself and for an extra subdomain such as staging", () => {
    expect(hostnameMayHaveWwwCompanion("www.example.org.uk")).toBe(false);
    expect(hostnameMayHaveWwwCompanion("staging.example.org.uk")).toBe(false);
    expect(hostnameMayHaveWwwCompanion("")).toBe(false);
  });
});

describe("groupOwnedApex", () => {
  const platform = "ngx-ramblers.org.uk";

  it("returns the apex for a group's own domain", () => {
    expect(groupOwnedApex("https://www.example.org.uk/walks", platform)).toBe("example.org.uk");
    expect(groupOwnedApex("staging.example.org.uk", platform)).toBe("example.org.uk");
  });

  it("returns null for a platform subdomain or missing host", () => {
    expect(groupOwnedApex("https://group.ngx-ramblers.org.uk", platform)).toBe(null);
    expect(groupOwnedApex("", platform)).toBe(null);
  });
});

describe("exampleWwwHostname and exampleStagingHostname", () => {
  const platform = "ngx-ramblers.org.uk";

  it("builds www and staging hosts from a selected group domain", () => {
    expect(exampleWwwHostname("https://www.example.org.uk", platform)).toBe("www.example.org.uk");
    expect(exampleStagingHostname("https://www.example.org.uk", platform)).toBe("staging.example.org.uk");
  });

  it("falls back when the selected host is on the platform domain", () => {
    expect(exampleWwwHostname("group.ngx-ramblers.org.uk", platform)).toBe("www.your-group.org.uk");
    expect(exampleStagingHostname("group.ngx-ramblers.org.uk", platform)).toBe(null);
  });
});

describe("firstGroupOwnedApex", () => {
  const platform = "ngx-ramblers.org.uk";

  it("skips platform hosts and takes the first group-owned domain", () => {
    expect(firstGroupOwnedApex([
      "staging.group-one.ngx-ramblers.org.uk",
      "https://www.example.org.uk",
      "staging.example.org.uk"
    ], platform)).toBe("example.org.uk");
  });

  it("returns null when every host is on the platform domain", () => {
    expect(firstGroupOwnedApex([
      "group-one.ngx-ramblers.org.uk",
      "staging.group-one.ngx-ramblers.org.uk"
    ], platform)).toBe(null);
  });
});

describe("relatedEnvironmentName", () => {
  it("pairs a staging sandbox with its live environment", () => {
    expect(relatedEnvironmentName("staging.group-one")).toBe("group-one");
  });

  it("pairs a live environment with its staging sandbox", () => {
    expect(relatedEnvironmentName("group-one")).toBe("staging.group-one");
  });

  it("returns null when there is no environment name", () => {
    expect(relatedEnvironmentName("")).toBe(null);
    expect(relatedEnvironmentName("staging.")).toBe(null);
  });
});

describe("suggestedCustomDomainHostname", () => {
  it("suggests a staging host on a sandbox environment", () => {
    expect(suggestedCustomDomainHostname("example.org.uk", "staging.group-one")).toBe("staging.example.org.uk");
  });

  it("suggests www on a live environment", () => {
    expect(suggestedCustomDomainHostname("example.org.uk", "group-one")).toBe("www.example.org.uk");
  });

  it("returns null when no group domain is known", () => {
    expect(suggestedCustomDomainHostname(null, "staging.group-one")).toBe(null);
  });
});

describe("dnsProviderFromNameservers", () => {
  it("detects Cloudflare as the platform DNS", () => {
    const detected = dnsProviderFromNameservers(["bonnie.ns.cloudflare.com", "rodney.ns.cloudflare.com"]);
    expect(detected.provider).toBe(DnsProvider.CLOUDFLARE);
    expect(detected.label).toBe("Cloudflare");
    expect(detected.ours).toBe(true);
  });

  it("detects StackDNS when nameservers are not Cloudflare", () => {
    const detected = dnsProviderFromNameservers(["ns1.stackdns.com", "ns2.stackdns.com"]);
    expect(detected.provider).toBe(DnsProvider.STACK_DNS);
    expect(detected.label).toBe("StackDNS");
    expect(detected.ours).toBe(false);
  });

  it("names an unknown provider from the nameserver organisation", () => {
    const detected = dnsProviderFromNameservers(["ns1.example.net"]);
    expect(detected.provider).toBe(DnsProvider.OTHER);
    expect(detected.label).toBe("example.net");
    expect(detected.ours).toBe(false);
  });

  it("returns unknown when there are no nameservers", () => {
    expect(dnsProviderFromNameservers([]).provider).toBe(DnsProvider.UNKNOWN);
  });
});
