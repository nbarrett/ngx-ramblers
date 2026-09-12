import { describe, expect, it } from "vitest";
import {
  ArticleBlockPosition,
  ComposerFragmentKind,
  EventInclusionMode,
  SectionDividerStyle
} from "../models/email-composer.model";
import { defaultEmailComposerState, fragmentIdsWithContent } from "./email-composer";

describe("fragmentIdsWithContent", () => {

  it("expands intro and signoff when they have text", () => {
    const state = defaultEmailComposerState();
    state.introMarkdown = "Hello Ciaran";
    state.signoffTextMarkdown = "Best regards";
    state.fragmentOrder = [
      {kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: SectionDividerStyle.NONE},
      {kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: SectionDividerStyle.NONE}
    ];
    expect(fragmentIdsWithContent(state)).toEqual(["intro", "signoff"]);
  });

  it("does not expand empty or whitespace-only intro", () => {
    const state = defaultEmailComposerState();
    state.introMarkdown = "   \n";
    state.signoffTextMarkdown = "";
    state.fragmentOrder = [
      {kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: SectionDividerStyle.NONE},
      {kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: SectionDividerStyle.NONE}
    ];
    expect(fragmentIdsWithContent(state)).toEqual([]);
  });

  it("expands an article with a title or markdown", () => {
    const state = defaultEmailComposerState();
    state.articleBlocks = [{
      id: "article-1",
      position: ArticleBlockPosition.ABOVE_EVENTS,
      order: 0,
      title: "Walk photos",
      markdown: ""
    }];
    state.fragmentOrder = [
      {kind: ComposerFragmentKind.ARTICLE, id: "article-1", dividerAfter: SectionDividerStyle.NONE}
    ];
    expect(fragmentIdsWithContent(state)).toEqual(["article-1"]);
  });

  it("expands events when one is selected", () => {
    const state = defaultEmailComposerState();
    state.eventInclusion = EventInclusionMode.AUTO_INCLUDE;
    state.groupEvents = [{id: "walk-1", selected: true} as any];
    state.fragmentOrder = [
      {kind: ComposerFragmentKind.EVENTS, id: "events", dividerAfter: SectionDividerStyle.NONE}
    ];
    expect(fragmentIdsWithContent(state)).toEqual(["events"]);
  });

  it("expands a multi-column row and the nested fragment that has text", () => {
    const state = defaultEmailComposerState();
    state.introMarkdown = "Left column copy";
    state.signoffTextMarkdown = "";
    state.fragmentOrder = [{
      kind: ComposerFragmentKind.MULTI_COLUMN,
      id: "multi-1",
      dividerAfter: SectionDividerStyle.NONE,
      columns: [
        [{kind: ComposerFragmentKind.INTRO, id: "intro", dividerAfter: SectionDividerStyle.NONE}],
        [{kind: ComposerFragmentKind.SIGNOFF, id: "signoff", dividerAfter: SectionDividerStyle.NONE}]
      ]
    }];
    expect(fragmentIdsWithContent(state)).toEqual(["multi-1", "intro"]);
  });
});
