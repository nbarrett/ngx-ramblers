import expect from "expect";
import { describe, it } from "mocha";
import { documentFileName, googleDocumentId, isDocumentUrl, withDocumentHeadings, withoutGoogleRedirects } from "./registration-documents";

describe("registration documents", () => {
  it("recognises the document links a group puts on its Ramblers page", () => {
    expect(googleDocumentId("https://docs.google.com/document/d/1GlHoDy94/edit?usp=sharing")).toBe("1GlHoDy94");
    expect(isDocumentUrl("https://docs.google.com/document/d/1GlHoDy94/edit")).toBe(true);
    expect(isDocumentUrl("https://group.example/newsletter.pdf")).toBe(true);
    expect(isDocumentUrl("https://group.example/minutes.docx?raw=1")).toBe(true);
    expect(isDocumentUrl("https://group.example/about-us")).toBe(false);
    expect(documentFileName("https://group.example/files/newsletter.pdf?v=2")).toBe("newsletter.pdf");
  });

  it("unwraps the redirect Google puts around links when a document is exported", () => {
    expect(withoutGoogleRedirects("see [our site](https://www.google.com/url?q=http://group.example/walks&sa=D&usg=AOv)"))
      .toBe("see [our site](http://group.example/walks)");
  });

  it("turns the questions in a flat document into headings", () => {
    const markdown = withDocumentHeadings("Our Frequently Asked Questions\n\nHow do I join?\n\nVisit the Ramblers website and choose our group.\n\n## Already a heading");
    expect(markdown).toBe("## Our Frequently Asked Questions\n\n#### How do I join?\n\nVisit the Ramblers website and choose our group.\n\n## Already a heading");
  });
});
