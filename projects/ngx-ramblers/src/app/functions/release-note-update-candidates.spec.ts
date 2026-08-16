import { DateTime } from "luxon";
import { ReleaseNoteUpdateCandidate } from "../models/ai.model";
import {
  hasWhatsNewHeading,
  isCuratedReleaseNote,
  isIssueReleaseNote,
  isUnassignedCommitDump,
  lastPathSegment,
  releaseNoteDateFromPath,
  releaseNoteInWindow,
  selectReleaseNoteUpdateCandidates
} from "./release-note-update-candidates";

const day = (iso: string) => DateTime.fromISO(iso).startOf("day").toMillis();

function candidate(path: string, title = path): ReleaseNoteUpdateCandidate {
  return {
    title,
    path,
    url: `https://example.test/${path}`,
    dateMillis: releaseNoteDateFromPath(path),
    excerpt: title
  };
}

describe("release-note-update-candidates", () => {

  describe("lastPathSegment", () => {
    it("returns the final slug", () => {
      expect(lastPathSegment("how-to/committee/release-notes/2026-07-26-issue-312")).toBe("2026-07-26-issue-312");
    });
  });

  describe("releaseNoteDateFromPath", () => {
    it("reads the dated slug", () => {
      expect(releaseNoteDateFromPath("how-to/committee/release-notes/2026-07-26-issue-312"))
        .toBe(day("2026-07-26"));
    });

    it("returns null when the slug is not dated", () => {
      expect(releaseNoteDateFromPath("how-to/committee/release-notes/index")).toBeNull();
    });
  });

  describe("releaseNoteInWindow", () => {
    it("includes a note on the first and last day", () => {
      expect(releaseNoteInWindow(day("2026-08-01"), day("2026-08-01"), DateTime.fromISO("2026-08-16").endOf("day").toMillis())).toBe(true);
      expect(releaseNoteInWindow(day("2026-08-16"), day("2026-08-01"), DateTime.fromISO("2026-08-16").endOf("day").toMillis())).toBe(true);
    });

    it("excludes a note outside the window or without a date", () => {
      expect(releaseNoteInWindow(day("2026-07-31"), day("2026-08-01"), DateTime.fromISO("2026-08-16").endOf("day").toMillis())).toBe(false);
      expect(releaseNoteInWindow(null, day("2026-08-01"), DateTime.fromISO("2026-08-16").endOf("day").toMillis())).toBe(false);
    });
  });

  describe("selectReleaseNoteUpdateCandidates", () => {
    const notes = [
      candidate("how-to/committee/release-notes/2026-07-20-old"),
      candidate("how-to/committee/release-notes/2026-08-04-walks"),
      candidate("how-to/committee/release-notes/2026-08-10-inbox"),
      candidate("how-to/committee/release-notes/undated")
    ];
    const from = day("2026-08-01");
    const to = DateTime.fromISO("2026-08-16").endOf("day").toMillis();

    it("keeps dated notes inside the window", () => {
      expect(selectReleaseNoteUpdateCandidates(notes, from, to, []).map(item => item.path)).toEqual([
        "how-to/committee/release-notes/2026-08-04-walks",
        "how-to/committee/release-notes/2026-08-10-inbox"
      ]);
    });

    it("drops notes the previous digest already included", () => {
      expect(selectReleaseNoteUpdateCandidates(notes, from, to, ["how-to/committee/release-notes/2026-08-04-walks"]).map(item => item.path))
        .toEqual(["how-to/committee/release-notes/2026-08-10-inbox"]);
    });

    it("returns nothing when the window is empty", () => {
      expect(selectReleaseNoteUpdateCandidates(notes, day("2026-08-17"), DateTime.fromISO("2026-08-31").endOf("day").toMillis(), [])).toEqual([]);
    });
  });

  describe("isCuratedReleaseNote", () => {
    it("drops unassigned commit dumps", () => {
      expect(isUnassignedCommitDump("how-to/committee/release-notes/2026-08-13-other")).toBe(true);
      expect(isCuratedReleaseNote("how-to/committee/release-notes/2026-08-13-other", "## What's new\nShipped.", false)).toBe(false);
    });

    it("keeps issue notes and notes with a What's new heading", () => {
      expect(isIssueReleaseNote("how-to/committee/release-notes/2026-08-07-issue-348")).toBe(true);
      expect(hasWhatsNewHeading("Intro\n## What's new\nMembers can follow a walk.")).toBe(true);
      expect(isCuratedReleaseNote("how-to/committee/release-notes/2026-08-07-issue-348", "", false)).toBe(true);
      expect(isCuratedReleaseNote("how-to/committee/release-notes/2026-08-14", "## What's new\nShare a walk.", false)).toBe(true);
    });

    it("keeps a screenshot write-up even without an issue slug", () => {
      expect(isCuratedReleaseNote("how-to/committee/release-notes/2026-08-05", "Mail reports.", true)).toBe(true);
    });

    it("drops a commit-only page", () => {
      expect(isCuratedReleaseNote("how-to/committee/release-notes/2026-08-13", "test(emoji-textarea): remove the environment-dependent shortcode-listbox test", false)).toBe(false);
    });
  });
});
