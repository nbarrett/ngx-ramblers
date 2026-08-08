import { markdownMarksForClipboard, renderLinkMarkdown } from "./html-marks.extension";

describe("markdownMarksForClipboard", () => {
  it("converts bold and italic HTML marks to Markdown", () => {
    expect(markdownMarksForClipboard("<strong>Date:</strong> <em>soon</em>"))
      .toBe("**Date:** *soon*");
  });

  it("keeps boundary whitespace outside Markdown marks", () => {
    expect(markdownMarksForClipboard("<strong> Date: </strong><em> soon </em>"))
      .toBe(" **Date:**  *soon* ");
  });

  it("converts nested marks", () => {
    expect(markdownMarksForClipboard("<strong><em>Important</em></strong>"))
      .toBe("***Important***");
  });
});

describe("renderLinkMarkdown", () => {
  const helpers = {
    renderChildren: () => "Reports"
  };

  it("keeps ordinary links as Markdown", () => {
    expect(renderLinkMarkdown({
      type: "text",
      attrs: { href: "https://pvramblers.org.uk/reports/", target: null }
    }, helpers)).toBe("[Reports](https://pvramblers.org.uk/reports/)");
  });

  it("stores open-in-new-tab links as HTML anchors so presentation keeps target", () => {
    expect(renderLinkMarkdown({
      type: "text",
      attrs: {
        href: "https://pvramblers.org.uk/reports/",
        target: "_blank",
        rel: "noopener noreferrer"
      }
    }, helpers)).toBe(
      "<a href=\"https://pvramblers.org.uk/reports/\" target=\"_blank\" rel=\"noopener noreferrer\">Reports</a>"
    );
  });
});
