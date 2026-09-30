import { describe, expect, it } from "vitest";
import { AddresseeType, RecipientAddressMode, RecipientMode } from "../models/email-composer.model";
import { BrandingMode, MemberSelection } from "../models/mail.model";
import {
  appendUniqueRecipients,
  composerCommitteeRecipients,
  composerContentHasPersonalisation,
  composerEveryoneFilterToken,
  composerFilterToken,
  composerRecipientAddressesArePrivate,
  composerSelectedMembersAreCommitteeAudience,
  composerRecipientCount,
  composerRecipientIsExpandableSet,
  composerRecipientFromMember,
  batchSendRecipientSplit,
  composerSendsAsCampaign,
  memberIsCoveredByComposerHeaders,
  recipientsWithoutEmails,
  syncedRecipientAddressMode,
  unbrandedCommitteeSharedTo
} from "./email-composer";
import { Member } from "../models/member.model";

describe("syncedRecipientAddressMode", () => {

  it("uses personal addresses when the send is not a committee-only list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: false,
      preselectCommitteeRole: true,
      current: RecipientAddressMode.COMMITTEE_ROLE
    })).toEqual(RecipientAddressMode.PERSONAL);
  });

  it("preselects committee role addresses whenever everyone on the send holds a committee role", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: true,
      current: RecipientAddressMode.PERSONAL
    })).toEqual(RecipientAddressMode.COMMITTEE_ROLE);
  });

  it("keeps a manual personal choice on a committee list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: false,
      current: RecipientAddressMode.PERSONAL
    })).toEqual(RecipientAddressMode.PERSONAL);
  });

  it("keeps a manual committee role choice on a committee list", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: false,
      current: RecipientAddressMode.COMMITTEE_ROLE
    })).toEqual(RecipientAddressMode.COMMITTEE_ROLE);
  });
});
describe("unbrandedCommitteeSharedTo", () => {

  it("puts every committee recipient on To for an unbranded selected-member send", () => {
    expect(unbrandedCommitteeSharedTo({
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      allMembersHoldCommitteeRoles: true,
      memberCount: 4,
      externalToCount: 0
    })).toEqual(true);
  });

  it("includes extra To addresses on the same unbranded committee send", () => {
    expect(unbrandedCommitteeSharedTo({
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      allMembersHoldCommitteeRoles: true,
      memberCount: 2,
      externalToCount: 1
    })).toEqual(true);
  });

  it("keeps branded committee mail as one copy per person", () => {
    expect(unbrandedCommitteeSharedTo({
      brandingMode: BrandingMode.BRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      allMembersHoldCommitteeRoles: true,
      memberCount: 4,
      externalToCount: 0
    })).toEqual(false);
  });

  it("keeps a mixed member list as one copy per person", () => {
    expect(unbrandedCommitteeSharedTo({
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      allMembersHoldCommitteeRoles: false,
      memberCount: 4,
      externalToCount: 0
    })).toEqual(false);
  });

  it("does not apply to a whole mailing list", () => {
    expect(unbrandedCommitteeSharedTo({
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode: RecipientMode.ENTIRE_LIST,
      allMembersHoldCommitteeRoles: true,
      memberCount: 8,
      externalToCount: 0
    })).toEqual(false);
  });

  it("does not apply to a single committee recipient", () => {
    expect(unbrandedCommitteeSharedTo({
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      allMembersHoldCommitteeRoles: true,
      memberCount: 1,
      externalToCount: 0
    })).toEqual(false);
  });
});

describe("composerContentHasPersonalisation", () => {

  it("treats a first-name greeting as personalised", () => {
    expect(composerContentHasPersonalisation(["Hello everyone"], AddresseeType.FIRST_NAME)).toEqual(true);
  });

  it("treats member merge fields in the body as personalised", () => {
    expect(composerContentHasPersonalisation(["Hi {{params.memberMergeFields.FNAME}}"], AddresseeType.NONE)).toEqual(true);
  });

  it("treats volunteer merge fields as personalised", () => {
    expect(composerContentHasPersonalisation(["Parish: {{params.volunteerMergeFields.PARISH}}"], AddresseeType.HI_ALL)).toEqual(true);
  });

  it("leaves a shared committee message without merge fields unpersonalised", () => {
    expect(composerContentHasPersonalisation(["Committee update for everyone"], AddresseeType.HI_ALL)).toEqual(false);
  });
});

describe("composerSendsAsCampaign", () => {

  it("sends a branded whole mailing list as a campaign when the list is not committee-only", () => {
    expect(composerSendsAsCampaign(RecipientMode.ENTIRE_LIST, BrandingMode.BRANDED, false)).toEqual(true);
  });

  it("does not send a committee-only list as a campaign", () => {
    expect(composerSendsAsCampaign(RecipientMode.ENTIRE_LIST, BrandingMode.BRANDED, true)).toEqual(false);
  });

  it("does not apply campaign sending to selected recipients", () => {
    expect(composerSendsAsCampaign(RecipientMode.SELECTED_MEMBERS, BrandingMode.BRANDED)).toEqual(false);
  });

  it("does not apply campaign sending to unbranded mail", () => {
    expect(composerSendsAsCampaign(RecipientMode.ENTIRE_LIST, BrandingMode.UNBRANDED)).toEqual(false);
  });
});

