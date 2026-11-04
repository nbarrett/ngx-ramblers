import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import * as domains from "./domain-management";
import * as dns from "../../cloudflare/cloudflare-dns";
import { authenticateSendingDomain } from "./domain-authentication";
import { BrevoClient } from "@getbrevo/brevo";
import { brevoDnsRecordHostname } from "../../../../projects/ngx-ramblers/src/app/functions/brevo-domain-dns";

const hostname = "group.example.org.uk";
const modernRecords = {
  dkimRecord: {type: "", hostName: "", value: "", status: false},
  dkim1Record: {type: "CNAME", hostName: "brevo1._domainkey", value: "b1.dkim.example.com", status: true},
  dkim2Record: {type: "CNAME", hostName: "brevo2._domainkey", value: "b2.dkim.example.com", status: true},
  brevoCode: {type: "TXT", hostName: "group", value: "fictional-code", status: true}
};

describe("Brevo domain DNS mapping", () => {
  it("retains both modern DKIM CNAME records returned by the API", async () => {
    const client = {domains: {getDomainConfiguration: async () => ({domain: hostname, authenticated: true, verified: true, dns_records: {
      dkim_record: null,
      dkim1Record: {type: "CNAME", host_name: "brevo1._domainkey", value: "b1.dkim.example.com", status: false},
      dkim2Record: {type: "CNAME", host_name: "brevo2._domainkey", value: "b2.dkim.example.com", status: false}
    }})}} as unknown as BrevoClient;
    const result = await domains.domainConfiguration(hostname, client);
    expect(result.dnsRecords.dkim1Record.value).toBe("b1.dkim.example.com");
    expect(result.dnsRecords.dkim2Record.type).toBe("CNAME");
  });

  it("resolves domain-relative selectors and zone-relative names without duplicating the subdomain", () => {
    expect(brevoDnsRecordHostname("brevo1._domainkey", hostname, "example.org.uk")).toBe(`brevo1._domainkey.${hostname}`);
    expect(brevoDnsRecordHostname("brevo1._domainkey.group", hostname, "example.org.uk")).toBe(`brevo1._domainkey.${hostname}`);
    expect(brevoDnsRecordHostname("group", hostname, "example.org.uk")).toBe(hostname);
    expect(brevoDnsRecordHostname(`brevo1._domainkey.${hostname}.`, hostname, "example.org.uk")).toBe(`brevo1._domainkey.${hostname}`);
  });
});

