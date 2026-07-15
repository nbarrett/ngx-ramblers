import expect from "expect";
import { afterEach, describe, it } from "mocha";
import { promises as fs } from "node:fs";
import path from "node:path";
import { downloadWalkImages, uniqueFileNames } from "./ramblers-walk-image-downloader";

const testDirectory = "/tmp/ramblers-image-downloader-test";
const originalFetch = global.fetch;

describe("downloadWalkImages", () => {
  afterEach(async () => {
    global.fetch = originalFetch;
    await fs.rm(testDirectory, { recursive: true, force: true });
  });

  it("downloads images in source order keeping their file names so ramblers images can be matched to local ones", async () => {
    global.fetch = async url => new Response(new TextEncoder().encode(String(url)));

    const result = await downloadWalkImages([{
      date: "15/07/2026",
      walkId: null,
      imagesChanged: false,
      title: "Woodland walk",
      fieldChanges: [],
      images: [
        {alternativeText: "First", fileName: "First Image.jpeg", sourceUrl: "https://example.com/first"},
        {alternativeText: "Second", fileName: "second.png", sourceUrl: "https://example.com/second"}
      ]
    }], testDirectory);

    expect(result).toEqual([{
      date: "15/07/2026",
      walkId: null,
      imagesChanged: false,
      title: "Woodland walk",
      fieldChanges: [],
      images: [
        {alternativeText: "First", fileName: "first-image.jpeg", filePath: path.join(testDirectory, "walk-1", "first-image.jpeg")},
        {alternativeText: "Second", fileName: "second.png", filePath: path.join(testDirectory, "walk-1", "second.png")}
      ]
    }]);
    expect(await fs.readFile(result[0].images[0].filePath, "utf8")).toEqual("https://example.com/first");
  });

  it("keeps duplicate file names distinct within a walk", () => {
    expect(uniqueFileNames(["path.jpeg", "path.jpeg", "other.png"])).toEqual(["path.jpeg", "path-2.jpeg", "other.png"]);
  });

  it("fails the job when an image cannot be downloaded", async () => {
    global.fetch = async () => new Response("missing", {status: 404, statusText: "Not Found"});

    await expect(downloadWalkImages([{
      date: "15/07/2026",
      walkId: null,
      imagesChanged: false,
      title: "Woodland walk",
      fieldChanges: [],
      images: [{alternativeText: "Missing", fileName: "missing.jpeg", sourceUrl: "https://example.com/missing"}]
    }], testDirectory)).rejects.toThrow("Failed to download walk image https://example.com/missing: 404 Not Found");
  });
});
