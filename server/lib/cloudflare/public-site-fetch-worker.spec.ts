import expect from "expect";
import { describe, it } from "mocha";
import { publicSiteFetchRelay, resetPublicSiteFetchRelay, runWithPublicSiteFetchRelay } from "./public-site-fetch-worker";

describe("public site fetch relay", () => {
  it("uses the relay passed for a migration job without calling Cloudflare", async () => {
    resetPublicSiteFetchRelay();
    const relay = await runWithPublicSiteFetchRelay(
      {url: "https://ngx-public-site-fetch.example.workers.dev", secret: "job-secret"},
      () => publicSiteFetchRelay()
    );
    expect(relay).toEqual({url: "https://ngx-public-site-fetch.example.workers.dev", secret: "job-secret"});
  });
});
