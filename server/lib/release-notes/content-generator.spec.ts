import expect from "expect";
import { describe, it } from "mocha";
import { createReleaseNotesData, generateMarkdown, refreshIndexPageContent, updateIndexPageContent } from "./content-generator";
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

describe("content-generator updateIndexPageContent", () => {

  it("preserves existing 📸 camera markers when adding a new entry", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "Welcome to the release notes page.",
        "",
        "- [01-Apr-2026 — Earlier release](how-to/committee/release-notes/2026-04-01) 📸",
        "- [31-Mar-2026 — Older release](how-to/committee/release-notes/2026-03-31)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "New release note",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("- [01-Apr-2026 — Earlier release](how-to/committee/release-notes/2026-04-01) 📸");
    expect(content).toContain("- [31-Mar-2026 — Older release](how-to/committee/release-notes/2026-03-31)");
    expect(content).toContain("- [04-Apr-2026 — New release note](how-to/committee/release-notes/2026-04-04)");
  });

  it("does not strip 📸 from entries that already exist when re-adding the same path", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [04-Apr-2026 — Existing entry](how-to/committee/release-notes/2026-04-04) 📸"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "Existing entry",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("- [04-Apr-2026 — Existing entry](how-to/committee/release-notes/2026-04-04) 📸");
  });

  it("adds new entries without a 📸 marker by default", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [31-Mar-2026 — Older](how-to/committee/release-notes/2026-03-31)"
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
        "- [08-Jan-2026 — Early 2026](how-to/committee/release-notes/2026-01-08)",
        "- [20-Dec-2025 — Late 2025](how-to/committee/release-notes/2025-12-20)",
        "- [07-May-2025 — Mid 2025](how-to/committee/release-notes/2025-05-07) 📸",
        "- [19-Dec-2024 — Late 2024](how-to/committee/release-notes/2024-12-19) 📸"
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
    expect(content).not.toContain("](/how-to/committee/release-notes/");
    expect(content).toContain("(how-to/committee/release-notes/2025-05-07) 📸");
  });

  it("refreshIndexPageContent applies year headings without merging a new entry", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [08-Jan-2026 — 2026 entry](how-to/committee/release-notes/2026-01-08)",
        "- [19-Dec-2024 — 2024 entry](/how-to/committee/release-notes/2024-12-19) 📸"
      ].join("\n")
    );

    const refreshed = refreshIndexPageContent(existing);
    const content = extractContent(refreshed);
    expect(content).toContain("## 2026\n\n- [08-Jan-2026");
    expect(content).toContain("## 2024\n\n- [19-Dec-2024");
    expect(content).toContain("(how-to/committee/release-notes/2024-12-19) 📸");
    expect(content).not.toContain("](/how-to/committee/release-notes/");
  });

  it("preserves 📸 across many entries when inserting in the middle", () => {
    const existing = makeIndexPage(
      [
        "# Release Notes",
        "",
        "- [05-Apr-2026 — A](how-to/committee/release-notes/2026-04-05) 📸",
        "- [03-Apr-2026 — B](how-to/committee/release-notes/2026-04-03) 📸",
        "- [01-Apr-2026 — C](how-to/committee/release-notes/2026-04-01)"
      ].join("\n")
    );

    const updated = updateIndexPageContent(existing, {
      date: "2026-04-04",
      title: "Inserted",
      path: "how-to/committee/release-notes/2026-04-04",
      issueNumber: null
    });

    const content = extractContent(updated);
    expect(content).toContain("- [05-Apr-2026 — A](how-to/committee/release-notes/2026-04-05) 📸");
    expect(content).toContain("- [03-Apr-2026 — B](how-to/committee/release-notes/2026-04-03) 📸");
    expect(content).toContain("- [01-Apr-2026 — C](how-to/committee/release-notes/2026-04-01)");
    expect(content).toContain("- [04-Apr-2026 — Inserted](how-to/committee/release-notes/2026-04-04)");
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
});
