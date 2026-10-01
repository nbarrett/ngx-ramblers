import expect from "expect";
import {afterEach, beforeEach, describe, it} from "mocha";
import sinon from "sinon";
import jwt from "jsonwebtoken";
import WebSocket from "ws";
import {envConfig} from "../../env-config/env-config";
import {MessageType} from "../../../../projects/ngx-ramblers/src/app/models/websocket.model";
import * as recipients from "./campaign-recipients";
import {handleCampaignRecipientExport} from "./campaign-recipients-ws-handler";

describe("campaign recipient WebSocket authentication", () => {
  const sandbox = sinon.createSandbox();
  const secret = "fictional-test-secret";
  const request = {campaignId: 812, type: "delivered"};

  beforeEach(() => sandbox.stub(envConfig, "auth").returns({secret}));
  afterEach(() => sandbox.restore());

  it("rejects missing, invalid and expired credentials before starting an export", async () => {
    const report = sandbox.stub(recipients, "recipientsReportFor").resolves({recipients: [], truncated: false});
    const send = sandbox.spy();
    const ws = {readyState: WebSocket.OPEN, send} as unknown as WebSocket;
    const expired = jwt.sign({memberId: "fictional-member"}, secret, {expiresIn: -1});
    for (const token of [null, "invalid-token", expired]) {
      await handleCampaignRecipientExport(ws, request, token);
    }
    expect(report.called).toBe(false);
    expect(send.callCount).toBe(3);
    expect(send.args.every(([message]) => JSON.parse(message).type === MessageType.ERROR)).toBe(true);
  });

  it("returns progress and recipients to a signed-in member", async () => {
    const result = {recipients: [{email: "alex.reed@example.com", date: "01-10-2026 12:01:00"}], truncated: false};
    const report = sandbox.stub(recipients, "recipientsReportFor").resolves(result);
    const send = sandbox.spy();
    const ws = {readyState: WebSocket.OPEN, send} as unknown as WebSocket;
    const token = jwt.sign({memberId: "fictional-member"}, secret, {expiresIn: 60});
    await handleCampaignRecipientExport(ws, request, token);
    expect(report.calledOnceWithExactly(request.campaignId, request.type)).toBe(true);
    expect(JSON.parse(send.firstCall.args[0]).type).toBe(MessageType.PROGRESS);
    expect(JSON.parse(send.lastCall.args[0]).data.recipients).toEqual(result.recipients);
  });

  it("reports export errors without sending to a socket that has closed", async () => {
    sandbox.stub(recipients, "recipientsReportFor").rejects(new Error("Export failed"));
    const send = sandbox.spy();
    const socket = {readyState: WebSocket.OPEN as number, send};
    const token = jwt.sign({memberId: "fictional-member"}, secret, {expiresIn: 60});
    await handleCampaignRecipientExport(socket as unknown as WebSocket, request, token);
    expect(JSON.parse(send.lastCall.args[0]).type).toBe(MessageType.ERROR);
    socket.readyState = WebSocket.CLOSED;
    send.resetHistory();
    await handleCampaignRecipientExport(socket as unknown as WebSocket, request, token);
    expect(send.called).toBe(false);
  });
});
