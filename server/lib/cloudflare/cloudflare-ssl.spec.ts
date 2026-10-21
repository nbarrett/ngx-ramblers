import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { CloudflareSslMode } from "./cloudflare.model";
import * as certificates from "../fly/fly-certificates";
import * as fly from "../fly/fly-runtime-config";
import { dateTimeNow } from "../shared/dates";
import { ensureInboxRouterSsl } from "./cloudflare-ssl";

const config = {apiToken: "token", zoneId: "zone-1"};
const hostname = "group.example.org.uk";
const settingResponse = (value: CloudflareSslMode, editable = true) => Response.json({success: true, result: {value, editable}});

describe("inbox router origin encryption", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(fly, "flyRuntimeConfig").resolves({apiToken: "fly-token", appName: "group-app"} as any);
    sandbox.stub(certificates, "queryCertificates").resolves([{hostname, clientStatus: "Ready", issued: [{type: "rsa", expiresAt: dateTimeNow().plus({days: 30}).toISO()}]}]);
  });

  afterEach(() => sandbox.restore());

  it("leaves Full, Full (strict) and authenticated origin encryption unchanged", async () => {
    const request = sandbox.stub(global, "fetch");
    for (const mode of [CloudflareSslMode.FULL, CloudflareSslMode.STRICT, CloudflareSslMode.ORIGIN_PULL]) {
      request.resolves(settingResponse(mode));
      expect(await ensureInboxRouterSsl(config, hostname)).toBe(false);
    }
    expect(request.getCalls().every(call => !call.args[1].method)).toBe(true);
    expect((certificates.queryCertificates as sinon.SinonStub).called).toBe(false);
  });

  it("sets Flexible to Full (strict) only after verifying the hostname's issued Fly certificate", async () => {
    const request = sandbox.stub(global, "fetch");
    request.onFirstCall().resolves(settingResponse(CloudflareSslMode.FLEXIBLE));
    request.onSecondCall().resolves(settingResponse(CloudflareSslMode.STRICT));
    request.onThirdCall().resolves(settingResponse(CloudflareSslMode.STRICT));
    expect(await ensureInboxRouterSsl(config, hostname)).toBe(true);
    expect(request.secondCall.args[1].method).toBe("PATCH");
    expect(JSON.parse(request.secondCall.args[1].body as string)).toEqual({value: CloudflareSslMode.STRICT});
    expect((certificates.queryCertificates as sinon.SinonStub).firstCall.calledBefore(request.secondCall)).toBe(true);
  });

  it("refuses to change SSL if the Fly certificate belongs to another hostname", async () => {
    const request = sandbox.stub(global, "fetch").resolves(settingResponse(CloudflareSslMode.FLEXIBLE));
    (certificates.queryCertificates as sinon.SinonStub).resolves([{hostname: "other.example.org.uk", clientStatus: "Ready", issued: [{type: "rsa", expiresAt: dateTimeNow().plus({days: 30}).toISO()}]}]);
    await expect(ensureInboxRouterSsl(config, hostname)).rejects.toThrow("valid Fly origin certificate");
    expect(request.calledOnce).toBe(true);
  });

  it("refuses an expired certificate", async () => {
    const request = sandbox.stub(global, "fetch").resolves(settingResponse(CloudflareSslMode.OFF));
    (certificates.queryCertificates as sinon.SinonStub).resolves([{hostname, clientStatus: "Ready", issued: [{type: "rsa", expiresAt: dateTimeNow().minus({days: 1}).toISO()}]}]);
    await expect(ensureInboxRouterSsl(config, hostname)).rejects.toThrow("valid Fly origin certificate");
    expect(request.calledOnce).toBe(true);
  });

  it("reports an unsuccessful SSL update", async () => {
    const request = sandbox.stub(global, "fetch");
    request.onFirstCall().resolves(settingResponse(CloudflareSslMode.FLEXIBLE));
    request.onSecondCall().resolves(Response.json({success: false, errors: [{message: "Permission denied"}]}));
    await expect(ensureInboxRouterSsl(config, hostname)).rejects.toThrow("Permission denied");
  });
});
