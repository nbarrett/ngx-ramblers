import expect from "expect";
import { describe, it } from "mocha";
import { customDomainEligibilityFromLookup, validateRedirectTargets } from "./hostname-health";
import { apexWwwSibling } from "../cloudflare/hostname-siblings";
import {
  DnsProvider,
  HostnameHealth,
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

    it("should leave non-redirecting hostnames untouched", () => {
      const result = validateRedirectTargets([status({ hostname: "www.example.co.uk" })]);
      expect(result[0].health).toEqual(HostnameHealth.SERVING);
      expect(result[0].healthy).toEqual(true);
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
