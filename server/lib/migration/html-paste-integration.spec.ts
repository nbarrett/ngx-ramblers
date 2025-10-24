import expect from "expect";
import { describe, it } from "mocha";
import { buildMarkdownPastePreview, buildHtmlPastePreview } from "./html-paste-preview";
import { htmlToMarkdown } from "./turndown-service-factory";
import { HtmlPastePreview, HtmlPasteRow } from "../../../projects/ngx-ramblers/src/app/models/html-paste.model";

describe("HTML Paste Integration", () => {
  describe("buildMarkdownPastePreview", () => {
    it("should handle empty markdown", () => {
      const preview = buildMarkdownPastePreview("");
      expect(preview.markdown).toBe("");
      expect(preview.rows).toEqual([]);
    });


    it("should handle plain text without images", () => {
      const markdown = "This is plain text content.";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.markdown).toBe(markdown);
      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0]).toEqual({ text: "This is plain text content." });
    });

    it("should handle single image without text", () => {
      const markdown = "![Photo](https://example.com/photo.jpg)";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0]).toEqual({
        imageSource: "https://example.com/photo.jpg",
        alt: "Photo"
      });
    });

    it("should group short caption with preceding image", () => {
      const markdown = "![Photo](photo.jpg)\n\nShort caption";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0]).toEqual({
        imageSource: "photo.jpg",
        alt: "Photo",
        text: "Short caption"
      });
    });

    it("should group short caption appearing before image", () => {
      const markdown = "Short caption here\n\n![Photo](photo.jpg)";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0]).toEqual({
        text: "Short caption here",
        imageSource: "photo.jpg",
        alt: "Photo"
      });
    });

    it("should NOT group long paragraph with image (exceeds 200 chars)", () => {
      const longText = "This is a very long paragraph that exceeds the 200 character threshold for being considered a caption. " +
        "It has multiple sentences and should be treated as standalone content rather than being grouped with any nearby images. " +
        "This ensures proper content structure.";
      const markdown = `![Photo](photo.jpg)\n\n${longText}`;
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(2);
      expect(preview.rows[0]).toEqual({
        imageSource: "photo.jpg",
        alt: "Photo"
      });
      expect(preview.rows[1]).toEqual({
        text: longText
      });
    });

    it("should NOT group multi-paragraph text with image", () => {
      const markdown = "![Photo](photo.jpg)\n\nFirst paragraph.\n\nSecond paragraph.";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(2);
      expect(preview.rows[0]).toEqual({
        imageSource: "photo.jpg",
        alt: "Photo"
      });
      expect(preview.rows[1]).toEqual({
        text: "First paragraph.\n\nSecond paragraph."
      });
    });

    it("should handle multiple images with captions (Eden Valley style)", () => {
      const markdown = `Eden Valley Walk

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/evw_banner.jpg)

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/hever01.jpg)

Hever Castle

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/penshurst01.jpg)

Penshurst`;

      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(4);

      expect(preview.rows[0]).toEqual({
        text: "Eden Valley Walk",
        imageSource: "https://www.kentramblers.org.uk/KentWalks/EdenVW/images/evw_banner.jpg",
        alt: "Image"
      });

      expect(preview.rows[1]).toEqual({
        imageSource: "https://www.kentramblers.org.uk/KentWalks/EdenVW/images/hever01.jpg",
        alt: "Image"
      });

      expect(preview.rows[2]).toEqual({
        text: "Hever Castle",
        imageSource: "https://www.kentramblers.org.uk/KentWalks/EdenVW/images/penshurst01.jpg",
        alt: "Image"
      });

      expect(preview.rows[3]).toEqual({
        text: "Penshurst"
      });
    });

    it("should handle real-world Eden Valley Walk with 6 images", () => {
      const markdown = `Eden Valley Walk

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/evw_banner.jpg)

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/hever01.jpg)

Hever Castle

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/penshurst01.jpg)

Penshurst

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/penshurst02.jpg)

Penshurst

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/penshurst03.jpg)

Penshurst Place

## Eden Valley Walk

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/route.jpg)

This 16 mile walk from Cernes Farm, a few miles south west of Edenbridge, to Tonbridge Castle was opened on 23 March 1991 by Lord de L'Isle of Penshurst.

There is a full description of the route with 1:25,000 maps and information about points of interest in our guide to Three River Valley Walks in West Kent, available now from our [books page](../../Books/index.htm).`;

      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBeGreaterThan(0);

      const imageRows = preview.rows.filter(row => row.imageSource);
      expect(imageRows.length).toBe(6);

      expect(preview.rows[0].text).toContain("Eden Valley Walk");
      expect(preview.rows[0].imageSource).toContain("evw_banner.jpg");

      const heverRow = preview.rows.find(row => row.imageSource?.includes("hever01.jpg"));
      expect(heverRow).toBeDefined();

      const penshurstRows = preview.rows.filter(row =>
        row.imageSource?.includes("penshurst") && row.text?.includes("Penshurst")
      );
      expect(penshurstRows.length).toBeGreaterThan(0);

      const hasLongParagraph = preview.rows.some(row =>
        row.text && row.text.includes("16 mile walk") && !row.imageSource
      );
      expect(hasLongParagraph).toBe(true);
    });

    it("should handle consecutive images without text between them", () => {
      const markdown = `![First](image1.jpg)

![Second](image2.jpg)

![Third](image3.jpg)`;

      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(3);
      expect(preview.rows[0]).toEqual({ imageSource: "image1.jpg", alt: "First" });
      expect(preview.rows[1]).toEqual({ imageSource: "image2.jpg", alt: "Second" });
      expect(preview.rows[2]).toEqual({ imageSource: "image3.jpg", alt: "Third" });
    });

    it("should preserve alt text from markdown images", () => {
      const markdown = "![Hever Castle gardens in spring](hever.jpg)";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0].alt).toBe("Hever Castle gardens in spring");
      expect(preview.rows[0].imageSource).toBe("hever.jpg");
    });

    it("should handle markdown images with empty alt text", () => {
      const markdown = "![](photo.jpg)";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0].imageSource).toBe("photo.jpg");
      expect(preview.rows[0].alt).toBeNull();
    });

    it("should handle text before and after image section", () => {
      const markdown = `Introduction text here.

![Photo](photo.jpg)

Photo caption

Conclusion text here.`;

      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(2);
      expect(preview.rows[0]).toEqual({
        text: "Introduction text here.",
        imageSource: "photo.jpg",
        alt: "Photo"
      });
      expect(preview.rows[1]).toEqual({
        text: "Photo caption\n\nConclusion text here."
      });
    });

    it("should handle whitespace-only text between images", () => {
      const markdown = `![First](img1.jpg)



![Second](img2.jpg)`;

      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(2);
      expect(preview.rows[0]).toEqual({ imageSource: "img1.jpg", alt: "First" });
      expect(preview.rows[1]).toEqual({ imageSource: "img2.jpg", alt: "Second" });
    });
  });

  describe("buildHtmlPastePreview", () => {
    it("should convert HTML to markdown and split into rows", () => {
      const html = `
        <h1>Title</h1>
        <p>First paragraph</p>
        <img src="photo.jpg" alt="Photo">
        <p>Caption text</p>
      `;

      const preview = buildHtmlPastePreview(html);

      expect(preview.markdown).toBeTruthy();
      expect(preview.rows.length).toBeGreaterThan(0);
    });

    it("should resolve relative URLs with base URL", () => {
      const html = '<img src="images/photo.jpg" alt="Photo">';
      const baseUrl = "https://example.com/walks/walk-1/";

      const preview = buildHtmlPastePreview(html, baseUrl);

      expect(preview.markdown).toContain("https://example.com/walks/walk-1/images/photo.jpg");

      const imageRow = preview.rows.find(row => row.imageSource);
      expect(imageRow).toBeDefined();
      expect(imageRow?.imageSource).toBe("https://example.com/walks/walk-1/images/photo.jpg");
    });

    it("should handle HTML with paragraphs and images", () => {
      const html = `
        <h2>Walk Description</h2>
        <p>Introduction paragraph with details.</p>
        <img src="banner.jpg" alt="Banner">
        <p>Short caption</p>
        <img src="map.jpg" alt="Map">
      `;

      const preview = buildHtmlPastePreview(html);

      expect(preview.rows.length).toBeGreaterThan(0);

      const imageRows = preview.rows.filter(row => row.imageSource);
      expect(imageRows.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle complex HTML with nested structures", () => {
      const html = `
        <div>
          <h1>Title</h1>
          <div>
            <p>Nested paragraph</p>
            <img src="photo.jpg" alt="Photo">
          </div>
        </div>
      `;

      const preview = buildHtmlPastePreview(html);

      expect(preview.rows.length).toBeGreaterThan(0);
      expect(preview.markdown).toContain("Title");
      expect(preview.markdown).toContain("Nested paragraph");
    });
  });

  describe("PageContent row creation semantics", () => {
    it("should produce rows compatible with PageContentRow structure", () => {
      const markdown = `![Photo](photo.jpg)

Caption text`;

      const preview = buildMarkdownPastePreview(markdown);
      const row = preview.rows[0];

      expect(row).toHaveProperty("imageSource");
      expect(row).toHaveProperty("text");
      expect(row).toHaveProperty("alt");

      expect(typeof row.imageSource).toBe("string");
      expect(typeof row.text).toBe("string");
    });

    it("should allow optional fields to be null or undefined", () => {
      const markdown = "Plain text only";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows[0].text).toBe("Plain text only");
      expect(preview.rows[0].imageSource).toBeUndefined();
      expect(preview.rows[0].alt).toBeUndefined();
    });

    it("should handle the exact Eden Valley structure for UI consumption", () => {
      const markdown = `Eden Valley Walk

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/evw_banner.jpg)

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/hever01.jpg)

Hever Castle`;

      const preview = buildMarkdownPastePreview(markdown);

      const firstRow = preview.rows[0];
      expect(firstRow.text).toBe("Eden Valley Walk");
      expect(firstRow.imageSource).toBe("https://www.kentramblers.org.uk/KentWalks/EdenVW/images/evw_banner.jpg");

      const heverRow = preview.rows[1];
      expect(heverRow.imageSource).toBe("https://www.kentramblers.org.uk/KentWalks/EdenVW/images/hever01.jpg");
      expect(heverRow.text).toBe("Hever Castle");
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle caption exactly at 200 character threshold", () => {
      const caption199 = "a".repeat(199);
      const caption200 = "a".repeat(200);
      const caption201 = "a".repeat(201);

      const preview199 = buildMarkdownPastePreview(`![Photo](photo.jpg)\n\n${caption199}`);
      expect(preview199.rows.length).toBe(1);
      expect(preview199.rows[0].text).toBe(caption199);

      const preview201 = buildMarkdownPastePreview(`![Photo](photo.jpg)\n\n${caption201}`);
      expect(preview201.rows.length).toBe(2);
    });

    it("should handle markdown with special characters in URLs", () => {
      const markdown = "![Photo](https://example.com/images/photo%20(1).jpg?v=123&size=large)";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows[0].imageSource).toBe("https://example.com/images/photo%20(1).jpg?v=123&size=large");
    });

    it("should handle markdown with escaped characters in alt text", () => {
      const markdown = "![Photo \\[2024\\]](photo.jpg)";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows[0].alt).toContain("Photo");
    });

    it("should handle trailing whitespace gracefully", () => {
      const markdown = "![Photo](photo.jpg)   \n\n   Caption text   ";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows[0].imageSource).toBe("photo.jpg");
      expect(preview.rows[0].text?.trim()).toBe("Caption text");
    });

    it("should handle single paragraph with newlines (not double-newline separated)", () => {
      const markdown = "![Photo](photo.jpg)\n\nLine 1\nLine 2\nLine 3";
      const preview = buildMarkdownPastePreview(markdown);

      expect(preview.rows.length).toBe(1);
      expect(preview.rows[0].text).toBe("Line 1\nLine 2\nLine 3");
    });
  });
});
