import expect from "expect";
import { describe, it } from "mocha";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { memberFieldChanges } from "./member-field-audit";

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: "member-1",
    firstName: "Colin",
    lastName: "Hatcher",
    email: "colin@example.com",
    mobileNumber: "07700 900001",
    emailMarketingConsent: false,
    ...overrides
  } as Member;
}

describe("memberFieldChanges", () => {

  it("returns nothing when a save changes no audited field", () => {
    expect(memberFieldChanges(member(), member())).toEqual([]);
  });

  it("records an edited field with its previous and new value", () => {
    const changes = memberFieldChanges(member(), member({email: "colin.hatcher@example.com"}));
    expect(changes).toEqual([{
      fieldName: "email",
      from: "colin@example.com",
      to: "colin.hatcher@example.com",
      resolution: "Edited"
    }]);
  });

  it("records a value being cleared as (none)", () => {
    const changes = memberFieldChanges(member(), member({mobileNumber: ""}));
    expect(changes).toEqual([{
      fieldName: "mobileNumber",
      from: "07700 900001",
      to: "(none)",
      resolution: "Edited"
    }]);
  });

  it("records every field as Created when there is no prior member", () => {
    const changes = memberFieldChanges(undefined, member());
    expect(changes.map(change => change.resolution)).toEqual(changes.map(() => "Created"));
    expect(changes.find(change => change.fieldName === "firstName")).toEqual({
      fieldName: "firstName",
      from: "(none)",
      to: "Colin",
      resolution: "Created"
    });
  });

  it("records boolean changes such as marketing consent", () => {
    const changes = memberFieldChanges(member(), member({emailMarketingConsent: true}));
    expect(changes).toEqual([{
      fieldName: "emailMarketingConsent",
      from: "false",
      to: "true",
      resolution: "Edited"
    }]);
  });

  it("ignores credentials and audit stamps so a re-save records nothing", () => {
    const prior = member({password: "old-hash", updatedBy: "member-9", updatedDate: 1} as Partial<Member>);
    const next = member({password: "new-hash", updatedBy: "member-8", updatedDate: 2} as Partial<Member>);
    expect(memberFieldChanges(prior, next)).toEqual([]);
  });

  it("ignores nested objects so a Brevo sync stamp records nothing", () => {
    const prior = member({mail: {subscriptions: [{id: 2, subscribed: true}], lastSyncedSignature: "a"}} as Partial<Member>);
    const next = member({mail: {subscriptions: [{id: 2, subscribed: false}], lastSyncedSignature: "b"}} as Partial<Member>);
    expect(memberFieldChanges(prior, next)).toEqual([]);
  });

});
