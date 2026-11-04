import {MailMessagingService} from "../mail/mail-messaging.service";
import {TestBed} from "@angular/core/testing";
import {provideHttpClient} from "@angular/common/http";
import {provideHttpClientTesting} from "@angular/common/http/testing";
import {Subject} from "rxjs";
import {describe, expect, it, vi} from "vitest";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {ComposerFragmentKind, SectionDividerStyle} from "../../models/email-composer.model";
import {EmailComposerProgrammeService} from "./email-composer-programme.service";
import {EmailComposerSessionService} from "./email-composer-session.service";
import {EmailComposerRenderingService} from "./email-composer-rendering.service";
import {EmailCompositionsService} from "./email-compositions.service";
import {DateUtilsService} from "../date-utils.service";
import {LoggerTestingModule} from "ngx-logger/testing";
import {UrlService} from "../url.service";
import {PageContentService} from "../page-content.service";
import {PageContentActionsService} from "../page-content-actions.service";
import {PageContentType} from "../../models/content-text.model";
import {ProgrammeEventFormat, PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX} from "../../models/email-composer.model";
import {GroupEventSummary} from "../../models/committee.model";

describe("programme draft and output", () => {
  function setup() {
    const state = defaultEmailComposerState();
    const changed = new Subject<void>();
    const pages = {all: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({id: "template-1"})};
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [EmailComposerProgrammeService, provideHttpClient(), provideHttpClientTesting(),
        {provide: EmailComposerSessionService, useValue: {state, contentChanged: changed, notify: {error: vi.fn(), success: vi.fn()}}},
        {provide: UrlService, useValue: {absoluteUrlFor: (path: string) => `https://group.example.org.uk${path}`}},
        {provide: PageContentService, useValue: pages},
        {provide: PageContentActionsService, useValue: {defaultRowFor: () => ({type: PageContentType.TEXT, columns: [{}]})}},
        {provide: DateUtilsService, useValue: {displayDate: () => "Monday"}},
        {provide: MailMessagingService, useValue: {currentConfig: () => ({notificationConfigs: []}), createSendSmtpEmailParams: (_member, _config, html) => ({messageMergeFields: {BODY_CONTENT: html}})}},
        {provide: EmailComposerRenderingService, useValue: {tableSection: value => value, markdownToHtml: (value: string) => value}}]
    });
    TestBed.inject(EmailComposerProgrammeService).settings().format = ProgrammeEventFormat.LISTING;
    return {state, pages, programme: TestBed.inject(EmailComposerProgrammeService), storage: TestBed.inject(EmailCompositionsService)};
  }

  it("uses the same edited event content for email and printable output and saves it with the draft", () => {
    const {state, programme, storage} = setup();
    state.subject = "Winter programme";
    state.introMarkdown = "Bring suitable footwear.";
    state.signoffTextMarkdown = "The walks team";
    state.fragmentOrder = [ComposerFragmentKind.INTRO, ComposerFragmentKind.EVENTS, ComposerFragmentKind.SIGNOFF]
      .map(kind => ({kind, id: kind, dividerAfter: SectionDividerStyle.NONE}));
    programme.updateMarkdown("## Hillside Park\n\nCoordinator's updated meeting instructions.\n\nPAGEBREAK");
    expect(programme.emailHtml()).toContain("Coordinator's updated meeting instructions.");
    expect(programme.emailHtml()).not.toContain("PAGEBREAK");
    const document = programme.document();
    expect(document.document.title).toBe("Winter programme");
    expect(document.document.markdown).toMatch(/^# Winter programme\n/);
    expect(document.document.markdown).toContain("Bring suitable footwear.");
    expect(document.document.markdown).toContain("Coordinator's updated meeting instructions.");
    expect(document.document.markdown).toContain("The walks team");
    expect(document.document.markdown).toContain("PAGEBREAK");
    const stored = storage.serialiseStateForStorage(state);
    expect(stored.programme).toEqual(state.programme);
    expect(stored.programme).not.toBe(state.programme);
    state.programme = JSON.parse(JSON.stringify(stored.programme));
    expect(programme.generated()).toBe(true);
    expect(programme.document()).toBe(document);
    programme.useLiveEvents();
    expect(programme.generated()).toBe(false);
    expect(state.introMarkdown).toBe("Bring suitable footwear.");
  });

  it("keeps coordinator edits when a regeneration has no selected events", () => {
    const {programme} = setup();
    programme.updateMarkdown("Keep the coordinator's changes.");
    programme.generate();
    expect(programme.settings().markdown).toBe("Keep the coordinator's changes.");
  });

  it("makes locator links absolute when generating content for external email recipients", () => {
    const {state, programme} = setup();
    state.groupEvents = [{id: "walk-1", selected: true, title: "Hillside Park", eventDate: 1000,
      gridReference: "SU123456", mapUrl: "/locate?lat=51&lon=-1"} as GroupEventSummary];
    programme.generate();
    expect(programme.settings().markdown).toContain("[SU123456](https://group.example.org.uk/locate?lat=51&lon=-1)");
    expect(state.groupEvents[0].mapUrl).toBe("/locate?lat=51&lon=-1");
  });

  it("uses saved edits when selecting a supplied format in the composer", async () => {
    const {programme, state, pages} = setup();
    pages.all.mockResolvedValue([{id: "saved-format", path: PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + "detailed", rows: [{columns: [{contentText: "Revised {{title}}"}]}]}]);
    state.groupEvents = [{id: "walk-1", selected: true, title: "Hillside Park", eventDate: 1000} as GroupEventSummary];
    programme.settings().format = ProgrammeEventFormat.DETAILED;
    await programme.selectFormat();
    expect(programme.settings().format).toBe(ProgrammeEventFormat.DETAILED);
    expect(programme.emailHtml()).toContain("Revised Hillside Park");
    expect(programme.document().document.markdown).toContain("Revised Hillside Park");
  });

  it("loads a saved event format without generating a snapshot", () => {
    const {programme, state} = setup();
    programme.applyTemplate({id: "event-template-1", rows: [{columns: [{contentText: "## {{title}}\n\n{{image}}"}]}]} as any);
    expect(programme.settings().format).toBe(ProgrammeEventFormat.CUSTOM);
    expect(programme.settings().customTemplate).toContain("{{image}}");
    expect(state.programme.markdown).toBeNull();
    expect(TestBed.inject(EmailCompositionsService).serialiseStateForStorage(state).programme.templateId).toBe("event-template-1");
  });

  it("updates live email and PDF content when event data changes", () => {
    const {programme, state} = setup();
    state.groupEvents = [{id: "walk-1", selected: true, title: "Hillside Park", eventDate: 1000,
      image: "site-content/walk.jpg"} as GroupEventSummary];
    state.groupEventsFilter = {includeImage: true} as any;
    programme.applyTemplate({rows: [{columns: [{contentText: "## {{title}}\n\n{{image}}"}]}]} as any);
    expect(programme.previewHtml()).toContain("Hillside Park");
    expect(programme.emailHtml()).toContain("walk.jpg");
    expect(programme.document().document.markdown).toContain("walk.jpg");
    state.groupEvents[0].title = "Meadow walk";
    expect(programme.previewHtml()).toContain("Meadow walk");
    expect(programme.emailHtml()).toContain("Meadow walk");
    expect(programme.document().document.markdown).toContain("Meadow walk");
    expect(programme.generated()).toBe(false);
    state.groupEventsFilter.includeImage = false;
    expect(programme.previewHtml()).not.toContain("walk.jpg");
    expect(programme.emailHtml()).not.toContain("walk.jpg");
    expect(programme.document().document.markdown).not.toContain("walk.jpg");
  });

  it("previews the first selected event but includes every selected event in the output", () => {
    const {programme, state} = setup();
    state.groupEvents = [
      {id: "walk-1", selected: true, title: "First walk", eventDate: 1000},
      {id: "walk-2", selected: true, title: "Second walk", eventDate: 2000}
    ] as GroupEventSummary[];
    programme.settings().format = ProgrammeEventFormat.DETAILED;
    expect(programme.previewHtml()).toContain("First walk");
    expect(programme.previewHtml()).not.toContain("Second walk");
    expect(programme.emailHtml()).toContain("Second walk");
    expect(programme.document().document.markdown).toContain("Second walk");
  });
});
