import expect from "expect";
import { describe, it } from "mocha";
import {
  absoluteUrl,
  buildForAiMarkdown,
  buildLlmsTxt,
  buildReleaseFeed,
  normaliseLinkedPath,
  pageExportUrl,
  parseReleaseEntriesFromMarkdown,
  preferredDocumentationPaths,
  RELEASE_FEED_TYPE,
  releaseNotesHumansPathFrom,
  releaseNotesIndexPathFrom,
  siteContentPaths,
  topLevelKeyPages
} from "./ai-discovery";

describe("ai-discovery", () => {
  const site = {
    siteName: "NGX-Ramblers",
    baseUrl: "https://ngx-ramblers.org.uk"
  };

  it("normalises absolute and relative release-note links to site paths", () => {
    expect(normaliseLinkedPath("how-to/committee/release-notes/2026-07-26-issue-312")).toBe(
      "how-to/committee/release-notes/2026-07-26-issue-312"
    );
    expect(normaliseLinkedPath("/how-to/committee/release-notes/2026-07-26-issue-312")).toBe(
      "how-to/committee/release-notes/2026-07-26-issue-312"
    );
    expect(normaliseLinkedPath("https://ngx-ramblers.org.uk/how-to/committee/release-notes/2026-07-26-issue-312")).toBe(
      "how-to/committee/release-notes/2026-07-26-issue-312"
    );
  });

  it("discovers release-note indexes only when those CMS paths exist", () => {
    expect(releaseNotesIndexPathFrom(["walks", "contact-us"])).toBeNull();
    expect(releaseNotesIndexPathFrom([
      "how-to",
      "how-to/committee/release-notes",
      "how-to/committee/release-notes-for-humans"
    ])).toBe("how-to/committee/release-notes");
    expect(releaseNotesHumansPathFrom([
      "how-to/committee/release-notes-for-humans"
    ])).toBe("how-to/committee/release-notes-for-humans");
    expect(releaseNotesIndexPathFrom(["docs/release-notes"])).toBe("docs/release-notes");
  });

  it("parses the humans index using the technical notes folder as the parent", () => {
    const markdown = [
      "# Release Notes For Humans",
      "",
      "- [17-Aug-2026 — follow a walk](https://ngx-ramblers.org.uk/how-to/committee/release-notes/2026-08-17-issue-151) 📸",
      "- [nested ignored](how-to/committee/release-notes/2024-03-06/mail-settings-page)"
    ].join("\n");
    const entries = parseReleaseEntriesFromMarkdown(markdown, "how-to/committee/release-notes");
    expect(entries).toEqual([{
      title: "17-Aug-2026 — follow a walk",
      path: "how-to/committee/release-notes/2026-08-17-issue-151",
      hasImages: true
    }]);
  });

  it("parses top-level release-note entries relative to the CMS index path", () => {
    const indexPath = "how-to/committee/release-notes";
    const markdown = [
      "# Release Notes",
      "",
      "## 2026",
      "",
      "- [26-Jul-2026 — build 796 — #312 — Album cover](how-to/committee/release-notes/2026-07-26-issue-312-build-796)",
      "- [26-Jul-2026 — build 795 — #312 — Create album](https://ngx-ramblers.org.uk/how-to/committee/release-notes/2026-07-26-issue-312) 📸",
      "- [nested should be ignored](how-to/committee/release-notes/2024-03-06/mail-settings-page)",
      "- [not a release](how-to/committee/editing-content)"
    ].join("\n");
    const entries = parseReleaseEntriesFromMarkdown(markdown, indexPath);
    expect(entries).toEqual([
      {
        title: "26-Jul-2026 — build 796 — #312 — Album cover",
        path: "how-to/committee/release-notes/2026-07-26-issue-312-build-796",
        hasImages: false
      },
      {
        title: "26-Jul-2026 — build 795 — #312 — Create album",
        path: "how-to/committee/release-notes/2026-07-26-issue-312",
        hasImages: true
      }
    ]);
  });

  it("builds a self-describing release feed from CMS-derived paths", () => {
    const feed = buildReleaseFeed({
      ...site,
      generated: "2026-07-27T10:00:00.000+01:00",
      indexPath: "how-to/committee/release-notes",
      humansIndexPath: "how-to/committee/release-notes-for-humans",
      entries: [
        {
          title: "26-Jul-2026 — Album cover",
          path: "how-to/committee/release-notes/2026-07-26-issue-312-build-796",
          hasImages: false
        }
      ]
    });
    expect(feed.type).toBe(RELEASE_FEED_TYPE);
    expect(feed.title).toBe("NGX-Ramblers Release Notes");
    expect(feed.indexPath).toBe("how-to/committee/release-notes");
    expect(feed.humansIndexPath).toBe("how-to/committee/release-notes-for-humans");
    expect(feed.entries).toHaveLength(1);
    expect(feed.entries[0].markdownUrl).toBe(
      "https://ngx-ramblers.org.uk/how-to/committee/release-notes/2026-07-26-issue-312-build-796?format=markdown"
    );
  });

  it("limits release-feed entries", () => {
    const entries = Array.from({length: 5}, (_, index) => ({
      title: `Release ${index}`,
      path: `how-to/committee/release-notes/2026-07-0${index + 1}`,
      hasImages: false
    }));
    const feed = buildReleaseFeed({
      ...site,
      generated: "2026-07-27T10:00:00.000+01:00",
      indexPath: "how-to/committee/release-notes",
      entries,
      limit: 2
    });
    expect(feed.entries).toHaveLength(2);
    expect(feed.entries[0].title).toBe("Release 0");
  });

  it("builds llms.txt with release hubs only when those CMS pages exist", () => {
    const withReleases = buildLlmsTxt({
      ...site,
      availablePaths: [
        "how-to",
        "how-to/committee/release-notes",
        "how-to/committee/release-notes-for-humans",
        "how-to/technical-articles",
        "walks",
        "contact-us"
      ],
      titleFromPath: path => path.split("/").pop() || path
    });
    expect(withReleases).toContain("# NGX-Ramblers");
    expect(withReleases).toContain("## Start here");
    expect(withReleases).toContain("https://ngx-ramblers.org.uk/for-ai");
    expect(withReleases).toContain("https://ngx-ramblers.org.uk/api/public/releases");
    expect(withReleases).toContain("how-to/committee/release-notes?format=markdown");
    expect(withReleases).not.toMatch(/https:\/\/ngx-ramblers\.org\.uk\/release-notes(?![\w/-])/);
    expect(withReleases).toContain("## Documentation hubs");
    expect(withReleases).toContain("how-to/technical-articles");
    expect(withReleases).toContain("- [walks](https://ngx-ramblers.org.uk/walks)");

    const withoutReleases = buildLlmsTxt({
      ...site,
      availablePaths: ["walks", "contact-us", "social"],
      titleFromPath: path => path
    });
    expect(withoutReleases).toContain("https://ngx-ramblers.org.uk/for-ai");
    expect(withoutReleases).not.toContain("api/public/releases");
    expect(withoutReleases).not.toContain("release-notes");
    expect(withoutReleases).toContain("## Key pages");
    expect(withoutReleases).not.toContain("## Documentation hubs");
  });

  it("builds the for-ai guide with CMS-conditional release entry points", () => {
    const withReleases = buildForAiMarkdown({
      ...site,
      availablePaths: ["how-to", "how-to/committee/release-notes", "how-to/technical-articles"],
      titleFromPath: path => path
    });
    expect(withReleases).toContain("# For AI assistants");
    expect(withReleases).toContain("## Recent releases");
    expect(withReleases).toContain("api/public/releases");
    expect(withReleases).toContain("?format=markdown");
    expect(withReleases).toContain("/llms.txt");
    expect(withReleases).toContain("how-to/committee/release-notes");
    expect(withReleases).not.toMatch(/https:\/\/ngx-ramblers\.org\.uk\/release-notes(?![\w/-])/);

    const withoutReleases = buildForAiMarkdown({
      ...site,
      availablePaths: ["walks", "contact-us"],
      titleFromPath: path => path
    });
    expect(withoutReleases).toContain("# For AI assistants");
    expect(withoutReleases).not.toContain("## Recent releases");
    expect(withoutReleases).not.toContain("api/public/releases");
  });

  it("selects preferred documentation paths that exist on the site", () => {
    expect(preferredDocumentationPaths([
      "how-to",
      "how-to/committee/release-notes",
      "walks"
    ])).toEqual([
      "how-to/committee/release-notes",
      "how-to"
    ]);
    expect(siteContentPaths(["walks", "contact-us"]).documentationHubs).toEqual([]);
  });

  it("lists only top-level key pages", () => {
    expect(topLevelKeyPages(["walks", "how-to/committee", "contact-us", "social"])).toEqual([
      "contact-us",
      "social",
      "walks"
    ]);
  });

  it("builds absolute and export URLs", () => {
    expect(absoluteUrl("https://example.org/", "how-to")).toBe("https://example.org/how-to");
    expect(pageExportUrl("https://example.org", "how-to", "json")).toBe("https://example.org/how-to?format=json");
  });
});
