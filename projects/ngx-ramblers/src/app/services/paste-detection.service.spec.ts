import { TestBed } from "@angular/core/testing";
import { PasteDetectionService } from "./paste-detection.service";

describe("PasteDetectionService", () => {
  let service: PasteDetectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PasteDetectionService);
  });

  describe("isSignificantHtml", () => {
    it("should return false for plain text wrapped in Chrome meta+span", () => {
      const html = `<meta charset='utf-8'><span>Hello world</span>`;
      const plain = "Hello world";
      expect(service.isSignificantHtml(html, plain)).toBe(false);
    });

    it("should return false for plain text wrapped in single span", () => {
      const html = `<span>Just plain text</span>`;
      const plain = "Just plain text";
      expect(service.isSignificantHtml(html, plain)).toBe(false);
    });

    it("should return false for plain text wrapped in single div", () => {
      const html = `<div>Plain text content</div>`;
      const plain = "Plain text content";
      expect(service.isSignificantHtml(html, plain)).toBe(false);
    });

    it("should return true for HTML with paragraph tags", () => {
      const html = `<p>First paragraph</p><p>Second paragraph</p>`;
      const plain = "First paragraph\nSecond paragraph";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with images", () => {
      const html = `<img src="photo.jpg" alt="Photo">`;
      const plain = "";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with links", () => {
      const html = `<a href="https://example.com">Link text</a>`;
      const plain = "Link text";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with headings", () => {
      const html = `<h1>Title</h1><p>Content</p>`;
      const plain = "Title\nContent";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with lists", () => {
      const html = `<ul><li>Item 1</li><li>Item 2</li></ul>`;
      const plain = "Item 1\nItem 2";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with tables", () => {
      const html = `<table><tr><td>Cell</td></tr></table>`;
      const plain = "Cell";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with bold/italic formatting", () => {
      const html = `<p>Normal <strong>bold</strong> <em>italic</em></p>`;
      const plain = "Normal bold italic";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with code blocks", () => {
      const html = `<pre><code>const x = 1;</code></pre>`;
      const plain = "const x = 1;";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for HTML with blockquotes", () => {
      const html = `<blockquote>Quote text</blockquote>`;
      const plain = "Quote text";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return false for empty HTML", () => {
      expect(service.isSignificantHtml("", "")).toBe(false);
      expect(service.isSignificantHtml("   ", "")).toBe(false);
    });

    it("should return false for HTML that matches plain text after stripping tags", () => {
      const html = `<span style="color: red">Red text</span>`;
      const plain = "Red text";
      expect(service.isSignificantHtml(html, plain)).toBe(false);
    });

    it("should return false for markdown text wrapped in paragraph tags", () => {
      const html = `<p># Heading</p><p>Content here</p>`;
      const plain = "# Heading\n\nContent here";
      expect(service.isSignificantHtml(html, plain)).toBe(false);
    });

    it("should return false for multi-line markdown wrapped in HTML", () => {
      const markdown = `# Member Privileges Guide

Use this guide to assign the right privileges.

## Core Membership
- Approved Group Member`;
      const html = `<p># Member Privileges Guide</p><p>Use this guide to assign the right privileges.</p><p>## Core Membership<br>- Approved Group Member</p>`;
      expect(service.isSignificantHtml(html, markdown)).toBe(false);
    });

    it("should return false for plain text list wrapped in p tags", () => {
      const plain = `- Item 1\n- Item 2\n- Item 3`;
      const html = `<p>- Item 1<br>- Item 2<br>- Item 3</p>`;
      expect(service.isSignificantHtml(html, plain)).toBe(false);
    });

    it("should return true for large HTML with meta tags and structural content", () => {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><script src="app.js"></script><style>.foo{color:red}</style></head><body><div><table><tr><td>Data 1</td><td>Data 2</td></tr><tr><td>Data 3</td><td>Data 4</td></tr></table><p>Some paragraph text here</p><ul><li>List item 1</li><li>List item 2</li></ul></div></body></html>`;
      const plain = "Data 1 Data 2 Data 3 Data 4 Some paragraph text here List item 1 List item 2";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });

    it("should return true for complex HTML page with meta charset at start", () => {
      const html = `<meta charset="utf-8"><html><head><title>Page</title><script>console.log("test");</script></head><body><div class="container"><h1>Welcome</h1><p>This is a <strong>complex</strong> page with <a href="/link">links</a>.</p><img src="photo.jpg" alt="Photo"><table><tr><td>Cell 1</td></tr></table></div></body></html>`;
      const plain = "Page Welcome This is a complex page with links. Cell 1";
      expect(service.isSignificantHtml(html, plain)).toBe(true);
    });
  });

  describe("hasMarkdownImages", () => {
    it("should return true for markdown with images", () => {
      expect(service.hasMarkdownImages("![alt text](image.jpg)")).toBe(true);
      expect(service.hasMarkdownImages("Text before ![](photo.png) text after")).toBe(true);
      expect(service.hasMarkdownImages("![Image description](https://example.com/image.jpg)")).toBe(true);
    });

    it("should detect images in real-world Eden Valley markdown", () => {
      const markdown = `Eden Valley Walk

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/evw_banner.jpg)

![Image](https://www.kentramblers.org.uk/KentWalks/EdenVW/images/hever01.jpg)

Hever Castle`;

      expect(service.hasMarkdownImages(markdown)).toBe(true);

      const imageRegex = /!\[([^\]]*)]\(([^)]+)\)/g;
      const images = [...markdown.matchAll(imageRegex)];
      expect(images.length).toBe(2);
      expect(images[0][2]).toContain("evw_banner.jpg");
      expect(images[1][2]).toContain("hever01.jpg");
    });

    it("should return false for markdown without images", () => {
      expect(service.hasMarkdownImages("Just plain text")).toBe(false);
      expect(service.hasMarkdownImages("[Link text](url)")).toBe(false);
      expect(service.hasMarkdownImages("**Bold** and *italic*")).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(service.hasMarkdownImages("")).toBe(false);
    });
  });

  describe("isLocalPath", () => {
    it("should return true for local paths", () => {
      expect(service.isLocalPath("/publications/article")).toBe(true);
      expect(service.isLocalPath("/admin/settings")).toBe(true);
      expect(service.isLocalPath("/path/to/file.html")).toBe(true);
      expect(service.isLocalPath("/path?query=value")).toBe(true);
      expect(service.isLocalPath("/path#anchor")).toBe(true);
    });

    it("should return false for URLs", () => {
      expect(service.isLocalPath("https://example.com")).toBe(false);
      expect(service.isLocalPath("http://localhost:4200/path")).toBe(false);
      expect(service.isLocalPath("//example.com/path")).toBe(false);
    });

    it("should return false for non-path text", () => {
      expect(service.isLocalPath("plain text")).toBe(false);
      expect(service.isLocalPath("no-leading-slash")).toBe(false);
    });
  });

  describe("isViewSourceOrHttpUrl", () => {
    it("should return true for http URLs", () => {
      expect(service.isViewSourceOrHttpUrl("http://example.com")).toBe(true);
      expect(service.isViewSourceOrHttpUrl("https://example.com/path")).toBe(true);
    });

    it("should return true for view-source URLs", () => {
      expect(service.isViewSourceOrHttpUrl("view-source:http://example.com")).toBe(true);
      expect(service.isViewSourceOrHttpUrl("view-source:https://example.com")).toBe(true);
    });

    it("should return false for local paths", () => {
      expect(service.isViewSourceOrHttpUrl("/publications/article")).toBe(false);
    });

    it("should return false for plain text", () => {
      expect(service.isViewSourceOrHttpUrl("plain text")).toBe(false);
    });
  });
});
