import expect from "expect";
import { describe, it } from "mocha";
import { Member } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { protectedEmailPermissionError } from "./salesforce-permissions";

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
