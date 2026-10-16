import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { EmailRoutingActionType } from "../../../projects/ngx-ramblers/src/app/models/cloudflare-email-routing.model";
import * as envConfigModule from "../env-config/env-config";
import * as routing from "./cloudflare-email-routing";
import * as workers from "./cloudflare-email-workers";
import { ensureDirectInboxCatchAll } from "./direct-inbox-catch-all";

describe("ensureDirectInboxCatchAll", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  it("points a Gmail forward catch-all at the shared inbox router", async () => {
    sandbox.stub(envConfigModule.envConfig, "value").returns("secret");
    sandbox.stub(routing, "catchAllRule").resolves({
      actions: [{type: EmailRoutingActionType.FORWARD, value: ["mailbox@group.example.org.uk"]}]
    } as any);
    const uploadScript = sandbox.stub(workers, "uploadWorkerScript").resolves({} as any);
    const uploadSecret = sandbox.stub(workers, "uploadWorkerSecret").resolves();
    const update = sandbox.stub(routing, "updateCatchAllRule").resolves({} as any);

    const result = await ensureDirectInboxCatchAll({zoneId: "zone-1", apiToken: "token", accountId: "acct"} as any);

    expect(result.changed).toBe(true);
    expect(uploadScript.called).toBe(true);
    expect(uploadSecret.called).toBe(true);
    expect(update.firstCall.args[1].actions[0].type).toEqual(EmailRoutingActionType.WORKER);
    expect(update.firstCall.args[1].actions[0].value).toEqual(["email-inbox-router"]);
  });

  it("leaves a router catch-all in place after refreshing the worker", async () => {
    sandbox.stub(envConfigModule.envConfig, "value").returns("secret");
    sandbox.stub(routing, "catchAllRule").resolves({
      actions: [{type: EmailRoutingActionType.WORKER, value: ["email-inbox-router"]}]
    } as any);
    sandbox.stub(workers, "uploadWorkerScript").resolves({} as any);
    sandbox.stub(workers, "uploadWorkerSecret").resolves();
    const update = sandbox.stub(routing, "updateCatchAllRule").resolves({} as any);

    const result = await ensureDirectInboxCatchAll({zoneId: "zone-1"} as any);

    expect(result.changed).toBe(false);
    expect(update.called).toBe(false);
  });
});
