import expect from "expect";
import { describe, it } from "mocha";
import { createReleaseNotesData, extractPlaintextBuildRef, generateMarkdown, generateTitle, linkPlaintextBuildLine, refreshIndexPageContent, releaseNoteSlug, stripRedundantIssueRefs, updateIndexPageContent } from "./content-generator";
import {
  PageContent,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { ConventionalCommit } from "./models";

function makeIndexPage(body: string): PageContent {
  return {
    id: "test-id",
    path: "how-to/committee/release-notes",
    rows: [
      {
        type: PageContentType.TEXT,
        showSwiper: false,
        maxColumns: 1,
        columns: [
          {
            columns: 12,
            contentText: body
          } as any
        ]
      }
    ]
  } as PageContent;
}

function extractContent(page: PageContent): string {
  return (page.rows?.[0]?.columns?.[0] as any).contentText;
}

describe("content-generator stripRedundantIssueRefs", () => {

  it("removes a trailing ref that repeats the issue already stated in the line", () => {
    expect(stripRedundantIssueRefs("#310 — separate inbox privacy from admin config (ref #310)"))
      .toEqual("#310 — separate inbox privacy from admin config");
  });

  it("removes secondary ticket metadata from the title", () => {
    expect(stripRedundantIssueRefs("#338 — contact-us button builder and TipTap editor improvements (ref #338, #303)"))
      .toEqual("#338 — contact-us button builder and TipTap editor improvements");
  });

  it("leaves a line alone when it has no trailing refs", () => {
    expect(stripRedundantIssueRefs("#312 — Always set a walk album cover after saving photos"))
      .toEqual("#312 — Always set a walk album cover after saving photos");
  });

  it("leaves parenthesised wording that is not an issue reference", () => {
    expect(stripRedundantIssueRefs("#800 — refresh codebase evolution stats snapshot (28 July 2026)"))
      .toEqual("#800 — refresh codebase evolution stats snapshot (28 July 2026)");
  });
});

describe("content-generator generateTitle", () => {
  it("removes multiple trailing ticket references before shortening the headline", () => {
    const commits = [{scope: "walks+mobile+cms", type: "fix", subject: "Walk filters work reliably (ref #345, #151, #205)"}] as ConventionalCommit[];
    expect(generateTitle(commits)).toEqual("Walk filters work reliably");
  });

  it("preserves ordinary parentheses in the headline", () => {
    const commits = [{scope: "walks", type: "fix", subject: "Walk filters (including past dates) update reliably (ref #345, #151)"}] as ConventionalCommit[];
    expect(generateTitle(commits)).toEqual("Walk filters (including past dates) update reliably");
  });

  it("turns compound technical scopes into a readable shared subject", () => {
    const commits = [
      {scope: "registration+albums+ci+stats", type: "fix", subject: "tidier imported pages"},
      {scope: "registration+ci", type: "fix", subject: "support Ramblers-hosted pages"}
    ] as ConventionalCommit[];

    expect(generateTitle(commits)).toEqual("Site registration updates");
  });

  it("uses readable scope names when several commits share compound scopes", () => {
    const commits = [
      {scope: "registration+albums", type: "fix", subject: "More complete imported pages (ref #123, #456)"},
      {scope: "registration+albums", type: "fix", subject: "Keep photo captions (ref #123)"}
    ] as ConventionalCommit[];
    expect(generateTitle(commits)).toEqual("Site registration and Photo albums: More complete imported pages");
  });

  it("uses a change summary when the shared scope is internal", () => {
    const commits = [
      {scope: "ci", type: "ci", subject: "Retry deployment (ref #123)"},
      {scope: "ci", type: "ci", subject: "Reuse published images (ref #123)"}
    ] as ConventionalCommit[];
    expect(generateTitle(commits)).toEqual("2 CI updates");
  });

  it("creates readable release-note path suffixes from the title", () => {
    expect(releaseNoteSlug("Site registration improvements")).toEqual("site-registration-improvements");
  });
});

describe("content-generator updateIndexPageContent", () => {

  it("replaces a retried build link instead of adding a second entry", () => {
    const path = "how-to/committee/release-notes/build-since-abcdef123";
    const existing = makeIndexPage(`# Release Notes\n\n## 2026\n\n- [21-Sep-2026 — build 963 — Site updates](${path})`);
    const updated = updateIndexPageContent(existing, {date: "2026-09-22", title: "Site updates", path, issueNumber: null, buildNumber: "964"});
    const content = extractContent(updated);
    expect(content.match(/build-since-abcdef123/g)?.length).toEqual(1);
    expect(content).toContain("build 964");
    expect(content).not.toContain("build 963");
  });

  it("drops a redundant trailing issue ref from a new entry, keeping the camera marker", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "Welcome to the release notes page.",
        "",
        "- [27-Jul-2026 — build 798 — #310 — separate inbox privacy (ref #310)](/how-to/committee/release-notes/2026-07-27) 📸"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-07-28",
      title: "H1–H6 headings and extract TipTap/composer helpers (ref #303)",
      path: "how-to/committee/release-notes/2026-07-28",
      issueNumber: "303",
      buildNumber: "801"
    });

    const content = extractContent(updated);
    expect(content).toContain("- [28-Jul-2026 — build 801 — #303 — H1–H6 headings and extract TipTap/composer helpers](/how-to/committee/release-notes/2026-07-28)");
    expect(content).toContain("- [27-Jul-2026 — build 798 — #310 — separate inbox privacy](/how-to/committee/release-notes/2026-07-27) 📸");
    expect(content).not.toContain("(ref #303)");
    expect(content).not.toContain("(ref #310)");
  });


  it("preserves existing 📸 camera markers when adding a new entry", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "Welcome to the release notes page.",
        "",
        "- [01-Apr-2026 — Earlier release](/how-to/committee/release-notes/2026-04-01) 📸",
        "- [31-Mar-2026 — Older release](/how-to/committee/release-notes/2026-03-31)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "New release note",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("- [01-Apr-2026 — Earlier release](/how-to/committee/release-notes/2026-04-01) 📸");
    expect(content).toContain("- [31-Mar-2026 — Older release](/how-to/committee/release-notes/2026-03-31)");
    expect(content).toContain("- [04-Apr-2026 — New release note](/how-to/committee/release-notes/2026-04-04)");
  });

  it("does not strip 📸 from entries that already exist when re-adding the same path", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [04-Apr-2026 — Existing entry](/how-to/committee/release-notes/2026-04-04) 📸"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "Existing entry",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("- [04-Apr-2026 — Existing entry](/how-to/committee/release-notes/2026-04-04) 📸");
  });

  it("adds new entries without a 📸 marker by default", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [31-Mar-2026 — Older](/how-to/committee/release-notes/2026-03-31)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "Fresh release",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    const newLine = content.split("\n").find(line => line.includes("2026-04-04"));
    expect(newLine).toBeDefined();
    expect(newLine).not.toContain("📸");
  });

  it("emits ## <year> headings consistently above each year's entries", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "## 2026",
        "",
        "- [08-Jan-2026 — Early 2026](/how-to/committee/release-notes/2026-01-08)",
        "- [20-Dec-2025 — Late 2025](/how-to/committee/release-notes/2025-12-20)",
        "- [07-May-2025 — Mid 2025](/how-to/committee/release-notes/2025-05-07) 📸",
        "- [19-Dec-2024 — Late 2024](/how-to/committee/release-notes/2024-12-19) 📸"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "New release",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("## 2026\n\n- [04-Apr-2026");
    expect(content).toContain("## 2025\n\n- [20-Dec-2025");
    expect(content).toContain("## 2024\n\n- [19-Dec-2024");
    // Ensure the original stray `## 2026` was stripped from preamble (not duplicated)
    expect(content.match(/## 2026/g)?.length).toBe(1);
  });

  it("normalises leading-slash paths in existing entries on round-trip", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [07-May-2025 — Legacy](/how-to/committee/release-notes/2025-05-07) 📸"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "New",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("](/how-to/committee/release-notes/2025-05-07) 📸");
  });

  it("refreshIndexPageContent applies year headings without merging a new entry", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [08-Jan-2026 — 2026 entry](/how-to/committee/release-notes/2026-01-08)",
        "- [19-Dec-2024 — 2024 entry](/how-to/committee/release-notes/2024-12-19) 📸"
      ].join("\n")
    );

    const refreshed = refreshIndexPageContent(existing);
    const content = extractContent(refreshed);
    expect(content).toContain("## 2026\n\n- [08-Jan-2026");
    expect(content).toContain("## 2024\n\n- [19-Dec-2024");
    expect(content).toContain("](/how-to/committee/release-notes/2024-12-19) 📸");
  });

  it("preserves 📸 across many entries when inserting in the middle", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [05-Apr-2026 — A](/how-to/committee/release-notes/2026-04-05) 📸",
        "- [03-Apr-2026 — B](/how-to/committee/release-notes/2026-04-03) 📸",
        "- [01-Apr-2026 — C](/how-to/committee/release-notes/2026-04-01)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "Inserted",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("- [05-Apr-2026 — A](/how-to/committee/release-notes/2026-04-05) 📸");
    expect(content).toContain("- [03-Apr-2026 — B](/how-to/committee/release-notes/2026-04-03) 📸");
    expect(content).toContain("- [01-Apr-2026 — C](/how-to/committee/release-notes/2026-04-01)");
    expect(content).toContain("- [04-Apr-2026 — Inserted](/how-to/committee/release-notes/2026-04-04)");
  });

  it("shows the build number in the label and orders same-date entries newest build first", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [03-Jul-2026 — build 733 — #306 — Attachments](/how-to/committee/release-notes/2026-07-03-issue-306) 📸"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-07-03",
      title: "Walks display tweaks",
      path: "how-to/committee/release-notes/2026-07-03",
      issueNumber: "302",
      buildNumber: "735"
    });

    const content = extractContent(updated);
    const entryLines = content.split("\n").filter(line => line.startsWith("- ["));
    expect(entryLines[0]).toContain("build 735");
    expect(entryLines[0]).toContain("(/how-to/committee/release-notes/2026-07-03)");
    expect(entryLines[1]).toContain("build 733");
    expect(content.indexOf("build 735")).toBeLessThan(content.indexOf("build 733"));
  });
});

