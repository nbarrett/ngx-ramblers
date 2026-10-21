import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
  EmailRoutingActionType,
  EmailRoutingMatcherType,
  EmailRoutingRule,
  WorkerEmailUsageStatus
} from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import * as dns from "./cloudflare-dns";
import * as routing from "./cloudflare-email-routing";
import * as workers from "./cloudflare-email-workers";
import { cloudflareWorkerInventory } from "./cloudflare-worker-inventory";

const config = {accountId: "account-1", apiToken: "token"};
const sharedScript = "email-inbox-router";
const forwardingScript = "email-fwd-group-example-org-uk-chair";
const unusedScript = "email-inbox-router-old-example-org-uk";
const zones = [
  {id: "zone-1", name: "group.example.org.uk", status: "active"},
  {id: "zone-2", name: "other.example.org.uk", status: "active"}
];

function rule(scriptName: string, enabled = true): EmailRoutingRule {
  return {
    name: "Catch-all",
    enabled,
    matchers: [{type: EmailRoutingMatcherType.ALL}],
    actions: [{type: EmailRoutingActionType.WORKER, value: [scriptName]}]
  };
}

describe("account worker email inventory", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(dns, "listZones").resolves(zones);
    sandbox.stub(workers, "listWorkerScripts").resolves([sharedScript, forwardingScript, unusedScript, "ngx-public-site-fetch"].map(id => ({id})));
    sandbox.stub(routing, "listEmailRoutingRules").resolves([]);
    sandbox.stub(routing, "catchAllRule").resolves(rule(sharedScript));
  });

  afterEach(() => sandbox.restore());

  it("finds references across zones and scopes zone discovery to the configured account", async () => {
    const result = await cloudflareWorkerInventory(config);
    expect((dns.listZones as sinon.SinonStub).firstCall.args).toEqual(["token", null, "account-1"]);
    expect(result.accountId).toBe("account-1");
    expect(result.workers[0].status).toBe(WorkerEmailUsageStatus.REFERENCED);
    expect(result.workers[0].mapped).toContain(zones[0].name);
    expect(result.workers[0].mapped).toContain(zones[1].name);
    expect((routing.catchAllRule as sinon.SinonStub).secondCall.args[0].zoneId).toBe("zone-2");
    expect(result.workers[2].status).toBe(WorkerEmailUsageStatus.UNREFERENCED);
  });

  it("counts disabled address rules as references", async () => {
    (routing.listEmailRoutingRules as sinon.SinonStub).onSecondCall().resolves([rule(forwardingScript, false)]);
    const result = await cloudflareWorkerInventory(config);
    expect(result.workers[1].status).toBe(WorkerEmailUsageStatus.REFERENCED);
    expect(result.workers[1].mapped).toContain("(disabled)");
  });

  it("retains address references when a catch-all check fails and marks absent references incomplete", async () => {
    (routing.catchAllRule as sinon.SinonStub).onFirstCall().rejects(new Error("Permission denied"));
    (routing.listEmailRoutingRules as sinon.SinonStub).onFirstCall().resolves([rule(forwardingScript)]);
    const result = await cloudflareWorkerInventory(config);
    expect(result.workers[1].status).toBe(WorkerEmailUsageStatus.REFERENCED);
    expect(result.workers[2].status).toBe(WorkerEmailUsageStatus.INCOMPLETE);
    expect(result.zones[0].errors).toEqual(["Catch-all: Permission denied"]);
    expect(result.zones[1].errors).toEqual([]);
  });

  it("retains catch-all references when address rules cannot be read", async () => {
    (routing.listEmailRoutingRules as sinon.SinonStub).onFirstCall().rejects(new Error("Rules unavailable"));
    const result = await cloudflareWorkerInventory(config);
    expect(result.workers[0].status).toBe(WorkerEmailUsageStatus.REFERENCED);
    expect(result.workers[2].status).toBe(WorkerEmailUsageStatus.INCOMPLETE);
    expect(result.zones[0].errors).toEqual(["Address rules: Rules unavailable"]);
  });

  it("does not mistake a forwarding destination for a worker reference", async () => {
    (routing.listEmailRoutingRules as sinon.SinonStub).resolves([{...rule(unusedScript), actions: [{type: EmailRoutingActionType.FORWARD, value: [unusedScript]}]}]);
    const result = await cloudflareWorkerInventory(config);
    expect(result.workers[2].status).toBe(WorkerEmailUsageStatus.UNREFERENCED);
  });

  it("keeps non-email workers visible without claiming that they are unused", async () => {
    const result = await cloudflareWorkerInventory(config);
    expect(result.workers[3]).toEqual({id: "ngx-public-site-fetch", mapped: "Site migration fetch worker", status: WorkerEmailUsageStatus.RESERVED});
    expect(WorkerEmailUsageStatus.UNREFERENCED).toBe("No email routing references");
  });

  it("does not claim a complete check when no zones are accessible", async () => {
    (dns.listZones as sinon.SinonStub).resolves([]);
    const result = await cloudflareWorkerInventory(config);
    expect(result.workers.filter(worker => worker.id !== "ngx-public-site-fetch").every(worker => worker.status === WorkerEmailUsageStatus.INCOMPLETE)).toBe(true);
    expect(result.workers.find(worker => worker.id === "ngx-public-site-fetch").status).toBe(WorkerEmailUsageStatus.RESERVED);
  });

  it("fails the inventory if zones cannot be enumerated", async () => {
    (dns.listZones as sinon.SinonStub).rejects(new Error("Cannot list zones"));
    await expect(cloudflareWorkerInventory(config)).rejects.toThrow("Cannot list zones");
  });

  it("fails the inventory if workers cannot be enumerated", async () => {
    (workers.listWorkerScripts as sinon.SinonStub).rejects(new Error("Cannot list workers"));
    await expect(cloudflareWorkerInventory(config)).rejects.toThrow("Cannot list workers");
  });
});

describe("account zone pagination", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("reads every page while retaining the account filter", async () => {
    const request = sandbox.stub(global, "fetch");
    request.onFirstCall().resolves(Response.json({success: true, result: [zones[0]], result_info: {total_pages: 2}}));
    request.onSecondCall().resolves(Response.json({success: true, result: [zones[1]], result_info: {total_pages: 2}}));
    expect(await dns.listZones("token", null, "account-1")).toEqual(zones);
    expect(request.firstCall.args[0]).toContain("account.id=account-1");
    expect(request.secondCall.args[0]).toContain("page=2");
    expect(request.secondCall.args[0]).toContain("account.id=account-1");
  });

  it("throws on a failed later page instead of returning a partial zone list", async () => {
    const request = sandbox.stub(global, "fetch");
    request.onFirstCall().resolves(Response.json({success: true, result: [zones[0]], result_info: {total_pages: 2}}));
    request.onSecondCall().resolves(Response.json({success: false, errors: [{message: "Permission denied"}]}));
    await expect(dns.listZones("token", null, "account-1")).rejects.toThrow("Permission denied");
  });
});
