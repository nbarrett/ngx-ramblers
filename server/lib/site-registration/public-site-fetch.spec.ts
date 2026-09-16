import expect from "expect";
import { describe, it } from "mocha";
import { HttpError } from "../shared/http-error";
import { sourceUnavailable, withoutQuery } from "./public-site-fetch";

describe("public-site-fetch", () => {
  it("treats a client error from the current website as a link that no longer works", () => {
    expect(sourceUnavailable(new HttpError(403, "expired signed link"))).toBe(true);
    expect(sourceUnavailable(new HttpError(404, "missing document"))).toBe(true);
  });

  it("treats a link to a domain that no longer exists as a link that no longer works", () => {
    expect(sourceUnavailable(Object.assign(new Error("getaddrinfo ENOTFOUND www.old-partner.example"), {code: "ENOTFOUND"}))).toBe(true);
  });

  it("does not treat server errors, timeouts or conversion failures as dead links", () => {
    expect(sourceUnavailable(new HttpError(503, "unavailable"))).toBe(false);
    expect(sourceUnavailable(new Error("The website did not respond in time."))).toBe(false);
  });

  it("drops the query string so signed parameters never appear in messages", () => {
    expect(withoutQuery("https://bucket.example.org/files/newsletter.pdf?X-Amz-Credential=abc&X-Amz-Signature=def")).toEqual("https://bucket.example.org/files/newsletter.pdf");
    expect(withoutQuery("not a url")).toEqual("not a url");
  });
});
