import { vi } from "vitest";
import { webcrypto } from "node:crypto";
import { DateTime } from "luxon";
import { parse } from "exifr";

import { provideHttpClientTesting } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { LoggerTestingModule } from "ngx-logger/testing";

import { FileUtilsService } from "./file-utils.service";
import { SearchFilterPipe } from "./pipes/search-filter.pipe";
import { ContentMetadataService } from "./services/content-metadata.service";
import { FullNamePipe } from "./pipes/full-name.pipe";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";

vi.mock("exifr", () => ({parse: vi.fn()}));

describe("FileUtilsService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule,
        RouterTestingModule],
    providers: [
        ContentMetadataService, SearchFilterPipe, FullNamePipe,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
    ]
}));

  it("fileExtensionIs should return true when matched", () => {
    const service: FileUtilsService = TestBed.inject(FileUtilsService);
    expect(service.fileExtensionIs("nick.doc", ["doc"])).toBe(true);
  });

  it("fileExtensionIs should return false when matched", () => {
    const service: FileUtilsService = TestBed.inject(FileUtilsService);
    expect(service.fileExtensionIs("nick.txt", ["doc"])).toBe(false);
  });
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto);
    vi.mocked(parse).mockResolvedValue(null);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({data: new Uint8ClampedArray(4).fill(255)}))
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reports an exhausted canvas and releases its memory", async () => {
    const service = TestBed.inject(FileUtilsService);
    const image = {width: 4000, height: 3000, src: "photo"} as HTMLImageElement;
    vi.spyOn(service as any, "loadImageFromBase64").mockResolvedValue(image);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(null));

    await expect(service.resizeBase64Image("data:image/jpeg;base64,YWJj", "photo.jpg", 1)).rejects.toThrow("short of memory");

    const canvas = (encode.mock.contexts[0] as HTMLCanvasElement);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(image.src).toBe("");
  });

  it("reports a missing canvas context instead of uploading an unresized photo", async () => {
    const service = TestBed.inject(FileUtilsService);
    vi.spyOn(service as any, "loadImageFromBase64").mockResolvedValue({width: 4000, height: 3000, src: "photo"});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(service.downscaleBase64Image("data:image/jpeg;base64,YWJj", "photo.jpg", 1200)).rejects.toThrow("Try adding fewer photos");
  });

  it("times out when the browser never completes canvas encoding", async () => {
    vi.useFakeTimers();
    const service = TestBed.inject(FileUtilsService);
    vi.spyOn(service as any, "loadImageFromBase64").mockResolvedValue({width: 4000, height: 3000, src: "photo"});
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(() => null);
    const resizing = service.downscaleBase64Image("data:image/jpeg;base64,YWJj", "photo.jpg", 1200);
    const failure = expect(resizing).rejects.toThrow("Timeout");

    await vi.advanceTimersByTimeAsync(30000);
    await failure;
  });

  it("returns encoded content and releases the canvas after successful downscaling", async () => {
    const service = TestBed.inject(FileUtilsService);
    const image = {width: 4000, height: 3000, src: "photo"} as HTMLImageElement;
    vi.spyOn(service as any, "loadImageFromBase64").mockResolvedValue(image);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(new Blob(["photo"], {type: "image/jpeg"})));

    expect(await service.downscaleBase64Image("data:image/jpeg;base64,YWJj", "photo.jpg", 1200)).toBe("data:image/jpeg;base64,cGhvdG8=");
    expect((encode.mock.contexts[0] as HTMLCanvasElement).width).toBe(0);
    expect(image.src).toBe("");
  });

  const browserDecoder = () => {
    const worker = {
      onmessage: null as Worker["onmessage"],
      onerror: null as Worker["onerror"],
      onmessageerror: null as Worker["onmessageerror"],
      postMessage: vi.fn(),
      terminate: vi.fn()
    };
    vi.stubGlobal("Worker", vi.fn(function() { return worker; }));
    return worker;
  };

  it("converts the original UUID-named HEIC locally and preserves its modification date", async () => {
    const service = TestBed.inject(FileUtilsService);
    const worker = browserDecoder();
    const file = new File(["original HEIC"], "00000000-0000-4000-8000-000000000001.HEIC", {type: "image/heic", lastModified: 1700000000000});
    const conversion = service.convertHEICFile({file, base64Content: "data:image/heic;base64,AAAA"});
    expect(worker.postMessage).toHaveBeenCalledWith(file);
    worker.onmessage.call(null, {data: {jpeg: new Blob(["converted JPEG"], {type: "image/jpeg"}), error: null}} as MessageEvent);
    const result = await conversion;
    expect(result.isImage).toBe(true);
    expect(result.file.file.name).toBe("00000000-0000-4000-8000-000000000001.jpeg");
    expect(result.file.file.type).toBe("image/jpeg");
    expect(result.file.file.lastModified).toBe(file.lastModified);
    expect(result.file.base64Content).toBe("data:image/jpeg;base64,Y29udmVydGVkIEpQRUc=");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("releases the decoder when a HEIC is malformed", async () => {
    const service = TestBed.inject(FileUtilsService);
    const worker = browserDecoder();
    vi.spyOn(service as any, "canDisplayImage").mockResolvedValue(false);
    const file = new File(["invalid"], "photo.heic", {type: "image/heic"});
    const conversion = service.convertHEICFile({file, base64Content: "data:image/heic;base64,AAAA"});
    worker.onmessage.call(null, {data: {jpeg: null, error: "The HEIC photo could not be decoded"}} as MessageEvent);
    expect((await conversion).isImage).toBe(false);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("terminates a decoder that never responds", async () => {
    vi.useFakeTimers();
    const service = TestBed.inject(FileUtilsService);
    const worker = browserDecoder();
    vi.spyOn(service as any, "canDisplayImage").mockResolvedValue(false);
    const file = new File(["photo"], "photo.heic", {type: "image/heic"});
    const conversion = service.convertHEICFile({file, base64Content: "data:image/heic;base64,AAAA"});
    await vi.advanceTimersByTimeAsync(30000);
    expect((await conversion).isImage).toBe(false);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("keeps all 39 photos and converts HEIC one at a time without filename pairing", async () => {
    const service = TestBed.inject(FileUtilsService);
    const files = Array.from({length: 39}, (_, index) => new File(["photo"], `${index}.photo`, {type: index < 30 ? "image/heic" : "image/jpeg"}));
    const base64Files = files.map((file, index) => ({file, base64Content: `data:image/jpeg;base64,${btoa(`photo-${index}`)}`}));
    vi.spyOn(service, "fileListToBase64Files").mockResolvedValue(base64Files);
    vi.spyOn(service as any, "canDisplayImage").mockResolvedValue(true);
    const active = {count: 0, maximum: 0};
    const conversion = vi.spyOn(service, "convertHEICFile").mockImplementation(async file => {
      active.count++;
      active.maximum = Math.max(active.maximum, active.count);
      await Promise.resolve();
      active.count--;
      return {file, isImage: true};
    });
    const result = await service.prepareDroppedFiles(files);
    expect(result.images).toEqual(base64Files.map(file => expect.objectContaining(file)));
    expect(result.skippedHeic).toBe(0);
    expect(result.unread).toBe(0);
    expect(conversion).toHaveBeenCalledTimes(30);
    expect(active.maximum).toBe(1);
  });

  it("reports unreadable and invalid image filenames alongside the photos that succeeded", async () => {
    const service = TestBed.inject(FileUtilsService);
    const files = ["readable.jpeg", "unreadable.jpeg", "corrupt.jpeg", "unsupported.heic"].map(name => new File([name], name, {type: "image/jpeg"}));
    vi.spyOn(service, "fileListToBase64Files").mockResolvedValue([files[0], files[2], files[3]].map(file => ({file, base64Content: btoa(file.name)})));
    vi.spyOn(service, "checkedImageFromBase64File").mockImplementation(async file => ({file, isImage: file.file === files[0]}));

    const prepared = await service.prepareDroppedFiles(files);

    expect(prepared.images.map(image => image.file.name)).toEqual(["readable.jpeg"]);
    expect(prepared.unread).toBe(1);
    expect(prepared.failedFiles).toEqual(["unreadable.jpeg", "corrupt.jpeg", "unsupported.heic"]);
  });

  it("skips a repeated HEIC before conversion even after the accepted photo has been resized", async () => {
    const service = TestBed.inject(FileUtilsService);
    const file = new File(["HEIC"], "photo.heic", {type: "image/heic"});
    vi.spyOn(service, "fileListToBase64Files").mockResolvedValue([{file, base64Content: "data:image/heic;base64,SEVJQw=="}]);
    const convert = vi.spyOn(service, "convertHEICFile").mockImplementation(async file => ({file, isImage: true}));
    const first = await service.prepareDroppedFiles([file]);
    const savedPhoto = {...service.contentMetadataItemFromBase64File(first.images[0]), base64Content: null, image: "photo.jpeg"};
    const repeated = await service.prepareDroppedFiles([file], [savedPhoto]);
    expect(first.images).toHaveLength(1);
    expect(repeated.images).toHaveLength(0);
    expect(repeated.skippedDuplicates).toBe(1);
    expect(convert).toHaveBeenCalledOnce();
  });

  it("uses capture metadata from the original HEIC before converting it", async () => {
    const service = TestBed.inject(FileUtilsService);
    const file = new File(["HEIC"], "photo.heic", {type: "image/heic", lastModified: 1800000000000});
    vi.mocked(parse).mockResolvedValue({DateTimeOriginal: DateTime.fromMillis(1700000000000).toJSDate()});
    vi.spyOn(service, "fileListToBase64Files").mockResolvedValue([{file, base64Content: "data:image/heic;base64,SEVJQw=="}]);
    vi.spyOn(service, "convertHEICFile").mockImplementation(async file => ({file, isImage: true}));
    const prepared = await service.prepareDroppedFiles([file]);
    expect(parse).toHaveBeenCalledWith(file, ["DateTimeOriginal", "CreateDate"]);
    expect(service.contentMetadataItemFromBase64File(prepared.images[0]).date).toBe(1700000000000);
  });

  it("falls back to the file date when capture metadata has been removed", async () => {
    const service = TestBed.inject(FileUtilsService);
    const file = new File(["photo"], "photo.jpeg", {type: "image/jpeg", lastModified: 1700000000000});
    expect(service.contentMetadataItemFromBase64File({file, base64Content: "", dateTaken: null}).date).toBe(1700000000000);
  });

  it("does not report a conversion error when the browser can display the original file", async () => {
    const service = TestBed.inject(FileUtilsService);
    const worker = browserDecoder();
    vi.spyOn(service as any, "canDisplayImage").mockResolvedValue(true);
    const errors = vi.spyOn(service["logger"], "error");
    const file = new File(["photo"], "photo.heic", {type: "image/heic"});
    const conversion = service.convertHEICFile({file, base64Content: "data:image/heic;base64,AAAA"});
    worker.onmessage.call(null, {data: {jpeg: null, error: "The HEIC file contains no readable photo"}} as MessageEvent);
    expect((await conversion).isImage).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });

});
