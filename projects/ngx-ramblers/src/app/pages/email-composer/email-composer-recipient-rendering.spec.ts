import {TestBed} from "@angular/core/testing";
import {By} from "@angular/platform-browser";
import {DateTime} from "luxon";
import {describe, expect, it, vi} from "vitest";
import {EmailComposerRecipientsComponent} from "./email-composer-recipients.component";
import {RecipientFieldComponent} from "../../modules/common/recipient-field/recipient-field";
import {EmailComposerSessionService} from "../../services/email-composer/email-composer-session.service";
import {EmailComposerRecipientSourcesService} from "../../services/email-composer/email-composer-recipient-sources.service";
import {EmailComposerRecipientResolutionService} from "../../services/email-composer/email-composer-recipient-resolution.service";
import {EmailComposerRecipientsService} from "../../services/email-composer/email-composer-recipients.service";
import {DateUtilsService} from "../../services/date-utils.service";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {BrandingMode} from "../../models/mail.model";
import {Member} from "../../models/member.model";
import {RecipientField, RecipientMode} from "../../models/email-composer.model";

describe("recipient picker rendering investigation", () => {
  function composer() {
    const members = Array.from({length: 1000}, (_, index) => ({
      id: `member-${index}`,
      firstName: "Alex",
      lastName: `Reed ${index}`,
      email: `alex.reed.${index}@example.com`,
      groupMember: true,
      emailMarketingConsent: true
    } as Member));
    const session = {
      state: {...defaultEmailComposerState(), brandingMode: BrandingMode.UNBRANDED, recipientMode: RecipientMode.SELECTED_MEMBERS},
      inboxReplyContext: null,
      syncStateToUrl: vi.fn()
    };
    const noLists: never[] = [];
    const noAddresses: never[] = [];
    const pool = {
      members,
      allMembers: members,
      unbrandedCommitteeLists: () => noLists,
      requiresConsent: () => false,
      memberBulkLoadDateMap: null
    };
    const resolver = {
      unbrandedSelectedListId: () => null,
      committeeRecipientAddresses: () => noAddresses,
      committeeRoleSendOffered: () => false,
      committeeOnlyAudience: () => false,
      sendingAsCampaign: () => false,
      headerEmailSet: () => new Set([
        ...session.state.externalRecipients,
        ...session.state.ccRecipients,
        ...session.state.bccRecipients
      ].map(recipient => recipient.email.toLowerCase()))
    };
    const recipients = Object.assign(Object.create(EmailComposerRecipientsService.prototype), {
      pool,
      resolver,
      session,
      savedExternalRecipients: [],
      forcedMemberId: null,
      newExternalSaveForReuse: false
    });
    TestBed.configureTestingModule({
      imports: [EmailComposerRecipientsComponent],
      providers: [
        {provide: EmailComposerSessionService, useValue: session},
        {provide: EmailComposerRecipientSourcesService, useValue: pool},
        {provide: EmailComposerRecipientResolutionService, useValue: resolver},
        {provide: EmailComposerRecipientsService, useValue: recipients},
        {provide: DateUtilsService, useValue: {dateTimeNowNoTime: () => DateTime.fromMillis(0), displayDate: () => "Example date"}}
      ]
    });
    const fixture = TestBed.createComponent(EmailComposerRecipientsComponent);
    fixture.detectChanges();
    const picker = fixture.debugElement.query(By.directive(RecipientFieldComponent)).componentInstance as RecipientFieldComponent;
    return {fixture, picker, session};
  }

  it("reuses the member index when the recipient screen renders unchanged data", () => {
    const {fixture, picker} = composer();
    const rebuildMemberIndex = vi.spyOn(picker as any, "rebuildMemberIndex");
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(rebuildMemberIndex).not.toHaveBeenCalled();
  });

  it.each([RecipientField.TO, RecipientField.CC, RecipientField.BCC])("does not rebuild the member index for each character typed in %s", field => {
    const {fixture, picker} = composer();
    const input = fixture.nativeElement.querySelector(`[data-recipient-field="${field}"] input.recipient-input`) as HTMLInputElement;
    input.focus();
    fixture.detectChanges();
    const rebuildMemberIndex = vi.spyOn(picker as any, "rebuildMemberIndex");
    for (const query of ["A", "Al", "Ale"]) {
      input.value = query;
      input.dispatchEvent(new Event("input", {bubbles: true}));
      fixture.detectChanges();
    }
    expect(fixture.nativeElement.querySelectorAll(".recipient-suggestion").length).toBeGreaterThan(0);
    expect(rebuildMemberIndex).not.toHaveBeenCalled();
  });

  it("adds a suggested person without rebuilding the unchanged member directory", () => {
    const {fixture, picker, session} = composer();
    const input = fixture.nativeElement.querySelector("input.recipient-input") as HTMLInputElement;
    input.focus();
    fixture.detectChanges();
    const rebuildMemberIndex = vi.spyOn(picker as any, "rebuildMemberIndex");
    fixture.nativeElement.querySelector(".recipient-suggestion").click();
    fixture.detectChanges();
    expect(session.state.externalRecipients).toHaveLength(1);
    expect(rebuildMemberIndex).not.toHaveBeenCalled();
  });
});