describe("configure individual Brevo authentication records", () => {
  const sandbox = sinon.createSandbox();
  const calls = {create: null as sinon.SinonStub, remove: null as sinon.SinonStub};
  beforeEach(() => {
    sandbox.stub(domains, "findDomainByName").resolves({id: 1, domainName: hostname, authenticated: true, verified: true});
    sandbox.stub(domains, "domainConfiguration").resolves({domain: hostname, authenticated: true, verified: true, dnsRecords: modernRecords});
    sandbox.stub(domains, "authenticateDomain").resolves({domainName: hostname, message: "Authentication checked"});
    sandbox.stub(dns, "zoneForHostname").resolves({id: "zone-id", name: "example.org.uk", status: "active"});
    sandbox.stub(dns, "listDnsRecords").resolves([]);
    sandbox.stub(dns, "updateDnsRecord").resolves({});
    calls.create = sandbox.stub(dns, "createDnsRecord").resolves({});
    calls.remove = sandbox.stub(domains, "deleteDomain").resolves();
  });
  afterEach(() => sandbox.restore());

  it("creates both DKIM CNAMEs even when Brevo already reports the domain authenticated", async () => {
    const result = await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    expect(result.authenticated).toBe(true);
    expect(calls.create.args.map(args => ({type: args[1].type, name: args[1].name}))).toEqual([
      {type: "CNAME", name: `brevo1._domainkey.${hostname}`},
      {type: "CNAME", name: `brevo2._domainkey.${hostname}`},
      {type: "TXT", name: hostname}
    ]);
    expect(calls.remove.called).toBe(false);
    expect(calls.create.args.every(args => args[1].type !== "NS")).toBe(true);
  });

  it("supports legacy TXT DKIM records without changing DNS authority", async () => {
    (domains.domainConfiguration as sinon.SinonStub).resolves({domain: hostname, authenticated: true, verified: true, dnsRecords: {
      dkimRecord: {type: "TXT", hostName: "mail._domainkey", value: "fictional-legacy-dkim", status: true},
      brevoCode: modernRecords.brevoCode
    }});
    await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    expect(calls.create.args.map(args => args[1].type)).toEqual(["TXT", "TXT"]);
    expect(calls.remove.called).toBe(false);
  });

  it("does not recreate matching DKIM CNAMEs on retry", async () => {
    const list = dns.listDnsRecords as sinon.SinonStub;
    list.withArgs(sinon.match.any, `brevo1._domainkey.${hostname}`, "CNAME").resolves([{id: "dkim-1", content: modernRecords.dkim1Record.value}]);
    list.withArgs(sinon.match.any, `brevo2._domainkey.${hostname}`, "CNAME").resolves([{id: "dkim-2", content: modernRecords.dkim2Record.value}]);
    list.withArgs(sinon.match.any, hostname, "TXT").resolves([{id: "code-1", content: modernRecords.brevoCode.value}]);
    await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    expect(calls.create.called).toBe(false);
    expect(calls.remove.called).toBe(false);
  });

  it("does not report setup success while the sending domain is delegated away from Cloudflare", async () => {
    (dns.listDnsRecords as sinon.SinonStub).withArgs(sinon.match.any, hostname, "NS").resolves([
      {id: "ns-1", name: hostname, type: "NS", content: "ns1.mail-provider.example.com"}
    ]);
    const removeDns = sandbox.stub(dns, "deleteDnsRecord");
    const result = await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    expect(result.authenticated).toBe(false);
    expect(result.message).toContain("Mail DNS maintenance");
    expect(result.brevoDomainsUrl).toBeNull();
    expect(removeDns.called).toBe(false);
    expect(calls.remove.called).toBe(false);
  });

  it("does not treat the overall authenticated flag as proof that DKIM verification passed", async () => {
    (domains.domainConfiguration as sinon.SinonStub).onSecondCall().resolves({domain: hostname, authenticated: true, verified: true, dnsRecords: {
      ...modernRecords,
      dkim1Record: {...modernRecords.dkim1Record, status: false},
      dkim2Record: {...modernRecords.dkim2Record, status: false}
    }});
    const result = await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    expect(result.authenticated).toBe(false);
    expect(result.message).toContain("has not verified them yet");
  });

  it("preserves SPF and unrelated TXT records while updating an old Brevo verification code", async () => {
    const records = {...modernRecords, brevoCode: {...modernRecords.brevoCode, value: "brevo-code:replacement"}};
    (domains.domainConfiguration as sinon.SinonStub).resolves({domain: hostname, authenticated: true, verified: true, dnsRecords: records});
    (dns.listDnsRecords as sinon.SinonStub).withArgs(sinon.match.any, hostname, "TXT").resolves([
      {id: "spf-1", content: "v=spf1 include:mail.example.com ~all"},
      {id: "verification-1", content: "brevo-code:previous"},
      {id: "other-1", content: "another-provider-verification=fictional-value"}
    ]);
    const removeDns = sandbox.stub(dns, "deleteDnsRecord");
    await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    const update = dns.updateDnsRecord as sinon.SinonStub;
    expect(update.calledOnce).toBe(true);
    expect(update.firstCall.args[1]).toBe("verification-1");
    expect(update.firstCall.args[2].content).toBe("brevo-code:replacement");
    expect(removeDns.called).toBe(false);
  });

  it("keeps an existing Brevo registration when legacy DKIM is missing", async () => {
    (domains.domainConfiguration as sinon.SinonStub).resolves({domain: hostname, authenticated: false, verified: false, dnsRecords: {
      dkimRecord: {type: "", hostName: "", value: "", status: false},
      brevoCode: {type: "", hostName: "", value: "", status: false}
    }});
    await authenticateSendingDomain(hostname, {cloudflareDnsConfig: {apiToken: "test-token", zoneId: "zone-id"}, baseDomainOverride: "example.org.uk"});
    expect(calls.remove.called).toBe(false);
  });
});
