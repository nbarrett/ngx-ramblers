import expect from "expect";
import { describe, it } from "mocha";
import {
  applyTextExclusions,
  coerceBlocks,
  coerceList,
  collapseExcessBlankLines,
  firstSentenceFrom,
  removeBlockExact,
  removeBlockFlexibleSequence,
  removeBlockWhitespaceTolerant,
  removeExcludedImages,
  removeMarkdownBlocks,
  removeTextPatterns
} from "./text-exclusions";

describe("text-exclusions.coercers", () => {
  it("coerceList should handle arrays, csv and newlines", () => {
    expect(coerceList(["a", "", "b"]).join(",")).toEqual("a,b");
    expect(coerceList("a,b;c").join(",")).toEqual("a,b,c");
    expect(coerceList("a\nb\n\nc").join(",")).toEqual("a,b,c");
  });

  it("coerceBlocks should split on dashed lines with whitespace", () => {
    const blocks = coerceBlocks("one\n---\n\n two \n ---- \n three");
    expect(blocks).toEqual(["one", "two", "three"]);
  });
});

describe("text-exclusions.pattern removal", () => {
  it("removeTextPatterns should delete Path Problems line", () => {
    const input = "Heading\n\n[Path Problems](../../path_problems/index.htm)\n\nBody";
    const out = removeTextPatterns(input, [String.raw`^\s*\[Path\s+Problems\]\([^)]*\)\s*$`]);
    expect(collapseExcessBlankLines(out)).toEqual("Heading\n\nBody");
  });

  it("strips Ramblers-Webs chrome, charity footer and leftover markdown", () => {
    const input = [
      "BOOKS - Walks Around the New Forest National Park",
      "",
      "](http://)",
      "",
      "The Ramblers’ | Contact us | Hosted by Ramblers-Webs",
      "",
      "The Ramblers' Association is a democratic, voluntary organisation, registered as a charity in England & Wales No: 1093577 © New Forest Group of the Ramblers' Association 2025 All Rights Reserved",
      "",
      "The book will cost:",
      "",
      "Migrated from https://www.newforestramblers.org.uk/books.htm on 2026-09-14 14:46"
    ].join("\n");
    const out = collapseExcessBlankLines(applyTextExclusions(input, {})).trim();
    expect(out).toContain("BOOKS - Walks Around the New Forest National Park");
    expect(out).toContain("The book will cost:");
    expect(applyTextExclusions("[The Ramblers’](https://www.ramblers.org.uk/) | [Contact us](contact.htm) | Hosted by [Ramblers-Webs](https://www.ramblers-webs.org.uk)", {})).not.toContain("Ramblers-Webs");
    expect(applyTextExclusions("[The Ramblers’](https://www.ramblers.org.uk/) | [Contact us](contact.htm) | Hosted by [Ramblers-Webs](https://www.ramblers-webs.org.uk)", {})).not.toContain("Ramblers-Webs");
    expect(out).not.toContain("Hosted by Ramblers-Webs");
    expect(out).not.toContain("1093577");
    expect(out).not.toContain("](http://)");
    expect(out).not.toContain("Migrated from");
    expect(collapseExcessBlankLines(applyTextExclusions("What's new?\n\n[\n\n[", {})).trim()).toBe("What's new?");
  });

  it("removeMarkdownBlocks handles exact, tolerant and sequences", () => {
    const block = "Line A\nLine B\nLine C";
    const input = "x\nLine A\n\nLine B\n  \nLine C\ny";
    const out = removeMarkdownBlocks(input, [block]);
    expect(collapseExcessBlankLines(out)).toEqual("x\n\ny");
  });

  it("removeBlockLines also removes link-wrapped lines", () => {
    const navBlock = ["Home", "News", "Support us", "Contact Us", "Path Problems"].join("\n");
    const input = [
      "[Home](index.htm)",
      "",
      "[News](news.htm)",
      "",
      "[Support us](support.htm)",
      "",
      "[Contact Us](contact.htm)",
      "",
      "[Path Problems](../../path_problems/index.htm)",
      "",
      "Content remains"
    ].join("\n");
    const out = removeMarkdownBlocks(input, [navBlock]);
    expect(collapseExcessBlankLines(out).trim()).toEqual("Content remains");
  });

  it("removeBlock helpers behave consistently", () => {
    const block = "Hello World";
    expect(removeBlockExact("xxHello Worldyy", block)).toEqual("xxyy");
    expect(removeBlockWhitespaceTolerant("xxHello   Worldyy", block)).toEqual("xxyy");
    const seq = "A\nB\nC";
    const flex = removeBlockFlexibleSequence("pre A\n\nB\n \n C post", seq);
    expect(flex).toEqual("pre  post");
  });
});

