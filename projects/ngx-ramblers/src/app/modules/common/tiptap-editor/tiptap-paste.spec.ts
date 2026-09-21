import {
  htmlHasRichFormatting,
  imagesFromRtf,
  isInternalPaste,
  isWordClipboardHtml,
  sanitiseHtmlForPaste,
  shouldPastePlainTextAsMarkdown,
  stripIncompatibleTextMarks
} from "./tiptap-paste";

describe("imagesFromRtf", () => {
  it("reads Word image bytes after nested picture metadata", () => {
    const rtf = "{\\pict\\pngblip\\bliptag255{\\*\\blipuid fdd18a216f098f83bf17b9573e79d049}"
      + "89504e470d0a1a0a0000000d49484452" + "00".repeat(30) + "}";
    const images = imagesFromRtf(rtf);
    expect(images.length).toBe(1);
    expect(images[0].type).toBe("image/png");
    expect(Array.from(images[0].bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});

describe("isWordClipboardHtml", () => {
  it("detects Word HTML even when it has no images", () => {
    expect(isWordClipboardHtml("<p class=\"MsoNormal\">A paragraph</p>")).toBe(true);
    expect(isWordClipboardHtml("<p style=\"mso-margin-top-alt:auto\">A paragraph</p>")).toBe(true);
    expect(isWordClipboardHtml("<p>A normal webpage paragraph</p>")).toBe(false);
  });
});

describe("shouldPastePlainTextAsMarkdown", () => {

  it("prefers markdown plain text even when HTML is also on the clipboard", () => {
    expect(shouldPastePlainTextAsMarkdown(false, "## Background\n\n- item", true)).toBe(true);
  });

  it("does not take over internal editor cuts or non-markdown plain text", () => {
    expect(shouldPastePlainTextAsMarkdown(true, "## Background", true)).toBe(false);
    expect(shouldPastePlainTextAsMarkdown(false, "Hello Tom", false)).toBe(false);
    expect(shouldPastePlainTextAsMarkdown(false, "", true)).toBe(false);
  });
});

describe("stripIncompatibleTextMarks", () => {

  it("keeps code alone when markdown parse also applies bold", () => {
    const cleaned = stripIncompatibleTextMarks({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "salesforceId",
          marks: [{type: "code"}, {type: "bold"}]
        }]
      }]
    });
    expect(cleaned.content?.[0].content?.[0].marks).toEqual([{type: "code"}]);
  });

  it("leaves non-conflicting marks alone", () => {
    const cleaned = stripIncompatibleTextMarks({
      type: "text",
      text: "hello",
      marks: [{type: "bold"}, {type: "italic"}]
    });
    expect(cleaned.marks).toEqual([{type: "bold"}, {type: "italic"}]);
  });
});

describe("htmlHasRichFormatting", () => {

  it("detects links so rich text paste keeps them", () => {
    expect(htmlHasRichFormatting("<p>See <a href=\"https://www.example.co.uk/\">here</a> for details</p>")).toBe(true);
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
    const sanitised = sanitiseHtmlForPaste("<a href=\"https://group.ngx-ramblers.org.uk/\" style=\"color:red\" width=\"40\">Kent</a>");
    expect(sanitised).toContain("href=\"https://group.ngx-ramblers.org.uk/\"");
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
