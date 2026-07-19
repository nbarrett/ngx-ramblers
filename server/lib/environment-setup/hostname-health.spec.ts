import expect from "expect";
import { describe, it } from "mocha";
import { validateRedirectTargets } from "./hostname-health";
import { apexWwwSibling } from "../cloudflare/hostname-siblings";
import {
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
    message: "Serving the site",
    ...overrides
  };
}

describe("hostname-health", () => {

  describe("validateRedirectTargets", () => {

    it("should flag a hostname redirecting to a target that does not resolve", () => {
      const result = validateRedirectTargets([
        status({
          hostname: "berkshire-weekend-walkers.ngx-ramblers.org.uk",
          health: HostnameHealth.REDIRECTING,
          healthy: true,
          redirectRuleTarget: "www.berkshire-weekend-walkers.ngx-ramblers.org.uk",
          message: "Redirects to https://www.berkshire-weekend-walkers.ngx-ramblers.org.uk"
        }),
        status({
          hostname: "www.berkshire-weekend-walkers.ngx-ramblers.org.uk",
          origin: HostnameOrigin.REDIRECT_TARGET,
          health: HostnameHealth.NO_DNS,
          healthy: false,
          dnsRecordType: "",
          dnsContent: "",
          httpStatus: 0,
          message: "No DNS record exists for www.berkshire-weekend-walkers.ngx-ramblers.org.uk, so it does not resolve at all"
        })
      ]);
      expect(result[0].healthy).toEqual(false);
      expect(result[0].health).toEqual(HostnameHealth.REDIRECT_TARGET_MISSING);
      expect(result[0].message).toContain("is not working");
    });

    it("should leave a hostname redirecting to a healthy target alone", () => {
      const result = validateRedirectTargets([
        status({
          hostname: "ekwg.co.uk",
          health: HostnameHealth.REDIRECTING,
          redirectRuleTarget: "www.ekwg.co.uk",
          message: "Redirects to https://www.ekwg.co.uk"
        }),
        status({ hostname: "www.ekwg.co.uk" })
      ]);
      expect(result[0].healthy).toEqual(true);
      expect(result[0].health).toEqual(HostnameHealth.REDIRECTING);
    });

    it("should leave non-redirecting hostnames untouched", () => {
      const result = validateRedirectTargets([status({ hostname: "www.ekwg.co.uk" })]);
      expect(result[0].health).toEqual(HostnameHealth.SERVING);
      expect(result[0].healthy).toEqual(true);
    });
  });

  describe("apexWwwSibling", () => {
    const zone = { id: "zone-id", name: "ngx-ramblers.org.uk", status: "active" };

    it("should pair the zone apex with its www variant", () => {
      expect(apexWwwSibling("ngx-ramblers.org.uk", zone)).toEqual("www.ngx-ramblers.org.uk");
      expect(apexWwwSibling("www.ngx-ramblers.org.uk", zone)).toEqual("ngx-ramblers.org.uk");
    });

    it("should not pair a subdomain with a www variant of itself", () => {
      expect(apexWwwSibling("berkshire-weekend-walkers.ngx-ramblers.org.uk", zone)).toEqual("");
      expect(apexWwwSibling("www.berkshire-weekend-walkers.ngx-ramblers.org.uk", zone)).toEqual("");
    });
  });
});
