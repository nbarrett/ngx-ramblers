import { markdownMarksForClipboard } from "./html-marks.extension";

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
