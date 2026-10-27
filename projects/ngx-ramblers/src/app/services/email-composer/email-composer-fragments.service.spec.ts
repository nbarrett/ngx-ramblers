import {TestBed} from "@angular/core/testing";
import {beforeEach, describe, expect, it} from "vitest";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {BrandingMode, ComposerFragmentKind, EmailCompositionKind, SectionDividerStyle} from "../../models/email-composer.model";
import {NotificationConfig} from "../../models/mail.model";
import {DateUtilsService} from "../date-utils.service";
import {StringUtilsService} from "../string-utils.service";
import {EmailComposerFragmentsComponent} from "../../pages/email-composer/email-composer-fragments.component";
import {CommitteeDisplayService} from "../../pages/committee/committee-display.service";
import {EmailComposerFragmentsService} from "./email-composer-fragments.service";

describe("composer fragment editing", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      EmailComposerFragmentsService,
      {provide: DateUtilsService, useValue: {}},
      {provide: StringUtilsService, useValue: {}},
      {provide: CommitteeDisplayService, useValue: {}}
    ]});
  });

  it("creates and opens one message section for an empty unbranded email", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.fragmentOrder = [];
    service.ensureUnbrandedMessage(state);
    service.ensureUnbrandedMessage(state);
    expect(state.fragmentOrder.map(fragment => fragment.kind)).toEqual([ComposerFragmentKind.INTRO]);
    expect(service.expandedFragmentIds.has("intro")).toBe(true);
  });

  it("opens an existing message inside a column without duplicating it or changing its content", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.introMarkdown = "Please review the arrangements.";
    const intro = {id: "existing-message", kind: ComposerFragmentKind.INTRO, dividerAfter: SectionDividerStyle.NONE};
    state.fragmentOrder = [{id: "columns", kind: ComposerFragmentKind.MULTI_COLUMN, dividerAfter: SectionDividerStyle.NONE, columns: [[intro]]}];
    service.ensureUnbrandedMessage(state);
    expect(state.fragmentOrder).toHaveLength(1);
    expect(service.expandedFragmentIds.has(intro.id)).toBe(true);
    expect(state.introMarkdown).toBe("Please review the arrangements.");
  });

  it("hides inherited branded sections in Compose and restores them when switching back", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.fragmentOrder = [
      {id: "intro", kind: ComposerFragmentKind.INTRO, dividerAfter: SectionDividerStyle.THIN_YELLOW},
      {id: "template-content", kind: ComposerFragmentKind.TEMPLATE_CONTENT, dividerAfter: SectionDividerStyle.NONE},
      {id: "signoff", kind: ComposerFragmentKind.SIGNOFF, dividerAfter: SectionDividerStyle.NONE}
    ];
    state.signoffTextMarkdown = "Regards, Alex";
    const originalFragments = structuredClone(state.fragmentOrder);
    const fixture = TestBed.createComponent(EmailComposerFragmentsComponent);
    fixture.componentRef.setInput("state", state);
    fixture.componentRef.setInput("bodyTemplate", null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Message");
    expect(fixture.nativeElement.textContent).not.toContain("Template content");
    expect(fixture.nativeElement.textContent).not.toContain("Signoff");
    expect(fixture.nativeElement.textContent).not.toContain("Divider after");
    expect(service.fragmentsForRender(state)).toEqual([{id: "intro", kind: ComposerFragmentKind.INTRO, dividerAfter: SectionDividerStyle.NONE}]);
    expect(state.fragmentOrder).toEqual(originalFragments);
    state.brandingMode = BrandingMode.BRANDED;
    fixture.componentRef.setInput("state", {...state});
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Template content");
    expect(fixture.nativeElement.textContent).toContain("Signoff");
    expect(state.signoffTextMarkdown).toBe("Regards, Alex");
    expect(state.fragmentOrder).toEqual(originalFragments);
  });

  it("excludes branded fragments recursively after reloading an unbranded draft", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.fragmentOrder = [
      {id: "columns", kind: ComposerFragmentKind.MULTI_COLUMN, dividerAfter: SectionDividerStyle.NONE, columns: [[
        {id: "intro", kind: ComposerFragmentKind.INTRO, dividerAfter: SectionDividerStyle.NONE},
        {id: "signoff", kind: ComposerFragmentKind.SIGNOFF, dividerAfter: SectionDividerStyle.NONE}
      ], [{id: "article", kind: ComposerFragmentKind.ARTICLE, dividerAfter: SectionDividerStyle.NONE}]]},
      {id: "template", kind: ComposerFragmentKind.TEMPLATE_CONTENT, dividerAfter: SectionDividerStyle.NONE},
      {id: "events", kind: ComposerFragmentKind.EVENTS, dividerAfter: SectionDividerStyle.NONE},
      {id: "empty-columns", kind: ComposerFragmentKind.MULTI_COLUMN, dividerAfter: SectionDividerStyle.NONE, columns: [[{id: "hidden-signoff", kind: ComposerFragmentKind.SIGNOFF, dividerAfter: SectionDividerStyle.NONE}]]}
    ];
    const restored = JSON.parse(JSON.stringify(state));
    service.ensureUnbrandedMessage(restored);
    const visible = service.fragmentsForRender(restored);
    expect(visible).toHaveLength(1);
    expect(visible[0].columns?.map(column => column.map(fragment => fragment.kind))).toEqual([[ComposerFragmentKind.INTRO], []]);
    expect(service.expandedFragmentIds.has("intro")).toBe(true);
    expect(restored.fragmentOrder).toEqual(state.fragmentOrder);
  });

  it("keeps deliberately added committee files and divider sections in unbranded mail", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.brandingMode = BrandingMode.UNBRANDED;
    state.fragmentOrder = [
      {id: "intro", kind: ComposerFragmentKind.INTRO, dividerAfter: SectionDividerStyle.NONE},
      {id: "files", kind: ComposerFragmentKind.COMMITTEE_FILE, dividerAfter: SectionDividerStyle.NONE, committeeFileIds: ["example-file"]},
      {id: "divider", kind: ComposerFragmentKind.DIVIDER, dividerAfter: SectionDividerStyle.THIN_YELLOW}
    ];
    expect(service.fragmentsForRender(state).map(fragment => fragment.kind)).toEqual([ComposerFragmentKind.INTRO, ComposerFragmentKind.COMMITTEE_FILE, ComposerFragmentKind.DIVIDER]);
    expect(service.fragmentsForRender(state)[2].dividerAfter).toBe(SectionDividerStyle.THIN_YELLOW);
  });

  it("moves an existing article into a column without losing other fragments", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    const article = {id: "article", kind: ComposerFragmentKind.ARTICLE, dividerAfter: SectionDividerStyle.NONE};
    const intro = {id: "intro", kind: ComposerFragmentKind.INTRO, dividerAfter: SectionDividerStyle.NONE};
    const columns = {id: "columns", kind: ComposerFragmentKind.MULTI_COLUMN, dividerAfter: SectionDividerStyle.NONE, columns: [[intro], []]};
    state.fragmentOrder = [columns, article];
    service.movePath(state, [1], [0, 1, 0]);
    expect(state.fragmentOrder).toEqual([columns]);
    expect(columns.columns).toEqual([[intro], [article]]);
  });

  it("ignores a missing destination without removing the source", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    const article = {id: "article", kind: ComposerFragmentKind.ARTICLE, dividerAfter: SectionDividerStyle.NONE};
    state.fragmentOrder = [article];
    service.movePath(state, [0], [3, 0, 0]);
    expect(state.fragmentOrder).toEqual([article]);
  });

  it("returns a default fragment list without writing it onto empty state", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    const rendered = service.fragmentsForRender(state);
    expect(state.fragmentOrder).toEqual([]);
    expect(rendered.some(fragment => fragment.kind === ComposerFragmentKind.INTRO)).toBe(true);
  });

  it.each([null, "", "   "])("omits template content from a newsletter with body %j", body => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.compositionKind = EmailCompositionKind.NEWSLETTER;
    state.notificationConfig = {id: "newsletter", body} as NotificationConfig;
    service.ensureFragmentOrder(state);
    expect(state.fragmentOrder.some(fragment => fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT)).toBe(false);
  });

  it("keeps configured template wording in branded emails", () => {
    const service = TestBed.inject(EmailComposerFragmentsService);
    const state = defaultEmailComposerState();
    state.notificationConfig = {id: "welcome", body: "Welcome to the group."} as NotificationConfig;
    service.ensureFragmentOrder(state);
    expect(state.fragmentOrder.some(fragment => fragment.kind === ComposerFragmentKind.TEMPLATE_CONTENT)).toBe(true);
  });

  it("keeps expansion and drag state separate between composer instances", () => {
    const first = TestBed.runInInjectionContext(() => new EmailComposerFragmentsService());
    const second = TestBed.runInInjectionContext(() => new EmailComposerFragmentsService());
    const state = defaultEmailComposerState();
    first.toggleFragmentExpanded(state, "article");
    first.draggedFragmentPath = [0];
    expect(second.isFragmentExpanded(state, "article")).toBe(false);
    expect(second.draggedFragmentPath).toBeNull();
  });
});
