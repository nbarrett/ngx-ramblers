import {TestBed} from "@angular/core/testing";
import {describe, expect, it, vi} from "vitest";
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
});
