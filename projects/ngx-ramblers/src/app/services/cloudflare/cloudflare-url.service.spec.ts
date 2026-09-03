import { CloudflareUrlService } from "./cloudflare-url.service";

describe("CloudflareUrlService", () => {
  const service = new CloudflareUrlService();
  const accountId = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4";

  it("uses the apex zone name in the email routing overview URL", () => {
    expect(service.emailRoutingOverview(accountId, "example.org.uk"))
      .toBe(`https://dash.cloudflare.com/${accountId}/example.org.uk/email/routing/overview`);
  });

  it("strips a leading www. so the Cloudflare dashboard does not 404", () => {
    expect(service.emailRoutingOverview(accountId, "www.example.org.uk"))
      .toBe(`https://dash.cloudflare.com/${accountId}/example.org.uk/email/routing/overview`);
  });

  it("lowercases the zone name", () => {
    expect(service.emailRoutingOverview(accountId, "WWW.Example.org.uk"))
      .toBe(`https://dash.cloudflare.com/${accountId}/example.org.uk/email/routing/overview`);
  });
});
