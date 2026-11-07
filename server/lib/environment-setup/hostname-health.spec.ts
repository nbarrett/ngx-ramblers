import sinon from "sinon";
import * as cloudflareDns from "../cloudflare/cloudflare-dns";
import * as publicDns from "../shared/dns-nameservers";
import * as routing from "../cloudflare/cloudflare-email-routing";
import * as tokens from "../cloudflare/cloudflare-api-token";
import { DnsRecordType } from "../cloudflare/cloudflare.model";
import { MailDnsLookupStatus } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { CLOUDFLARE_INBOUND_MX } from "../../../projects/ngx-ramblers/src/app/functions/mx-record-status";
import expect from "expect";
import { afterEach, describe, it } from "mocha";
import {
  annotateOptionalEnvironmentSubdomain,
  annotateOptionalPairHost,
  classifyHostnameHealth,
  emailRoutingStatusFor,
  customDomainEligibilityFromLookup,
  validateRedirectTargets
} from "./hostname-health";
import { apexWwwSibling, publicHostnameForSiteUrlPreference } from "../cloudflare/hostname-siblings";
import { candidateZoneNames } from "../cloudflare/cloudflare-dns";
import { SiteUrlPreference } from "../../../projects/ngx-ramblers/src/app/models/environment-config.model";
import {
  DnsProvider,
  HostnameHealth,
  HostnameEmailRoutingHealth,
  HostnameOrigin,
  HostnameStatus
} from "../../../projects/ngx-ramblers/src/app/models/environment-setup.model";

function status(overrides: Partial<HostnameStatus>): HostnameStatus {
  return {
    hostname: "example.org.uk",
    origin: HostnameOrigin.SITE_URL,
    health: HostnameHealth.SERVING,
    healthy: true,
    dnsRecordType: "A",
    dnsContent: "1.2.3.4",
    proxied: true,
    redirectRuleTarget: "",
    httpStatus: 200,
    httpRedirectLocation: "",
    nameservers: [],
    dnsProvider: DnsProvider.UNKNOWN,
    dnsProviderLabel: "Unknown",
    message: "Serving the site",
    ...overrides
  };
}

