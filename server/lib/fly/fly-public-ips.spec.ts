import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import * as certificates from "./fly-certificates";
import { IpAddressType } from "./fly.model";
import { ensureAppPublicIps } from "./fly-public-ips";

describe("ensureAppPublicIps", () => {
  const sandbox = sinon.createSandbox();
  const config = {apiToken: "fictional-token", appName: "ngx-ramblers-example-group"};

  afterEach(() => sandbox.restore());

  it("allocates dedicated IPv6 and shared IPv4 when the app has neither", async () => {
    sandbox.stub(certificates, "appIpAddresses").resolves({ipv4: null, ipv6: null});
    const allocate = sandbox.stub(certificates, "allocateIpAddress");
    allocate.withArgs(config, IpAddressType.V6).resolves({address: "2001:db8::20", type: "v6"});
    allocate.withArgs(config, IpAddressType.SharedV4).resolves({address: "192.0.2.20", type: "shared_v4"});
    expect(await ensureAppPublicIps(config)).toEqual({ipv4: "192.0.2.20", ipv6: "2001:db8::20"});
    expect(allocate.callCount).toBe(2);
  });

  it("leaves existing addresses alone", async () => {
    sandbox.stub(certificates, "appIpAddresses").resolves({ipv4: "192.0.2.10", ipv6: "2001:db8::10"});
    const allocate = sandbox.stub(certificates, "allocateIpAddress");
    expect(await ensureAppPublicIps(config)).toEqual({ipv4: "192.0.2.10", ipv6: "2001:db8::10"});
    expect(allocate.called).toBe(false);
  });

  it("fills only the missing address family", async () => {
    sandbox.stub(certificates, "appIpAddresses").resolves({ipv4: null, ipv6: "2001:db8::10"});
    const allocate = sandbox.stub(certificates, "allocateIpAddress");
    allocate.resolves({address: "192.0.2.20", type: "shared_v4"});
    expect(await ensureAppPublicIps(config)).toEqual({ipv4: "192.0.2.20", ipv6: "2001:db8::10"});
    expect(allocate.calledOnceWithExactly(config, IpAddressType.SharedV4)).toBe(true);
  });
});
