import {
  DnsProvider,
  HostnameHealth,
  HostnameOrigin,
  HostnameSituationAlert,
  HostnameSituationKind,
  HostnameStatus
} from "../models/environment-setup.model";
import { analyseHostnameSituation, hostnameNeedsAction } from "./hostname-situation";

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

describe("hostname-situation", () => {

  it("should ask for a re-check when no hostnames were returned", () => {
    const situation = analyseHostnameSituation([]);
    expect(situation.kind).toBe(HostnameSituationKind.NONE_TO_CHECK);
    expect(situation.action).toContain("Re-check");
  });

  it("should tell you to clear a Ramblers national Site URL and use the live host", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "www.ramblers.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.UNREACHABLE,
        healthy: false
      }),
      status({
        hostname: "group.org.uk",
        origin: HostnameOrigin.CUSTOM_DOMAIN
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.WRONG_SITE_URL);
    expect(situation.action).toContain("Clear Site URL");
    expect(situation.action).toContain("Use as Site URL");
    expect(situation.action).toContain("group.org.uk");
  });

  it("should tell you to clear a national Site URL and set up the subdomain when nothing is live", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "www.ramblers.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.UNREACHABLE,
        healthy: false
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.WRONG_SITE_URL);
    expect(situation.action).toContain("Setup subdomain");
  });

  it("should tell you to set up the subdomain when nothing is serving", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
        health: HostnameHealth.NO_DNS,
        healthy: false,
        dnsRecordType: "",
        dnsContent: "",
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.SITE_NOT_LIVE_SETUP_SUBDOMAIN);
    expect(situation.action).toContain("Setup subdomain");
  });

  it("should tell you to deploy when the NGX host has DNS but HTTPS is dead", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.UNREACHABLE,
        healthy: false,
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.SITE_NOT_LIVE_DEPLOY);
    expect(situation.action).toContain("Deploy to Fly.io");
  });

  it("should tell you to attach a custom domain when the Site URL has no DNS", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "group.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.NO_DNS,
        healthy: false,
        dnsRecordType: "",
        dnsContent: "",
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.SITE_NOT_LIVE_ATTACH_DOMAIN);
    expect(situation.action).toContain("Attach group.org.uk");
  });

  it("should tell you to check a custom domain when the public address is not serving", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "group.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.UNREACHABLE,
        healthy: false,
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.SITE_NOT_LIVE_CHECK_DOMAIN);
    expect(situation.action).toContain("Check");
  });

  it("should say DNS is outside this Cloudflare account when there is no zone", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "group.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.ZONE_NOT_FOUND,
        healthy: false
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.SITE_NOT_LIVE_EXTERNAL_DNS);
    expect(situation.action).toContain("Cloudflare");
  });

  it("should say the site is live when apex serves and www redirects", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "www.group.org.uk",
        origin: HostnameOrigin.SIBLING,
        health: HostnameHealth.REDIRECTING,
        healthy: true,
        redirectRuleTarget: "group.org.uk",
        httpStatus: 302
      }),
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
        health: HostnameHealth.NOT_CREATED,
        healthy: true
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE);
    expect(situation.alert).toBe(HostnameSituationAlert.SUCCESS);
    expect(situation.action).toBeNull();
    expect(situation.detail).toContain("group.org.uk");
    expect(situation.detail).toContain("www.group.org.uk");
  });

  it("should treat a proxied redirect with no HTTPS yet as waiting, not as a problem", () => {
    const pending = status({
      hostname: "www.group.org.uk",
      origin: HostnameOrigin.SIBLING,
      health: HostnameHealth.REDIRECT_PENDING,
      healthy: false,
      redirectRuleTarget: "group.org.uk",
      proxied: true,
      dnsContent: "192.0.2.1",
      httpStatus: 0
    });
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      pending
    ]);
    expect(hostnameNeedsAction(pending)).toBe(false);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REDIRECT_WAITING);
    expect(situation.action).toContain("Re-check");
  });

  it("should tell you to repair when the live site's www redirect is not proxied", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "www.group.org.uk",
        origin: HostnameOrigin.SIBLING,
        health: HostnameHealth.REDIRECT_NOT_PROXIED,
        healthy: false,
        redirectRuleTarget: "group.org.uk"
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REDIRECT_BROKEN);
    expect(situation.action).toContain("Repair redirect");
  });

  it("should tell you to remove and recreate a redirect that points at a dead host", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "www.group.org.uk",
        origin: HostnameOrigin.SIBLING,
        health: HostnameHealth.REDIRECT_TARGET_MISSING,
        healthy: false,
        redirectRuleTarget: "old.group.org.uk"
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REDIRECT_TARGET_MISSING);
    expect(situation.action).toContain("Remove redirect");
    expect(situation.action).toContain("group.org.uk");
  });

  it("should tell you to set up a redirect when the placeholder has no rule", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "www.group.org.uk",
        origin: HostnameOrigin.SIBLING,
        health: HostnameHealth.REDIRECT_TARGET_MISSING,
        healthy: false,
        redirectRuleTarget: "",
        dnsContent: "192.0.2.1"
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REDIRECT_TARGET_MISSING);
    expect(situation.action).toContain("Apex / www redirect");
  });

  it("should tell you to use the live host as Site URL when Site URL is not that host", () => {
    const situation = analyseHostnameSituation([
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.SITE_URL,
        health: HostnameHealth.NO_DNS,
        healthy: false,
        dnsRecordType: "",
        dnsContent: ""
      }),
      status({
        hostname: "group.org.uk",
        origin: HostnameOrigin.CUSTOM_DOMAIN
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_SET_SITE_URL);
    expect(situation.action).toContain("Use as Site URL");
    expect(situation.action).toContain("group.org.uk");
  });

  it("should say both addresses serve when apex and www both return the site", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({hostname: "www.group.org.uk", origin: HostnameOrigin.SIBLING})
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_BOTH_SERVING);
    expect(situation.action).toContain("Apex / www redirect");
  });

  it("should tell you to remove a leftover NGX host that still serves beside a custom domain", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REMOVE_SUBDOMAIN);
    expect(situation.action).toContain("Remove subdomain");
  });

  it("should tell you to remove a leftover NGX host that has DNS but is dead", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
        health: HostnameHealth.UNREACHABLE,
        healthy: false,
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REMOVE_SUBDOMAIN);
    expect(situation.action).toContain("Remove subdomain");
  });

  it("should tell you to check an extra custom domain that is not serving", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "other.group.org.uk",
        origin: HostnameOrigin.CUSTOM_DOMAIN,
        health: HostnameHealth.UNREACHABLE,
        healthy: false,
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_CHECK_CUSTOM_DOMAIN);
    expect(situation.action).toContain("Check");
    expect(situation.action).toContain("other.group.org.uk");
  });

  it("should tell you to set up the pair redirect when the unused half is dead without a Cloudflare rule", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.SITE_URL}),
      status({
        hostname: "www.group.org.uk",
        origin: HostnameOrigin.SIBLING,
        health: HostnameHealth.UNREACHABLE,
        healthy: false,
        httpStatus: 0
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_SETUP_PAIR_REDIRECT);
    expect(situation.action).toContain("Apex / www redirect");
  });

  it("should prefer Repair over every other live-site issue", () => {
    const situation = analyseHostnameSituation([
      status({hostname: "group.org.uk", origin: HostnameOrigin.CUSTOM_DOMAIN}),
      status({
        hostname: "www.group.org.uk",
        origin: HostnameOrigin.SIBLING,
        health: HostnameHealth.REDIRECT_NOT_PROXIED,
        healthy: false,
        redirectRuleTarget: "group.org.uk"
      }),
      status({
        hostname: "group.ngx-ramblers.org.uk",
        origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
        health: HostnameHealth.UNREACHABLE,
        healthy: false
      })
    ]);
    expect(situation.kind).toBe(HostnameSituationKind.LIVE_REDIRECT_BROKEN);
    expect(situation.action).toContain("Repair redirect");
  });
});
