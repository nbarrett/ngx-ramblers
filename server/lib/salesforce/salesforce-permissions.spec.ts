import expect from "expect";
import { describe, it } from "mocha";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { applyHeadOfficeSendingPermissionBounds, protectedEmailPermissionError } from "./salesforce-permissions";

function supporter(values: Partial<Member>): Member {
  return { firstName: "Test", lastName: "Supporter", salesforceMemberRef: "member-ref", ...values };
}

describe("protectedEmailPermissionError", () => {
  it("fails closed when the sender is not matched", () => {
    expect(protectedEmailPermissionError(null, [supporter({ salesforceTeamStatus: "Member" })]))
      .toEqual("The signed-in account is not matched to a Ramblers supporter record");
  });

  it("requires permission to view supporter data", () => {
    const sender = supporter({ canEmailMembers: true, canViewMemberData: false });
    expect(protectedEmailPermissionError(sender, [supporter({ salesforceTeamStatus: "Member" })]))
      .toEqual("Ramblers has not granted permission to view supporter data");
  });

  it("enforces each published audience permission independently", () => {
    const sender = supporter({ canViewMemberData: true, canEmailMembers: true, canEmailVolunteers: false, canEmailWellbeingWalkers: false });
    expect(protectedEmailPermissionError(sender, [supporter({ salesforceTeamStatus: "Member" })])).toBeNull();
    expect(protectedEmailPermissionError(sender, [supporter({ salesforceTeamStatus: "Volunteer" })]))
      .toEqual("Ramblers has not granted permission to email volunteers");
    expect(protectedEmailPermissionError(sender, [supporter({ salesforceTeamStatus: "Wellbeing Walker" })]))
      .toEqual("Ramblers has not granted permission to email Wellbeing Walkers");
  });

  it("does not apply Ramblers permissions to local-only recipients", () => {
    expect(protectedEmailPermissionError(null, [supporter({ salesforceMemberRef: undefined })])).toBeNull();
  });
});

describe("applyHeadOfficeSendingPermissionBounds", () => {
  it("keeps a local grant while Ramblers Team Emails is off", () => {
    const next = supporter({ canEmailMembers: true, canViewMemberData: true });
    const prior = supporter({ canEmailMembers: false, canViewMemberData: false });
    const result = applyHeadOfficeSendingPermissionBounds(next, prior, false);
    expect(result.canEmailMembers).toEqual(true);
    expect(result.canViewMemberData).toEqual(true);
  });

  it("restores Head Office values when Ramblers Team Emails is on", () => {
    const next = supporter({ canEmailMembers: true, canEmailVolunteers: true, canEmailWellbeingWalkers: true, canViewMemberData: true });
    const prior = supporter({ canEmailMembers: true, canEmailVolunteers: false, canEmailWellbeingWalkers: false, canViewMemberData: false });
    expect(applyHeadOfficeSendingPermissionBounds(next, prior, true)).toEqual(supporter({
      canEmailMembers: true,
      canEmailVolunteers: false,
      canEmailWellbeingWalkers: false,
      canViewMemberData: false
    }));
  });

  it("fails closed on a new member when Ramblers Team Emails is on", () => {
    const next = supporter({ canEmailMembers: true, canViewMemberData: true });
    expect(applyHeadOfficeSendingPermissionBounds(next, undefined, true)).toEqual(supporter({
      canEmailMembers: false,
      canEmailVolunteers: false,
      canEmailWellbeingWalkers: false,
      canViewMemberData: false
    }));
  });
});
