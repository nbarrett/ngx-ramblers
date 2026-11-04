import {StoredValue} from "../../../../models/ui-actions";
import {ProgrammeOverviewStatus} from "../../../../models/walk-programme.model";
import {Component, Input} from "@angular/core";
import {By} from "@angular/platform-browser";
import {NgSelectComponent} from "@ng-select/ng-select";
import {TestBed} from "@angular/core/testing";
import {Router, Params, provideRouter} from "@angular/router";
import {DateTime} from "luxon";
import {LoggerTestingModule} from "ngx-logger/testing";
import {describe, expect, it, vi} from "vitest";
import {EventTemplatePreviewComponent} from "./event-template-preview";
import {CommitteeQueryService} from "../../../../services/committee/committee-query.service";
import {DateUtilsService} from "../../../../services/date-utils.service";
import {UrlService} from "../../../../services/url.service";
import {EventTemplateRenderingService} from "../../../../services/mail/event-template-rendering.service";
import {EmailPreviewComponent} from "../../../../modules/common/email-preview/email-preview.component";
import {CommitteeDocumentEditor} from "../../../committee/document/committee-document-editor";
import {CommitteeFile, GroupEventSummary, GroupEventTypes} from "../../../../models/committee.model";

@Component({selector: "app-email-preview", template: `<div>{{content}}</div>`})
class EmailPreviewStub {
  content = "";
  @Input() set html(value: string) { this.content = value; }
}

@Component({selector: "app-committee-document-editor", template: `<div>{{committeeFile?.document?.markdown}}</div>`})
class DocumentPreviewStub {
  @Input() committeeFile: CommitteeFile;
  @Input() editable = true;
}

