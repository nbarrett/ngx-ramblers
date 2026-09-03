import { describe, expect, it } from "vitest";
import { isOfficeContentType, isOfficeFileName, officeViewerEmbedUrl, officeViewerUrl } from "./office-viewer";

describe("office viewer", () => {

  it("recognises office files by extension, ignoring query strings and case", () => {
    expect(isOfficeFileName("committee-statistics-20260903.xlsx")).toBe(true);
    expect(isOfficeFileName("/api/aws/s3/email-attachments/minutes.DOCX?disposition=inline")).toBe(true);
    expect(isOfficeFileName("photo.jpg")).toBe(false);
    expect(isOfficeFileName("")).toBe(false);
  });

  it("recognises office content types", () => {
    expect(isOfficeContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isOfficeContentType("application/msword")).toBe(true);
    expect(isOfficeContentType("application/octet-stream")).toBe(false);
  });

  it("builds viewer links with the source encoded", () => {
    expect(officeViewerEmbedUrl("https://www.ekwg.co.uk/api/aws/s3/a b.xlsx")).toEqual("https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fwww.ekwg.co.uk%2Fapi%2Faws%2Fs3%2Fa%20b.xlsx");
    expect(officeViewerUrl("")).toEqual("");
  });

});
