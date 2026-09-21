import expect from "expect";
import { describe, it } from "mocha";
import { PageContentType } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import type { PageContent } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";
import { imageStatusByPathFrom, pageHasImages } from "./image-detection";

describe("imageStatusByPathFrom", () => {
  it("marks a release note that contains an image and ignores nested paths", () => {
    const note: PageContent = {
      path: "how-to/committee/release-notes/2026-09-21-issue-1",
      rows: [{
        type: PageContentType.TEXT,
        showSwiper: false,
        maxColumns: 1,
        columns: [{ columns: 12, contentText: "See ![map](https://example.test/map.jpg)" }]
      }]
    };
    const nested: PageContent = {
      path: "how-to/committee/release-notes/2026-09-21-issue-1/extra",
      rows: [{
        type: PageContentType.TEXT,
        showSwiper: false,
        maxColumns: 1,
        columns: [{ columns: 12, contentText: "![hidden](https://example.test/hidden.jpg)" }]
      }]
    };
    const plain: PageContent = {
      path: "how-to/committee/release-notes/2026-09-21-issue-2",
      rows: [{
        type: PageContentType.TEXT,
        showSwiper: false,
        maxColumns: 1,
        columns: [{ columns: 12, contentText: "No picture here" }]
      }]
    };
    const status = imageStatusByPathFrom([note, nested, plain], "how-to/committee/release-notes/", pageHasImages);
    expect(status.get(note.path!)).toBe(true);
    expect(status.get(plain.path!)).toBe(false);
    expect(status.has(nested.path!)).toBe(false);
  });
});
