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
      "https://www.kentramblers.org.uk/banners/autumn_oasts.jpg",
      "https://www.kentramblers.org.uk/Books/images/trvwwk_cover_front.jpg"
    ];
    const input = [
      "![banner](https://www.kentramblers.org.uk/banners/autumn_oasts.jpg)",
      "[![](https://www.kentramblers.org.uk/Books/images/trvwwk_cover_front.jpg)](../../Books/index.htm)",
      "![keep](https://www.kentramblers.org.uk/KentWalks/DVP/images/route.gif)"
    ].join("\n\n");
    const out = removeExcludedImages(input, ex);
    expect(collapseExcessBlankLines(out)).toEqual("\n\n![keep](https://www.kentramblers.org.uk/KentWalks/DVP/images/route.gif)");
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
      "![](https://www.kentramblers.org.uk/banners/autumn_oasts.jpg)",
      "",
      "![](https://www.kentramblers.org.uk/KentWalks/DVP/images/route.gif)",
      "",
      "The Darent Valley Path starts alternatively at Sevenoaks Station or Chipstead."
    ].join("\n");
    const out = applyTextExclusions(input, {
      excludeImageUrls: [
        "https://www.kentramblers.org.uk/banners/autumn_oasts.jpg"
      ]
    });
    console.log("OUT:", out);
    expect(out.includes("Path Problems")).toBeFalsy();
    expect(out.includes("autumn_oasts.jpg")).toBeFalsy();
    expect(out.includes("route.gif")).toBeTruthy();
    expect(out.includes("Darent Valley Path")).toBeTruthy();
  });
});

describe("text-exclusions.firstSentenceFrom", () => {
  it("extracts a clean first sentence from noisy lines", () => {
    const input = [
      "**Kent Ramblers**",
      "",
      "Elham Valley Way",
      "",
      "![](https://www.kentramblers.org.uk/KentWalks/EVW/images/EVW_banner.jpg)",
      "",
      "Step out and explore the Kent countryside by following one of the most popular of the county's recreation routes.",
      "More text."
    ].join("\n");
    const sentence = firstSentenceFrom(input);
    expect(sentence).toEqual("Step out and explore the Kent countryside by following one of the most popular of the county's recreation routes.");
  });
});