describe("real event template preview", () => {
  const today = DateTime.fromISO("2026-11-01", {zone: "Europe/London"});
  const events = [
    {id: "walk-1", title: "Hillside Park", eventDate: today.plus({days: 2}).toMillis(), eventType: GroupEventTypes.WALK, image: "site-content/walk.jpg", selected: true},
    {id: "social-1", title: "Autumn lunch", eventDate: today.plus({days: 3}).toMillis(), eventType: GroupEventTypes.SOCIAL, selected: true}
  ] as GroupEventSummary[];

  async function setup(failure = false, queryParams: Params = null, sourceEvents = events) {
    const query = {groupEvents: failure ? vi.fn().mockRejectedValue(new Error("Unavailable")) : vi.fn().mockResolvedValue(sourceEvents)};
    TestBed.configureTestingModule({imports: [EventTemplatePreviewComponent, LoggerTestingModule], providers: [provideRouter([]),
      {provide: CommitteeQueryService, useValue: query},
      {provide: DateUtilsService, useValue: {dateTimeNowNoTime: () => today, asDateValue: value => ({value}), displayDate: () => "Sunday"}},
      {provide: UrlService, useValue: {absoluteUrlFor: path => /^https?:/.test(path) ? path : `https://group.example.org.uk${path}`}},
      {provide: EventTemplateRenderingService, useValue: {
        markdown: (sourceEvents, settings) => [...sourceEvents].sort((left, right) => left.eventDate - right.eventDate)
          .map(event => (settings.customTemplate || "").split("{{title}}").join(event.title).split("{{image}}").join(event.image || "")).join("\n"),
        embeddedEmailHtml: value => value
      }}
    ]});
    TestBed.overrideComponent(EventTemplatePreviewComponent, {
      remove: {imports: [EmailPreviewComponent, CommitteeDocumentEditor]}, add: {imports: [EmailPreviewStub, DocumentPreviewStub]}
    });
    if (queryParams) {
      await TestBed.inject(Router).navigate([], {queryParams});
    }
    const fixture = TestBed.createComponent(EventTemplatePreviewComponent);
    fixture.componentRef.setInput("template", "## {{title}}\n\n{{image}}");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {fixture, query, host: fixture.nativeElement as HTMLElement};
  }

  it("loads site events and immediately renders the selected events and images", async () => {
    const {fixture, host, query} = await setup();
    expect(query.groupEvents).toHaveBeenCalledWith(expect.objectContaining({includeWalks: true, includeSocialEvents: true, includeCommitteeEvents: true}));
    const typePicker = fixture.debugElement.queryAll(By.directive(NgSelectComponent))[0].componentInstance as NgSelectComponent;
    expect(typePicker.selectedItems.map(item => item.label)).toEqual(["Walk", "Social Event"]);
    expect(host.textContent).toContain("Hillside Park");
    expect(host.textContent).toContain("Autumn lunch");
    expect(host.textContent).toContain("walk.jpg");
    expect(events[0].image).toBe("site-content/walk.jpg");
  });

  it("automatically selects upcoming events with usable details in chronological order", async () => {
    const fixtures = [
      {...events[0], id: "past", title: "Past walk", eventDate: today.minus({days: 1}).toMillis()},
      {...events[0], id: "placeholder", title: "Awaiting details", eventDate: today.plus({days: 1}).toMillis(), programmeStatus: ProgrammeOverviewStatus.AWAITING_WALK_DETAILS},
      {...events[0], id: "later", title: "Later walk", eventDate: today.plus({days: 7}).toMillis()},
      {...events[0], id: "earlier", title: "Earlier walk", eventDate: today.plus({days: 3}).toMillis()}
    ];
    const {host} = await setup(false, null, fixtures);
    const preview = host.querySelector("app-email-preview").textContent;
    expect(preview).toContain("Earlier walk");
    expect(preview).toContain("Later walk");
    expect(preview).not.toContain("Past walk");
    expect(preview).not.toContain("Awaiting details");
    expect(preview.indexOf("Earlier walk")).toBeLessThan(preview.indexOf("Later walk"));
  });

  it("recovers an empty saved selection with upcoming events on page load", async () => {
    const {host} = await setup(false, {[StoredValue.EVENT_IDS]: ""});
    expect(host.querySelector("app-email-preview").textContent).toContain("Hillside Park");
    expect(host.querySelector("app-email-preview").textContent).toContain("Autumn lunch");
  });

  it("shows the saved event type when the URL names one", async () => {
    const {fixture} = await setup(false, {[StoredValue.EVENT_TYPE]: GroupEventTypes.WALK.eventType});
    const typePicker = fixture.debugElement.queryAll(By.directive(NgSelectComponent))[0].componentInstance as NgSelectComponent;
    expect(typePicker.selectedItems[0].label).toContain(GroupEventTypes.WALK.description);
  });

  it("updates the preview on template edits and filters using the existing event types", async () => {
    const {fixture, host} = await setup();
    fixture.componentRef.setInput("template", "### Revised layout: {{title}}");
    fixture.detectChanges();
    expect(host.textContent).toContain("Revised layout: Hillside Park");
    const typePicker = fixture.debugElement.queryAll(By.directive(NgSelectComponent))[0];
    typePicker.triggerEventHandler("ngModelChange", [GroupEventTypes.SOCIAL.eventType]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector("app-email-preview").textContent).toContain("Autumn lunch");
    expect(host.querySelector("app-email-preview").textContent).not.toContain("Hillside Park");
  });

  it("keeps the picker options stable and allows an actual event option to be deselected", async () => {
    const {fixture, host} = await setup();
    const picker = fixture.debugElement.queryAll(By.directive(NgSelectComponent))[1].componentInstance as NgSelectComponent;
    const items = picker.items;
    fixture.detectChanges();
    expect(picker.items).toBe(items);
    picker.open();
    fixture.detectChanges();
    const option = [...document.querySelectorAll<HTMLElement>(".ng-dropdown-panel .ng-option")]
      .find(element => element.textContent.includes("Hillside Park"));
    expect(option).toBeDefined();
    option.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector("app-email-preview").textContent).not.toContain("Hillside Park");
    expect(host.querySelector("app-email-preview").textContent).toContain("Autumn lunch");
    expect(picker.items).toBe(items);
    const unselected = [...document.querySelectorAll<HTMLElement>(".ng-dropdown-panel .ng-option")]
      .find(element => element.textContent.includes("Hillside Park"));
    unselected.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(host.querySelector("app-email-preview").textContent).toContain("Hillside Park");
    expect(host.querySelector("app-email-preview").textContent).toContain("Autumn lunch");
    picker.close();
  });

  it("shows a retryable error when the site event query fails", async () => {
    const {host} = await setup(true);
    expect(host.textContent).toContain("Events could not be loaded");
    expect(host.textContent).toContain("Retry");
    expect(host.querySelector("app-email-preview")).toBeNull();
  });
});
