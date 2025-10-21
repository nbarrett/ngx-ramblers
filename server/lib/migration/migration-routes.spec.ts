import expect from "expect";
import { describe, it } from "mocha";
import * as fs from "fs";
import * as path from "path";
import { createTurndownService, htmlToMarkdown } from "./turndown-service-factory";

describe("HTML to Markdown Conversion", () => {
  const turndownService = createTurndownService();

  describe("Kent Ramblers Walk 81 HTML conversion", () => {
    let html: string;
    let markdown: string;

    before(() => {
      const testDataPath = path.join(__dirname, "../../test-data/kent-ramblers-walk-81.html");
      html = fs.readFileSync(testDataPath, "utf-8");
      markdown = htmlToMarkdown(html);
    });

    it("should convert HTML to markdown without throwing errors", () => {
      expect(markdown).toBeTruthy();
      expect(markdown.length).toBeGreaterThan(0);
    });

    it("should not contain raw HTML tags like <img>", () => {
      expect(markdown).not.toMatch(/<img[^>]*>/);
    });

    it("should not contain raw HTML tags like <td>", () => {
      expect(markdown).not.toMatch(/<td[^>]*>/);
    });

    it("should not contain raw HTML tags like <table>", () => {
      expect(markdown).not.toMatch(/<table[^>]*>/);
    });

    it("should not contain style attributes", () => {
      expect(markdown).not.toMatch(/style\s*=\s*"/);
    });

    it("should not contain class attributes", () => {
      expect(markdown).not.toMatch(/class\s*=\s*"/);
    });

    it("should convert h1 'Kent Ramblers: Walk 81' to markdown heading", () => {
      expect(markdown).toMatch(/# Kent Ramblers: Walk 81/);
    });

    it("should convert h2 'Benenden Short Circular' to markdown heading", () => {
      expect(markdown).toMatch(/## Benenden Short\s+Circular/);
    });

    it("should convert h2 'Points of Interest' to markdown heading", () => {
      expect(markdown).toMatch(/## Points of Interest/);
    });

    it("should convert h3 'Benenden' to markdown heading", () => {
      expect(markdown).toMatch(/### Benenden/);
    });

    it("should convert h3 'Benenden School' to markdown heading", () => {
      expect(markdown).toMatch(/### Benenden School/);
    });

    it("should convert h3 'The Grange' to markdown heading", () => {
      expect(markdown).toMatch(/### The Grange/);
    });

    it("should convert h3 'Public Transport' to markdown heading", () => {
      expect(markdown).toMatch(/### Public Transport/);
    });

    it("should convert navigation link 'Home' to markdown link", () => {
      expect(markdown).toMatch(/\[Home\]\(http:\/\/www\.kentramblers\.org\.uk\)/);
    });

    it("should convert navigation link 'News' to markdown link", () => {
      expect(markdown).toMatch(/\[News\]\([^)]*news[^)]*\)/);
    });

    it("should convert 'Contact Us' link to markdown link", () => {
      expect(markdown).toMatch(/\[Contact Us\]\([^)]*feedback[^)]*\)/);
    });

    it("should convert email link to markdown link", () => {
      expect(markdown).toMatch(/\[info@kentramblers\.org\.uk\]\(mailto:info@kentramblers\.org\.uk\)/);
    });

    it("should convert 'join us' link to markdown link", () => {
      expect(markdown).toMatch(/\[join us\]\(http:\/\/www\.ramblers\.org\.uk\/membership\/whyjoin\.html\)/);
    });

    it("should convert ramblers logo image to markdown image", () => {
      expect(markdown).toMatch(/!\[[^\]]*\]\([^)]*ramblers-logo\.gif\)/);
    });

    it("should convert banner image to markdown image", () => {
      expect(markdown).toMatch(/!\[[^\]]*\]\([^)]*banner_081\.jpg\)/);
    });

    it("should convert map image to markdown image with link", () => {
      expect(markdown).toMatch(/!\[[^\]]*\]\([^)]*map_081\.jpg\)/);
    });

    it("should convert footer image to markdown image", () => {
      expect(markdown).toMatch(/!\[[^\]]*\]\([^)]*footer-bg\.png\)/);
    });

    it("should preserve paragraph about parking", () => {
      expect(markdown).toMatch(/Park in the street or around village green/);
    });

    it("should preserve walking directions paragraph", () => {
      expect(markdown).toMatch(/If parked around village green, walk back to Benenden/);
    });

    it("should preserve distance information", () => {
      expect(markdown).toMatch(/Distance:.*2\.7 miles/);
    });

    it("should preserve OS Map information", () => {
      expect(markdown).toMatch(/OS Map:.*Explorer 125/);
    });

    it("should preserve grid reference", () => {
      expect(markdown).toMatch(/TQ807329/);
    });

    it("should preserve Benenden description", () => {
      expect(markdown).toMatch(/This secluded, very pretty,\s+village, set among Kent's hop fields/);
    });

    it("should preserve Benenden School description", () => {
      expect(markdown).toMatch(/Known as Hemsted Manor/);
    });

    it("should preserve The Grange description", () => {
      expect(markdown).toMatch(/now a home for people with\s+learning disabilities/);
    });

    it("should preserve Public Transport information", () => {
      expect(markdown).toMatch(/Benenden is served by the 297\s+bus/);
    });

    it("should convert horizontal rules", () => {
      // TurndownService converts <hr> to * * *
      expect(markdown).toMatch(/\* \* \*/);
    });

    it("should preserve copyright notice", () => {
      expect(markdown).toMatch(/Crown copyright/);
      expect(markdown).toMatch(/2024/);
    });

    it("should preserve book guide links", () => {
      expect(markdown).toMatch(/Guide to the Wealdway/);
      expect(markdown).toMatch(/Guide to the\s+Kent Coast Path/);
      expect(markdown).toMatch(/Guide to Tunbridge\s+Wells Circular Walk/);
    });

    it("should not contain excessive whitespace", () => {
      // Allow a few blank lines but avoid large gaps
      expect(markdown).not.toMatch(/\n{6,}/);
    });

    it("should not contain HTML entities that should be decoded", () => {
      // TurndownService should decode &nbsp; to spaces
      expect(markdown).not.toMatch(/&nbsp;/);
    });

    it("should produce markdown that is significantly shorter than HTML", () => {
      // Markdown should be more concise (removing style tags, attributes, etc.)
      expect(markdown.length).toBeLessThan(html.length * 0.8);
    });
  });

  describe("Simple HTML conversions", () => {
    const turndownService = createTurndownService();

    it("should convert a simple heading", () => {
      const html = "<h1>Hello World</h1>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("# Hello World");
    });

    it("should convert a simple paragraph", () => {
      const html = "<p>This is a paragraph.</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("This is a paragraph.");
    });

    it("should convert a simple link", () => {
      const html = '<a href="https://example.com">Click here</a>';
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("[Click here](https://example.com)");
    });

    it("should convert a simple image", () => {
      const html = '<img src="image.jpg" alt="A test image">';
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("![A test image](image.jpg)");
    });

    it("should convert an image without alt text", () => {
      const html = '<img src="image.jpg">';
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("![](image.jpg)");
    });

    it("should convert bold text", () => {
      const html = "<p>This is <b>bold</b> text</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("This is **bold** text");
    });

    it("should convert italic text", () => {
      const html = "<p>This is <i>italic</i> text</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("This is _italic_ text");
    });

    it("should convert code", () => {
      const html = "<p>This is <code>code</code> text</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toBe("This is `code` text");
    });

    it("should convert unordered lists", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toMatch(/\*\s+Item 1/);
      expect(markdown).toMatch(/\*\s+Item 2/);
    });

    it("should convert ordered lists", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      const markdown = turndownService.turndown(html);
      expect(markdown).toMatch(/1\.\s+First/);
      expect(markdown).toMatch(/2\.\s+Second/);
    });

    it("should strip out style tags", () => {
      const html = "<style>body { color: red; }</style><p>Content</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).not.toMatch(/<style>/);
      expect(markdown).not.toMatch(/color: red/);
      expect(markdown).toBe("Content");
    });

    it("should strip out script tags", () => {
      const html = "<script>alert('test');</script><p>Content</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).not.toMatch(/<script>/);
      expect(markdown).not.toMatch(/alert/);
      expect(markdown).toBe("Content");
    });

    it("should decode HTML entities", () => {
      const html = "<p>This&nbsp;has&nbsp;non-breaking&nbsp;spaces</p>";
      const markdown = turndownService.turndown(html);
      expect(markdown).not.toMatch(/&nbsp;/);
      expect(markdown).toMatch(/This\s+has\s+non-breaking\s+spaces/);
    });
  });
});
