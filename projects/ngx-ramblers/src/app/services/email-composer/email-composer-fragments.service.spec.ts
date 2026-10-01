import {TestBed} from "@angular/core/testing";
import {beforeEach, describe, expect, it} from "vitest";
import {defaultEmailComposerState} from "../../functions/email-composer";
import {ComposerFragmentKind, SectionDividerStyle} from "../../models/email-composer.model";
import {DateUtilsService} from "../date-utils.service";
import {StringUtilsService} from "../string-utils.service";
import {EmailComposerFragmentsService} from "./email-composer-fragments.service";

describe("composer fragment editing", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({providers: [
      EmailComposerFragmentsService,
      {provide: DateUtilsService, useValue: {}},
      {provide: StringUtilsService, useValue: {}}
    ]});
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
