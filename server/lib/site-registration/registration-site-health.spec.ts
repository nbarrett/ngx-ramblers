import expect from "expect";
import { describe, it } from "mocha";
import { registrationSiteHealth } from "./registration-site-health";

describe("registrationSiteHealth", () => {
  it("reports the advertised hostname as live when it responds", async () => {
    const health = await registrationSiteHealth(
      {siteUrl: "https://new-forest.ngx-ramblers.org.uk", environmentName: "new-forest"},
      async () => ({httpStatus: 200})
    );
    expect(health.advertisedReachable).toBe(true);
    expect(health.workingUrl).toBe("https://new-forest.ngx-ramblers.org.uk");
    expect(health.title).toBe(null);
  });

  it("points at the Fly address when the advertised hostname does not resolve", async () => {
    const health = await registrationSiteHealth(
      {siteUrl: "https://new-forest.ngx-ramblers.org.uk", environmentName: "new-forest"},
      async hostname => ({httpStatus: hostname.endsWith(".fly.dev") ? 200 : 0})
    );
    expect(health.advertisedReachable).toBe(false);
    expect(health.workingUrl).toBe("https://ngx-ramblers-new-forest.fly.dev");
    expect(health.title).toBe("The public hostname is not live");
    expect(health.detail).toContain("new-forest.ngx-ramblers.org.uk");
    expect(health.action).toContain("Setup subdomain");
  });
});
