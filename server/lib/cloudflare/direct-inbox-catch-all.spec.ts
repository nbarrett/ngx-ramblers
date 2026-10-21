import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { EmailRoutingActionType, EmailRoutingMatcherType, EmailRoutingRule, SHARED_INBOX_ROUTER_WORKER_NAME } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import * as envConfigModule from "../env-config/env-config";
import * as routing from "./cloudflare-email-routing";
import * as workers from "./cloudflare-email-workers";
import * as dns from "./cloudflare-dns";
import * as destinations from "./cloudflare-destination-addresses";
import { assertCatchAllOwnedByThisSite, ensureDirectInboxCatchAll, ensureRouterWorker } from "./direct-inbox-catch-all";

const siteDomain = "group.example.org.uk";
const zoneWorker = "email-inbox-router-group-example-org-uk";
const fallback = "mailbox@example.com";
const cloudflareConfig = {zoneId: "zone-1", apiToken: "token", accountId: "account-1", baseDomain: "platform.example.org.uk"};

function routerRule(workerName: string = zoneWorker): EmailRoutingRule {
  return {name: `Catch-all - Shared inbox router (fallback ${fallback})`, enabled: true, actions: [{type: EmailRoutingActionType.WORKER, value: [workerName]}]} as EmailRoutingRule;
}

