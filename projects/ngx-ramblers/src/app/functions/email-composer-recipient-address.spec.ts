import { describe, expect, it } from "vitest";
import { AddresseeType, RecipientAddressMode, RecipientMode } from "../models/email-composer.model";
import { BrandingMode, MemberSelection } from "../models/mail.model";
import {
  appendUniqueRecipients,
  composerCommitteeRecipients,
  composerApiErrorMessage,
  composerContentHasPersonalisation,
  batchSendJobWasLost,
  composerEveryoneFilterToken,
  composerFilterToken,
  composerRecipientAddressesArePrivate,
  composerSelectedMembersAreCommitteeAudience,
  composerRecipientCount,
  composerRecipientIsExpandableSet,
  composerRecipientFromMember,
  composerRecipientsForAddressMode,
  batchSendRecipientSplit,
  composerSendsAsCampaign,
  composerSendProgressDescription,
  composerCcFieldAvailable,
  composerRecipientLacksMarketingConsent,
  composerMemberIdentityRecipients,
  composerRecipientFromSuggestion,
  composerRecipientIsSamePerson,
  composerRecipientMatchesQuery,
  composerSuggestionShowsEmail,
  defaultAddresseeTypeForBranding,
  memberIsCoveredByComposerHeaders,
  recipientsWithoutEmails,
  syncedRecipientAddressMode,
  unbrandedCommitteeSharedTo
} from "./email-composer";
import { RoleType } from "../models/committee.model";
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

  it("leaves personal addresses selected until the user asks for role addresses", () => {
    expect(syncedRecipientAddressMode({
      committeeRoleSendOffered: true,
      preselectCommitteeRole: false,
      current: RecipientAddressMode.PERSONAL
    })).toEqual(RecipientAddressMode.PERSONAL);
  });
});