describe("composerRecipientAddressesArePrivate", () => {

  it("keeps addresses private when more than one recipient is not committee-only", () => {
    expect(composerRecipientAddressesArePrivate(12, false)).toEqual(true);
  });

  it("allows shared To when the audience is committee-only", () => {
    expect(composerRecipientAddressesArePrivate(7, true)).toEqual(false);
  });

  it("does not apply when there is only one recipient", () => {
    expect(composerRecipientAddressesArePrivate(1, false)).toEqual(false);
  });
});

describe("composerSelectedMembersAreCommitteeAudience", () => {

  it("is true when every recipient is a committee member", () => {
    expect(composerSelectedMembersAreCommitteeAudience(
      [{committee: true}, {committee: true}, {committee: true}],
      3
    )).toEqual(true);
  });

  it("is false when any recipient is not a committee member", () => {
    expect(composerSelectedMembersAreCommitteeAudience(
      [{committee: true}, {committee: false}],
      2
    )).toEqual(false);
  });

  it("is false when extra non-member recipients are on the send", () => {
    expect(composerSelectedMembersAreCommitteeAudience(
      [{committee: true}, {committee: true}],
      3
    )).toEqual(false);
  });
});

describe("composerFilterToken", () => {

  it("marks a refine-audience set as one expandable chip", () => {
    const token = composerFilterToken(MemberSelection.RECENTLY_ADDED, "Added in last 1 month", 4);
    expect(token.listCount).toEqual(4);
    expect(composerRecipientIsExpandableSet(token)).toEqual(true);
  });

  it("marks everyone-with-email as one expandable chip", () => {
    const token = composerEveryoneFilterToken("Everyone with an email address", 149);
    expect(token.listCount).toEqual(149);
    expect(composerRecipientIsExpandableSet(token)).toEqual(true);
  });
});

describe("composer recipient lists", () => {

  it("counts the people represented by compact list tokens", () => {
    expect(composerRecipientCount([
      {email: "list-1@list.internal", listId: 1, listCount: 27},
      {email: "person@example.org"}
    ])).toEqual(28);
  });

  it("builds a recipient from a member email", () => {
    const member = {id: "1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.org"} as Member;
    expect(composerRecipientFromMember(member)).toEqual({
      email: "ada@example.org",
      name: "Ada Lovelace",
      saveForReuse: false,
      memberId: "1"
    });
  });

  it("keeps member ids on To chips for the batch send, and leaves unknown addresses as external", () => {
    expect(batchSendRecipientSplit([
      {email: "ada@example.org", name: "Ada Lovelace", memberId: "1", saveForReuse: false},
      {email: "guest@example.org", name: "Guest"}
    ])).toEqual({
      memberIds: ["1"],
      externalRecipients: [{email: "guest@example.org", name: "Guest"}]
    });
  });

  it("skips members without email", () => {
    expect(composerRecipientFromMember({id: "1", firstName: "Ada"} as Member)).toEqual(null);
  });

  it("treats a committee role address on To as covering that member", () => {
    const member = {id: "m1", firstName: "Pat", lastName: "Chair", email: "pat@example.org"} as Member;
    expect(memberIsCoveredByComposerHeaders(
      member,
      [{email: "membership@group.org", memberId: "m1"}],
      [{type: "membership", memberId: "m1", email: "membership@group.org"}] as any
    )).toEqual(true);
  });

  it("does not treat another person's To chip as covering a selected member", () => {
    const member = {id: "m2", firstName: "Sam", lastName: "Walker", email: "sam@example.org"} as Member;
    expect(memberIsCoveredByComposerHeaders(
      member,
      [{email: "membership@group.org", memberId: "m1"}],
      [{type: "membership", memberId: "m1", email: "membership@group.org"}] as any
    )).toEqual(false);
  });

  it("collects unique committee addresses", () => {
    const emails = composerCommitteeRecipients([
      {type: "chair", description: "Chair", fullName: "Pat Chair", email: "chair@group.org", additionalEmails: ["chair@group.org", "pat.chair@group.org"]},
      {type: "secretary", description: "Secretary", fullName: "Sam Sec", email: "secretary@group.org"}
    ] as any).map(recipient => recipient.email);
    expect(emails).toContain("chair@group.org");
    expect(emails).toContain("pat.chair@group.org");
    expect(emails).toContain("secretary@group.org");
    expect(new Set(emails).size).toEqual(emails.length);
  });

  it("appends unique recipients and removes by email", () => {
    const existing = [{email: "a@x.org", name: "A"}];
    const merged = appendUniqueRecipients(existing, [{email: "A@x.org"}, {email: "b@x.org", name: "B"}]);
    expect(merged).toEqual([{email: "a@x.org", name: "A"}, {email: "b@x.org", name: "B"}]);
    expect(recipientsWithoutEmails(merged, new Set(["b@x.org"]))).toEqual([{email: "a@x.org", name: "A"}]);
  });
});
