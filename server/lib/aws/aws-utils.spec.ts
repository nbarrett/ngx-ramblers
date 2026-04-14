import expect from "expect";
import { describe, it } from "mocha";
import { contentTypeFrom, extensionFrom, isAwsUploadErrorResponse } from "./aws-utils";
import { AwsInfo, AwsUploadErrorResponse } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";

describe("aws-utils.extensionFrom", () => {
  it("returns the lowercase extension with leading dot", () => {
    expect(extensionFrom("Photo.JPG")).toEqual(".jpg");
  });

  it("defaults to .jpeg when no extension is recognisable", () => {
    expect(extensionFrom("filename-without-extension")).toEqual(".jpeg");
  });

  it("defaults to .jpeg when extension is longer than 5 chars", () => {
    expect(extensionFrom("some.file.longextension")).toEqual(".jpeg");
  });
});

describe("aws-utils.contentTypeFrom", () => {
  it("returns text/html for .html", () => {
    expect(contentTypeFrom("index.html")).toEqual("text/html; charset=utf-8");
  });

  it("returns text/html for .htm", () => {
    expect(contentTypeFrom("legacy.htm")).toEqual("text/html; charset=utf-8");
  });

  it("returns text/css for .css", () => {
    expect(contentTypeFrom("styles.css")).toEqual("text/css; charset=utf-8");
  });

  it("returns application/javascript for .js", () => {
    expect(contentTypeFrom("bundle.js")).toEqual("application/javascript; charset=utf-8");
  });

  it("returns application/javascript for .mjs", () => {
    expect(contentTypeFrom("module.mjs")).toEqual("application/javascript; charset=utf-8");
  });

  it("returns image/png for .png", () => {
    expect(contentTypeFrom("screenshot.png")).toEqual("image/png");
  });

  it("returns image/jpeg for .jpg", () => {
    expect(contentTypeFrom("photo.jpg")).toEqual("image/jpeg");
  });

  it("returns image/jpeg for .jpeg", () => {
    expect(contentTypeFrom("photo.jpeg")).toEqual("image/jpeg");
  });

  it("returns image/svg+xml for .svg", () => {
    expect(contentTypeFrom("icon.svg")).toEqual("image/svg+xml");
  });

  it("returns image/webp for .webp", () => {
    expect(contentTypeFrom("hero.webp")).toEqual("image/webp");
  });

  it("returns image/heic for .heic", () => {
    expect(contentTypeFrom("image.heic")).toEqual("image/heic");
  });

  it("returns image/gif for .gif", () => {
    expect(contentTypeFrom("loader.gif")).toEqual("image/gif");
  });

  it("returns image/x-icon for .ico", () => {
    expect(contentTypeFrom("favicon.ico")).toEqual("image/x-icon");
  });

  it("returns application/json for .json", () => {
    expect(contentTypeFrom("config.json")).toEqual("application/json");
  });

  it("returns application/json for .geojson", () => {
    expect(contentTypeFrom("map.geojson")).toEqual("application/json");
  });

  it("returns font/woff2 for .woff2", () => {
    expect(contentTypeFrom("font.woff2")).toEqual("font/woff2");
  });

  it("returns font/ttf for .ttf", () => {
    expect(contentTypeFrom("font.ttf")).toEqual("font/ttf");
  });

  it("returns application/pdf for .pdf", () => {
    expect(contentTypeFrom("document.pdf")).toEqual("application/pdf");
  });

  it("returns application/msword for .doc / .docx", () => {
    expect(contentTypeFrom("letter.doc")).toEqual("application/msword");
    expect(contentTypeFrom("letter.docx")).toEqual("application/msword");
  });

  it("returns application/gpx+xml for .gpx", () => {
    expect(contentTypeFrom("route.gpx")).toEqual("application/gpx+xml");
  });

  it("returns application/zip for .zip", () => {
    expect(contentTypeFrom("bundle.zip")).toEqual("application/zip");
  });

  it("returns application/gzip for .gz", () => {
    expect(contentTypeFrom("archive.tar.gz")).toEqual("application/gzip");
  });

  it("is case-insensitive for the extension", () => {
    expect(contentTypeFrom("Index.HTML")).toEqual("text/html; charset=utf-8");
  });

  it("falls back to application/octet-stream for unknown extensions", () => {
    expect(contentTypeFrom("file.xyz")).toEqual("application/octet-stream");
  });

  it("falls back to application/octet-stream when there is no extension", () => {
    expect(contentTypeFrom("filename-without-extension")).toEqual("application/octet-stream");
  });
});

describe("aws-utils.isAwsUploadErrorResponse", () => {
  it("returns true when response contains an error field", () => {
    const errorResponse: AwsUploadErrorResponse = { error: "oops", responseData: null as never };
    expect(isAwsUploadErrorResponse(errorResponse)).toBe(true);
  });

  it("returns false for a non-error response", () => {
    const successResponse: AwsInfo = {} as AwsInfo;
    expect(isAwsUploadErrorResponse(successResponse)).toBe(false);
  });
});
