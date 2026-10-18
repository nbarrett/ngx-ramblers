import { describe, expect, it } from "vitest";
import { albumMaxImageSize, DEFAULT_ALBUM_MAX_IMAGE_SIZE, imageAlt, SMALLEST_ALBUM_MAX_IMAGE_SIZE } from "./content-metadata.model";

describe("albumMaxImageSize", () => {
  it("keeps no-resizing", () => {
    expect(albumMaxImageSize(0)).toBe(0);
  });

  it("replaces empty and tiny registration values with the site default", () => {
    expect(albumMaxImageSize(null)).toBe(DEFAULT_ALBUM_MAX_IMAGE_SIZE);
    expect(albumMaxImageSize(1024)).toBe(DEFAULT_ALBUM_MAX_IMAGE_SIZE);
    expect(albumMaxImageSize(SMALLEST_ALBUM_MAX_IMAGE_SIZE - 1, 200000)).toBe(200000);
  });

  it("keeps valid stored sizes", () => {
    expect(albumMaxImageSize(256000)).toBe(256000);
    expect(albumMaxImageSize(SMALLEST_ALBUM_MAX_IMAGE_SIZE)).toBe(SMALLEST_ALBUM_MAX_IMAGE_SIZE);
  });
});

describe("imageAlt", () => {
  it("prefers dedicated alt text and falls back to the title", () => {
    expect(imageAlt({alt: "Ridge path", text: "Sunday walk"})).toBe("Ridge path");
    expect(imageAlt({text: "Sunday walk"})).toBe("Sunday walk");
    expect(imageAlt(null)).toBe("");
  });
});
