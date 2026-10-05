import expect from "expect";
import sinon from "sinon";
import debug from "debug";
import {afterEach, describe, it} from "mocha";
import {sendTransactionalEmailRequest} from "./send-transactional-mail";
import * as brevoConfig from "../brevo-config";
import * as rateLimiting from "../common/rate-limiting";
import * as permission from "../send-permission";
import * as messages from "../common/messages";
import {BrandingMode, EmailAddress, SendSmtpEmailRequest} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";

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
