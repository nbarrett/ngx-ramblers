import {TestBed} from "@angular/core/testing";
import {LoggerTestingModule} from "ngx-logger/testing";
import {EmailComposerMemberFilterComponent} from "./email-composer-member-filter";
import {EmailComposerRecipientResolutionService} from "../../services/email-composer/email-composer-recipient-resolution.service";
import {MemberEmailSendService} from "../../services/member-email-send/member-email-send.service";
import {MemberSelection} from "../../models/mail.model";

describe("composer member filters without the legacy picker", () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [EmailComposerMemberFilterComponent, LoggerTestingModule],
      providers: [
        {provide: EmailComposerRecipientResolutionService, useValue: {
          memberMatchesPreFilter: (member: {id: string}) => member.id !== "outside-filter",
          memberSelectionChipLabel: () => "Recently added members"
        }},
        {provide: MemberEmailSendService, useValue: {list: async () => [{memberId: "already-sent", sentAt: 100}]}}
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(EmailComposerMemberFilterComponent);
    fixture.componentRef.setInput("members", [
      {id: "available", email: "alex.reed@example.com"},
      {id: "already-sent", email: "sam.taylor@example.com"},
      {id: "outside-filter", email: "casey.reed@example.com"},
      {id: "no-consent", email: "morgan.reed@example.com", emailMarketingConsent: false},
      {id: "unsubscribed", email: "robin.reed@example.com"},
      {id: "missing-email"}
    ]);
    fixture.componentRef.setInput("notificationConfig", {id: "notification", defaultMemberSelection: MemberSelection.RECENTLY_ADDED});
    fixture.componentRef.setInput("requireConsent", true);
    fixture.componentRef.setInput("respectBlocks", true);
    fixture.componentRef.setInput("unsubscribedDates", {unsubscribed: 50});
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it("renders only the retained filter controls and does not select members on opening", async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.querySelectorAll("input[type=radio]").length).toBe(1);
    expect(fixture.nativeElement.querySelector("ng-select")).toBeNull();
    expect(fixture.componentInstance.selectedIds).toEqual([]);
  });

  it("preserves eligibility and prior-send exclusions when applying a filter", async () => {
    const fixture = await setup();
    const exclusions = vi.fn();
    fixture.componentInstance.priorSendExclusionsChange.subscribe(exclusions);
    fixture.componentInstance.applyPreFilter(MemberSelection.RECENTLY_ADDED);
    expect(fixture.componentInstance.selectedIds).toEqual(["available"]);
    expect(exclusions).toHaveBeenCalledWith([expect.objectContaining({member: expect.objectContaining({id: "already-sent"}), sentAt: 100})]);
    fixture.componentRef.setInput("includeAlreadySent", true);
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedIds).toEqual(["available", "already-sent"]);
  });
});
