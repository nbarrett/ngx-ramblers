import {normaliseWordPasteMarkdown} from "./unwrap-line-breaks";

describe("normaliseWordPasteMarkdown", () => {
  it("joins wrapped Word prose while keeping headings, list items and images separate", () => {
    const markdown = [
      "Overview.",
      "",
      "We will soon be moving to a new website platform provided by",
      "",
      "NGX-Ramblers. This new platform provides",
      "",
      "a more stable environment.",
      "",
      "![Screenshot](api/aws/s3/site-content/example.png)",
      "",
      "- Walk Date",
      "",
      "-",
      "",
      "Start Time",
      "",
      "- Walk Leader - the",
      "",
      "leader's name"
    ].join("\n");
    expect(normaliseWordPasteMarkdown(markdown)).toBe([
      "Overview.",
      "",
      "We will soon be moving to a new website platform provided by NGX-Ramblers. This new platform provides a more stable environment.",
      "",
      "![Screenshot](api/aws/s3/site-content/example.png)",
      "",
      "- Walk Date",
      "",
      "- Start Time",
      "",
      "- Walk Leader - the leader's name"
    ].join("\n"));
  });
});
