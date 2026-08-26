import {
  extractLeadingTitle,
  placeForwardedIntroMarkdown,
  planTitledIntroPaste,
  shouldRunIntroSmartPaste,
  subjectStillDefault,
  subjectTextFromPaste
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

    it("decodes entities in a markdown heading so the subject is plain text", () => {
      expect(extractLeadingTitle("# Ciaran's Q&amp;A document (25 Aug)\n\nPrep notes")).toEqual({
        title: "Ciaran's Q&A document (25 Aug)",
        body: "Prep notes"
      });
    });

    it("reads a leading HTML H1 as the title", () => {
      expect(extractLeadingTitle(
        "Ciaran's Q&A document (25 Aug)\n\nPrep notes",
        "<h1>Ciaran's Q&amp;A document (25 Aug)</h1><p>Prep notes</p>"
      )).toEqual({
        title: "Ciaran's Q&A document (25 Aug)",
        body: "Prep notes"
      });
    });

    it("uses a unique H2 as the title when every heading below it is H3 or deeper", () => {
      const markdown = [
        "## Ciaran's Q&A document (25 Aug) and meeting prep for Wednesday 26th",
        "",
        "### Background",
        "",
        "Notes on the call.",
        "",
        "### Agenda",
        "",
        "Walk through the document."
      ].join("\n");
      expect(extractLeadingTitle(markdown)).toEqual({
        title: "Ciaran's Q&A document (25 Aug) and meeting prep for Wednesday 26th",
        body: [
          "### Background",
          "",
          "Notes on the call.",
          "",
          "### Agenda",
          "",
          "Walk through the document."
        ].join("\n")
      });
    });

    it("does not pick a title when several headings share the top level", () => {
      expect(extractLeadingTitle("## One\n\n## Two\n\n### Detail")).toBeNull();
    });

    it("ignores a heading that only appears inside a code fence", () => {
      expect(extractLeadingTitle("```\n## Not a title\n```\n\nBody")).toBeNull();
    });

    it("keeps a unique H2 in the body when it is not the first content", () => {
      const markdown = "A short intro.\n\n## Meeting prep\n\n### Agenda\n\nItem one.";
      expect(extractLeadingTitle(markdown)).toEqual({
        title: "Meeting prep",
        body: markdown
      });
    });

    it("uses a unique HTML H2 when the rest of the headings are H3", () => {
      expect(extractLeadingTitle(
        "Meeting prep\n\nAgenda\n\nItem one.",
        "<h2>Meeting prep</h2><h3>Agenda</h3><p>Item one.</p>"
      )).toEqual({
        title: "Meeting prep",
        body: "Agenda\n\nItem one."
      });
    });
  });

  describe("subjectTextFromPaste", () => {
    it("strips markdown heading markers and decoded entities from a subject paste", () => {
      expect(subjectTextFromPaste("# Ciaran's Q&amp;A document (25 Aug) and meeting prep for Wednesday 26th"))
        .toBe("Ciaran's Q&A document (25 Aug) and meeting prep for Wednesday 26th");
    });

    it("uses an HTML heading when the clipboard has rich text", () => {
      expect(subjectTextFromPaste(
        "Ciaran's Q&A document (25 Aug)",
        "<h1>Ciaran's Q&amp;A document (25 Aug)</h1>"
      )).toBe("Ciaran's Q&A document (25 Aug)");
    });

    it("leaves ordinary subject text unchanged", () => {
      expect(subjectTextFromPaste("Walk details for Saturday")).toBe("Walk details for Saturday");
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

  describe("subjectStillDefault", () => {
    it("is true when the subject is empty or still the configuration default", () => {
      expect(subjectStillDefault("", "Newsletter")).toBe(true);
      expect(subjectStillDefault("   ", "Newsletter")).toBe(true);
      expect(subjectStillDefault("Newsletter", "Newsletter")).toBe(true);
      expect(subjectStillDefault(" Newsletter ", "Newsletter")).toBe(true);
    });

    it("is false when the subject has been personalised", () => {
      expect(subjectStillDefault("Re: Walk details", "Newsletter")).toBe(false);
    });
  });

  describe("planTitledIntroPaste", () => {
    const titled = { title: "Background", body: "Full doc body" };

    it("sets the subject and body when the subject is empty", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "", "Newsletter", false)).toEqual({
        apply: true,
        subject: "Background",
        body: "Full doc body"
      });
    });

    it("overwrites a subject that is still the default for the selected email configuration", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "Newsletter", "Newsletter", false)).toEqual({
        apply: true,
        subject: "Background",
        body: "Full doc body"
      });
    });

    it("keeps a personalised subject and leaves the heading in the body", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "Re: Walk details", "Newsletter", false)).toEqual({
        apply: true,
        subject: null,
        body: "## Background\n\nFull doc body"
      });
    });

    it("does not replace when the editor already has content", () => {
      expect(planTitledIntroPaste("## Background\n\nFull doc body", titled, "Re: Walk details", "Newsletter", true)).toEqual({
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