describe("content-generator generateMarkdown commit body paragraphs", () => {

  function makeCommit(body: string): ConventionalCommit {
    return {
      hash: "abcdef1234567890abcdef1234567890abcdef12",
      shortHash: "abcdef1",
      date: "2026-04-05",
      type: "fix",
      scope: "example",
      subject: "example subject line",
      body,
      footer: "",
      issueReferences: [],
      breakingChange: false
    };
  }

  it("links the primary ticket in the heading and places build details before the article", () => {
    const commit = {...makeCommit("## What's new\n\n- Choose a date range on the Walks Programme."), subject: "Walk filters work reliably (ref #345, #151, #205)", issueReferences: [
      {issue: "345", action: null, raw: "ref #345"},
      {issue: "151", action: null, raw: "#151"},
      {issue: "205", action: null, raw: "#205"}
    ]};
    const data = createReleaseNotesData([commit], "1013", "owner/repo");
    data.title = commit.subject;
    data.buildUrl = "https://github.com/owner/repo/actions/runs/123";
    const markdown = generateMarkdown(data, "owner/repo");
    const heading = markdown.split("\n")[0];
    expect(heading).toEqual("# 05-Apr-2026 — Walk filters work reliably [#345](https://github.com/owner/repo/issues/345)");
    expect(heading).not.toContain("#151");
    expect(heading).not.toContain("#205");
    expect(markdown.indexOf("## [build 1013]")).toBeLessThan(markdown.indexOf("_____"));
    expect(markdown.indexOf("_____")).toBeLessThan(markdown.indexOf("## What's new"));
    expect(markdown).toContain(data.buildUrl);
    expect(markdown).toContain(data.commitUrl);
    expect(markdown).toContain("[#345](https://github.com/owner/repo/issues/345)");
    expect(data.allCommits[0].issueReferences.map(reference => reference.issue)).toEqual(["345", "151", "205"]);
  });

  it("links future release-note instructions to the reader's chosen website", () => {
    const data = createReleaseNotesData([makeCommit("## What's new\n\nOpen **Admin → Members → Member Bulk Load** or [Inbox](/admin/inbox).")], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");
    expect(markdown).toContain("[**Admin → Members → Member Bulk Load**](/admin/members/member-bulk-load \"{{siteUrl}}\")");
    expect(markdown).toContain("[Inbox](/admin/inbox \"{{siteUrl}}\")");
    const platform = createReleaseNotesData([makeCommit("## What's new\n\nOpen **Admin → Platform → Environment management → Site registrations**.")], null, "owner/repo");
    expect(generateMarkdown(platform, "owner/repo")).toContain("[**Admin → Platform → Environment management → Site registrations**](/admin/platform/environment-management/registrations \"{{siteUrl}}\")");
  });

  it("preserves paragraph breaks between sections in a commit body", () => {
    const body = [
      "First paragraph of context.",
      "",
      "Second paragraph after a blank line.",
      "",
      "Third paragraph."
    ].join("\n");

    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("First paragraph of context.\n\nSecond paragraph after a blank line.\n\nThird paragraph.");
  });

  it("preserves multiline paragraphs (soft wraps within a paragraph) as single paragraphs", () => {
    const body = [
      "A commit message body",
      "that is soft-wrapped",
      "across several lines.",
      "",
      "A second paragraph."
    ].join("\n");

    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("A commit message body\nthat is soft-wrapped\nacross several lines.\n\nA second paragraph.");
  });

  it("keeps setext-style section headings intact with surrounding blank lines", () => {
    const body = [
      "Intro paragraph.",
      "",
      "Section Heading",
      "---------------",
      "Section body text.",
      "",
      "Another Heading",
      "---------------",
      "Another section body."
    ].join("\n");

    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("Intro paragraph.\n\nSection Heading\n---------------\nSection body text.\n\nAnother Heading\n---------------\nAnother section body.");
  });

  it("collapses runs of multiple blank lines to a single paragraph separator", () => {
    const body = [
      "Paragraph one.",
      "",
      "",
      "",
      "Paragraph two."
    ].join("\n");

    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("Paragraph one.\n\nParagraph two.");
    expect(markdown).not.toContain("\n\n\n");
  });

  it("drops the redundant ### **scope**: subject heading when its subject already appears in the H1, but keeps the body", () => {
    const data = createReleaseNotesData([makeCommit("- bullet one\n- bullet two")], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).not.toContain("### **example**: example subject line");
    expect(markdown).toContain("- bullet one");
    expect(markdown).toContain("- bullet two");
    expect(markdown).toContain("example subject line");
  });

  it("keeps a bullet containing a spaced dash as one bullet rather than splitting it mid-sentence", () => {
    const body = "- Walks whose images already match are left alone - the image step is skipped entirely.";
    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("- Walks whose images already match are left alone - the image step is skipped entirely.");
    expect(markdown.split("\n")).not.toContain("- the image step is skipped entirely.");
  });

  it("omits the Technical changes section from the committee-facing note and keeps What's new", () => {
    const body = [
      "## What's new",
      "Something a committee member cares about.",
      "",
      "## Technical changes",
      "- Extract Cloudflare email-routing controllers from the route declarations",
      "- Inline shared worker template dependencies"
    ].join("\n");

    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("Something a committee member cares about.");
    expect(markdown).not.toContain("Technical changes");
    expect(markdown).not.toContain("Extract Cloudflare email-routing controllers");
  });

  it("collapses a spaced-dash divider line into a single horizontal rule rather than expanding it into many empty bullets", () => {
    const body = [
      "Code fix - some/file.ts",
      "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -",
      "first body paragraph after the divider"
    ].join("\n");

    const data = createReleaseNotesData([makeCommit(body)], null, "owner/repo");
    const markdown = generateMarkdown(data, "owner/repo");

    expect(markdown).toContain("Code fix - some/file.ts\n---\nfirst body paragraph after the divider");
    expect(markdown).not.toMatch(/(?:^|\n)- -(?:\n|$)/);
  });
});

describe("plain-text build-heading linking", () => {
  const plainHeading = "## GitHub #706 — [commit abc1234](https://github.com/owner/repo/commit/abc1234def5678901234567890123456789012ab)";

  it("extracts the run number and full commit sha from a plain-text build heading", () => {
    const ref = extractPlaintextBuildRef(`${plainHeading}\n\n_____\n\nsome body`);
    expect(ref).toEqual({ buildNumber: "706", commitSha: "abc1234def5678901234567890123456789012ab" });
  });

  it("returns null when the build heading is already a link", () => {
    const linked = "## [GitHub #706](https://github.com/owner/repo/actions/runs/123) — [commit abc1234](https://github.com/owner/repo/commit/abc1234def5678901234567890123456789012ab)";
    expect(extractPlaintextBuildRef(linked)).toBeNull();
  });

  it("returns null when no commit sha is present to resolve the run", () => {
    expect(extractPlaintextBuildRef("## GitHub #706 — build")).toBeNull();
  });

  it("rewrites a plain-text build heading into a link to the workflow run, leaving the rest untouched", () => {
    const content = `# 20-06-2026 — A title\n\n${plainHeading}\n\n_____\n\n- some change`;
    const result = linkPlaintextBuildLine(content, "https://github.com/owner/repo/actions/runs/123");
    expect(result).toContain("## [build 706](https://github.com/owner/repo/actions/runs/123) — [commit abc1234](https://github.com/owner/repo/commit/abc1234def5678901234567890123456789012ab)");
    expect(result).toContain("# 20-06-2026 — A title");
    expect(result).toContain("- some change");
  });

  it("leaves an already-linked build heading in the newer build wording unchanged", () => {
    const linked = "## [build 706](https://github.com/owner/repo/actions/runs/123) — [commit abc1234](https://github.com/owner/repo/commit/abc1234def5678901234567890123456789012ab)";
    expect(linkPlaintextBuildLine(linked, "https://github.com/owner/repo/actions/runs/999")).toEqual(linked);
    expect(extractPlaintextBuildRef(linked)).toBeNull();
  });

  it("leaves an already-linked build heading unchanged", () => {
    const linked = "## [GitHub #706](https://github.com/owner/repo/actions/runs/123) — [commit abc1234](https://github.com/owner/repo/commit/abc1234def5678901234567890123456789012ab)";
    expect(linkPlaintextBuildLine(linked, "https://github.com/owner/repo/actions/runs/999")).toEqual(linked);
  });
});

describe("content-generator preserves unassigned entries", () => {

  it("keeps existing -other links when the index is rewritten", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [26-Jun-2026 — Unassigned commits](/how-to/committee/release-notes/2026-06-26-other)",
        "- [26-Jun-2026 — #298 — an issue note](/how-to/committee/release-notes/2026-06-26-issue-298)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-06-27",
      title: "Something later",
      path: "how-to/committee/release-notes/2026-06-27",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("(/how-to/committee/release-notes/2026-06-26-other)");
    expect(content).toContain("(/how-to/committee/release-notes/2026-06-26-issue-298)");
  });

  it("treats a date page and its -other sibling as separate entries", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [23-Jun-2026 — the day's note](/how-to/committee/release-notes/2026-06-23)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-06-23",
      title: "Unassigned commits",
      path: "how-to/committee/release-notes/2026-06-23-other",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("(/how-to/committee/release-notes/2026-06-23)");
    expect(content).toContain("(/how-to/committee/release-notes/2026-06-23-other)");
  });

  it("keeps existing -other links when refreshing without adding an entry", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [26-Jun-2026 — Unassigned commits](/how-to/committee/release-notes/2026-06-26-other)"
      ].join("\n")
    );

    expect(extractContent(refreshIndexPageContent(existing)))
      .toContain("(/how-to/committee/release-notes/2026-06-26-other)");
  });
});
