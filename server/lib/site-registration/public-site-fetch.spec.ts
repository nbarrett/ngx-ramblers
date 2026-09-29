import expect from "expect";
import { describe, it } from "mocha";
import { gzipSync } from "zlib";
import { HttpError } from "../shared/http-error";
import { decodedPublicSiteBody, PUBLIC_SITE_USER_AGENT, publicSiteHttpErrorMessage, shouldRelayPublicSiteFetch, sourceUnavailable, withoutQuery } from "./public-site-fetch";

describe("public-site-fetch", () => {
  it("uses a browser user agent for sites that reject migration crawlers", () => {
    expect(PUBLIC_SITE_USER_AGENT).toContain("Chrome/");
  });

  it("treats a client error from the current website as a link that no longer works", () => {
    expect(sourceUnavailable(new HttpError(403, "expired signed link"))).toBe(true);
    expect(sourceUnavailable(new HttpError(404, "missing document"))).toBe(true);
  });

  it("explains a refused home page without HTTP status wording", () => {
    expect(publicSiteHttpErrorMessage("https://www.group.example/", 403))
      .toEqual("The current website at https://www.group.example/ refused to send its pages to our servers. The address is readable in a browser; its protection is blocking the import. Try Find pages again, or ask the webmaster to pause bot protection while the pages are copied.");
    expect(publicSiteHttpErrorMessage("https://www.group.example/?q=1", 403)).not.toMatch(/returned HTTP|HTTP 403|charset=/i);
  });

  it("inflates a gzip body from the current website", () => {
    const plain = Buffer.from("<html>Welcome</html>");
    expect(decodedPublicSiteBody(Buffer.from(Uint8Array.from(gzipSync(Uint8Array.from(plain)))), "gzip").toString()).toEqual(plain.toString());
  });

  it("treats a link to a domain that no longer exists as a link that no longer works", () => {
    expect(sourceUnavailable(Object.assign(new Error("getaddrinfo ENOTFOUND www.old-partner.example"), {code: "ENOTFOUND"}))).toBe(true);
  });

  it("does not treat server errors, timeouts or conversion failures as dead links", () => {
    expect(sourceUnavailable(new HttpError(503, "unavailable"))).toBe(false);
    expect(sourceUnavailable(new Error("The website did not respond in time."))).toBe(false);
  });

  it("relays a refused home page through Cloudflare", () => {
    expect(shouldRelayPublicSiteFetch(new HttpError(403, "refused"))).toBe(true);
    expect(shouldRelayPublicSiteFetch(new HttpError(401, "auth"))).toBe(true);
    expect(shouldRelayPublicSiteFetch(new HttpError(404, "missing"))).toBe(false);
    expect(shouldRelayPublicSiteFetch(new Error("timeout"))).toBe(false);
  });

  it("drops the query string so signed parameters never appear in messages", () => {
    expect(withoutQuery("https://bucket.example.org/files/newsletter.pdf?X-Amz-Credential=abc&X-Amz-Signature=def")).toEqual("https://bucket.example.org/files/newsletter.pdf");
    expect(withoutQuery("not a url")).toEqual("not a url");
  });
});
