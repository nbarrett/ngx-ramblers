import expect from "expect";
import { afterEach, describe, it } from "mocha";
import { Resolver } from "dns/promises";
import sinon from "sinon";
import { MailDnsLookupStatus } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { nameserverLookupCandidates, publicMailExchanges } from "./dns-nameservers";

describe("nameserverLookupCandidates", () => {

  it("walks from the hostname toward the registrable domain and skips public suffixes", () => {
    expect(nameserverLookupCandidates("staging.example.org.uk")).toEqual([
      "staging.example.org.uk",
      "example.org.uk"
    ]);
    expect(nameserverLookupCandidates("www.example.com")).toEqual([
      "example.com"
    ]);
  });

  it("keeps a two-label apex such as example.com", () => {
    expect(nameserverLookupCandidates("example.com")).toEqual(["example.com"]);
  });
});

describe("public mail DNS lookups", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("uses independent public resolvers and normalises MX names", async () => {
    const servers = sandbox.stub(Resolver.prototype, "setServers");
    sandbox.stub(Resolver.prototype, "resolveMx").resolves([{exchange: "MX.EXAMPLE.COM.", priority: 10}]);
    const results = await publicMailExchanges("group.example.org.uk", ["mx.example.com"]);
    expect(servers.args).toEqual([[["1.1.1.1"]], [["8.8.8.8"]]]);
    expect(results.map(result => result.status)).toEqual([MailDnsLookupStatus.MATCHED, MailDnsLookupStatus.MATCHED]);
  });

  it("retains DNS error codes alongside a successful result", async () => {
    sandbox.stub(Resolver.prototype, "setServers");
    const mx = sandbox.stub(Resolver.prototype, "resolveMx");
    mx.onFirstCall().rejects(Object.assign(new Error("DNS failed"), {code: "ESERVFAIL"}));
    mx.onSecondCall().resolves([{exchange: "mx.example.com", priority: 10}]);
    const results = await publicMailExchanges("group.example.org.uk", ["mx.example.com"]);
    expect(results[0]).toEqual({resolver: "1.1.1.1", status: MailDnsLookupStatus.FAILED, exchanges: [], error: "ESERVFAIL"});
    expect(results[1].status).toBe(MailDnsLookupStatus.MATCHED);
  });

  it("rejects different or empty public MX answers", async () => {
    sandbox.stub(Resolver.prototype, "setServers");
    const mx = sandbox.stub(Resolver.prototype, "resolveMx");
    mx.onFirstCall().resolves([{exchange: "other.example.com", priority: 10}]);
    mx.onSecondCall().resolves([]);
    const results = await publicMailExchanges("group.example.org.uk", ["mx.example.com"]);
    expect(results.map(result => result.status)).toEqual([MailDnsLookupStatus.DIFFERENT, MailDnsLookupStatus.DIFFERENT]);
  });
});
