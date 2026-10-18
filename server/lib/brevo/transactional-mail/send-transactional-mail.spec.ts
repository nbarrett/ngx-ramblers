import expect from "expect";
import sinon from "sinon";
import debug from "debug";
import {afterEach, describe, it} from "mocha";
import {sendTransactionalEmailRequest} from "./send-transactional-mail";
import * as brevoConfig from "../brevo-config";
import * as rateLimiting from "../common/rate-limiting";
import * as permission from "../send-permission";
import * as messages from "../common/messages";
import * as config from "../../mongo/controllers/config";
import * as memberModel from "../../mongo/models/member";
import * as transforms from "../../mongo/controllers/transforms";
import {BrandingMode, EmailAddress, SendPurpose, SendSmtpEmailRequest} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

const sender = {email: "support@group.example.org.uk", name: "Alex Reed"};

describe("transactional sending Reply-To behaviour", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  const cases: (EmailAddress | null)[] = [null, {email: "", name: ""}, {email: " ", name: ""}, {email: " SUPPORT@group.example.org.uk ", name: ""}, {email: " visitor@example.com ", name: "Sam Taylor"}];
  cases.forEach(replyTo => {
    it(`normalises Reply-To ${JSON.stringify(replyTo)} at the provider boundary`, async () => {
      const send = sandbox.stub().resolves({messageId: "message-1"});
      sandbox.stub(permission, "assertSendAllowed").resolves();
      sandbox.stub(brevoConfig, "brevoClient").resolves({transactionalEmails: {sendTransacEmail: send}} as any);
      sandbox.stub(rateLimiting, "scheduleBrevo").callsFake(async action => action());
      sandbox.stub(messages, "performTemplateSubstitution").callsFake(async (_request, payload) => payload);
      sandbox.stub(config, "queryKey").resolves({value: {roles: []}});
      const request = {sender, replyTo, to: [{email: "member@example.com"}], subject: "Notification", brandingMode: BrandingMode.UNBRANDED} as SendSmtpEmailRequest;
      await sendTransactionalEmailRequest(request, debug("test:transactional"));
      expect(send.calledOnce).toBe(true);
      const payload = send.firstCall.args[0];
      expect(payload.sender).toEqual(sender);
      if (replyTo?.email?.trim() === "visitor@example.com") {
        expect(payload.replyTo).toEqual({email: "visitor@example.com", name: "Sam Taylor"});
      } else {
        expect(payload).not.toHaveProperty("replyTo");
      }
    });
  });
});

describe("transactional sending committee role recipients", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("rewrites a committee member personal address before sending", async () => {
    const send = sandbox.stub().resolves({messageId: "message-1"});
    sandbox.stub(permission, "assertSendAllowed").resolves();
    sandbox.stub(brevoConfig, "brevoClient").resolves({transactionalEmails: {sendTransacEmail: send}} as any);
    sandbox.stub(rateLimiting, "scheduleBrevo").callsFake(async action => action());
    sandbox.stub(messages, "performTemplateSubstitution").callsFake(async (_request, payload) => payload);
    sandbox.stub(config, "queryKey").resolves({
      value: {roles: [{type: "walks", email: "walks@group.example.org.uk", memberId: "aaaaaaaaaaaaaaaaaaaaaaaa"}]}
    });
    sandbox.stub(memberModel.member, "find").returns({
      lean: () => Promise.resolve([{_id: "aaaaaaaaaaaaaaaaaaaaaaaa"}])
    } as any);
    sandbox.stub(transforms, "toObjectWithId").returns({id: "aaaaaaaaaaaaaaaaaaaaaaaa", email: "sam.taylor@example.com"});
    const request = {
      sender,
      to: [{email: "sam.taylor@example.com", name: "Sam Taylor"}],
      subject: "Walk change",
      brandingMode: BrandingMode.UNBRANDED
    } as SendSmtpEmailRequest;
    await sendTransactionalEmailRequest(request, debug("test:transactional"));
    expect(send.firstCall.args[0].to).toEqual([{email: "walks@group.example.org.uk", name: "Sam Taylor"}]);
  });

  it("leaves booking recipients on the address they entered", async () => {
    const send = sandbox.stub().resolves({messageId: "message-1"});
    sandbox.stub(permission, "assertSendAllowed").resolves();
    sandbox.stub(brevoConfig, "brevoClient").resolves({transactionalEmails: {sendTransacEmail: send}} as any);
    sandbox.stub(rateLimiting, "scheduleBrevo").callsFake(async action => action());
    sandbox.stub(messages, "performTemplateSubstitution").callsFake(async (_request, payload) => payload);
    const queryKey = sandbox.stub(config, "queryKey");
    const request = {
      sender,
      to: [{email: "sam.taylor@example.com", name: "Sam Taylor"}],
      subject: "Booking",
      brandingMode: BrandingMode.UNBRANDED
    } as SendSmtpEmailRequest;
    await sendTransactionalEmailRequest(request, debug("test:transactional"), undefined, SendPurpose.BOOKING);
    expect(queryKey.called).toBe(false);
    expect(send.firstCall.args[0].to).toEqual([{email: "sam.taylor@example.com", name: "Sam Taylor"}]);
  });
});
