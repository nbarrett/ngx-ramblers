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
import {ContentTemplateType, PageContentType} from "../../models/content-text.model";
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
        {provide: EmailComposerRenderingService, useValue: {markdownToHtml: (value: string) => value}}]
    });
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

  it("customises the supplied listing and saves and loads it through the existing content template library", async () => {
    const {programme, pages} = setup();
    programme.customiseFormat();
    expect(programme.settings().format).toBe(ProgrammeEventFormat.CUSTOM);
    expect(programme.settings().customTemplate).toContain("{{grid-reference}}");
    expect(await programme.saveTemplate("Compact walk programme")).toBe(true);
    const saved = pages.create.mock.calls[0][0];
    expect(saved.path).toBe(PROGRAMME_EVENT_TEMPLATE_PATH_PREFIX + "compact-walk-programme");
    expect(saved.migrationTemplate.templateType).toBe(ContentTemplateType.USER_TEMPLATE);
    programme.settings().customTemplate = "Different format";
    programme.applyTemplate(saved);
    expect(programme.settings().customTemplate).toContain("{{grid-reference}}");
    pages.all.mockResolvedValue([saved]);
    expect(await programme.saveTemplate("Compact walk programme")).toBe(false);
    expect(pages.create).toHaveBeenCalledOnce();
  });
});
