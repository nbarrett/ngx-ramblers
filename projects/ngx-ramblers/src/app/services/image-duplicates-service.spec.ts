import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { webcrypto } from "node:crypto";
import { vi } from "vitest";
import { ImageDuplicatesService } from "./image-duplicates-service";

const photoFile = (name: string, content: string, mime = "image/jpeg") => ({
  file: new File([content], name, {type: mime}),
  base64Content: `data:${mime};base64,${btoa(content)}`
});

describe("duplicate photo selection", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({imports: [LoggerTestingModule]});
    vi.stubGlobal("crypto", webcrypto);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("skips identical bytes in one drop despite different filenames or MIME labels", async () => {
    const service = TestBed.inject(ImageDuplicatesService);
    const selection = await service.uniqueFilesFrom([photoFile("photo.jpg", "first"), photoFile("renamed.jpg", "first", "application/octet-stream")], []);
    expect(selection.files).toHaveLength(1);
    expect(selection.skippedDuplicates).toBe(1);
  });

  it("keeps different photos that share a filename", async () => {
    const service = TestBed.inject(ImageDuplicatesService);
    const selection = await service.uniqueFilesFrom([photoFile("photo.jpg", "first"), photoFile("photo.jpg", "second")], []);
    expect(selection.files).toHaveLength(2);
    expect(selection.skippedDuplicates).toBe(0);
  });

  it("recognises a later drop from the checksum retained with a saved photo", async () => {
    const service = TestBed.inject(ImageDuplicatesService);
    const original = photoFile("photo.jpg", "first");
    const accepted = await service.uniqueFilesFrom([original], []);
    const selection = await service.uniqueFilesFrom([photoFile("renamed.jpg", "first")], [{image: "resized-photo.jpeg", sourceChecksum: accepted.files[0].sourceChecksum}]);
    expect(selection.files).toHaveLength(0);
    expect(selection.skippedDuplicates).toBe(1);
  });
});
