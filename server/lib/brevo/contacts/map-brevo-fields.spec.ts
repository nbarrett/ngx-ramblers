import expect from "expect";
import { describe, it } from "mocha";
import {
  mapBrevoContactFields,
  mapBrevoListFields,
  mapBrevoContacts,
  mapBrevoLists,
  toBrevoContactUpdateFields
} from "./map-brevo-fields";

describe("map-brevo-fields", () => {

  it("maps contact wire denied fields to domain names and drops wire keys", () => {
    const mapped = mapBrevoContactFields({
      email: "a@example.com",
      emailBlacklisted: true,
      smsBlacklisted: false,
      id: 1
    });
    expect(mapped.emailDenied).toBe(true);
    expect(mapped.smsDenied).toBe(false);
    expect(mapped.email).toBe("a@example.com");
    expect((mapped as {emailBlacklisted?: boolean}).emailBlacklisted).toBeUndefined();
    expect((mapped as {smsBlacklisted?: boolean}).smsBlacklisted).toBeUndefined();
  });

  it("keeps domain names when already mapped", () => {
    const mapped = mapBrevoContactFields({
      emailDenied: true,
      smsDenied: true
    });
    expect(mapped.emailDenied).toBe(true);
    expect(mapped.smsDenied).toBe(true);
  });

  it("maps list totalBlacklisted to totalDenied", () => {
    const mapped = mapBrevoListFields({id: 9, name: "Members", totalBlacklisted: 3});
    expect(mapped.totalDenied).toBe(3);
    expect((mapped as {totalBlacklisted?: number}).totalBlacklisted).toBeUndefined();
  });

  it("maps arrays of contacts and lists", () => {
    expect(mapBrevoContacts([{emailBlacklisted: true}])).toEqual([
      expect.objectContaining({emailDenied: true})
    ]);
    expect(mapBrevoLists([{totalBlacklisted: 2}])).toEqual([
      expect.objectContaining({totalDenied: 2})
    ]);
  });

  it("maps domain update fields back to Brevo wire names", () => {
    expect(toBrevoContactUpdateFields({
      emailDenied: false,
      smsDenied: true,
      smtpDeniedSenders: ["x@example.com"]
    })).toEqual({
      emailBlacklisted: false,
      smsBlacklisted: true,
      smtpBlacklistSender: ["x@example.com"]
    });
  });
});
