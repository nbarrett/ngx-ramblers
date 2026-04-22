import expect from "expect";
import { describe, it } from "mocha";
import {
  albumIndexHasContent,
  carouselHasContent,
  columnHasImage,
  pageHasImages,
  rowHasImage,
  textHasImage
} from "./image-detection";

describe("image-detection", () => {

  describe("textHasImage", () => {
    it("detects markdown images", () => {
      expect(textHasImage("Here is ![a screenshot](site-content/abc.png) embedded")).toBe(true);
    });

    it("detects HTML img tags", () => {
      expect(textHasImage('Inline <img src="/foo.png" alt="x"> here')).toBe(true);
    });

    it("ignores plain text", () => {
      expect(textHasImage("Just **bold** and _italic_, no images")).toBe(false);
    });

    it("handles non-string input", () => {
      expect(textHasImage(null)).toBe(false);
      expect(textHasImage(undefined)).toBe(false);
      expect(textHasImage(123)).toBe(false);
    });

    it("ignores markdown image syntax inside inline code spans", () => {
      // Regression: 2026-04-20 release note quoted `![](url)` in prose describing
      // migration syntax, which was being picked up as a real image.
      expect(textHasImage("image references (`<img src>`, `![](url)`) and link refs")).toBe(false);
    });

    it("ignores markdown image syntax inside fenced code blocks", () => {
      const text = "Here is an example:\n\n```markdown\n![alt](x.png)\n```\n\nEnd";
      expect(textHasImage(text)).toBe(false);
    });

    it("ignores HTML img tags inside inline code spans", () => {
      expect(textHasImage("Use `<img src=\"foo.png\">` to embed an image")).toBe(false);
    });

    it("still detects a real markdown image alongside a code span example", () => {
      const text = "The syntax is `![](url)` — example: ![real](site-content/a.jpg)";
      expect(textHasImage(text)).toBe(true);
    });
  });

  describe("carouselHasContent", () => {
    it("treats a default-initialised stub carousel as empty", () => {
      // The CMS editor attaches this shape to plain text rows — NOT evidence
      // of images. This was the false-positive source on 2025-11-10-issue-33.
      const stub = {
        name: null,
        createdAt: null,
        createdBy: null,
        eventDate: null,
        eventId: null,
        eventType: "walks",
        title: null,
        coverImageHeight: 400,
        coverImageBorderRadius: 6
      };
      expect(carouselHasContent(stub)).toBe(false);
    });

    it("detects a carousel with a real name", () => {
      expect(carouselHasContent({ name: "Summer walks 2025" })).toBe(true);
    });

    it("detects a carousel linked via albumId", () => {
      expect(carouselHasContent({ name: null, albumId: "abc123" })).toBe(true);
    });

    it("detects a carousel linked via eventId", () => {
      expect(carouselHasContent({ name: null, eventId: "evt-1" })).toBe(true);
    });

    it("rejects null / undefined / non-object", () => {
      expect(carouselHasContent(null)).toBe(false);
      expect(carouselHasContent(undefined)).toBe(false);
      expect(carouselHasContent("string")).toBe(false);
    });
  });

  describe("albumIndexHasContent", () => {
    it("detects a populated album index", () => {
      expect(albumIndexHasContent({ albums: [{ name: "a" }] })).toBe(true);
    });

    it("treats an empty album index as empty", () => {
      expect(albumIndexHasContent({ albums: [] })).toBe(false);
      expect(albumIndexHasContent({})).toBe(false);
    });
  });

  describe("columnHasImage", () => {
    it("detects col.imageSource", () => {
      expect(columnHasImage({ imageSource: "site-content/x.jpg" })).toBe(true);
    });

    it("detects col.icon", () => {
      expect(columnHasImage({ icon: "fa-walking" })).toBe(true);
    });

    it("detects markdown image in contentText", () => {
      expect(columnHasImage({ contentText: "See ![shot](a.png)" })).toBe(true);
    });

    it("ignores plain contentText", () => {
      expect(columnHasImage({ contentText: "# A heading\n\nSome text" })).toBe(false);
    });

    it("recurses into nested col.rows", () => {
      const nested = {
        rows: [{ columns: [{ imageSource: "a.jpg" }] }]
      };
      expect(columnHasImage(nested)).toBe(true);
    });
  });

  describe("rowHasImage", () => {
    it("does NOT fire on a text row with a stub carousel", () => {
      // Matches the exact shape of 2025-11-10-issue-33 on production.
      const row = {
        type: "text",
        columns: [{ contentText: "# Heading\n\nJust text" }],
        carousel: {
          name: null,
          albumName: undefined,
          eventId: null,
          title: null,
          coverImageHeight: 400
        }
      };
      expect(rowHasImage(row)).toBe(false);
    });

    it("fires on a real carousel row with a linked album", () => {
      const row = {
        type: "carousel",
        columns: [],
        carousel: { name: "September 2025 walks", eventType: "walks" }
      };
      expect(rowHasImage(row)).toBe(true);
    });

    it("fires on a text row whose column has an imageSource", () => {
      const row = {
        type: "text",
        columns: [{ imageSource: "site-content/a.jpg", contentText: "*caption*" }]
      };
      expect(rowHasImage(row)).toBe(true);
    });

    it("fires on a text row with markdown image in contentText", () => {
      const row = {
        type: "text",
        columns: [{ contentText: "Before\n![alt](x.png)\nAfter" }]
      };
      expect(rowHasImage(row)).toBe(true);
    });
  });

  describe("pageHasImages", () => {
    it("returns false for a page with only a stub-carousel text row", () => {
      // Regression test for 2025-11-10-issue-33 false positive.
      const page = {
        rows: [{
          type: "text",
          columns: [{ contentText: "# Walk fixes\n\nPlain markdown, no images" }],
          carousel: { name: null, eventId: null, title: null }
        }]
      };
      expect(pageHasImages(page)).toBe(false);
    });

    it("returns true for a page mixing image rows and text rows", () => {
      // Regression test for 2025-01-17 true positive.
      const page = {
        rows: [
          { type: "text", columns: [{ contentText: "# Release" }] },
          {
            type: "text",
            columns: [{ imageSource: "site-content/shot1.jpg", contentText: "*caption 1*" }],
            carousel: { name: null }
          },
          {
            type: "text",
            columns: [{ imageSource: "site-content/shot2.jpg", contentText: "*caption 2*" }],
            carousel: { name: null }
          }
        ]
      };
      expect(pageHasImages(page)).toBe(true);
    });

    it("returns false for a page with no rows", () => {
      expect(pageHasImages({ rows: [] })).toBe(false);
      expect(pageHasImages({})).toBe(false);
      expect(pageHasImages(null)).toBe(false);
    });
  });
});