describe("hostname-health", () => {

  describe("validateRedirectTargets", () => {

    it("should flag a hostname redirecting to a target that does not resolve", () => {
      const result = validateRedirectTargets([
        status({
          hostname: "group.example.org.uk",
          health: HostnameHealth.REDIRECTING,
          healthy: true,
          redirectRuleTarget: "www.group.example.org.uk",
          message: "Redirects to https://www.group.example.org.uk"
        }),
        status({
          hostname: "www.group.example.org.uk",
          origin: HostnameOrigin.REDIRECT_TARGET,
          health: HostnameHealth.NO_DNS,
          healthy: false,
          dnsRecordType: "",
          dnsContent: "",
          httpStatus: 0,
          message: "No DNS record exists for www.group.example.org.uk, so it does not resolve at all"
        })
      ]);
      expect(result[0].healthy).toEqual(false);
      expect(result[0].health).toEqual(HostnameHealth.REDIRECT_TARGET_MISSING);
      expect(result[0].message).toContain("is not working");
    });

    it("should leave a hostname redirecting to a healthy target alone", () => {
      const result = validateRedirectTargets([
        status({
          hostname: "example.co.uk",
          health: HostnameHealth.REDIRECTING,
          redirectRuleTarget: "www.example.co.uk",
          message: "Redirects to https://www.example.co.uk"
        }),
        status({ hostname: "www.example.co.uk" })
      ]);
      expect(result[0].healthy).toEqual(true);
      expect(result[0].health).toEqual(HostnameHealth.REDIRECTING);
    });

    it("should treat a proxied serving host as a working redirect target", () => {
      const result = validateRedirectTargets([
        status({
          hostname: "group.example.org.uk",
          health: HostnameHealth.REDIRECTING,
          healthy: true,
          redirectRuleTarget: "www.group.example.org.uk",
          message: "Redirects to https://www.group.example.org.uk via a Cloudflare rule"
        }),
        status({
          hostname: "www.group.example.org.uk",
          health: HostnameHealth.PROXIED,
          healthy: false,
          proxied: true,
          message: "Serving through Cloudflare HTTP proxy"
        })
      ]);
      expect(result[0].health).toEqual(HostnameHealth.REDIRECTING);
      expect(result[0].healthy).toEqual(true);
    });

    it("should leave non-redirecting hostnames untouched", () => {
      const result = validateRedirectTargets([status({ hostname: "www.example.co.uk" })]);
      expect(result[0].health).toEqual(HostnameHealth.SERVING);
      expect(result[0].healthy).toEqual(true);
    });
  });

  describe("classifyHostnameHealth", () => {

    it("should mark a DNS-only leftover CNAME with a Cloudflare rule as redirect not live", () => {
      const result = classifyHostnameHealth(
        "www.winchesterwalkingweekend.org.uk",
        [{ type: "CNAME", content: "winchester-walking-weekend.fly.dev", proxied: false }],
        "winchesterwalkingweekend.org.uk",
        0,
        ""
      );
      expect(result.health).toEqual(HostnameHealth.REDIRECT_NOT_PROXIED);
      expect(result.message).toContain("Visitors cannot reach this address");
      expect(result.message).toContain("winchesterwalkingweekend.org.uk");
    });

    it("should mark a proxied hostname with a Cloudflare 302 as redirecting", () => {
      const result = classifyHostnameHealth(
        "www.ekwg.co.uk",
        [{ type: "A", content: "192.0.2.1", proxied: true }],
        "ekwg.co.uk",
        302,
        "https://ekwg.co.uk/"
      );
      expect(result.health).toEqual(HostnameHealth.REDIRECTING);
      expect(result.message).toContain("via a Cloudflare rule");
    });

    it("should still treat a DNS-only hostname as serving when HTTPS actually works", () => {
      const result = classifyHostnameHealth(
        "www.example.org.uk",
        [{ type: "CNAME", content: "example.fly.dev", proxied: false }],
        "example.org.uk",
        200,
        ""
      );
      expect(result.health).toEqual(HostnameHealth.SERVING);
    });

    it("should mark a proxied hostname that returns 200 as blocking mail apps", () => {
      const result = classifyHostnameHealth(
        "www.group.example.org.uk",
        [{ type: "A", content: "66.241.124.94", proxied: true }],
        "",
        200,
        ""
      );
      expect(result.health).toEqual(HostnameHealth.PROXIED);
      expect(result.message).toContain("IMAP");
    });

    it("should mark a hostname with no DNS record as having no DNS", () => {
      const result = classifyHostnameHealth("missing.example.org.uk", [], "", 0, "");
      expect(result.health).toEqual(HostnameHealth.NO_DNS);
    });

    it("should mark a proxied redirect as waiting when HTTPS does not respond yet", () => {
      const result = classifyHostnameHealth(
        "www.example.org.uk",
        [{ type: "A", content: "192.0.2.1", proxied: true }],
        "example.org.uk",
        0,
        ""
      );
      expect(result.health).toEqual(HostnameHealth.REDIRECT_PENDING);
      expect(result.message).toContain("has not finished HTTPS yet");
    });
  });

  describe("annotateOptionalEnvironmentSubdomain", () => {

    it("should omit a missing NGX host when a custom domain is already serving", () => {
      const result = annotateOptionalEnvironmentSubdomain([
        status({
          hostname: "www.group.org.uk",
          origin: HostnameOrigin.SITE_URL,
          health: HostnameHealth.SERVING,
          healthy: true
        }),
        status({
          hostname: "group.ngx-ramblers.org.uk",
          origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
          health: HostnameHealth.NO_DNS,
          healthy: false,
          dnsRecordType: "",
          dnsContent: "",
          httpStatus: 0,
          message: "No DNS record exists"
        })
      ]);
      expect(result.map(hostname => hostname.hostname)).toEqual(["www.group.org.uk"]);
    });

    it("should still flag a missing NGX host when nothing else is serving", () => {
      const result = annotateOptionalEnvironmentSubdomain([
        status({
          hostname: "group.ngx-ramblers.org.uk",
          origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
          health: HostnameHealth.NO_DNS,
          healthy: false
        })
      ]);
      expect(result[0].health).toEqual(HostnameHealth.NO_DNS);
      expect(result[0].healthy).toEqual(false);
    });

    it("should still flag a broken NGX host that has DNS even if a custom domain is serving", () => {
      const result = annotateOptionalEnvironmentSubdomain([
        status({
          hostname: "www.group.org.uk",
          origin: HostnameOrigin.SITE_URL,
          health: HostnameHealth.SERVING,
          healthy: true
        }),
        status({
          hostname: "group.ngx-ramblers.org.uk",
          origin: HostnameOrigin.ENVIRONMENT_SUBDOMAIN,
          health: HostnameHealth.UNREACHABLE,
          healthy: false,
          dnsRecordType: "A",
          dnsContent: "1.2.3.4"
        })
      ]);
      expect(result[1].health).toEqual(HostnameHealth.UNREACHABLE);
      expect(result[1].healthy).toEqual(false);
    });
  });

  describe("annotateOptionalPairHost", () => {

    it("should not treat a missing www as a problem when the apex is already serving", () => {
      const result = annotateOptionalPairHost([
        status({
          hostname: "group.org.uk",
          origin: HostnameOrigin.SITE_URL,
          health: HostnameHealth.SERVING,
          healthy: true
        }),
        status({
          hostname: "www.group.org.uk",
          origin: HostnameOrigin.SIBLING,
          health: HostnameHealth.NO_DNS,
          healthy: false,
          dnsRecordType: "",
          dnsContent: "",
          httpStatus: 0,
          message: "No DNS record exists"
        })
      ]);
      expect(result[1].health).toEqual(HostnameHealth.NOT_CREATED);
      expect(result[1].healthy).toEqual(true);
    });
  });

  describe("apexWwwSibling", () => {
    const zone = { id: "zone-id", name: "example.org.uk", status: "active" };

    it("should pair the zone apex with its www variant", () => {
      expect(apexWwwSibling("example.org.uk", zone)).toEqual("www.example.org.uk");
      expect(apexWwwSibling("www.example.org.uk", zone)).toEqual("example.org.uk");
    });

    it("should not pair a subdomain with a www variant of itself", () => {
      expect(apexWwwSibling("group.example.org.uk", zone)).toEqual("");
      expect(apexWwwSibling("www.group.example.org.uk", zone)).toEqual("");
    });
  });

  describe("publicHostnameForSiteUrlPreference", () => {
    it("defaults visitors to the apex", () => {
      expect(publicHostnameForSiteUrlPreference("fhramblers.org.uk", SiteUrlPreference.APEX)).toEqual("fhramblers.org.uk");
      expect(publicHostnameForSiteUrlPreference("fhramblers.org.uk", SiteUrlPreference.WWW)).toEqual("www.fhramblers.org.uk");
    });
  });

  describe("candidateZoneNames", () => {

    it("strips a site URL down to zone name candidates", () => {
      expect(candidateZoneNames("https://fhramblers.org.uk")).toEqual(["fhramblers.org.uk", "org.uk"]);
      expect(candidateZoneNames("www.fhramblers.org.uk")).toEqual(["fhramblers.org.uk", "org.uk"]);
    });
  });

  describe("customDomainEligibilityFromLookup", () => {

    it("should treat a zone in this Cloudflare account as eligible without confirmation", () => {
      const eligibility = customDomainEligibilityFromLookup("staging.example.org.uk", "example.org.uk", [
        "bonnie.ns.cloudflare.com",
        "rodney.ns.cloudflare.com"
      ]);
      expect(eligibility.managedByThisAccount).toEqual(true);
      expect(eligibility.dnsProvider).toEqual(DnsProvider.CLOUDFLARE);
      expect(eligibility.zoneName).toEqual("example.org.uk");
      expect(eligibility.message).toContain("is in this Cloudflare account");
      expect(eligibility.message).toContain("zone example.org.uk");
    });

    it("should warn when DNS is StackDNS and not this Cloudflare account", () => {
      const eligibility = customDomainEligibilityFromLookup("staging.example.org.uk", null, [
        "ns1.stackdns.com",
        "ns2.stackdns.com",
        "ns3.stackdns.com",
        "ns4.stackdns.com"
      ]);
      expect(eligibility.managedByThisAccount).toEqual(false);
      expect(eligibility.dnsProvider).toEqual(DnsProvider.STACK_DNS);
      expect(eligibility.dnsProviderLabel).toEqual("StackDNS");
      expect(eligibility.message).toContain("does not manage staging.example.org.uk");
      expect(eligibility.message).toContain("hosted at StackDNS");
      expect(eligibility.message).toContain("ns1.stackdns.com");
      expect(eligibility.message).toContain("Attaching will request a Fly certificate");
    });

    it("should warn when nameservers are Cloudflare but the zone is not in this account", () => {
      const eligibility = customDomainEligibilityFromLookup("www.example.org.uk", null, [
        "ada.ns.cloudflare.com",
        "tim.ns.cloudflare.com"
      ]);
      expect(eligibility.managedByThisAccount).toEqual(false);
      expect(eligibility.dnsProvider).toEqual(DnsProvider.CLOUDFLARE);
      expect(eligibility.message).toContain("nameservers are Cloudflare, but the zone is not in this account");
    });

    it("should warn when public nameservers cannot be determined", () => {
      const eligibility = customDomainEligibilityFromLookup("unknown.example.org.uk", null, []);
      expect(eligibility.managedByThisAccount).toEqual(false);
      expect(eligibility.dnsProvider).toEqual(DnsProvider.UNKNOWN);
      expect(eligibility.message).toContain("Public nameservers could not be determined");
    });
  });
});

