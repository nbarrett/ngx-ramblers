import expect from "expect";
import { afterEach, describe, it } from "mocha";
import { DnsRecordType } from "../../cloudflare/cloudflare.model";
import { reconcileAddressRecord } from "./subdomain";

describe("reconcileAddressRecord", () => {
  const originalFetch = globalThis.fetch;
  const dnsConfig = {apiToken: "token", zoneId: "zone"};

  function recordRequests(): {method: string; url: string; body: any}[] {
    const requests: {method: string; url: string; body: any}[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body || "{}"));
      requests.push({method: init.method, url: String(url), body});
      return {json: async () => ({success: true, errors: [], result: {id: "record-id", ...body}})} as Response;
    }) as typeof fetch;
    return requests;
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("points an address record left behind by an earlier app at the current app", async () => {
    const requests = recordRequests();
    const existing = [{id: "old-a", type: "A", content: "192.0.2.10"}];
    await reconcileAddressRecord(() => undefined, dnsConfig, "example-group", "example-group.example.org", DnsRecordType.A, "192.0.2.20", existing);
    expect(requests.map(request => request.method)).toEqual(["PUT"]);
    expect(requests[0].url).toContain("old-a");
    expect(requests[0].body.content).toEqual("192.0.2.20");
  });

  it("creates a missing address record and leaves a correct one alone", async () => {
    const requests = recordRequests();
    await reconcileAddressRecord(() => undefined, dnsConfig, "example-group", "example-group.example.org", DnsRecordType.AAAA, "2001:db8::20", []);
    await reconcileAddressRecord(() => undefined, dnsConfig, "example-group", "example-group.example.org", DnsRecordType.A, "192.0.2.20", [{id: "a", type: "A", content: "192.0.2.20"}]);
    expect(requests.map(request => request.method)).toEqual(["POST"]);
    expect(requests[0].body.content).toEqual("2001:db8::20");
  });
});
