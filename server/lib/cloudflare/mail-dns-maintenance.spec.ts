import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as configuration from "./cloudflare-config";
import * as dns from "./cloudflare-dns";
import * as routing from "./cloudflare-email-routing";
import * as sending from "../brevo/domains/domain-management";
import * as system from "../config/system-config";
import { removeMailDnsDelegation } from "./mail-dns-maintenance";
import { CLOUDFLARE_INBOUND_MX } from "../../../projects/ngx-ramblers/src/app/functions/mx-record-status";
import { DnsRecordType } from "./cloudflare.model";

const hostname = "group.example.org.uk";
const records = ["ns1.mail-provider.example.com", "ns2.mail-provider.example.com"].map((content, index) => ({
  id: `ns-${index}`, name: hostname, type: DnsRecordType.NS, content
}));
const request = () => ({user: {memberAdmin: true}, body: {hostname, records}} as unknown as Request);

describe("mail DNS maintenance", () => {
  const sandbox = sinon.createSandbox();
  const calls = {remove: null as sinon.SinonStub, list: null as sinon.SinonStub, routing: null as sinon.SinonStub, zone: null as sinon.SinonStub};

  beforeEach(() => {
    sandbox.stub(system, "systemConfig").resolves({group: {href: `https://${hostname}`}});
    sandbox.stub(configuration, "configuredCloudflare").resolves({apiToken: "test-token"});
    calls.zone = sandbox.stub(dns, "zoneForHostname").resolves({id: "zone-id", name: "example.org.uk", status: "active"});
    calls.list = sandbox.stub(dns, "listDnsRecords").resolves([]);
    sandbox.stub(sending, "domainConfiguration").resolves({domain: hostname, authenticated: true, verified: true, dnsRecords: {
      dkimRecord: {type: "TXT", hostName: "mail._domainkey", value: "fictional-dkim", status: true},
      brevoCode: {type: "TXT", hostName: hostname, value: "fictional-code", status: true}
    }});
    calls.list.withArgs(sinon.match.any, `mail._domainkey.${hostname}`, DnsRecordType.TXT).resolves([{id: "dkim-1", name: `mail._domainkey.${hostname}`, type: "TXT", content: "fictional-dkim"}]);
    calls.list.withArgs(sinon.match.any, hostname, DnsRecordType.NS).resolves(records);
    calls.list.withArgs(sinon.match.any, hostname, DnsRecordType.MX).resolves(CLOUDFLARE_INBOUND_MX.map((record, index) => ({...record, id: `mx-${index}`, name: hostname, type: DnsRecordType.MX})));
    calls.routing = sandbox.stub(routing, "getEmailRoutingSettings").resolves({enabled: true});
    calls.remove = sandbox.stub(dns, "deleteDnsRecord").resolves();
  });
  afterEach(() => sandbox.restore());

  it("removes only the exact reviewed NS records after checking Cloudflare routing and MX", async () => {
    const json = sandbox.spy();
    await removeMailDnsDelegation(request(), {json} as unknown as Response);
    expect(calls.remove.args.map(args => args[1])).toEqual(["ns-0", "ns-1"]);
    expect(json.firstCall.args[0].response.removedRecords).toEqual(records);
    expect(json.firstCall.args[0].response.message).toContain("DNS caches may retain");
  });

  it("requires a member administrator", async () => {
    const req = {...request(), user: {walkAdmin: true}} as unknown as Request;
    await expect(removeMailDnsDelegation(req, {} as Response)).rejects.toMatchObject({status: 403});
    expect(calls.remove.called).toBe(false);
  });

  it("cannot change another site's delegation", async () => {
    const req = request();
    req.body.hostname = "other.example.org.uk";
    await expect(removeMailDnsDelegation(req, {} as Response)).rejects.toMatchObject({status: 400});
    expect(calls.remove.called).toBe(false);
  });

  it("cannot remove zone apex nameservers", async () => {
    calls.zone.resolves({id: "zone-id", name: hostname, status: "active"});
    await expect(removeMailDnsDelegation(request(), {} as Response)).rejects.toMatchObject({status: 400});
    expect(calls.remove.called).toBe(false);
  });

  it("rejects records changed since the user reviewed them", async () => {
    const req = request();
    req.body.records = records.map(record => ({...record, content: "changed.example.com"}));
    await expect(removeMailDnsDelegation(req, {} as Response)).rejects.toMatchObject({status: 409});
    expect(calls.remove.called).toBe(false);
  });

  it("rejects incomplete or duplicate record selections", async () => {
    const req = request();
    req.body.records = [records[0], records[0]];
    await expect(removeMailDnsDelegation(req, {} as Response)).rejects.toMatchObject({status: 409});
    expect(calls.remove.called).toBe(false);
  });

  it("refuses removal until Cloudflare mail routing is ready", async () => {
    calls.routing.resolves({enabled: false});
    await expect(removeMailDnsDelegation(request(), {} as Response)).rejects.toMatchObject({status: 409});
    expect(calls.remove.called).toBe(false);
  });

  it("refuses removal when required Cloudflare MX is missing", async () => {
    calls.list.withArgs(sinon.match.any, hostname, DnsRecordType.MX).resolves([]);
    await expect(removeMailDnsDelegation(request(), {} as Response)).rejects.toMatchObject({status: 409});
    expect(calls.remove.called).toBe(false);
  });

  it("blocks removal when Brevo reports authenticated but its individual DKIM records are absent", async () => {
    calls.list.withArgs(sinon.match.any, `mail._domainkey.${hostname}`, DnsRecordType.TXT).resolves([]);
    await expect(removeMailDnsDelegation(request(), {} as Response)).rejects.toMatchObject({status: 409, message: expect.stringContaining("DKIM signing records are not configured")});
    expect(calls.remove.called).toBe(false);
  });

  it("reports partial Cloudflare failures instead of claiming success", async () => {
    calls.remove.onSecondCall().rejects(new Error("Cloudflare unavailable"));
    await expect(removeMailDnsDelegation(request(), {} as Response)).rejects.toMatchObject({status: 502, message: expect.stringContaining("Removed 1 of 2")});
  });
});
