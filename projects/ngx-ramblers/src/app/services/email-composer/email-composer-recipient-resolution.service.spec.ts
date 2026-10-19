import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {EmailComposerRecipientResolutionService} from "./email-composer-recipient-resolution.service";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {EmailComposerRecipientSourcesService} from "./email-composer-recipient-sources.service";
import {MailListUpdaterService} from "../mail/mail-list-updater.service";
import {MemberService} from "../member/member.service";
import {BrandingMode, RecipientMode} from "../../models/email-composer.model";
import {Member} from "../../models/member.model";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {MemberSelection} from "../../models/mail.model";
import {DateRangeUnit, NO_DATE_FILTER} from "../../models/search.model";
import {StringUtilsService} from "../string-utils.service";

describe("composer send copies", () => {
  it("does not treat Bcc committee members as personalised send copies", () => {
    const toMember = {id: "alex", firstName: "Alex", lastName: "Reed", email: "alex.reed@example.com"} as Member;
    const bccMember = {id: "tim", firstName: "Tim", lastName: "Weston", email: "tim.weston@example.com", committee: true} as Member;
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.BRANDED;
    state.recipientMode = RecipientMode.SELECTED_MEMBERS;
    state.selectedMemberIds = [toMember.id];
    state.externalRecipients = [{email: toMember.email, name: "Alex Reed", memberId: toMember.id}];
    state.bccRecipients = [{
      email: "membership@group.example.org.uk",
      name: "Membership Co-ordinator",
      memberId: bccMember.id,
      committeeRoleType: "membership"
    }];
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        EmailComposerRecipientResolutionService,
        {provide: EmailComposerSessionService, useValue: {state}},
        {provide: EmailComposerRecipientSourcesService, useValue: {
          members: [toMember, bccMember],
          allMembers: [toMember, bccMember],
          committeeReferenceData: {committeeMembers: () => [{type: "membership", memberId: bccMember.id, email: "membership@group.example.org.uk"}]}
        }},
        {provide: MailListUpdaterService, useValue: {memberSubscribed: () => false}},
        {provide: MemberService, useValue: {filterFor: {GROUP_MEMBERS: () => true}}}
      ]
    });
    const service = TestBed.inject(EmailComposerRecipientResolutionService);
    const entries = service.uniqueSendEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].member?.id).toBe(toMember.id);
    expect(entries.map(entry => entry.member?.id)).not.toContain(bccMember.id);
  });

  it("reads the notification config window for member-filter labels", () => {
    const state = defaultEmailComposerState();
    state.notificationConfig = {
      ...state.notificationConfig,
      defaultMemberSelection: MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS,
      monthsInPast: 3,
      timeUnit: DateRangeUnit.MONTHS
    };
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        EmailComposerRecipientResolutionService,
        StringUtilsService,
        {provide: EmailComposerSessionService, useValue: {state}},
        {provide: EmailComposerRecipientSourcesService, useValue: {members: [], allMembers: [], committeeReferenceData: null}},
        {provide: MailListUpdaterService, useValue: {memberSubscribed: () => false}},
        {provide: MemberService, useValue: {filterFor: {GROUP_MEMBERS: () => true}}}
      ]
    });
    const service = TestBed.inject(EmailComposerRecipientResolutionService);
    expect(service.memberSelectionChipLabel(MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS)).toBe("Missing from bulk load (3 months or more)");
    state.notificationConfig.monthsInPast = 2;
    state.notificationConfig.timeUnit = DateRangeUnit.WEEKS;
    expect(service.memberSelectionChipLabel(MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS)).toBe("Missing from bulk load (2 weeks or more)");
    state.notificationConfig.timeUnit = NO_DATE_FILTER;
    expect(service.memberSelectionChipLabel(MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS)).toBe("Missing from bulk load");
  });
});
