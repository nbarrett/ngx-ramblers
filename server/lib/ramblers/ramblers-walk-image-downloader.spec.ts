import expect from "expect";
import { afterEach, describe, it } from "mocha";
import { promises as fs } from "node:fs";
import path from "node:path";
import { downloadWalkImages } from "./ramblers-walk-image-downloader";

const testDirectory = "/tmp/ramblers-image-downloader-test";
const originalFetch = global.fetch;

describe("downloadWalkImages", () => {
  afterEach(async () => {
    global.fetch = originalFetch;
    await fs.rm(testDirectory, { recursive: true, force: true });
  });

  it("downloads images in source order and returns local metadata", async () => {
    global.fetch = async url => new Response(new TextEncoder().encode(String(url)));

    const result = await downloadWalkImages([{
      date: "15/07/2026",
      walkId: null,
      title: "Woodland walk",
      images: [
        {alternativeText: "First", fileName: "first.jpeg", sourceUrl: "https://example.com/first"},
        {alternativeText: "Second", fileName: "second.png", sourceUrl: "https://example.com/second"}
      ]
    }], testDirectory);

    expect(result).toEqual([{
      date: "15/07/2026",
      walkId: null,
      title: "Woodland walk",
      images: [
        {alternativeText: "First", filePath: path.join(testDirectory, "1-1.jpeg")},
        {alternativeText: "Second", filePath: path.join(testDirectory, "1-2.png")}
      ]
    }]);
    expect(await fs.readFile(result[0].images[0].filePath, "utf8")).toEqual("https://example.com/first");
  });

  it("fails the job when an image cannot be downloaded", async () => {
    global.fetch = async () => new Response("missing", {status: 404, statusText: "Not Found"});

    await expect(downloadWalkImages([{
      date: "15/07/2026",
      walkId: null,
      title: "Woodland walk",
      images: [{alternativeText: "Missing", fileName: "missing.jpeg", sourceUrl: "https://example.com/missing"}]
    }], testDirectory)).rejects.toThrow("Failed to download walk image https://example.com/missing: 404 Not Found");
  });
});
