import expect from "expect";
import { describe, it } from "mocha";
import { cleanFlickrAlbumTitle } from "./flickr-provider";

describe("flickr-provider", () => {
  describe("cleanFlickrAlbumTitle", () => {
    it("should remove photo count and views from album title", () => {
      expect(cleanFlickrAlbumTitle("Bolton Ramblers 2026 22 photos · 62 views"))
        .toEqual("Bolton Ramblers 2026");
    });

    it("should remove photo count with video and views", () => {
      expect(cleanFlickrAlbumTitle("Bolton Ramblers 2025 368 photos and 1 video · 612 views"))
        .toEqual("Bolton Ramblers 2025");
    });

    it("should remove multiple photos and videos with views", () => {
      expect(cleanFlickrAlbumTitle("Bolton Ramblers 2024 300 photos and 1 video · 590 views"))
        .toEqual("Bolton Ramblers 2024");
    });

    it("should handle title with only views", () => {
      expect(cleanFlickrAlbumTitle("My Album · 100 views"))
        .toEqual("My Album");
    });

    it("should handle title with only photo count", () => {
      expect(cleanFlickrAlbumTitle("Summer Photos 50 photos"))
        .toEqual("Summer Photos");
    });

    it("should handle singular photo", () => {
      expect(cleanFlickrAlbumTitle("Single Shot 1 photo · 10 views"))
        .toEqual("Single Shot");
    });

    it("should preserve title without stats", () => {
      expect(cleanFlickrAlbumTitle("Clean Album Title"))
        .toEqual("Clean Album Title");
    });

    it("should handle empty or whitespace", () => {
      expect(cleanFlickrAlbumTitle("")).toEqual("");
      expect(cleanFlickrAlbumTitle("  ")).toEqual("  ");
    });
  });
});
