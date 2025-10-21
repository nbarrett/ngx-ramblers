import expect from "expect";
import { describe, it } from "mocha";
import {
  decodeHtmlEntities,
  stripClipboardCodeWrappers,
  unwrapAnchorsInAttributes,
  htmlToMarkdown
} from "./turndown-service-factory";

describe("turndown-service-factory helpers", () => {
  it("decodeHtmlEntities returns decoded html", () => {
    const input = "&lt;div&gt;&amp;nbsp;&lt;/div&gt;";
    const result = decodeHtmlEntities(input);
    expect(result).toBe("<div>&nbsp;</div>");
  });

  it("decodeHtmlEntities returns original when not encoded", () => {
    const input = "<p>plain</p>";
    const result = decodeHtmlEntities(input);
    expect(result).toBe(input);
  });

  it("stripClipboardCodeWrappers removes code table markup", () => {
    const clipboardHtml = `
      <table class="code-table"><tbody>
        <tr><td class="line-number">1</td><td class="line-content"><span><html></span></td></tr>
        <tr><td class="line-number">2</td><td class="line-content"><span><body></span></td></tr>
        <tr><td class="line-number">3</td><td class="line-content"><span><img src=\"https://example.com/image.jpg\"></span></td></tr>
        <tr><td class="line-number">4</td><td class="line-content"><span></body></span></td></tr>
        <tr><td class="line-number">5</td><td class="line-content"><span></html></span></td></tr>
      </tbody></table>`;

    const result = stripClipboardCodeWrappers(clipboardHtml).replace(/\s+/g, "");
    expect(result).toContain("<html>");
    expect(result).toContain("<body>");
    expect(result).toContain("<imgsrc=\"https://example.com/image.jpg\">");
    expect(result).not.toContain("line-content");
  });

  it("stripClipboardCodeWrappers returns original when wrappers absent", () => {
    const input = "<div>No wrappers</div>";
    const result = stripClipboardCodeWrappers(input);
    expect(result).toBe(input);
  });

  it("unwrapAnchorsInAttributes removes nested links in src and href", () => {
    const input = "<img src=\"<a href='https://example.com/img.jpg'>https://example.com/img.jpg</a>\"><a href=\"<a href='https://example.com'>https://example.com</a>\">link</a>";
    const result = unwrapAnchorsInAttributes(input);
    expect(result).toBe("<img src=\"https://example.com/img.jpg\"><a href=\"https://example.com\">link</a>");
  });

  it("htmlToMarkdown resolves relative image src using page url", () => {
    const html = "<html><body><img src=\"images/example.jpg\"></body></html>";
    const markdown = htmlToMarkdown(html, "https://example.com/path/page.html");
    expect(markdown).toContain("![](https://example.com/path/images/example.jpg)");
  });

  it("htmlToMarkdown normalises non-breaking spaces", () => {
    const html = "<p>Distance:&nbsp;&nbsp;&nbsp;2.7&nbsp;miles</p><p>OS Map:\u00A0\u00A0125</p>";
    const markdown = htmlToMarkdown(html);
    const lines = markdown.split("\n").map(line => line.trim()).filter(line => line);
    expect(lines[0]).toBe("Distance: 2.7 miles");
    expect(lines[1]).toBe("OS Map: 125");
  });

  it("htmlToMarkdown removes blockquote prefixes", () => {
    const html = "<table><tr><td><p>Item</p></td></tr></table>";
    const markdown = htmlToMarkdown(html);
    expect(markdown).toBe("Item");
  });

  it("htmlToMarkdown removes stray font-family fragments", () => {
    const html1 = "<p>Arial\",sans-serif\">Hello</p>";
    const html2 = "<p>\"Times New Roman\", serif\" >World</p>";
    const html3 = "<p>Caption ', monospace' > Done</p>";
    const md1 = htmlToMarkdown(html1);
    const md2 = htmlToMarkdown(html2);
    const md3 = htmlToMarkdown(html3);
    expect(md1).not.toContain("sans-serif");
    expect(md1).not.toContain("\">");
    expect(md2).not.toContain("serif");
    expect(md2).not.toContain("'>");
    expect(md2).not.toContain("\">");
    expect(md3).not.toContain("monospace");
    expect(md3).not.toContain("'>");
  });

  it("htmlToMarkdown strips CSS property declarations left as text", () => {
    const html = "<div>width: 100%; line-height: normal; color: #333; Distance: 2.7 miles</div>";
    const markdown = htmlToMarkdown(html);
    expect(markdown).toBe("Distance: 2.7 miles");
  });
});
