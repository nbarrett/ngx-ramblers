import expect from "expect";
import { describe, it } from "mocha";
import { SalesforceConfig } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { buildFullOptOutConsentRequest } from "./salesforce-consent";

const TIMESTAMP_ISO = "2026-04-30T12:34:56.000Z";

function configWith(overrides: Partial<SalesforceConfig> = {}): SalesforceConfig {
  return {
    endpointBaseUrl: "https://example.test",
    apiKeysByGroupCode: { KT50: "secret" },
    enabled: true,
    ...overrides,
  };
}

describe("salesforce-consent", () => {

  describe("buildFullOptOutConsentRequest", () => {

    it("should always set emailMarketingConsent to false", () => {
      const request = buildFullOptOutConsentRequest(configWith(), undefined, TIMESTAMP_ISO);
      expect(request.emailMarketingConsent).toEqual(false);
    });

    it("should always identify NGX as the source", () => {
      const request = buildFullOptOutConsentRequest(configWith(), undefined, TIMESTAMP_ISO);
      expect(request.source).toEqual("ngx-ramblers");
    });

    it("should pass the supplied timestamp through", () => {
      const request = buildFullOptOutConsentRequest(configWith(), undefined, TIMESTAMP_ISO);
      expect(request.timestamp).toEqual(TIMESTAMP_ISO);
    });

    it("should include the reason when supplied", () => {
      const request = buildFullOptOutConsentRequest(configWith(), "branded-unsubscribe-list", TIMESTAMP_ISO);
      expect(request.reason).toEqual("branded-unsubscribe-list");
    });

    it("should omit the reason key when undefined rather than sending null", () => {
      const request = buildFullOptOutConsentRequest(configWith(), undefined, TIMESTAMP_ISO);
      expect(request.reason).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(request, "reason")).toEqual(false);
    });

    it("should leave granular consent flags absent when toggle is off (parity mode)", () => {
      const request = buildFullOptOutConsentRequest(configWith({ enableGranularConsent: false }), "x", TIMESTAMP_ISO);
      expect(request.groupMarketingConsent).toBeUndefined();
      expect(request.areaMarketingConsent).toBeUndefined();
      expect(request.otherMarketingConsent).toBeUndefined();
    });

    it("should set all granular flags to false when toggle is on", () => {
      const request = buildFullOptOutConsentRequest(configWith({ enableGranularConsent: true }), "x", TIMESTAMP_ISO);
      expect(request.groupMarketingConsent).toEqual(false);
      expect(request.areaMarketingConsent).toEqual(false);
      expect(request.otherMarketingConsent).toEqual(false);
    });
  });
});
