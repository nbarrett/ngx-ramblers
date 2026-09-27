import { describe, expect, it } from "vitest";
import { RecipientAddressMode, RecipientMode } from "../models/email-composer.model";
import { BrandingMode } from "../models/mail.model";
import {
  appendUniqueRecipients,
  composerCommitteeRecipients,
  composerRecipientCount,
  composerRecipientFromMember,
  composerSendsAsCampaign,
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

describe("composerSendsAsCampaign", () => {

  it("always sends a branded whole mailing list as a campaign", () => {
    expect(composerSendsAsCampaign(RecipientMode.ENTIRE_LIST, BrandingMode.BRANDED)).toEqual(true);
  });

  it("does not apply campaign sending to selected recipients", () => {
    expect(composerSendsAsCampaign(RecipientMode.SELECTED_MEMBERS, BrandingMode.BRANDED)).toEqual(false);
  });

  it("does not apply campaign sending to unbranded mail", () => {
    expect(composerSendsAsCampaign(RecipientMode.ENTIRE_LIST, BrandingMode.UNBRANDED)).toEqual(false);
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
      saveForReuse: false
    });
  });

  it("skips members without email", () => {
    expect(composerRecipientFromMember({id: "1", firstName: "Ada"} as Member)).toEqual(null);
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
