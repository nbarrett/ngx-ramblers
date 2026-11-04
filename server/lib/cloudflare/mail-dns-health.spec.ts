import expect from "expect";
import { afterEach, describe, it } from "mocha";
import sinon from "sinon";
import * as cloudflareDns from "./cloudflare-dns";
import * as publicDns from "../shared/dns-nameservers";
import { checkedMxRecordStatus } from "./mail-dns-health";
import { CLOUDFLARE_INBOUND_MX } from "../../../projects/ngx-ramblers/src/app/functions/mx-record-status";
import { MailDnsLookupStatus } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { DnsRecordType } from "./cloudflare.model";

const hostname = "group.example.org.uk";
const zone = {id: "zone-id", name: "example.org.uk", status: "active"};
const config = {apiToken: "test-token", zoneId: zone.id};
const records = CLOUDFLARE_INBOUND_MX.map((record, index) => ({...record, id: `mx-${index}`, name: hostname, type: DnsRecordType.MX}));
const lookups = ["1.1.1.1", "8.8.8.8"].map(resolver => ({resolver, status: MailDnsLookupStatus.MATCHED, exchanges: records.map(record => record.content), error: null}));

describe("mail DNS health", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("flags a delegated subdomain even when the parent zone has all required MX records and a resolver returns them", async () => {
    const ns = sandbox.stub(cloudflareDns, "listDnsRecords").resolves([
      {id: "ns-1", name: hostname, type: DnsRecordType.NS, content: "ns1.mail-provider.example.com"}
    ]);
    sandbox.stub(publicDns, "publicMailExchanges").resolves(lookups);
    const status = await checkedMxRecordStatus(config, hostname, zone, records);
    expect(status.allPresent).toBe(true);
    expect(status.dnsHealth.healthy).toBe(false);
    expect(status.dnsHealth.delegations).toEqual([{hostname, records: [{id: "ns-1", name: "group.example.org.uk", type: "NS", content: "ns1.mail-provider.example.com"}]}]);
    expect(status.dnsHealth.message).toContain("adding MX records or redeploying the inbox router does not fix delegation");
    expect(ns.firstCall.args).toEqual([config, hostname, DnsRecordType.NS]);
  });

  it("does not call DNS healthy when one public resolver fails", async () => {
    sandbox.stub(cloudflareDns, "listDnsRecords").resolves([]);
    sandbox.stub(publicDns, "publicMailExchanges").resolves([
      lookups[0], {...lookups[1], status: MailDnsLookupStatus.FAILED, exchanges: [], error: "ESERVFAIL"}
    ]);
    const status = await checkedMxRecordStatus(config, hostname, zone, records);
    expect(status.dnsHealth.healthy).toBe(false);
    expect(status.dnsHealth.lookups[1].error).toBe("ESERVFAIL");
    expect(status.dnsHealth.message).toContain("Senders may be unable to deliver mail");
  });

  it("checks ancestor delegation for a nested mail domain", async () => {
    const ns = sandbox.stub(cloudflareDns, "listDnsRecords");
    ns.withArgs(config, "team.group.example.org.uk", DnsRecordType.NS).resolves([]);
    ns.withArgs(config, hostname, DnsRecordType.NS).resolves([
      {id: "ns-1", name: hostname, type: DnsRecordType.NS, content: "ns1.mail-provider.example.com"}
    ]);
    sandbox.stub(publicDns, "publicMailExchanges").resolves(lookups);
    const status = await checkedMxRecordStatus(config, "team.group.example.org.uk", zone, records);
    expect(status.dnsHealth.healthy).toBe(false);
    expect(status.dnsHealth.delegations[0].hostname).toBe(hostname);
    expect(ns.callCount).toBe(2);
  });

  it("reports matching public DNS without claiming inbox delivery is proven", async () => {
    sandbox.stub(cloudflareDns, "listDnsRecords").resolves([]);
    sandbox.stub(publicDns, "publicMailExchanges").resolves(lookups);
    const status = await checkedMxRecordStatus(config, hostname, zone, records);
    expect(status.dnsHealth.healthy).toBe(true);
    expect(status.dnsHealth.message).toContain("does not prove a message reached the inbox");
  });

  it("does not treat apex nameservers as a subdomain delegation", async () => {
    const ns = sandbox.stub(cloudflareDns, "listDnsRecords");
    sandbox.stub(publicDns, "publicMailExchanges").resolves(lookups);
    const status = await checkedMxRecordStatus(config, zone.name, zone, records);
    expect(status.dnsHealth.healthy).toBe(true);
    expect(ns.called).toBe(false);
  });

  it("surfaces an unreadable delegation check instead of returning a healthy result", async () => {
    sandbox.stub(cloudflareDns, "listDnsRecords").rejects(new Error("DNS records access denied"));
    sandbox.stub(publicDns, "publicMailExchanges").resolves(lookups);
    await expect(checkedMxRecordStatus(config, hostname, zone, records)).rejects.toThrow("DNS records access denied");
  });
});
