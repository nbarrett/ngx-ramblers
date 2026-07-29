import { htmlHasRichFormatting, isInternalPaste, sanitiseHtmlForPaste } from "./tiptap-paste";

describe("htmlHasRichFormatting", () => {

  it("detects links so rich text paste keeps them", () => {
    expect(htmlHasRichFormatting("<p>See <a href=\"https://www.ekwg.co.uk/\">here</a> for details</p>")).toBe(true);
  });

  it("detects bold, italic, headings, lists, quotes and images", () => {
    expect(htmlHasRichFormatting("<strong>bold</strong>")).toBe(true);
    expect(htmlHasRichFormatting("<em>italic</em>")).toBe(true);
    expect(htmlHasRichFormatting("<h2>Heading</h2>")).toBe(true);
    expect(htmlHasRichFormatting("<ul><li>one</li></ul>")).toBe(true);
    expect(htmlHasRichFormatting("<blockquote>quoted</blockquote>")).toBe(true);
    expect(htmlHasRichFormatting("<img src=\"https://example.com/a.png\">")).toBe(true);
  });

  it("ignores markdown source pasted as plain or preformatted text", () => {
    expect(htmlHasRichFormatting("")).toBe(false);
    expect(htmlHasRichFormatting("<p>* a bullet</p>")).toBe(false);
    expect(htmlHasRichFormatting("<pre>## Heading\n\n- item</pre>")).toBe(false);
    expect(htmlHasRichFormatting("<div><span>[text](https://example.com)</span></div>")).toBe(false);
  });

  it("ignores an anchor with no href", () => {
    expect(htmlHasRichFormatting("<a name=\"anchor\">label</a>")).toBe(false);
  });
});

describe("sanitiseHtmlForPaste", () => {

  it("keeps href when stripping presentation attributes", () => {
    const sanitised = sanitiseHtmlForPaste("<a href=\"https://kent.ngx-ramblers.org.uk/\" style=\"color:red\" width=\"40\">Kent</a>");
    expect(sanitised).toContain("href=\"https://kent.ngx-ramblers.org.uk/\"");
    expect(sanitised).not.toContain("style");
    expect(sanitised).not.toContain("width");
  });

  it("keeps links that Word wraps in mso classes", () => {
    const sanitised = sanitiseHtmlForPaste("<p class=\"MsoNormal\"><a href=\"mailto:info@example.com\">email us</a></p>");
    expect(sanitised).toContain("href=\"mailto:info@example.com\"");
    expect(sanitised).not.toContain("MsoNormal");
  });
});

describe("isInternalPaste", () => {

  it("recognises a ProseMirror slice", () => {
    expect(isInternalPaste("<div data-pm-slice=\"1 1 []\">copied</div>")).toBe(true);
    expect(isInternalPaste("<p>from a web page</p>")).toBe(false);
  });
});
