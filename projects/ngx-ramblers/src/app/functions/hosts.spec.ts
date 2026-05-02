import { apexHost, isHostUnderDomain } from "./hosts";

describe("apexHost", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(apexHost(null)).toBe("");
    expect(apexHost(undefined)).toBe("");
    expect(apexHost("")).toBe("");
  });

  it("strips a leading www. prefix", () => {
    expect(apexHost("www.example.com")).toBe("example.com");
  });

  it("leaves hosts without a www prefix unchanged", () => {
    expect(apexHost("example.com")).toBe("example.com");
    expect(apexHost("bolton.ngx-ramblers.org.uk")).toBe("bolton.ngx-ramblers.org.uk");
  });
});

describe("isHostUnderDomain", () => {
  it("returns false when either input is missing", () => {
    expect(isHostUnderDomain(null, "ngx-ramblers.org.uk")).toBe(false);
    expect(isHostUnderDomain("bolton.ngx-ramblers.org.uk", null)).toBe(false);
    expect(isHostUnderDomain("", "")).toBe(false);
  });

  it("returns true when host equals baseDomain (apex)", () => {
    expect(isHostUnderDomain("ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
  });

  it("returns true for a subdomain of baseDomain", () => {
    expect(isHostUnderDomain("bolton.ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
    expect(isHostUnderDomain("a.b.ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
  });

  it("returns true after stripping a leading www. from the host", () => {
    expect(isHostUnderDomain("www.ngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(true);
  });

  it("returns false for an unrelated host", () => {
    expect(isHostUnderDomain("winchesterwalkingweekend.org.uk", "ngx-ramblers.org.uk")).toBe(false);
  });

  it("does not treat a domain that merely ends with the same string as a subdomain", () => {
    expect(isHostUnderDomain("notngx-ramblers.org.uk", "ngx-ramblers.org.uk")).toBe(false);
  });

  it("matches case-insensitively", () => {
    expect(isHostUnderDomain("Bolton.NGX-Ramblers.ORG.UK", "ngx-ramblers.org.uk")).toBe(true);
    expect(isHostUnderDomain("ngx-ramblers.org.uk", "NGX-RAMBLERS.ORG.UK")).toBe(true);
  });
});
