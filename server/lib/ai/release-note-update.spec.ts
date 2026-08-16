import expect from "expect";
import { describe, it } from "mocha";
import { ReleaseNoteUpdateCandidate } from "../../../projects/ngx-ramblers/src/app/models/ai.model";
import { ReleaseNoteUpdateCategory } from "../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { defaultReleaseNoteUpdateDefaults } from "../../../projects/ngx-ramblers/src/app/functions/email-composer";
import {
  buildReleaseNoteUpdateInput,
  buildReleaseNoteUpdateRetryInput,
  cleanGeneratedProse,
  cleanGeneratedTitle,
  describeCandidate,
  digestHighlightLimit,
  emptyReleaseNoteUpdateDraft,
  handComposableDraft,
  handComposableIntro,
  parseReleaseNoteUpdateDraft,
  representativeItemSources,
  RELEASE_NOTE_UPDATE_SYSTEM_PROMPT,
  quietEmptyIntro,
  releaseNoteImagesFromMarkdown,
  truncateExcerpt
} from "./release-note-update";

function candidate(overrides: Partial<ReleaseNoteUpdateCandidate> = {}): ReleaseNoteUpdateCandidate {
  return {
    title: "Share a walk from the page",
    path: "how-to/committee/release-notes/2026-08-10-share-menu",
    url: "https://example.test/how-to/committee/release-notes/2026-08-10-share-menu",
    dateMillis: 1,
    excerpt: "Members can share a walk from its page.",
    ...overrides
  };
}

