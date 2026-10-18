import {DateTime} from "luxon";
import {TestBed} from "@angular/core/testing";
import {afterEach, describe, expect, it, vi} from "vitest";
import {composerCommitteeRoleSendOffered, composerListToken, composerRecipientFromMember, defaultEmailComposerState} from "../../functions/email-composer";
import {BrandingMode, ComposerExternalRecipient, RecipientAddressMode, RecipientField, RecipientMode, SendingChannel} from "../../models/email-composer.model";
import {StoredValue} from "../../models/ui-actions";
import {CommitteeMember} from "../../models/committee.model";
import {Member} from "../../models/member.model";
import {ListInfo, MemberSelection, NotificationConfig} from "../../models/mail.model";
import {MailListUpdaterService} from "../mail/mail-list-updater.service";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {EmailComposerRecipientSourcesService} from "./email-composer-recipient-sources.service";
import {EmailComposerRecipientResolutionService} from "./email-composer-recipient-resolution.service";
import {EmailComposerRecipientsService} from "./email-composer-recipients.service";

describe("composer list expansion", () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("keeps the chosen committee pill and its recipient count when member-loading cleanup runs", () => {
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    const list = {id: 7, name: "Committee"} as ListInfo;
    const members = ["alex", "sam", "casey"].map(id => ({id, email: `${id}@example.com`, committee: true} as Member));
    const pool = {
      members, allMembers: members,
      nonEmptyLists: () => [list], unbrandedCommitteeLists: () => [list], committeeOnlyLists: () => [list],
      availableLists: () => [list], subscribedMemberCount: () => members.length
    };
    const updater = {memberSubscribed: () => true};
    const session = {state, inboxReplyContext: null, syncStateToUrl: vi.fn()};
    const resolver = Object.create(EmailComposerRecipientResolutionService.prototype) as EmailComposerRecipientResolutionService;
    Object.assign(resolver, {session, pool, mailListUpdaterService: updater});
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: session},
      {provide: MailListUpdaterService, useValue: updater},
      {provide: EmailComposerRecipientSourcesService, useValue: pool},
      {provide: EmailComposerRecipientResolutionService, useValue: resolver}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);

    service.selectUnbrandedCommitteeList(list);
    service.clearUnsupportedUnbrandedBulkRecipients();

    expect(state.externalRecipients).toEqual([composerListToken(list.id, list.name, members.length)]);
    expect(resolver.unbrandedSelectedListId()).toBe(list.id);
    expect(resolver.totalRecipientCount()).toBe(members.length);
    expect(resolver.unbrandedListExpanded()).toBe(false);

    state.ccRecipients = [composerListToken(42, "Group members", 12)];
    state.bccRecipients = [{email: "guest@example.com"}];
    service.clearUnsupportedUnbrandedBulkRecipients();
    expect(state.externalRecipients[0].listId).toBe(list.id);
    expect(state.ccRecipients).toEqual([]);
    expect(state.bccRecipients).toEqual([{email: "guest@example.com"}]);
  });

  it("clears list, filter, header and member selections together for an unbranded audience reset", () => {
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.sendingChannel = SendingChannel.CAMPAIGN;
    state.selectedListId = 42;
    state.narrowListId = 42;
    state.preFilterKey = MemberSelection.EXPIRED_MEMBERS;
    state.selectedMemberIds = ["alex", "sam"];
    state.externalRecipients = [composerListToken(42, "Group members", 12)];
    state.ccRecipients = [{email: "alex.reed@example.com"}];
    state.bccRecipients = [{email: "sam@example.com"}];
    const syncStateToUrl = vi.fn();
    const recomputeCandidateMembers = vi.fn();
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: {state, inboxReplyContext: null, syncStateToUrl}},
      {provide: MailListUpdaterService, useValue: {}},
      {provide: EmailComposerRecipientSourcesService, useValue: {allMembers: [], recomputeCandidateMembers}},
      {provide: EmailComposerRecipientResolutionService, useValue: {
        sendingAsCampaign: () => false, committeeRoleSendOffered: () => false, committeeOnlyAudience: () => false
      }}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);
    service.expandedRecipientListIds.add(42);
    service.expandedRecipientFilterKeys.add(MemberSelection.EXPIRED_MEMBERS);
    service.expandedEveryoneSet = true;

    service.clearRecipientSelection();

    expect(state.recipientMode).toBe(RecipientMode.SELECTED_MEMBERS);
    expect(state.sendingChannel).toBe(SendingChannel.TRANSACTIONAL_BATCH);
    expect(state.selectedListId).toBeNull();
    expect(state.narrowListId).toBeNull();
    expect(state.preFilterKey).toBeNull();
    expect(state.selectedMemberIds).toEqual([]);
    expect(state.externalRecipients).toEqual([]);
    expect(state.ccRecipients).toEqual([]);
    expect(state.bccRecipients).toEqual([]);
    expect(service.expandedRecipientListIds.size).toBe(0);
    expect(service.expandedRecipientFilterKeys.size).toBe(0);
    expect(service.expandedEveryoneSet).toBe(false);
    expect(recomputeCandidateMembers).toHaveBeenCalledOnce();
    expect(syncStateToUrl).toHaveBeenCalledWith({[StoredValue.LIST_ID]: null});
    expect(syncStateToUrl).toHaveBeenCalledWith({[StoredValue.EMAIL_TYPE]: "selected-members", [StoredValue.PRE_FILTER]: null});
  });

  it("does not treat a committee list with a non-committee Cc or Bcc as a committee-only audience", () => {
    const state = defaultEmailComposerState();
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = 7;
    state.externalRecipients = [{email: "chair@group.example.org.uk", memberId: "alex"}];
    state.ccRecipients = [{email: "guest@example.com"}];
    const resolver = Object.create(EmailComposerRecipientResolutionService.prototype) as EmailComposerRecipientResolutionService;
    Object.assign(resolver, {
      session: {state},
      pool: {
        allMembers: [{id: "alex", email: "alex.reed@example.com", committee: true}],
        committeeOnlyLists: () => [{id: 7}]
      },
      expandedHeaderRecipients: recipients => recipients
    });

    expect(resolver.committeeOnlyAudience()).toBe(false);
    state.bccRecipients = state.ccRecipients;
    state.ccRecipients = [];
    expect(resolver.committeeOnlyAudience()).toBe(false);
    state.bccRecipients = [];
    expect(resolver.committeeOnlyAudience()).toBe(true);
  });

  it.each([RecipientField.TO, RecipientField.CC, RecipientField.BCC])("rejects a non-committee list on %s in unbranded mode", field => {
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    const recipientFields = {[RecipientField.TO]: "externalRecipients", [RecipientField.CC]: "ccRecipients", [RecipientField.BCC]: "bccRecipients"};
    state[recipientFields[field]] = [composerListToken(42, "Group members", 3)];
    const resolver = Object.create(EmailComposerRecipientResolutionService.prototype);
    Object.assign(resolver, {session: {state}, pool: {unbrandedCommitteeLists: () => [{id: 7}]}});
    expect(resolver.unbrandedListsAllowed()).toBe(false);
    state[recipientFields[field]] = [composerListToken(7, "Committee", 2)];
    expect(resolver.unbrandedListsAllowed()).toBe(true);
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

  it("loads only members added within the welcome configuration's one-month window on a fresh composition", () => {
    const now = DateTime.fromMillis(1800000000000);
    const members = Array.from({length: 137}, (_, index) => ({
      id: `member-${index}`, email: `member-${index}@example.com`, groupMember: true,
      createdDate: now.minus(index < 2 ? {days: 5} : {months: 3}).toMillis()
    } as Member));
    const state = defaultEmailComposerState();
    const config = {id: "welcome", defaultMemberSelection: MemberSelection.RECENTLY_ADDED, monthsInPast: 1} as NotificationConfig;
    state.notificationConfig = config;
    const session = {state, inboxReplyContext: null, syncStateToUrl: vi.fn()};
    const pool = {
      members, allMembers: members, candidateMembers: () => members,
      nonEmptyLists: () => [], unbrandedCommitteeLists: () => [], committeeReferenceData: null
    };
    const resolver = Object.create(EmailComposerRecipientResolutionService.prototype) as EmailComposerRecipientResolutionService;
    Object.assign(resolver, {session, pool, dateUtils: {dateTimeNowNoTime: () => now}});
    vi.spyOn(resolver, "committeeRoleSendOffered").mockReturnValue(false);
    vi.spyOn(resolver, "committeeOnlyAudience").mockReturnValue(false);
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: session},
      {provide: MailListUpdaterService, useValue: {}},
      {provide: EmailComposerRecipientSourcesService, useValue: pool},
      {provide: EmailComposerRecipientResolutionService, useValue: resolver}
    ]});
    TestBed.inject(EmailComposerRecipientsService).applyRecipientDefaultsFrom(config);
    expect(state.recipientMode).toBe(RecipientMode.SELECTED_MEMBERS);
    expect(state.preFilterKey).toBe(MemberSelection.RECENTLY_ADDED);
    expect(state.selectedListId).toBeNull();
    expect(state.selectedMemberIds).toEqual(["member-0", "member-1"]);
    expect(state.externalRecipients.map(recipient => recipient.email)).toEqual(["member-0@example.com", "member-1@example.com"]);
  });

  it("keeps an existing mailing list when an email type is applied", () => {
    const members = [{id: "alex", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member];
    const list = {id: 13, name: "Platform service alerts"} as ListInfo;
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.BRANDED;
    state.recipientMode = RecipientMode.ENTIRE_LIST;
    state.selectedListId = list.id;
    state.selectedMemberIds = [];
    state.externalRecipients = [];
    const config = {
      id: "newsletter",
      defaultMemberSelection: MemberSelection.MAILING_LIST,
      defaultListId: 1
    } as NotificationConfig;
    TestBed.configureTestingModule({providers: [
      EmailComposerRecipientsService,
      {provide: EmailComposerSessionService, useValue: {state, inboxReplyContext: null, syncStateToUrl: vi.fn()}},
      {provide: MailListUpdaterService, useValue: {memberSubscribed: () => true}},
      {provide: EmailComposerRecipientSourcesService, useValue: {
        members,
        allMembers: members,
        committeeReferenceData: null,
        candidateMembers: () => members,
        nonEmptyLists: () => [list, {id: 1, name: "All Members"} as ListInfo],
        unbrandedCommitteeLists: () => [],
        subscribedMemberCount: () => members.length
      }},
      {provide: EmailComposerRecipientResolutionService, useValue: {
        committeeRoleSendOffered: () => false,
        committeeOnlyAudience: () => false,
        sendingAsCampaign: () => true,
        headerEmailSet: () => new Set(),
        memberRecipientsForIds: () => []
      }}
    ]});
    const service = TestBed.inject(EmailComposerRecipientsService);
    service.applyRecipientDefaultsFrom(config);
    expect(state.selectedListId).toBe(13);
    expect(state.recipientMode).toBe(RecipientMode.ENTIRE_LIST);
  });
});

