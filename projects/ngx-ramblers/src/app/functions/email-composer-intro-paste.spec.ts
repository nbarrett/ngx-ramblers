import {
  extractLeadingTitle,
  placeForwardedIntroMarkdown,
  planTitledIntroPaste,
  shouldRunIntroSmartPaste
} from "./email-composer-intro-paste";

describe("email-composer-intro-paste", () => {
  describe("extractLeadingTitle", () => {
    it("reads a leading H1 or H2 as the title", () => {
      expect(extractLeadingTitle("## Background\n\nBody text")).toEqual({
        title: "Background",
        body: "Body text"
      });
      expect(extractLeadingTitle("# Hello\n\nWorld")).toEqual({
        title: "Hello",
        body: "World"
      });
    });

    it("ignores deeper headings and plain text", () => {
      expect(extractLeadingTitle("### Not a title\n\nBody")).toBeNull();
      expect(extractLeadingTitle("To: someone@example.com\n\nHi")).toBeNull();
    });
  });

  describe("shouldRunIntroSmartPaste", () => {
    it("only runs for unbranded non-reply compositions", () => {
      expect(shouldRunIntroSmartPaste(true, false)).toBe(true);
      expect(shouldRunIntroSmartPaste(true, true)).toBe(false);
      expect(shouldRunIntroSmartPaste(false, false)).toBe(false);
      expect(shouldRunIntroSmartPaste(false, true)).toBe(false);
    });
  });

  describe("planTitledIntroPaste", () => {
    const titled = { title: "Background", body: "Full doc body" };

    it("replaces an empty body and sets the subject when the subject is empty", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "", false)).toEqual({
        apply: true,
        subject: "Background",
        body: "Full doc body"
      });
    });

    it("keeps an existing subject and leaves the heading in the body", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "Re: Walk details", false)).toEqual({
        apply: true,
        subject: null,
        body: "## Background\n\nFull doc body"
      });
    });

    it("does not replace when the editor already has content", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "Re: Walk details", true)).toEqual({
        apply: false
      });
    });
  });

  describe("placeForwardedIntroMarkdown", () => {
    const forwarded = "\n\n---\n\nTo: a@b.com\n\n---\n\nHi there";
    const quote = "\n\nOn Fri, Tom wrote:\n> Hello";

    it("uses the forwarded block alone when the intro is empty", () => {
      expect(placeForwardedIntroMarkdown("", forwarded, false)).toBe(forwarded);
      expect(placeForwardedIntroMarkdown("   ", forwarded, true)).toBe(forwarded);
    });

    it("appends below existing draft content by default", () => {
      expect(placeForwardedIntroMarkdown("My draft", forwarded, false)).toBe(`My draft${forwarded}`);
    });

    it("places the paste above an existing quote when preferred", () => {
      expect(placeForwardedIntroMarkdown(quote, forwarded, true)).toBe(`${forwarded}${quote}`);
    });
  });
});
