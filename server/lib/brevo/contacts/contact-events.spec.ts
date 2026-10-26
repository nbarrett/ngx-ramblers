import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as brevoConfig from "../brevo-config";
import * as rateLimiting from "../common/rate-limiting";
import { contactEvents } from "./contact-events";
import { BrevoEventType } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const sandbox = sinon.createSandbox();
const event = {email: "alex.reed@example.com", date: "2026-10-25T12:00:00.000Z", messageId: "event-one", event: BrevoEventType.OPENED};
const send = {...event, messageId: "send-two", subject: "Login details", uuid: "two"};

async function report(query: Record<string, string>) {
  const getEmailEventReport = sandbox.stub().resolves({events: [event]});
  const getTransacEmailsList = sandbox.stub().resolves({transactionalEmails: [send]});
  sandbox.stub(brevoConfig, "brevoClient").resolves({transactionalEmails: {getEmailEventReport, getTransacEmailsList}} as any);
  const response = {status: sandbox.stub(), json: sandbox.stub()};
  response.status.returns(response);
  await contactEvents({params: {identifier: "Alex.Reed@example.com"}, query} as unknown as Request, response as unknown as Response);
  return {body: response.json.firstCall.args[0].response, getEmailEventReport, getTransacEmailsList};
}

describe("contact activity reports", () => {
  beforeEach(() => {
    sandbox.stub(rateLimiting, "scheduleBrevo").callsFake(async task => task());
  });
  afterEach(() => sandbox.restore());

  it("keeps the statistics cursor independent of added send rows", async () => {
    const result = await report({limit: "1"});
    expect(result.body.events.length).toBe(2);
    expect(result.body.nextOffset).toBe(1);
    expect(result.body.hasMore).toBe(true);
    expect(result.getEmailEventReport.firstCall.args[0].email).toBe("alex.reed@example.com");
  });

  it("does not add request events to a report filtered to opens", async () => {
    const result = await report({event: BrevoEventType.OPENED});
    expect(result.body.events).toEqual([event]);
    expect(result.getTransacEmailsList.called).toBe(false);
  });

  it("does not repeat supplementary sends on later pages", async () => {
    const result = await report({offset: "50"});
    expect(result.body.nextOffset).toBe(51);
    expect(result.body.hasMore).toBe(false);
    expect(result.getTransacEmailsList.called).toBe(false);
  });
});