describe("text-exclusions.images", () => {
  it("removeExcludedImages removes bare and link-wrapped", () => {
    const ex = [
      "https://www.archive.example.org.uk/banners/autumn_oasts.jpg",
      "https://www.archive.example.org.uk/Books/images/trvwwk_cover_front.jpg"
    ];
    const input = [
      "![banner](https://www.archive.example.org.uk/banners/autumn_oasts.jpg)",
      "[![](https://www.archive.example.org.uk/Books/images/trvwwk_cover_front.jpg)](../../Books/index.htm)",
      "![keep](https://www.archive.example.org.uk/KentWalks/DVP/images/route.gif)"
    ].join("\n\n");
    const out = removeExcludedImages(input, ex);
    expect(collapseExcessBlankLines(out)).toEqual("\n\n![keep](https://www.archive.example.org.uk/KentWalks/DVP/images/route.gif)");
  });
});

describe("text-exclusions.collapse", () => {
  it("collapseExcessBlankLines to double", () => {
    expect(collapseExcessBlankLines("a\n\n\n\n b")).toEqual("a\n\n b");
  });
});

describe("text-exclusions.applyTextExclusions", () => {
  it("applies all removals on realistic content", () => {
    const input = [
      "Darent Valley Path",
      "",
      "[Path Problems](../../path_problems/index.htm)",
      "",
      "![](https://www.archive.example.org.uk/banners/autumn_oasts.jpg)",
      "",
      "![](https://www.archive.example.org.uk/KentWalks/DVP/images/route.gif)",
      "",
      "The Darent Valley Path starts alternatively at Sevenoaks Station or Chipstead."
    ].join("\n");
    const out = applyTextExclusions(input, {
      excludeImageUrls: [
        "https://www.archive.example.org.uk/banners/autumn_oasts.jpg"
      ]
    });
    expect(out.includes("Path Problems")).toBeFalsy();
    expect(out.includes("autumn_oasts.jpg")).toBeFalsy();
    expect(out.includes("route.gif")).toBeTruthy();
    expect(out.includes("Darent Valley Path")).toBeTruthy();
  });

  it("removes class attributes from inline HTML blocks", () => {
    const input = [
      "<div class=\"container\"><p class=\"lead\">Hello <span class='note'>world</span></p></div>",
      "",
      "<img class=\"img-fluid\" alt=\"Alt\" src=\"/path/to.jpg\">"
    ].join("\n");
    const out = applyTextExclusions(input, {
      excludeTextPatterns: [],
      excludeMarkdownBlocks: [],
      excludeImageUrls: []
    } as any);
    expect(out.includes("class=\"container\"")).toBeFalsy();
    expect(out.includes("class=\"lead\"")).toBeFalsy();
    expect(out.includes("class='note'")).toBeFalsy();
    expect(out.includes("class=\"img-fluid\""));
  });

  it("removes presentational HTML attributes including unquoted values", () => {
    const input = [
      "<table border=\"1\" cellpadding=\"0\" cellspacing='0' align=center>",
      "  <tr valign=top bgcolor=#ffffff>",
      "    <td width=600 height=400 hspace=10 vspace=5>Cell</td>",
      "  </tr>",
      "</table>"
    ].join("\n");
    const out = applyTextExclusions(input, { excludeTextPatterns: [], excludeMarkdownBlocks: [], excludeImageUrls: [] } as any);
    expect(out.includes("border=")).toBeFalsy();
    expect(out.includes("cellpadding=")).toBeFalsy();
    expect(out.includes("cellspacing=")).toBeFalsy();
    expect(out.includes("align=")).toBeFalsy();
    expect(out.includes("valign=")).toBeFalsy();
    expect(out.includes("bgcolor=")).toBeFalsy();
    expect(out.includes("width=")).toBeFalsy();
    expect(out.includes("height=")).toBeFalsy();
    expect(out.includes("hspace=")).toBeFalsy();
    expect(out.includes("vspace=")).toBeFalsy();
  });

  it("removes inline event handler attributes", () => {
    const input = "<a href=\"#\" onclick=\"alert('x')\" onmouseover='noop()'>link</a>";
    const out = applyTextExclusions(input, { excludeTextPatterns: [], excludeMarkdownBlocks: [], excludeImageUrls: [] } as any);
    expect(out.includes("onclick=")).toBeFalsy();
    expect(out.includes("onmouseover=")).toBeFalsy();
  });

  it("removes inline CSS rule blocks from markdown text", () => {
    const input = "Title\n\n.auto-style9 { font-family: Arial; } body { color: #000; } h2 { font-size: 120%; }\n\nContent here";
    const out = applyTextExclusions(input, { excludeTextPatterns: [], excludeMarkdownBlocks: [], excludeImageUrls: [] } as any);
    expect(out.includes("auto-style9")).toBeFalsy();
    expect(out.includes("font-family")).toBeFalsy();
    expect(out.includes("body {" )).toBeFalsy();
    expect(out.includes("h2 {" )).toBeFalsy();
    expect(out.includes("Content here")).toBeTruthy();
  });

  it("removes HTML comments and script/style/noscript blocks", () => {
    const input = [
      "Title",
      "",
      "<!-- hidden note -->",
      "",
      "<style>h1{color:red}</style>",
      "<script>console.log('x')</script>",
      "<noscript>Enable JS</noscript>",
      "",
      "Body"
    ].join("\n");
    const out = applyTextExclusions(input, { excludeTextPatterns: [], excludeMarkdownBlocks: [], excludeImageUrls: [] } as any);
    expect(out.includes("hidden note")).toBeFalsy();
    expect(out.includes("<style>")).toBeFalsy();
    expect(out.includes("<script>")).toBeFalsy();
    expect(out.includes("<noscript>")).toBeFalsy();
    expect(out.includes("Body")).toBeTruthy();
  });

  it("unwraps presentational tags while preserving content", () => {
    const input = "<center><font color=\"#000\"><big>Hello</big> <small>World</small></font></center>";
    const out = applyTextExclusions(input, { excludeTextPatterns: [], excludeMarkdownBlocks: [], excludeImageUrls: [] } as any);
    expect(out.includes("<center>")).toBeFalsy();
    expect(out.includes("<font")).toBeFalsy();
    expect(out.includes("<big>")).toBeFalsy();
    expect(out.includes("<small>")).toBeFalsy();
    expect(out.includes("Hello World")).toBeTruthy();
  });

  it("removes attribute-list blocks but keeps hash links", () => {
    const md = [
      "### Eden Valley {#eden .title style=\"color:#060\"}",
      "",
      "![Alt](img.jpg){#hero .rounded style=\"border:0\"}",
      "",
      "See [Jump](#eden) section"
    ].join("\n");
    const out = applyTextExclusions(md, { excludeTextPatterns: [], excludeMarkdownBlocks: [], excludeImageUrls: [] } as any);
    expect(out.includes("{#eden")).toBeFalsy();
    expect(out.includes("{#hero")).toBeFalsy();
    expect(out.includes("[Jump](#eden)")).toBeTruthy();
  });
});

