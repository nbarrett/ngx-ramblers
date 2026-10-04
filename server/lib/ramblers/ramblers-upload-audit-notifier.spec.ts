import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import WebSocket from "ws";
import * as mongooseClient from "../mongo/mongoose-client";
import * as broadcaster from "../websockets/websocket-broadcaster";
import { AuditType, RamblersUploadAudit, Status } from "../../../projects/ngx-ramblers/src/app/models/ramblers-upload-audit.model";
import { MessageType } from "../../../projects/ngx-ramblers/src/app/models/websocket.model";
import { completeRamblersUploadSession, registerRamblersUploadSession } from "./ramblers-upload-session-registry";
import { sendAudit } from "./ramblers-upload-audit-notifier";

describe("worker audit details", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
    completeRamblersUploadSession("example-audit-job");
  });

  it("persists and broadcasts the error and elapsed time supplied by a worker step", async () => {
    const create = sandbox.stub(mongooseClient, "create").callsFake(async (_model, data) => data);
    const broadcast = sandbox.stub(broadcaster, "broadcast").returns(1);
    const socket = {readyState: WebSocket.OPEN} as unknown as WebSocket;
    registerRamblersUploadSession("example-audit-job", "example-export.gpx", socket);
    const audit: RamblersUploadAudit = {
      auditTime: 1, type: AuditType.STEP, status: Status.ERROR,
      message: "Alex clicks Export GPX", durationMs: 10000,
      errorResponse: {message: "Export click timed out"}
    };
    await sendAudit(socket, {
      messageType: MessageType.PROGRESS,
      auditMessage: audit,
      parserFunction: data => [{audit: true, data}]
    }, "example-audit-job");
    expect(create.firstCall.args[1]).toMatchObject({durationMs: 10000, errorResponse: audit.errorResponse});
    expect(broadcast.firstCall.args[1]).toMatchObject({audits: [{durationMs: 10000, errorResponse: audit.errorResponse}]});
  });
});