describe("zone inbox router deployment", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(envConfigModule.envConfig, "value").returns("secret");
    sandbox.stub(dns, "zoneForHostname").resolves({id: "zone-1", name: siteDomain, status: "active"});
    sandbox.stub(destinations, "ensureForwardDestinationVerified").resolves();
    sandbox.stub(workers, "uploadWorkerScript").resolves({} as any);
    sandbox.stub(workers, "uploadWorkerSecret").resolves();
    sandbox.stub(workers, "workerSecretNames").resolves([]);
    sandbox.stub(routing, "updateCatchAllRule").resolves({} as any);
    sandbox.stub(routing, "listEmailRoutingRules").resolves([]);
    sandbox.stub(routing, "updateEmailRoutingRule").resolves({} as any);
  });

  afterEach(() => sandbox.restore());

  it("migrates a forward catch-all only after uploading the zone worker and both secrets", async () => {
    sandbox.stub(routing, "catchAllRule").resolves({actions: [{type: EmailRoutingActionType.FORWARD, value: [fallback]}]} as EmailRoutingRule);
    const result = await ensureDirectInboxCatchAll(cloudflareConfig, siteDomain);
    const upload = workers.uploadWorkerScript as sinon.SinonStub;
    const secret = workers.uploadWorkerSecret as sinon.SinonStub;
    const update = routing.updateCatchAllRule as sinon.SinonStub;
    expect(result.changed).toBe(true);
    expect(upload.firstCall.args[1]).toBe(zoneWorker);
    expect(upload.firstCall.args[0].baseDomain).toBe(siteDomain);
    expect(secret.secondCall.args.slice(1)).toEqual([zoneWorker, "NGX_FALLBACK_FORWARD", fallback]);
    expect(secret.secondCall.calledBefore(update.firstCall)).toBe(true);
    expect(update.firstCall.args[1].actions[0].value).toEqual([zoneWorker]);
  });

  it("migrates a legacy router using the zone rule's recorded fallback", async () => {
    sandbox.stub(routing, "catchAllRule").resolves(routerRule(SHARED_INBOX_ROUTER_WORKER_NAME));
    const result = await ensureDirectInboxCatchAll(cloudflareConfig, siteDomain);
    expect(result.scriptName).toBe(zoneWorker);
    expect(result.changed).toBe(true);
    expect((workers.uploadWorkerScript as sinon.SinonStub).firstCall.args[1]).toBe(zoneWorker);
    expect((routing.updateCatchAllRule as sinon.SinonStub).firstCall.args[1].name).toContain(fallback);
  });

  it("moves explicit legacy address rules in this zone while preserving their matchers and enabled state", async () => {
    sandbox.stub(routing, "catchAllRule").resolves(routerRule(SHARED_INBOX_ROUTER_WORKER_NAME));
    const rule = {...routerRule(SHARED_INBOX_ROUTER_WORKER_NAME), tag: "rule-1", enabled: false, matchers: [{type: EmailRoutingMatcherType.LITERAL, value: `chair@${siteDomain}`}]};
    (routing.listEmailRoutingRules as sinon.SinonStub).resolves([rule, {...routerRule(), tag: "rule-2"}, {...routerRule(SHARED_INBOX_ROUTER_WORKER_NAME), tag: "catch-all", matchers: [{type: EmailRoutingMatcherType.ALL}]}]);
    await ensureDirectInboxCatchAll(cloudflareConfig, siteDomain);
    const update = routing.updateEmailRoutingRule as sinon.SinonStub;
    expect(update.calledOnce).toBe(true);
    expect(update.firstCall.args[0].zoneId).toBe("zone-1");
    expect(update.firstCall.args[1]).toBe("rule-1");
    expect(update.firstCall.args[2]).toEqual({...rule, actions: [{type: EmailRoutingActionType.WORKER, value: [zoneWorker]}]});
    expect((workers.uploadWorkerSecret as sinon.SinonStub).secondCall.calledBefore(update.firstCall)).toBe(true);
  });

  it("refreshes the zone router with its fallback without rewriting an active catch-all", async () => {
    sandbox.stub(routing, "catchAllRule").resolves(routerRule());
    const result = await ensureDirectInboxCatchAll(cloudflareConfig, siteDomain);
    expect(result.changed).toBe(false);
    expect((workers.uploadWorkerSecret as sinon.SinonStub).callCount).toBe(2);
    expect((routing.updateCatchAllRule as sinon.SinonStub).called).toBe(false);
  });

  it("lets a subdomain reuse its parent router without any Cloudflare writes", async () => {
    sandbox.stub(routing, "catchAllRule").resolves(routerRule());
    const result = await ensureDirectInboxCatchAll(cloudflareConfig, `branch.${siteDomain}`);
    expect(result.scriptName).toBe(zoneWorker);
    expect(result.changed).toBe(false);
    expect((workers.uploadWorkerScript as sinon.SinonStub).called).toBe(false);
    expect((workers.uploadWorkerSecret as sinon.SinonStub).called).toBe(false);
    expect((routing.updateCatchAllRule as sinon.SinonStub).called).toBe(false);
  });

  it("preserves the legacy parent router when a subdomain switches provider", async () => {
    sandbox.stub(routing, "catchAllRule").resolves(routerRule(SHARED_INBOX_ROUTER_WORKER_NAME));
    const result = await ensureDirectInboxCatchAll(cloudflareConfig, `branch.${siteDomain}`);
    expect(result.scriptName).toBe(SHARED_INBOX_ROUTER_WORKER_NAME);
    expect((workers.uploadWorkerScript as sinon.SinonStub).called).toBe(false);
  });

  it("refuses subdomain publishing even when the parent router exists", async () => {
    await expect(ensureRouterWorker(cloudflareConfig, `branch.${siteDomain}`, fallback)).rejects.toMatchObject({code: "SubdomainCatchAllForbidden"});
    expect((workers.uploadWorkerScript as sinon.SinonStub).called).toBe(false);
  });

  it("refuses a provider switch when the parent catch-all is not an active router", async () => {
    sandbox.stub(routing, "catchAllRule").resolves({...routerRule(), enabled: false});
    await expect(ensureDirectInboxCatchAll(cloudflareConfig, `branch.${siteDomain}`)).rejects.toMatchObject({code: "SubdomainCatchAllForbidden"});
    expect((workers.uploadWorkerScript as sinon.SinonStub).called).toBe(false);
    expect((routing.updateCatchAllRule as sinon.SinonStub).called).toBe(false);
  });

  it("refuses unknown and mismatched zones before publishing", async () => {
    const zone = dns.zoneForHostname as sinon.SinonStub;
    zone.resolves(null);
    await expect(assertCatchAllOwnedByThisSite(cloudflareConfig, siteDomain)).rejects.toMatchObject({code: "RouterZoneMismatch"});
    zone.resolves({id: "other-zone", name: siteDomain});
    await expect(ensureRouterWorker(cloudflareConfig, siteDomain, fallback)).rejects.toMatchObject({code: "RouterZoneMismatch"});
    expect((workers.uploadWorkerScript as sinon.SinonStub).called).toBe(false);
  });

  it("migrates a direct-only site without introducing a fallback or a Gmail dependency", async () => {
    sandbox.stub(routing, "catchAllRule").resolves({...routerRule(SHARED_INBOX_ROUTER_WORKER_NAME), name: "Catch-all - Shared inbox router"});
    const result = await ensureDirectInboxCatchAll(cloudflareConfig, siteDomain, {registerMissingDestination: false});
    expect(result.changed).toBe(true);
    expect((workers.uploadWorkerSecret as sinon.SinonStub).callCount).toBe(1);
    expect((workers.uploadWorkerSecret as sinon.SinonStub).firstCall.args[2]).toBe("NGX_INBOUND_SECRET");
    expect((destinations.ensureForwardDestinationVerified as sinon.SinonStub).called).toBe(false);
  });

  it("does not reuse an unrecorded fallback secret on an old zone worker", async () => {
    sandbox.stub(routing, "catchAllRule").resolves({...routerRule(SHARED_INBOX_ROUTER_WORKER_NAME), name: "Catch-all - Shared inbox router"});
    (workers.workerSecretNames as sinon.SinonStub).resolves(["NGX_FALLBACK_FORWARD"]);
    await expect(ensureDirectInboxCatchAll(cloudflareConfig, siteDomain)).rejects.toMatchObject({code: "RouterFallbackUnknown"});
    expect((workers.uploadWorkerScript as sinon.SinonStub).called).toBe(false);
    expect((routing.updateCatchAllRule as sinon.SinonStub).called).toBe(false);
  });

  it("keeps the existing catch-all when a secret upload fails", async () => {
    sandbox.stub(routing, "catchAllRule").resolves(routerRule(SHARED_INBOX_ROUTER_WORKER_NAME));
    (workers.uploadWorkerSecret as sinon.SinonStub).onSecondCall().rejects(new Error("Upload failed"));
    await expect(ensureDirectInboxCatchAll(cloudflareConfig, siteDomain)).rejects.toThrow("Upload failed");
    expect((routing.updateCatchAllRule as sinon.SinonStub).called).toBe(false);
  });
});
