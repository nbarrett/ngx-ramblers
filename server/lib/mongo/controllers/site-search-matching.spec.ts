import expect from "expect";
import { describe, it } from "mocha";
import { excerptAround, matches, termOverlap } from "./site-search-matching";

describe("site-search-matching", () => {

  describe("matches", () => {
    it("matches a single term as a substring", () => {
      expect(matches("Solar Arrays in Kent", "solar")).toBe(true);
      expect(matches("Footpath maps", "solar")).toBe(false);
    });

    it("any-words matches when only one of several terms is present", () => {
      expect(matches("Solar energy developments", "solar array")).toBe(true);
      expect(matches("Array of footpaths", "solar array")).toBe(true);
      expect(matches("Coastal access route", "solar array")).toBe(false);
    });

    it("matches the contiguous phrase even without quotes", () => {
      expect(matches("a solar array on the hill", "solar array")).toBe(true);
    });

    it("exact phrase requires the words to be adjacent", () => {
      expect(matches("a solar array on the hill", "\"solar array\"")).toBe(true);
      expect(matches("solar panels and a wind array", "\"solar array\"")).toBe(false);
    });

    it("is case-insensitive", () => {
      expect(matches("NORTH DOWNS WAY", "downs")).toBe(true);
    });

    it("handles empty text and empty query safely", () => {
      expect(matches("", "solar")).toBe(false);
      expect(matches(null as unknown as string, "solar")).toBe(false);
    });
  });

  describe("termOverlap", () => {
    it("counts how many distinct query terms appear", () => {
      expect(termOverlap("solar array in kent", "solar array")).toBe(2);
      expect(termOverlap("solar energy", "solar array")).toBe(1);
      expect(termOverlap("coastal access", "solar array")).toBe(0);
    });

    it("returns 1 for a present exact phrase, 0 otherwise", () => {
      expect(termOverlap("a solar array here", "\"solar array\"")).toBe(1);
      expect(termOverlap("solar and array apart", "\"solar array\"")).toBe(0);
    });
  });

  describe("excerptAround", () => {
    it("windows the text around the first match with ellipses on both sides", () => {
      const text = `${"word ".repeat(20)}solar ${"word ".repeat(40)}`;
      const excerpt = excerptAround(text, "solar");
      expect(excerpt).toContain("solar");
      expect(excerpt.startsWith("…")).toBe(true);
      expect(excerpt.endsWith("…")).toBe(true);
    });

    it("falls back to the head of the text when the query is absent", () => {
      expect(excerptAround("Short description", "missing")).toBe("Short description");
    });

    it("strips markdown table pipes and delimiter rows", () => {
      const table = "| Role | Officer | |------|---------| | Chairman | Colin Sefton |";
      expect(excerptAround(table, "chairman")).not.toContain("|");
      expect(excerptAround(table, "chairman")).not.toContain("---");
    });

    it("preserves single hyphens and em dashes in content", () => {
      const text = "Kent Area Officers 2023-24 - Chairman Colin Sefton — 07305 956109";
      const excerpt = excerptAround(text, "chairman");
      expect(excerpt).toContain("2023-24");
      expect(excerpt).toContain("—");
    });
  });
});
