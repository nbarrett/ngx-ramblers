import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { InboxReaderProvider } from "../../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { EmailRoutingActionType, EmailRoutingRule, SHARED_INBOX_ROUTER_WORKER_NAME } from "../../../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import { CloudflareSslMode } from "../../../cloudflare/cloudflare.model";
import * as configuration from "../../../cloudflare/cloudflare-config";
import * as dns from "../../../cloudflare/cloudflare-dns";
import * as routing from "../../../cloudflare/cloudflare-email-routing";
import * as deployment from "../../../cloudflare/direct-inbox-catch-all";
import * as destinations from "../../../cloudflare/cloudflare-destination-addresses";
import * as ssl from "../../../cloudflare/cloudflare-ssl";
import { migrateZoneInboxRouter } from "./zone-inbox-router";

const hostname = "group.example.org.uk";
const workerName = "email-inbox-router-group-example-org-uk";

function routerRule(): EmailRoutingRule {
  return {enabled: true, name: "Catch-all - Shared inbox router", actions: [{type: EmailRoutingActionType.WORKER, value: [SHARED_INBOX_ROUTER_WORKER_NAME]}]} as EmailRoutingRule;
}

describe("zone inbox router migration applicability", () => {
  const sandbox = sinon.createSandbox();
  const state = {provider: InboxReaderProvider.CLOUDFLARE_INGRESS, href: `https://www.${hostname}`};
  const findOne = sinon.stub();
  const collection = sinon.stub().returns({findOne});
  const db = {collection} as any;

  beforeEach(() => {
    state.provider = InboxReaderProvider.CLOUDFLARE_INGRESS;
    state.href = `https://www.${hostname}`;
    collection.resetHistory();
    findOne.reset();
    findOne.callsFake(async () => ({value: {group: {href: state.href}, inbox: {provider: state.provider}}}));
    sandbox.stub(configuration, "configuredCloudflare").resolves({apiToken: "token", accountId: "account-1", zoneId: "platform-zone"});
    sandbox.stub(dns, "zoneForHostname").resolves({id: "zone-1", name: hostname, status: "active"});
    sandbox.stub(routing, "catchAllRule").resolves(routerRule());
    sandbox.stub(destinations, "ensureForwardDestinationVerified").resolves();
    sandbox.stub(ssl, "queryZoneSslSetting").resolves({value: CloudflareSslMode.STRICT, editable: true});
    sandbox.stub(ssl, "ensureInboxRouterSsl").resolves(false);
    sandbox.stub(deployment, "ensureDirectInboxCatchAll").resolves({scriptName: workerName, changed: true, detail: "Migrated"});
  });

  afterEach(() => sandbox.restore());

  it("does not inspect or change Cloudflare for a site with no selected inbox provider", async () => {
    findOne.resolves({value: {group: {href: state.href}}});
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect((configuration.configuredCloudflare as sinon.SinonStub).called).toBe(false);
    expect(collection.calledOnceWithExactly("config")).toBe(true);
  });

  it("leaves a Gmail-connected site entirely unchanged", async () => {
    state.provider = InboxReaderProvider.GMAIL_API;
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect((configuration.configuredCloudflare as sinon.SinonStub).called).toBe(false);
  });

  it("does not let Direct-to-inbox subdomains change their parent zone", async () => {
    state.href = `https://branch.${hostname}`;
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect((routing.catchAllRule as sinon.SinonStub).called).toBe(false);
    expect((ssl.ensureInboxRouterSsl as sinon.SinonStub).called).toBe(false);
    expect((deployment.ensureDirectInboxCatchAll as sinon.SinonStub).called).toBe(false);
  });

  it("preserves a disabled catch-all", async () => {
    (routing.catchAllRule as sinon.SinonStub).resolves({...routerRule(), enabled: false});
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect((deployment.ensureDirectInboxCatchAll as sinon.SinonStub).called).toBe(false);
  });

  it("preserves plain forwarding instead of turning it into an inbox router", async () => {
    (routing.catchAllRule as sinon.SinonStub).resolves({...routerRule(), actions: [{type: EmailRoutingActionType.FORWARD, value: ["inbox@example.com"]}]});
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect((ssl.ensureInboxRouterSsl as sinon.SinonStub).called).toBe(false);
  });

  it("recreates a legacy router for a direct-only site without needing a Gmail account", async () => {
    expect(await migrateZoneInboxRouter(db)).toEqual({});
    const deploy = deployment.ensureDirectInboxCatchAll as sinon.SinonStub;
    expect(deploy.firstCall.args).toEqual([
      {apiToken: "token", accountId: "account-1", zoneId: "zone-1", baseDomain: hostname},
      hostname,
      {fallbackAddress: "", registerMissingDestination: false}
    ]);
    expect((destinations.ensureForwardDestinationVerified as sinon.SinonStub).called).toBe(false);
    expect(collection.calledOnceWithExactly("config")).toBe(true);
  });

  it("preserves only the fallback explicitly recorded on this zone's rule", async () => {
    (routing.catchAllRule as sinon.SinonStub).resolves({...routerRule(), name: "Catch-all - Shared inbox router (fallback fallback@example.com)"});
    await migrateZoneInboxRouter(db);
    expect((destinations.ensureForwardDestinationVerified as sinon.SinonStub).calledOnceWithExactly(sinon.match.any, "fallback@example.com", false)).toBe(true);
    expect((deployment.ensureDirectInboxCatchAll as sinon.SinonStub).firstCall.args[2].fallbackAddress).toBe("fallback@example.com");
  });

  it("skips an already migrated zone with working origin encryption", async () => {
    (routing.catchAllRule as sinon.SinonStub).resolves({...routerRule(), actions: [{type: EmailRoutingActionType.WORKER, value: [workerName]}]});
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect((deployment.ensureDirectInboxCatchAll as sinon.SinonStub).called).toBe(false);
  });

  it("repairs unsafe SSL without republishing an already migrated router", async () => {
    (routing.catchAllRule as sinon.SinonStub).resolves({...routerRule(), actions: [{type: EmailRoutingActionType.WORKER, value: [workerName]}]});
    (ssl.queryZoneSslSetting as sinon.SinonStub).resolves({value: CloudflareSslMode.FLEXIBLE, editable: true});
    (ssl.ensureInboxRouterSsl as sinon.SinonStub).resolves(true);
    expect(await migrateZoneInboxRouter(db)).toEqual({});
    expect((ssl.ensureInboxRouterSsl as sinon.SinonStub).calledOnce).toBe(true);
    expect((deployment.ensureDirectInboxCatchAll as sinon.SinonStub).called).toBe(false);
  });

  it("leaves certificate and API failures pending for retry instead of recording completion", async () => {
    (ssl.ensureInboxRouterSsl as sinon.SinonStub).rejects(new Error("Origin certificate not ready"));
    expect(await migrateZoneInboxRouter(db)).toEqual({deferred: true, reason: "Origin certificate not ready"});
    expect((deployment.ensureDirectInboxCatchAll as sinon.SinonStub).called).toBe(false);
  });

  it("can retry a partial deployment and becomes a no-op after the rule has moved", async () => {
    const deploy = deployment.ensureDirectInboxCatchAll as sinon.SinonStub;
    deploy.onFirstCall().rejects(new Error("Secret upload failed"));
    expect((await migrateZoneInboxRouter(db)).deferred).toBe(true);
    expect(await migrateZoneInboxRouter(db)).toEqual({});
    (routing.catchAllRule as sinon.SinonStub).resolves({...routerRule(), actions: [{type: EmailRoutingActionType.WORKER, value: [workerName]}]});
    expect((await migrateZoneInboxRouter(db)).skipped).toBe(true);
    expect(deploy.callCount).toBe(2);
  });
});
