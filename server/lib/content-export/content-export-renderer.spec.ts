import expect from "expect";
import { describe, it } from "mocha";
import { absolutiseMarkdownLinks, descriptionFromMarkdown, normalisePath, publicMarkdownFromRows, titleFromPath } from "./content-export-renderer";
import { PageContentRow } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { AccessLevel } from "../../../projects/ngx-ramblers/src/app/models/member-resource.model";

describe("content-export-renderer", () => {

  describe("publicMarkdownFromRows", () => {
    it("includes public column titles as headings followed by content", () => {
      const rows = [{columns: [{title: "Welcome", contentText: "Hello walkers"}]}] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("## Welcome\n\nHello walkers");
    });

    it("excludes columns restricted to logged-in members or committee", () => {
      const rows = [{
        columns: [
          {contentText: "Public text", accessLevel: AccessLevel.PUBLIC},
          {contentText: "Members only", accessLevel: AccessLevel.LOGGED_IN_MEMBER},
          {contentText: "Committee only", accessLevel: AccessLevel.COMMITTEE}
        ]
      }] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("Public text");
    });

    it("treats columns without an access level as public", () => {
      const rows = [{columns: [{contentText: "Unmarked text"}]}] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("Unmarked text");
    });

    it("recurses into nested rows within columns", () => {
      const rows = [{
        columns: [{
          contentText: "Outer",
          rows: [{columns: [{contentText: "Inner"}]}]
        }]
      }] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("Outer\n\nInner");
    });

    it("returns empty string for missing or empty rows", () => {
      expect(publicMarkdownFromRows(null)).toBe("");
      expect(publicMarkdownFromRows([])).toBe("");
      expect(publicMarkdownFromRows([{columns: []}] as PageContentRow[])).toBe("");
    });

    it("includes column images as markdown images after the text by default", () => {
      const rows = [{columns: [{contentText: "Our committee", imageSource: "site-content/committee.jpg", alt: "The committee"}]}] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("Our committee\n\n![The committee](/api/aws/s3/site-content/committee.jpg)");
    });

    it("places the image before the text when showTextAfterImage is set", () => {
      const rows = [{columns: [{contentText: "Caption text", imageSource: "site-content/photo.jpg", showTextAfterImage: true}]}] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("![](/api/aws/s3/site-content/photo.jpg)\n\nCaption text");
    });

    it("leaves remote image addresses unchanged and skips inline base64 images", () => {
      const rows = [{
        columns: [
          {contentText: "Remote", imageSource: "https://example.com/image.jpg"},
          {contentText: "Inline", imageSource: "data:image/png;base64,abc123"}
        ]
      }] as PageContentRow[];
      expect(publicMarkdownFromRows(rows)).toBe("Remote\n\n![](https://example.com/image.jpg)\n\nInline");
    });
  });

  describe("descriptionFromMarkdown", () => {
    it("strips markdown formatting to plain text", () => {
      expect(descriptionFromMarkdown("# Heading\n\nSome **bold** text")).toBe("Heading Some bold text");
    });

    it("truncates long content at a word boundary with an ellipsis", () => {
      const longText = Array.from({length: 60}, (item, index) => `word${index}`).join(" ");
      const description = descriptionFromMarkdown(longText);
      expect(description.length).toBeLessThanOrEqual(161);
      expect(description.endsWith("…")).toBe(true);
      expect(description).not.toContain("  ");
    });

    it("returns short content unchanged", () => {
      expect(descriptionFromMarkdown("A short walk description")).toBe("A short walk description");
    });
  });

  describe("absolutiseMarkdownLinks", () => {
    it("makes root-relative links and images absolute against the base address", () => {
      const markdown = "See the [walks programme](/walks) and ![photo](/api/aws/s3/site-content/photo.jpg)";
      expect(absolutiseMarkdownLinks(markdown, "https://www.example.org.uk"))
        .toBe("See the [walks programme](https://www.example.org.uk/walks) and ![photo](https://www.example.org.uk/api/aws/s3/site-content/photo.jpg)");
    });

    it("makes bare relative targets absolute", () => {
      expect(absolutiseMarkdownLinks("[join](join-us)", "https://www.example.org.uk"))
        .toBe("[join](https://www.example.org.uk/join-us)");
    });

    it("leaves external, mailto, tel, anchor and data targets unchanged", () => {
      const markdown = "[a](https://elsewhere.org) [b](mailto:x@y.z) [c](tel:0123) [d](#section) ![e](data:image/png;base64,abc)";
      expect(absolutiseMarkdownLinks(markdown, "https://www.example.org.uk")).toBe(markdown);
    });

    it("returns markdown unchanged when no base address is configured", () => {
      expect(absolutiseMarkdownLinks("[walks](/walks)", null)).toBe("[walks](/walks)");
    });
  });

  describe("titleFromPath", () => {
    it("derives a title from the last path segment", () => {
      expect(titleFromPath("how-to/committee/release-notes")).toBe("Release Notes");
    });

    it("handles single-segment paths", () => {
      expect(titleFromPath("contact-us")).toBe("Contact Us");
    });
  });

  describe("normalisePath", () => {
    it("strips leading and trailing slashes", () => {
      expect(normalisePath("/contact-us/")).toBe("contact-us");
    });

    it("decodes url-encoded characters", () => {
      expect(normalisePath("/how-to/walk%20leaders")).toBe("how-to/walk leaders");
    });

    it("returns empty string for null or root path", () => {
      expect(normalisePath(null)).toBe("");
      expect(normalisePath("/")).toBe("");
    });
  });
});