describe("mixed unbranded committee recipients", () => {
  const member = {id: "alex", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member;
  const roles = [{type: "chair", memberId: member.id, email: "chair@group.example.org.uk"}] as CommitteeMember[];

  function service() {
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.externalRecipients = [{email: "guest@example.com"}];
    const instance = Object.create(EmailComposerRecipientsService.prototype) as EmailComposerRecipientsService;
    Object.assign(instance, {
      recipientAddressModeTouched: false,
      session: {state, inboxReplyContext: null},
      pool: {allMembers: [member], committeeReferenceData: {committeeMembers: () => roles}},
      resolver: {
        committeeRoleSendOffered: () => composerCommitteeRoleSendOffered({
          recipients: [...state.externalRecipients, ...state.ccRecipients, ...state.bccRecipients],
          members: [member], roles, committeeOnlyAudience: false, recipientCount: 2, brandingMode: state.brandingMode
        }),
        committeeOnlyAudience: () => false,
        headerEmailSet: () => new Set()
      }
    });
    return {instance, state};
  }

  it.each([RecipientField.CC, RecipientField.BCC])("defaults to the role mailbox when the first committee member is added on %s", field => {
    const {instance, state} = service();
    const recipients = [composerRecipientFromMember(member) as ComposerExternalRecipient];
    if (field === RecipientField.CC) {
      instance.onUnbrandedCcChange(recipients);
    } else {
      instance.onUnbrandedBccChange(recipients);
    }
    expect(state.recipientAddressMode).toBe(RecipientAddressMode.COMMITTEE_ROLE);
    expect((field === RecipientField.CC ? state.ccRecipients : state.bccRecipients)[0].email).toBe(roles[0].email);
    expect(state.externalRecipients[0].email).toBe("guest@example.com");
  });

  it("preserves an explicit choice to use personal addresses", () => {
    const {instance, state} = service();
    instance.recipientAddressModeTouched = true;
    state.recipientAddressMode = RecipientAddressMode.PERSONAL;
    instance.onUnbrandedCcChange([composerRecipientFromMember(member) as ComposerExternalRecipient]);
    expect(state.recipientAddressMode).toBe(RecipientAddressMode.PERSONAL);
    expect(state.ccRecipients[0].email).toBe(member.email);
  });

  it.each([RecipientField.CC, RecipientField.BCC])("offers and defaults role addresses for a committee list on %s beside a guest on To", field => {
    const {instance, state} = service();
    instance.pool.members = [member];
    const resolver = Object.create(EmailComposerRecipientResolutionService.prototype) as EmailComposerRecipientResolutionService;
    Object.assign(resolver, {
      session: {state},
      pool: instance.pool,
      mailListUpdaterService: {memberSubscribed: () => true},
      committeeOnlyAudience: () => false,
      totalRecipientCount: () => 2
    });
    instance["resolver"] = resolver;
    const recipients = [composerListToken(7, "Committee", 1)];
    if (field === RecipientField.CC) {
      instance.onUnbrandedCcChange(recipients);
    } else {
      instance.onUnbrandedBccChange(recipients);
    }
    expect(resolver.committeeRoleSendOffered()).toBe(true);
    expect(state.recipientAddressMode).toBe(RecipientAddressMode.COMMITTEE_ROLE);
    expect(resolver.expandedHeaderRecipients(recipients)[0].email).toBe(roles[0].email);
    expect(state.externalRecipients[0].email).toBe("guest@example.com");
    instance.onSendToCommitteeRoleAddressesChange({target: {checked: false}} as unknown as Event);
    expect(resolver.expandedHeaderRecipients(recipients)[0].email).toBe(member.email);
  });
});
