import { normaliseMarkdownText } from "./markdown";

describe("markdown", () => {

  describe("normaliseMarkdownText", () => {
    it("converts html containing literal markdown links into markdown with working links", () => {
      expect(normaliseMarkdownText("<p>Nick continues his shameless pillaging of the [Elham Valley Walks Series - Walk 4](https://elhamvalleywalkers.co.uk)!</p>"))
        .toBe("Nick continues his shameless pillaging of the [Elham Valley Walks Series - Walk 4](https://elhamvalleywalkers.co.uk)!");
    });

    it("converts html anchors to markdown links", () => {
      expect(normaliseMarkdownText("<p>We meet at the <a href=\"https://thekingsarmselham.com/\">Kings Arms</a></p>"))
        .toBe("We meet at the [Kings Arms](https://thekingsarmselham.com/)");
    });

    it("unescapes previously escaped markdown links in plain text", () => {
      expect(normaliseMarkdownText("meet at the \\[Kings Arms\\](https://thekingsarmselham.com/), parking available"))
        .toBe("meet at the [Kings Arms](https://thekingsarmselham.com/), parking available");
    });

    it("leaves clean markdown unchanged", () => {
      expect(normaliseMarkdownText("A walk via [Denton](https://example.com) and back"))
        .toBe("A walk via [Denton](https://example.com) and back");
    });

    it("returns null for empty values and passes through non-strings", () => {
      expect(normaliseMarkdownText("   ")).toBe(null);
      expect(normaliseMarkdownText(null)).toBe(null);
      expect(normaliseMarkdownText(undefined as unknown as string)).toBe(undefined);
    });
  });
});