describe("incoming mail hostname diagnostics", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("checks the site's mail subdomain and prevents readiness when delegation conflicts with MX", async () => {
    const hostname = "group.example.org.uk";
    sandbox.stub(cloudflareDns, "zoneForHostname").resolves({id: "zone-id", name: "example.org.uk", status: "active"});
    const records = sandbox.stub(cloudflareDns, "listDnsRecords");
    records.withArgs(sinon.match.any, hostname, DnsRecordType.MX).resolves(CLOUDFLARE_INBOUND_MX.map((record, index) => ({...record, id: `mx-${index}`, name: hostname, type: DnsRecordType.MX})));
    records.withArgs(sinon.match.any, hostname, DnsRecordType.NS).resolves([{id: "ns-1", name: hostname, type: DnsRecordType.NS, content: "ns1.mail-provider.example.com"}]);
    sandbox.stub(publicDns, "publicMailExchanges").resolves([{resolver: "1.1.1.1", status: MailDnsLookupStatus.FAILED, exchanges: [], error: "ESERVFAIL"}]);
    sandbox.stub(routing, "getEmailRoutingSettings").resolves({enabled: true});
    const result = await emailRoutingStatusFor("test-token", "account-id", hostname, "");
    expect(result.mxRecordStatus.subdomain).toBe(hostname);
    expect(result.cloudflareMx).toBe(true);
    expect(result.inboundReady).toBe(false);
    expect(result.repairable).toBe(false);
    expect(result.health).toBe(HostnameEmailRoutingHealth.DNS_ERROR);
  });

  it("reports a routing permission error without trying to repair credentials during a health check", async () => {
    sandbox.stub(cloudflareDns, "zoneForHostname").resolves({id: "zone-id", name: "example.org.uk", status: "active"});
    sandbox.stub(cloudflareDns, "listDnsRecords").resolves([]);
    sandbox.stub(publicDns, "publicMailExchanges").resolves([]);
    sandbox.stub(routing, "getEmailRoutingSettings").rejects(new Error("Permission denied"));
    const repair = sandbox.spy(tokens, "ensureCloudflareTokenCanManageEmailRouting");
    const result = await emailRoutingStatusFor("test-token", "account-id", "example.org.uk", "");
    expect(result.health).toBe(HostnameEmailRoutingHealth.API_DENIED);
    expect(result.message).toContain("Incoming mail for example.org.uk");
    expect(result.message).toContain("Permission denied");
    expect(repair.called).toBe(false);
  });

  it("names the mail subdomain in extra MX diagnostics, not the Cloudflare zone", async () => {
    const hostname = "group.example.org.uk";
    sandbox.stub(cloudflareDns, "zoneForHostname").resolves({id: "zone-id", name: "example.org.uk", status: "active"});
    const records = sandbox.stub(cloudflareDns, "listDnsRecords");
    records.callsFake((_config, name, type) => type === DnsRecordType.MX && name === hostname
      ? Promise.resolve([{id: "mx-old", name: hostname, type: DnsRecordType.MX, content: "inbound.mail-provider.example.com"}])
      : Promise.resolve([]));
    sandbox.stub(publicDns, "publicMailExchanges").resolves([]);
    sandbox.stub(routing, "getEmailRoutingSettings").resolves({enabled: true});
    const result = await emailRoutingStatusFor("test-token", "account-id", hostname, "");
    expect(result.health).toBe(HostnameEmailRoutingHealth.MX_MISSING);
    expect(result.message).toContain("Incoming mail for group.example.org.uk");
    expect(result.message).toContain("inbound.mail-provider.example.com");
    expect(result.message.includes("Incoming mail for example.org.uk is still")).toBe(false);
  });

  it("names the mail subdomain when incoming mail is ready", async () => {
    const hostname = "group.example.org.uk";
    sandbox.stub(cloudflareDns, "zoneForHostname").resolves({id: "zone-id", name: "example.org.uk", status: "active"});
    const records = sandbox.stub(cloudflareDns, "listDnsRecords");
    records.callsFake((_config, name, type) => type === DnsRecordType.MX && name === hostname
      ? Promise.resolve(CLOUDFLARE_INBOUND_MX.map((record, index) => ({...record, id: `mx-${index}`, name: hostname, type: DnsRecordType.MX})))
      : Promise.resolve([]));
    sandbox.stub(publicDns, "publicMailExchanges").resolves([]);
    sandbox.stub(routing, "getEmailRoutingSettings").resolves({enabled: true});
    const result = await emailRoutingStatusFor("test-token", "account-id", hostname, "");
    expect(result.inboundReady).toBe(true);
    expect(result.health).toBe(HostnameEmailRoutingHealth.READY);
    expect(result.message).toBe("Incoming mail for group.example.org.uk is accepted by Cloudflare Email Routing.");
  });
});