describe("release-note-update", () => {

  describe("system prompt", () => {
    it("requires user outcomes instead of implementation detail", () => {
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("what a chair, webmaster, walk leader, committee member or ordinary member can now do");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("mention only that outcome");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("not a compressed inventory");
    });

    it("excludes technical handover and supplier language", () => {
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("Do not name suppliers, protocols, frameworks or internal systems");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("Do not mention tickets, handover assets, technical readiness");
    });

    it("distinguishes new capabilities from improvements to existing ones", () => {
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("Treat release-note wording such as introduces, adds, launches, is now available, can now or new as evidence that the capability is new");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("only when the supplied release notes explicitly establish that the capability existed before the reporting period");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("use a neutral factual subject heading");
    });

    it("headlines the most important capability rather than a supporting convenience", () => {
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("The title must lead with that capability and its main user outcome");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("Never headline a smaller convenience, search refinement or supporting fix");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("Do not group changes merely because they touch the same screen, map or part of the website");
    });

    it("requires substantive coverage of major social-media capabilities", () => {
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("a category label or introductory sentence never counts as covering it");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("must receive a substantive item with its own meaningful title, body and supporting sourceIds");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("Do not create a separate social-media category");
    });
  });

  describe("truncateExcerpt", () => {
    it("returns an empty string for nothing usable", () => {
      expect(truncateExcerpt(undefined)).toEqual("");
      expect(truncateExcerpt("   ")).toEqual("");
    });

    it("truncates a long excerpt", () => {
      expect(truncateExcerpt("x".repeat(20), 10)).toEqual(`${"x".repeat(10)}…`);
    });
  });

  describe("generated rich-text copy", () => {
    it("removes empty Markdown tables and list syntax", () => {
      expect(cleanGeneratedProse("A useful introduction.\n\n|   |\n| - |\n\n- A plain sentence.")).toEqual("A useful introduction.\n\nA plain sentence.");
    });

    it("removes model-style New and Improved labels from titles", () => {
      expect(cleanGeneratedTitle("New! Import photo albums from Flickr")).toEqual("Import photo albums from Flickr");
      expect(cleanGeneratedTitle("Improved: Walk editing")).toEqual("Walk editing");
    });
  });

  describe("release-note images", () => {
    it("extracts unique absolute Markdown images with their descriptions", () => {
      expect(releaseNoteImagesFromMarkdown("![Route editor](https://example.test/route.png)\n![Duplicate](https://example.test/route.png)\n![Local](/local.png)")).toEqual([
        {url: "https://example.test/route.png", alt: "Route editor"}
      ]);
    });
  });

  describe("describeCandidate", () => {
    it("puts the date, title and detail on separate lines without the long storage path", () => {
      expect(describeCandidate(candidate())).not.toContain(candidate().path);
      expect(describeCandidate(candidate())).toContain("date: 1970-01-01");
      expect(describeCandidate(candidate())).toContain("title: Share a walk from the page");
      expect(describeCandidate(candidate())).toContain("detail: Members can share a walk from its page.");
    });

  });

  describe("digestHighlightLimit", () => {
    it("uses the configured maximum number of aggregated subjects", () => {
      expect(digestHighlightLimit(0, 10)).toEqual(0);
      expect(digestHighlightLimit(6, 10)).toEqual(6);
      expect(digestHighlightLimit(40, 10)).toEqual(10);
    });
  });

  describe("representativeItemSources", () => {
    it("keeps evidence from the oldest and newest parts of a long reporting period", () => {
      const item = {
        path: "august",
        sourcePaths: ["august", "july", "june", "may", "april", "march", "february", "january"],
        sourceNotes: ["august", "july", "june", "may", "april", "march", "february", "january"].map(description => ({description, url: description, date: description})),
        url: "notes",
        title: "Features across the period",
        body: "A summary.",
        theme: "Website features",
        category: ReleaseNoteUpdateCategory.NON_EMAIL
      };

      const selected = representativeItemSources(item, 4);

      expect(selected.sourcePaths).toEqual(["august", "june", "march", "january"]);
      expect(selected.sourceNotes.map(note => note.description)).toEqual(["august", "june", "march", "january"]);
    });
  });

  describe("buildReleaseNoteUpdateInput", () => {
    it("says when the window is empty", () => {
      const input = buildReleaseNoteUpdateInput([], "1 August to 16 August 2026", "East Kent", null, defaultReleaseNoteUpdateDefaults());
      expect(input).toContain("Curated release notes in the period: 0");
      expect(input).toContain("There are no curated release notes in this period.");
    });

    it("lists candidates and sender guidance", () => {
      const input = buildReleaseNoteUpdateInput([candidate()], "1 August to 16 August 2026", "East Kent", "Keep it short", defaultReleaseNoteUpdateDefaults());
      expect(input).toContain("Group: East Kent");
      expect(input).toContain("Guidance from the sender: Keep it short");
      expect(input).toContain("Release note id 1:");
      expect(input).not.toContain(candidate().path);
    });

    it("lists the complete period from oldest source to newest", () => {
      const older = candidate({title: "Older feature", path: "how-to/committee/release-notes/2026-01-20-older", dateMillis: 1});
      const newer = candidate({title: "Newer feature", path: "how-to/committee/release-notes/2026-08-20-newer", dateMillis: 2});
      const input = buildReleaseNoteUpdateInput([newer, older], "20 January to 20 August 2026", "NGX", null, defaultReleaseNoteUpdateDefaults());

      expect(input.indexOf(older.title)).toBeLessThan(input.indexOf(newer.title));
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("represent the whole period");
      expect(RELEASE_NOTE_UPDATE_SYSTEM_PROMPT).toContain("not just the most recent weeks");
    });
  });

  describe("buildReleaseNoteUpdateRetryInput", () => {
    it("gives the retry a compact source map and a strict aggregation limit", () => {
      const input = buildReleaseNoteUpdateRetryInput([candidate()], "January to August", "Keeping Members Informed\nManaging Your Website", 6, 3);

      expect(input).toContain("Period covered: January to August");
      expect(input).toContain("Return no more than 1 aggregated items in total. This is an absolute limit.");
      expect(input).toContain("Use no more than 3 sourceIds per item.");
      expect(input).toContain("1: 1970-01-01 | Share a walk from the page");
      expect(input).toContain("Previous draft to repair without losing its coverage:");
      expect(input).toContain("Keeping Members Informed");
      expect(input).toContain("Managing Your Website");
      expect(input).toContain("Do not emit one item per bullet or release note");
    });
  });

  describe("parseReleaseNoteUpdateDraft", () => {
    it("keeps only items that match a supplied candidate", () => {
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "A few things have shipped.",
        items: [
          {sources: [{path: candidate().path, description: "Members can share a walk from its page"}], title: "Share walks more easily", body: "Members can send a walk to a friend from the walk page.", theme: "Running walks"},
          {path: "how-to/committee/release-notes/missing", title: "Invented", body: "Not real."}
        ]
      }), [candidate()], "how-to/committee/release-notes", "https://example.test/how-to/committee/release-notes", 10, 12);

      expect(draft?.intro).toEqual("A few things have shipped.");
      expect(draft?.items).toEqual([{
        path: candidate().path,
        sourcePaths: [candidate().path],
        sourceNotes: [{description: "Share a walk from the page", url: candidate().url, date: "1 January 1970"}],
        url: "https://example.test/how-to/committee/release-notes",
        title: "Share walks more easily",
        body: "Members can send a walk to a friend from the walk page.",
        theme: "Running walks",
        category: ReleaseNoteUpdateCategory.NON_EMAIL
      }]);
    });

    it("keeps several release notes as sources for one aggregated highlight", () => {
      const second = candidate({
        title: "Clearer walk details",
        path: "how-to/committee/release-notes/2026-08-11-walk-details",
        url: "https://example.test/how-to/committee/release-notes/2026-08-11-walk-details",
        dateMillis: 2
      });
      const sourcePaths = [candidate().path, second.path];
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "Running walks has become simpler.",
        items: [{
          sources: sourcePaths.map((path, index) => ({path, description: index === 0 ? "Members can share walks" : "Walk details are clearer"})),
          title: "Simpler ways to organise and share walks",
          body: "Several changes now make walk information clearer and easier to pass on.",
          theme: "Running walks"
        }]
      }), [candidate(), second], "how-to/committee/release-notes", "https://example.test/notes", 10, 12);

      expect(draft?.items).toHaveLength(1);
      expect(draft?.items[0].sourcePaths).toEqual([second.path, candidate().path]);
      expect(draft?.items[0].sourceNotes.map(note => note.description)).toEqual(["Clearer walk details", "Share a walk from the page"]);
      expect(draft?.items[0].url).toEqual("https://example.test/notes");
    });

    it("returns null when the model output is not JSON", () => {
      expect(parseReleaseNoteUpdateDraft("sorry, I cannot", [candidate()], null, null, 10, 12)).toEqual(null);
    });

    it("returns null when release notes were supplied but no usable highlights were returned", () => {
      expect(parseReleaseNoteUpdateDraft(JSON.stringify({intro: "An update", items: []}), [candidate()], null, null, 10, 12)).toEqual(null);
    });

    it("accepts source paths returned as strings", () => {
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{
          sourcePaths: [candidate().path],
          title: "Clearer walks",
          body: "Walk information is easier to use.",
          theme: "Running walks"
        }]
      }), [candidate()], null, null, 10, 12);

      expect(draft?.items[0].sourcePaths).toEqual([candidate().path]);
    });

    it("maps compact numeric source ids back to exact release notes", () => {
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{sourceIds: [1], title: "Clearer walks", body: "Walk information is easier to use."}]
      }), [candidate()], null, null, 10, 12);

      expect(draft?.items[0].sourcePaths).toEqual([candidate().path]);
      expect(draft?.items[0].sourceNotes[0].url).toEqual(candidate().url);
    });

    it("maps a chosen image id to a verified image from a supporting release note", () => {
      const source = candidate({images: [{url: "https://example.test/route.png", alt: "Editing a walk route on a phone"}]});
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{sourceIds: [1], imageId: "1.1", title: "Follow and edit walk routes", body: "Walk routes can be used on a phone."}]
      }), [source], null, null, 10, 12);

      expect(draft?.items[0].image).toEqual({url: "https://example.test/route.png", alt: "Editing a walk route on a phone"});
    });

    it("accepts a numeric image id", () => {
      const source = candidate({images: [{url: "https://example.test/route.png", alt: "Route editor"}]});
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{sourceIds: [1], imageId: 1.1, title: "Edit walk routes", body: "Routes can be edited."}]
      }), [source], null, null, 10, 12);

      expect(draft?.items[0].image?.url).toEqual("https://example.test/route.png");
    });

    it("uses a verified supporting image when the model omits imageId", () => {
      const source = candidate({images: [{url: "https://example.test/route.png", alt: "Route editor"}]});
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{sourceIds: [1], title: "Edit walk routes", body: "Routes can be edited."}]
      }), [source], null, null, 10, 12);

      expect(draft?.items[0].image?.url).toEqual("https://example.test/route.png");
    });

    it("rejects an image that does not belong to the item's supporting release notes", () => {
      const supporting = candidate();
      const unrelated = candidate({path: "unrelated", images: [{url: "https://example.test/unrelated.png", alt: "Unrelated"}]});
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{sourceIds: [1], imageId: "2.1", title: "Share walks", body: "Walks can be shared."}]
      }), [supporting, unrelated], null, null, 10, 12);

      expect(draft?.items[0].image).toBeUndefined();
    });

    it("uses a relevant image from another release note when supporting notes have no images", () => {
      const supporting = candidate({title: "Follow walks from a phone"});
      const illustrated = candidate({
        path: "illustrated-route-release",
        title: "Edit and follow walk routes",
        excerpt: "A route can be followed on a phone.",
        images: [{url: "https://example.test/route.png", alt: "Follow a walk route on a phone"}]
      });
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [{sourceIds: [1], title: "Follow and edit walk routes", body: "Walk routes can be followed on a phone."}]
      }), [supporting, illustrated], null, null, 10, 12);

      expect(draft?.items[0].image).toEqual({url: "https://example.test/route.png", alt: "Follow a walk route on a phone"});
    });

    it("accepts compact source ids in common model response shapes", () => {
      const items = [
        {sourceIds: ["1"]},
        {source_ids: [1]},
        {sources: [1]},
        {sources: [{id: "1"}]}
      ];
      items.forEach(item => {
        const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
          intro: "An update",
          items: [{...item, title: "Clearer walks", body: "Walk information is easier to use."}]
        }), [candidate()], null, null, 10, 12);
        expect(draft?.items[0].sourcePaths).toEqual([candidate().path]);
      });
    });

    it("accepts an empty items list for a quiet window", () => {
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: quietEmptyIntro(),
        items: []
      }), [], null, null, 10, 12);
      expect(draft?.items).toEqual([]);
      expect(draft?.intro).toContain("Nothing new has shipped");
    });

    it("keeps email and non-email items separate when all features are requested", () => {
      const secondCandidate = candidate({path: "how-to/committee/release-notes/2026-08-11-email"});
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [
          {sourceIds: [1], category: ReleaseNoteUpdateCategory.EMAIL, title: "Clearer email", body: "Email is easier to follow."},
          {sourceIds: [2], category: ReleaseNoteUpdateCategory.NON_EMAIL, title: "Clearer walks", body: "Walks are easier to follow."}
        ]
      }), [candidate(), secondCandidate], null, null, 10, 12, [ReleaseNoteUpdateCategory.EMAIL, ReleaseNoteUpdateCategory.NON_EMAIL]);

      expect(draft?.items.map(item => item.category)).toEqual([ReleaseNoteUpdateCategory.EMAIL, ReleaseNoteUpdateCategory.NON_EMAIL]);
    });

    it("uses each release note as evidence for only one subject", () => {
      const secondCandidate = candidate({path: "how-to/committee/release-notes/2026-08-11-flickr", dateMillis: 2});
      const draft = parseReleaseNoteUpdateDraft(JSON.stringify({
        intro: "An update",
        items: [
          {sourceIds: [1, 2], title: "Photo albums", body: "Import albums from Flickr."},
          {sourceIds: [2], title: "Website images", body: "Import Flickr photos."}
        ]
      }), [candidate(), secondCandidate], null, null, 10, 12);

      expect(draft?.items).toHaveLength(1);
      expect(draft?.items[0].sourcePaths).toEqual([secondCandidate.path, candidate().path]);
    });
  });

  describe("hand composable fallback", () => {
    it("turns candidates into blank items the sender can write", () => {
      const draft = handComposableDraft([candidate()], "how-to/committee/release-notes", "https://example.test/notes", handComposableIntro(1));
      expect(draft.items[0].title).toEqual(candidate().title);
      expect(draft.items[0].body).toEqual("");
      expect(draft.intro).toContain("Edit the items below");
    });

    it("uses the quiet intro when there is nothing to write about", () => {
      expect(emptyReleaseNoteUpdateDraft(null, null, quietEmptyIntro()).intro).toEqual(quietEmptyIntro());
      expect(handComposableIntro(0)).toEqual(quietEmptyIntro());
    });
  });
});