describe("text-exclusions.firstSentenceFrom", () => {
  it("extracts a clean first sentence from noisy lines", () => {
    const input = [
      "**Kent Ramblers**",
      "",
      "Elham Valley Way",
      "",
      "![](https://www.archive.example.org.uk/KentWalks/EVW/images/EVW_banner.jpg)",
      "",
      "Step out and explore the Kent countryside by following one of the most popular of the county's recreation routes.",
      "More text."
    ].join("\n");
    const sentence = firstSentenceFrom(input);
    expect(sentence).toEqual("Step out and explore the Kent countryside by following one of the most popular of the county's recreation routes.");
  });
});

describe("text-exclusions.wordpress-shortcodes", () => {
  it("removes unrendered WordPress shortcodes, escaped or not, and keeps ordinary links", () => {
    const text = [
      "In the meantime, here is a small selection to start with:",
      "[gb_gallery group=\"1\" size=\"900X500\" auto_resize=\"on\" duration=\"2000\" special_effect=\"no\"]",
      "\\[gb\\_gallery group=\"1\" size=\"900X500\"\\]",
      "[/caption]",
      "[Our Flickr group](http://www.flickr.com/groups/hikeessex)"
    ].join("\n\n");
    const out = applyTextExclusions(text, {});
    expect(out).not.toContain("gb_gallery");
    expect(out).not.toContain("gb\\_gallery");
    expect(out).not.toContain("[/caption]");
    expect(out).toContain("[Our Flickr group](http://www.flickr.com/groups/hikeessex)");
    expect(out).toContain("here is a small selection to start with:");
  });
});

describe("text-exclusions.stylesheet-paths", () => {
  it("removes a line that is only a stylesheet path left behind by the old site's page header", () => {
    const out = applyTextExclusions("css/blue.css\n\n# The Example Group\n\nSee styles.css in the notes", {});
    expect(out).not.toContain("css/blue.css\n");
    expect(out).toContain("# The Example Group");
    expect(out).toContain("See styles.css in the notes");
  });
});


describe("text-exclusions.site-search-label", () => {
  it("removes the old site's search box label, keeping sentences that mention searching", () => {
    const out = applyTextExclusions("Search this site\n\n## Introduction\n\nSearch this site for walks near you.", {});
    expect(out).not.toMatch(/^Search this site$/m);
    expect(out).toContain("Search this site for walks near you.");
  });
});
