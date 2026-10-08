import {TestBed} from "@angular/core/testing";
import {afterEach, describe, expect, it, vi} from "vitest";
import {composerListToken, composerRecipientFromMember, defaultEmailComposerState} from "../../functions/email-composer";
import {BrandingMode, ComposerExternalRecipient, RecipientField, RecipientMode} from "../../models/email-composer.model";
import {Member} from "../../models/member.model";
import {ListInfo} from "../../models/mail.model";
import {MailListUpdaterService} from "../mail/mail-list-updater.service";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {EmailComposerRecipientSourcesService} from "./email-composer-recipient-sources.service";
import {EmailComposerRecipientResolutionService} from "./email-composer-recipient-resolution.service";
import {EmailComposerRecipientsService} from "./email-composer-recipients.service";

describe("composer list expansion", () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("keeps a mailing-list pill until expanded, then keeps its individual recipients through picker updates", () => {
    const members = [...new Set([..."abcdefghijkl"])].map(id => ({id, firstName: "Alex", lastName: id, email: `${id}@example.com`} as Member));
    const outside = {id: "outside", email: "outside@example.com"} as Member;
    const list = {id: 42, name: "Group members"} as ListInfo;
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.BRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = list.id;
    state.preFilterKey = null;
    state.externalRecipients = [composerListToken(list.id, list.name, members.length)];
    const ids = members.map(member => member.id);
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: {state, inboxReplyContext: null, syncStateToUrl: vi.fn()}},
      {provide: MailListUpdaterService, useValue: {memberSubscribed: (member: Member) => member.id !== outside.id}},
      {provide: EmailComposerRecipientSourcesService, useValue: {
        members: [...members, outside], allMembers: [...members, outside], committeeReferenceData: null,
        nonEmptyLists: () => [list], unbrandedCommitteeLists: () => [], subscribedMemberCount: () => members.length
      }},
      {provide: EmailComposerRecipientResolutionService, useValue: {
        committeeRoleSendOffered: () => false,
        committeeOnlyAudience: () => false,
        sendingAsCampaign: () => state.recipientMode === RecipientMode.ENTIRE_LIST,
        memberRecipientsForIds: (selectedIds: string[]) => members.filter(member => selectedIds.includes(member.id))
          .map(member => composerRecipientFromMember(member)).filter((recipient): recipient is ComposerExternalRecipient => !!recipient)
      }}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);
    service.onFilteredMemberIdsChange(ids);
    expect(state.externalRecipients).toHaveLength(1);
    expect(state.externalRecipients[0].listId).toBe(list.id);
    service.expandListToken(RecipientField.TO, state.externalRecipients[0]);
    service.onFilteredMemberIdsChange(ids);
    expect(state.externalRecipients.map(recipient => recipient.email)).toEqual(members.map(member => member.email));
    expect(state.externalRecipients.every(recipient => !recipient.listId && !recipient.filterKey)).toBe(true);
    expect(state.externalRecipients.some(recipient => recipient.email === outside.email)).toBe(false);
    expect(state.narrowListId).toBe(list.id);
  });

  it("does not replace a whole-list send with every member who has an email", () => {
    const members = [...new Set([..."abcdefghijkl"])].map(id => ({id, firstName: "Alex", lastName: id, email: `${id}@example.com`} as Member));
    const list = {id: 42, name: "Group members"} as ListInfo;
    const listToken = composerListToken(list.id, list.name, members.length);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.BRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = list.id;
    state.preFilterKey = null;
    state.externalRecipients = [listToken];
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: {state, inboxReplyContext: null, syncStateToUrl: vi.fn()}},
      {provide: MailListUpdaterService, useValue: {memberSubscribed: () => true}},
      {provide: EmailComposerRecipientSourcesService, useValue: {
        members,
        allMembers: members,
        committeeReferenceData: null,
        candidateMembers: () => members,
        nonEmptyLists: () => [],
        unbrandedCommitteeLists: () => [],
        subscribedMemberCount: () => members.length
      }},
      {provide: EmailComposerRecipientResolutionService, useValue: {
        committeeRoleSendOffered: () => false,
        committeeOnlyAudience: () => false,
        sendingAsCampaign: () => true,
        memberRecipientsForIds: (selectedIds: string[]) => members.filter(member => selectedIds.includes(member.id))
          .map(member => composerRecipientFromMember(member)).filter((recipient): recipient is ComposerExternalRecipient => !!recipient)
      }}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);
    service.applyPreFilterAudienceToTo();
    expect(state.recipientMode).toBe(RecipientMode.ENTIRE_LIST);
    expect(state.externalRecipients).toEqual([listToken]);
  });

  it("does not recurse when a person is added to a whole-list send", () => {
    const members = [{id: "alex", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com", committee: true} as Member];
    const list = {id: 7, name: "Committee"} as ListInfo;
    const listToken = composerListToken(list.id, list.name, members.length);
    const guest = {email: "guest@example.com", name: "Guest", saveForReuse: false};
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = list.id;
    state.externalRecipients = [listToken];
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: {state, inboxReplyContext: null, syncStateToUrl: vi.fn()}},
      {provide: MailListUpdaterService, useValue: {memberSubscribed: () => true}},
      {provide: EmailComposerRecipientSourcesService, useValue: {
        members,
        allMembers: members,
        committeeReferenceData: {committeeMembers: () => []},
        candidateMembers: () => members,
        nonEmptyLists: () => [list],
        unbrandedCommitteeLists: () => [list],
        subscribedMemberCount: () => members.length
      }},
      {provide: EmailComposerRecipientResolutionService, useValue: {
        committeeRoleSendOffered: () => false,
        committeeOnlyAudience: () => false,
        sendingAsCampaign: () => false,
        headerEmailSet: () => new Set((state.externalRecipients ?? []).map(recipient => recipient.email.toLowerCase())),
        memberRecipientsForIds: () => members.map(member => composerRecipientFromMember(member))
          .filter((recipient): recipient is ComposerExternalRecipient => !!recipient)
      }}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);
    expect(() => service.onUnbrandedToChange([listToken, guest])).not.toThrow();
    expect(state.recipientMode).toBe(RecipientMode.SELECTED_MEMBERS);
    expect(state.selectedListId).toBeNull();
    expect(state.narrowListId).toBe(list.id);
    expect(state.externalRecipients.some(recipient => recipient.email === guest.email)).toBe(true);
    expect(state.externalRecipients.every(recipient => !recipient.listId)).toBe(true);
  });

  it("keeps the mailing list as the member audience when a person is added to a branded list send", () => {
    const members = [{id: "alex", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member];
    const list = {id: 7, name: "Committee"} as ListInfo;
    const listToken = composerListToken(list.id, list.name, members.length);
    const person = composerRecipientFromMember(members[0]) as ComposerExternalRecipient;
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.BRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = list.id;
    state.externalRecipients = [listToken];
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: {state, inboxReplyContext: null, syncStateToUrl: vi.fn()}},
      {provide: MailListUpdaterService, useValue: {memberSubscribed: () => true}},
      {provide: EmailComposerRecipientSourcesService, useValue: {
        members,
        allMembers: members,
        committeeReferenceData: {committeeMembers: () => []},
        candidateMembers: () => members,
        nonEmptyLists: () => [list],
        unbrandedCommitteeLists: () => [],
        subscribedMemberCount: () => members.length
      }},
      {provide: EmailComposerRecipientResolutionService, useValue: {
        committeeRoleSendOffered: () => false,
        committeeOnlyAudience: () => false,
        sendingAsCampaign: () => true,
        headerEmailSet: () => new Set((state.externalRecipients ?? []).map(recipient => recipient.email.toLowerCase())),
        memberRecipientsForIds: () => [person]
      }}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);
    service.onUnbrandedToChange([listToken, person]);
    expect(state.recipientMode).toBe(RecipientMode.SELECTED_MEMBERS);
    expect(state.selectedListId).toBeNull();
    expect(state.narrowListId).toBe(list.id);
    expect(state.externalRecipients.some(recipient => recipient.email === person.email)).toBe(true);
  });
});
