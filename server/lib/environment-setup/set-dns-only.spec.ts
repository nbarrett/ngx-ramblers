import sinon from "sinon";
import expect from "expect";
import { afterEach, describe, it } from "mocha";
import * as cloudflareDns from "../cloudflare/cloudflare-dns";
import * as environmentsConfig from "../environments/environments-config";
import * as environmentContext from "./environment-context";
import { DnsRecordType, REDIRECT_PLACEHOLDER_IPV4 } from "../cloudflare/cloudflare.model";
import { setHostnameDnsOnly } from "./set-dns-only";

describe("setHostnameDnsOnly", () => {

  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  function stubs(records: {id: string; type: string; name: string; content: string; ttl: number; proxied: boolean}[]): sinon.SinonStub {
    sandbox.stub(environmentContext, "loadEnvironmentContext").resolves({} as never);
    sandbox.stub(environmentsConfig, "configuredEnvironments").resolves({cloudflare: {apiToken: "token"}} as never);
    sandbox.stub(cloudflareDns, "zoneForHostname").resolves({id: "zone-id", name: "group.example.org.uk", status: "active"} as never);
    sandbox.stub(cloudflareDns, "listDnsRecords").resolves(records as never);
    return sandbox.stub(cloudflareDns, "updateDnsRecord").resolves({} as never);
  }

  it("should turn a proxied A record into DNS only", async () => {
    const update = stubs([{
      id: "rec-1",
      type: DnsRecordType.A,
      name: "www.group.example.org.uk",
      content: "66.241.124.94",
      ttl: 1,
      proxied: true
    }]);
    const result = await setHostnameDnsOnly("group", "www.group.example.org.uk");
    expect(result.updated).toEqual(1);
    expect(update.calledOnce).toEqual(true);
    expect(update.firstCall.args[2].proxied).toEqual(false);
  });

  it("should leave an already DNS-only record unchanged", async () => {
    const update = stubs([{
      id: "rec-1",
      type: DnsRecordType.A,
      name: "group.example.org.uk",
      content: "66.241.124.94",
      ttl: 1,
      proxied: false
    }]);
    const result = await setHostnameDnsOnly("group", "group.example.org.uk");
    expect(result.updated).toEqual(0);
    expect(update.called).toEqual(false);
  });

  it("should refuse to grey-cloud a redirect placeholder", async () => {
    stubs([{
      id: "rec-1",
      type: DnsRecordType.A,
      name: "www.group.example.org.uk",
      content: REDIRECT_PLACEHOLDER_IPV4,
      ttl: 1,
      proxied: true
    }]);
    await expect(setHostnameDnsOnly("group", "www.group.example.org.uk"))
      .rejects.toMatchObject({message: expect.stringContaining("redirect placeholder")});
  });
});
