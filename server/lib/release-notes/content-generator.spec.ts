import expect from "expect";
import { describe, it } from "mocha";
import { updateIndexPageContent } from "./content-generator";
import {
  PageContent,
  PageContentType
} from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

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