describe("composer member identity recipients", () => {

  it("lists a committee member once, matching both personal and role mailboxes", () => {
    const member = {id: "alex", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member;
    const identities = composerMemberIdentityRecipients({
      members: [member],
      committeeAddresses: [{
        email: "treasurer@group.example.org.uk",
        name: "Treasurer",
        memberId: "alex",
        committeeRoleType: "treasurer",
        saveForReuse: false
      }]
    });
    expect(identities).toHaveLength(1);
    expect(identities[0].email).toEqual("alex.reed@example.com");
    expect(identities[0].memberId).toEqual("alex");
    expect(identities[0].committeeRoleLabel).toEqual("Treasurer");
    expect(identities[0].committeeRoleType).toBeUndefined();
    expect(composerSuggestionShowsEmail(identities[0])).toEqual(false);
    expect(composerRecipientMatchesQuery(identities[0], "treasurer")).toEqual(true);
    expect(composerRecipientMatchesQuery(identities[0], "treasurer@group.example.org.uk")).toEqual(true);
    expect(composerRecipientMatchesQuery(identities[0], "alex.reed@example.com")).toEqual(true);
  });

  it("still lists a vacant role without showing its mailbox as a second person", () => {
    const identities = composerMemberIdentityRecipients({
      members: [{id: "other", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member],
      committeeAddresses: [{
        email: "chair@group.example.org.uk",
        name: "Chair",
        committeeRoleType: "chair",
        saveForReuse: false
      }]
    });
    expect(identities.map(item => item.email)).toEqual(["alex.reed@example.com", "chair@group.example.org.uk"]);
    expect(identities[1].name).toEqual("Chair");
    expect(identities[1].committeeRoleType).toEqual("chair");
    expect(identities[1].committeeRoleLabel).toBeUndefined();
    expect(composerSuggestionShowsEmail(identities[1])).toEqual(false);
  });

  it("treats two chips for the same member as the same person", () => {
    expect(composerRecipientIsSamePerson(
      {email: "alex.reed@example.com", memberId: "alex"},
      {email: "treasurer@group.example.org.uk", memberId: "alex"}
    )).toEqual(true);
  });
});

describe("composer suggestion email visibility", () => {

  it("hides addresses for members, vacant roles and lists", () => {
    expect(composerSuggestionShowsEmail({email: "alex.reed@example.com", name: "Alex Reed", memberId: "alex", saveForReuse: false})).toEqual(false);
    expect(composerSuggestionShowsEmail({email: "chair@group.example.org.uk", name: "Chair", committeeRoleType: "chair", saveForReuse: false})).toEqual(false);
    expect(composerSuggestionShowsEmail({email: "list@group.example.org.uk", name: "Walk leaders", listId: 12, saveForReuse: false})).toEqual(false);
  });

  it("shows the address for a saved external contact", () => {
    expect(composerSuggestionShowsEmail({
      email: "sam.patel@example.com",
      name: "Sam Patel",
      saveForReuse: true
    })).toEqual(true);
  });

  it("keeps a member role label on the chosen chip without forcing the role mailbox", () => {
    expect(composerRecipientFromSuggestion({
      email: "alex.reed@example.com",
      name: "Alex Reed",
      memberId: "alex",
      committeeRoleLabel: "Treasurer",
      saveForReuse: false,
      searchText: "alex reed treasurer"
    })).toEqual({
      email: "alex.reed@example.com",
      name: "Alex Reed",
      existingId: undefined,
      saveForReuse: false,
      memberId: "alex",
      listId: undefined,
      listCount: undefined,
      filterKey: undefined,
      committeeRoleType: undefined,
      committeeRoleLabel: "Treasurer"
    });
  });

  it("keeps a vacant role mailbox as a role chip", () => {
    expect(composerRecipientFromSuggestion({
      email: "chair@group.example.org.uk",
      name: "Chair",
      committeeRoleType: "chair",
      saveForReuse: false
    }).committeeRoleType).toEqual("chair");
  });
});

describe("composer cc field", () => {

  it("is available for inbox replies and committee-only mail", () => {
    expect(composerCcFieldAvailable({inboxReply: true, committeeOnlyAudience: false})).toEqual(true);
    expect(composerCcFieldAvailable({inboxReply: false, committeeOnlyAudience: true})).toEqual(true);
  });

  it("is hidden for mixed member sends", () => {
    expect(composerCcFieldAvailable({inboxReply: false, committeeOnlyAudience: false})).toEqual(false);
  });
});

describe("composerRecipientLacksMarketingConsent", () => {

  it("is false when the site does not respect consent", () => {
    expect(composerRecipientLacksMarketingConsent({
      requireConsent: false,
      recipient: {email: "alex@example.com", memberId: "alex"},
      member: {id: "alex", email: "alex@example.com", emailMarketingConsent: false} as Member
    })).toEqual(false);
  });

  it("is true for a member who has withheld Head office marketing consent", () => {
    expect(composerRecipientLacksMarketingConsent({
      requireConsent: true,
      recipient: {email: "alex@example.com", memberId: "alex"},
      member: {id: "alex", email: "alex@example.com", emailMarketingConsent: false} as Member
    })).toEqual(true);
  });

  it("does not apply to mailing-list chips", () => {
    expect(composerRecipientLacksMarketingConsent({
      requireConsent: true,
      recipient: {email: "list@group.example.org.uk", listId: 12, listCount: 20},
      member: {id: "alex", emailMarketingConsent: false} as Member
    })).toEqual(false);
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

describe("defaultAddresseeTypeForBranding", () => {

  it("defaults unbranded mail to no greeting", () => {
    expect(defaultAddresseeTypeForBranding(BrandingMode.UNBRANDED)).toEqual(AddresseeType.NONE);
  });

  it("defaults branded mail to a first-name greeting", () => {
    expect(defaultAddresseeTypeForBranding(BrandingMode.BRANDED)).toEqual(AddresseeType.FIRST_NAME);
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

describe("composerApiErrorMessage", () => {

  it("reads Job not found from the batch-status 404 body", () => {
    expect(composerApiErrorMessage({
      status: 404,
      message: "Http failure response for https://group.example.org.uk/api/mail/transactional/batch/job-id: 404 OK",
      error: {request: {messageType: "brevo:batch-transactional-send"}, error: {message: "Job not found"}}
    })).toEqual("Job not found");
  });
});

describe("batchSendJobWasLost", () => {

  it("treats a 404 poll as a lost send job", () => {
    expect(batchSendJobWasLost({status: 404, error: {error: {message: "Job not found"}}})).toEqual(true);
  });

  it("does not treat a 500 send error as a lost job", () => {
    expect(batchSendJobWasLost({status: 500, error: {error: {message: "Brevo refused the send"}}})).toEqual(false);
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

describe("composerSendProgressDescription", () => {

  it("names the current recipient on a personalised batch", () => {
    expect(composerSendProgressDescription({
      sendingAsCampaign: false,
      oneCombinedEmail: false,
      hasBatchProgress: true,
      totalRecipients: 243,
      processedCount: 101,
      currentRecipientLabel: "Alex Reed"
    })).toEqual("Sending 102 of 243 - Alex Reed");
  });

  it("keeps a personalised send per-recipient when Cc or Bcc chips are present", () => {
    expect(composerSendProgressDescription({
      sendingAsCampaign: false,
      oneCombinedEmail: false,
      hasBatchProgress: true,
      totalRecipients: 243,
      processedCount: 0,
      currentRecipientLabel: "Alex Reed"
    })).toEqual("Sending 1 of 243 - Alex Reed");
  });

  it("describes a shared committee To as one email", () => {
    expect(composerSendProgressDescription({
      sendingAsCampaign: false,
      oneCombinedEmail: true,
      hasBatchProgress: true,
      totalRecipients: 7,
      processedCount: 0,
      currentRecipientLabel: "Alex Reed"
    })).toEqual("Sending one email to 7 recipients");
  });

  it("prepares personalised emails before the first poll", () => {
    expect(composerSendProgressDescription({
      sendingAsCampaign: false,
      oneCombinedEmail: false,
      hasBatchProgress: false,
      totalRecipients: 0,
      processedCount: 0,
      currentRecipientLabel: null
    })).toEqual("Preparing personalised emails…");
  });

  it("prepares one combined email before the first poll", () => {
    expect(composerSendProgressDescription({
      sendingAsCampaign: false,
      oneCombinedEmail: true,
      hasBatchProgress: false,
      totalRecipients: 0,
      processedCount: 0,
      currentRecipientLabel: null
    })).toEqual("Preparing one email…");
  });

  it("prepares a campaign before the first poll", () => {
    expect(composerSendProgressDescription({
      sendingAsCampaign: true,
      oneCombinedEmail: false,
      hasBatchProgress: false,
      totalRecipients: 0,
      processedCount: 0,
      currentRecipientLabel: null
    })).toEqual("Preparing campaign for Brevo…");
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

  it("sends a committee role chip to the role mailbox, not the member contact", () => {
    expect(batchSendRecipientSplit([
      {email: "chair@group.org", name: "Chair", memberId: "1", committeeRoleType: "chair"},
      {email: "alex@home.example", name: "Alex Reed", memberId: "1"}
    ])).toEqual({
      memberIds: ["1"],
      externalRecipients: [{email: "chair@group.org", name: "Chair", memberId: "1", committeeRoleType: "chair"}]
    });
  });

  it("skips members without email", () => {
    expect(composerRecipientFromMember({id: "1", firstName: "Ada"} as Member)).toEqual(null);
  });

  it("rewrites a member chip to the committee role mailbox when sending to role addresses", () => {
    const member = {id: "m1", firstName: "Alex", lastName: "Reed", email: "alex@home.example"} as Member;
    const roles = [{type: "chair", description: "Chair", fullName: "Alex Reed", email: "chair@group.org", memberId: "m1", roleType: RoleType.COMMITTEE_MEMBER}];
    expect(composerRecipientsForAddressMode(
      [{email: "alex@home.example", name: "Alex Reed", memberId: "m1", saveForReuse: false}],
      [member],
      roles,
      RecipientAddressMode.COMMITTEE_ROLE
    )).toEqual([{email: "chair@group.org", name: "Alex Reed", memberId: "m1", saveForReuse: false}]);
  });

  it("restores the member contact email when sending to personal addresses", () => {
    const member = {id: "m1", firstName: "Alex", lastName: "Reed", email: "alex@home.example"} as Member;
    const roles = [{type: "chair", description: "Chair", fullName: "Alex Reed", email: "chair@group.org", memberId: "m1", roleType: RoleType.COMMITTEE_MEMBER}];
    expect(composerRecipientsForAddressMode(
      [{email: "chair@group.org", name: "Alex Reed", memberId: "m1", saveForReuse: false}],
      [member],
      roles,
      RecipientAddressMode.PERSONAL
    )).toEqual([{email: "alex@home.example", name: "Alex Reed", memberId: "m1", saveForReuse: false}]);
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

  it("marks committee typeahead chips with the role type so send keeps the role mailbox", () => {
    const recipients = composerCommitteeRecipients([
      {type: "chair", description: "Chair", fullName: "Alex Reed", email: "chair@group.org", memberId: "1"}
    ] as any);
    expect(recipients[0].committeeRoleType).toEqual("chair");
    expect(recipients[0].memberId).toEqual("1");
  });

  it("treats committee role chips plus committee people as a committee audience", () => {
    expect(composerSelectedMembersAreCommitteeAudience(
      [{committee: true}],
      3,
      2
    )).toEqual(true);
  });

  it("does not treat mixed committee and non-committee people as a committee audience", () => {
    expect(composerSelectedMembersAreCommitteeAudience(
      [{committee: true}, {committee: false}],
      2,
      0
    )).toEqual(false);
  });

  it("appends unique recipients and removes by email", () => {
    const existing = [{email: "a@x.org", name: "A"}];
    const merged = appendUniqueRecipients(existing, [{email: "A@x.org"}, {email: "b@x.org", name: "B"}]);
    expect(merged).toEqual([{email: "a@x.org", name: "A"}, {email: "b@x.org", name: "B"}]);
    expect(recipientsWithoutEmails(merged, new Set(["b@x.org"]))).toEqual([{email: "a@x.org", name: "A"}]);
  });
});
