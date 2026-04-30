import expect from "expect";
import { describe, it } from "mocha";
import { SalesforceMember } from "../../../projects/ngx-ramblers/src/app/models/salesforce.model";
import { mapSalesforceMemberToRamblersMember } from "./salesforce-member-mapper";

function baseSalesforceMember(overrides: Partial<SalesforceMember> = {}): SalesforceMember {
  return {
    salesforceId: "003Dn00000A1b2cDEF",
    membershipNumber: "3300001",
    firstName: "Jane",
    lastName: "Smith",
    title: "Mrs",
    email: "jane.smith@example.com",
    mobileNumber: "07700 900001",
    landlineTelephone: "01303 555111",
    postcode: "CT1 2AA",
    membershipType: "Individual",
    memberType: "Member",
    memberTerm: "annual",
    memberStatus: "Active",
    jointWith: "",
    membershipExpiryDate: "2026-07-15T00:00:00Z",
    emailMarketingConsent: true,
    emailPermissionLastUpdated: "2023-07-15T00:00:00Z",
    ...overrides,
  };
}

describe("salesforce-member-mapper", () => {

  describe("mapSalesforceMemberToRamblersMember", () => {

    it("should map identity, contact and membership fields onto RamblersMember", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember());
      expect(result.membershipNumber).toEqual("3300001");
      expect(result.firstName).toEqual("Jane");
      expect(result.lastName).toEqual("Smith");
      expect(result.title).toEqual("Mrs");
      expect(result.email).toEqual("jane.smith@example.com");
      expect(result.mobileNumber).toEqual("07700 900001");
      expect(result.landlineTelephone).toEqual("01303 555111");
      expect(result.postcode).toEqual("CT1 2AA");
      expect(result.type).toEqual("Individual");
      expect(result.memberStatus).toEqual("Active");
      expect(result.memberTerm).toEqual("annual");
    });

    it("should fall back to salesforceId when membershipNumber is absent", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({ membershipNumber: undefined }));
      expect(result.membershipNumber).toEqual("003Dn00000A1b2cDEF");
    });

    it("should convert membershipExpiryDate from ISO to dd/MM/yy", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({
        membershipExpiryDate: "2026-07-15T00:00:00Z"
      }));
      expect(result.membershipExpiryDate).toEqual("15/07/26");
    });

    it("should convert emailPermissionLastUpdated from ISO to dd/MM/yyyy", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({
        emailPermissionLastUpdated: "2023-07-15T00:00:00Z"
      }));
      expect(result.emailPermissionLastUpdated).toEqual("15/07/2023");
    });

    it("should leave membership-expiry undefined when Salesforce returns no value", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({ membershipExpiryDate: undefined }));
      expect(result.membershipExpiryDate).toBeUndefined();
    });

    it("should coerce emailMarketingConsent boolean to string \"true\"", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({ emailMarketingConsent: true }));
      expect(result.emailMarketingConsent).toEqual("true");
    });

    it("should coerce emailMarketingConsent boolean to string \"false\"", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({ emailMarketingConsent: false }));
      expect(result.emailMarketingConsent).toEqual("false");
    });

    it("should drop memberTerm when Salesforce returns an unrecognised value", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({ memberTerm: "lifetime" as any }));
      expect(result.memberTerm).toBeUndefined();
    });

    it("should null-out optional contact fields that Salesforce omits", () => {
      const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({
        email: undefined, mobileNumber: undefined, landlineTelephone: undefined, postcode: undefined
      }));
      expect(result.email).toBeNull();
      expect(result.mobileNumber).toBeNull();
      expect(result.landlineTelephone).toBeNull();
      expect(result.postcode).toBeNull();
    });

    describe("granular consent toggle", () => {

      it("should omit granular consent fields when toggle is off, even if Salesforce returns them", () => {
        const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({
          groupMarketingConsent: true,
          areaMarketingConsent: false,
          otherMarketingConsent: true,
        }));
        expect(result.groupMarketingConsent).toBeUndefined();
        expect(result.areaMarketingConsent).toBeUndefined();
        expect(result.otherMarketingConsent).toBeUndefined();
      });

      it("should pass granular consent through as strings when toggle is on", () => {
        const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({
          groupMarketingConsent: true,
          areaMarketingConsent: false,
          otherMarketingConsent: true,
        }), { enableGranularConsent: true });
        expect(result.groupMarketingConsent).toEqual("true");
        expect(result.areaMarketingConsent).toEqual("false");
        expect(result.otherMarketingConsent).toEqual("true");
      });

      it("should preserve absence (three-state) when Salesforce omits a granular flag with toggle on", () => {
        const result = mapSalesforceMemberToRamblersMember(baseSalesforceMember({
          groupMarketingConsent: true,
        }), { enableGranularConsent: true });
        expect(result.groupMarketingConsent).toEqual("true");
        expect(result.areaMarketingConsent).toBeUndefined();
        expect(result.otherMarketingConsent).toBeUndefined();
      });
    });
  });
});
