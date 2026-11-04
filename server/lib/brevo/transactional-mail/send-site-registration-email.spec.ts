import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { MemberSelection } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { RegistrationEmailType, RegistrationSettings } from "../../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import * as brevoConfig from "../brevo-config";
import { notificationConfig } from "../../mongo/models/notification-config";
import { banner } from "../../mongo/models/banner";
import * as config from "../../mongo/controllers/config";
import * as transactionalMail from "./send-transactional-mail";
import { registrationFromAddress, sendRegistrationEmail } from "./send-site-registration-email";

const settings: RegistrationSettings = {
  enabled: true, committeeEmailValidationEnabled: true, sourceFidelityValidationEnabled: true, publicUrl: "https://platform.example.com",
  senderEmail: "sender@example.com", reviewer: {firstName: "Site", lastName: "Reviewer", email: "reviewer@example.com"},
  sourceEnvironmentName: "staging", approvedEmails: []
};

describe("site registration email", () => {
  const sandboxState: {sandbox: sinon.SinonSandbox | null} = {sandbox: null};

  beforeEach(() => {
    sandboxState.sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandboxState.sandbox.restore();
  });

  it("renders the mapped built-in configuration through the shared transactional sender, with the site banner on the public address", async () => {
    sandboxState.sandbox.stub(brevoConfig, "configuredBrevo").resolves({registrationConfirmationConfigId: "email-config-1"} as any);
    sandboxState.sandbox.stub(notificationConfig, "findById").returns({lean: () => Promise.resolve({
      subject: {prefixParameter: "", text: "Configured confirmation", suffixParameter: "messageMergeFields.GROUP_NAME"},
      preSendActions: [], postSendActions: [], defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
      bannerId: null, body: "[Continue]({{params.messageMergeFields.ACTION_URL}})"
    })} as any);
    sandboxState.sandbox.stub(banner, "find").returns({lean: () => Promise.resolve([{_id: "banner-1", fileNameData: {rootFolder: "banners", awsFileName: "banners/logo.png"}}])} as any);
    sandboxState.sandbox.stub(config, "queryKey").withArgs(ConfigKey.COMMITTEE).resolves({
      value: {
        roles: [
          {type: "chairman", description: "Chair", email: "chair@group.example.org.uk", fullName: "Alex Reed"},
          {type: "support", description: "Support", email: "support@group.example.org.uk", fullName: "Jordan Blake"}
        ]
      }
    } as any);
    const send = sandboxState.sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").resolves({} as any);

    await sendRegistrationEmail(settings, RegistrationEmailType.CONFIRMATION, "committee@example.com", {
      groupName: "Example Ramblers", actionUrl: "https://platform.example.com/register/confirm/token",
      returnUrl: "https://platform.example.com/register/token"
    });

    const request = send.firstCall.args[0];
    expect(request.subject).toBe("Configured confirmation – Example Ramblers");
    expect(request.body).toContain("ACTION_URL");
    expect(request.params.messageMergeFields.ACTION_URL).toContain("/register/confirm/");
    expect(request.params.messageMergeFields.RETURN_URL).toContain("/register/token");
    expect(request.htmlContent).toBeUndefined();
    expect(request.params.messageMergeFields.BANNER_IMAGE_SOURCE).toBe("https://platform.example.com/api/aws/s3/banners/banners/logo.png");
    expect(request.sender).toEqual({email: "sender@example.com", name: "NGX Ramblers"});
    expect(request.replyTo).toEqual({email: "sender@example.com", name: "NGX Ramblers"});
  });

  it("sends from the email configuration sender role, not the first committee role", async () => {
    sandboxState.sandbox.stub(brevoConfig, "configuredBrevo").resolves({registrationReviewConfigId: "email-config-review"} as any);
    sandboxState.sandbox.stub(notificationConfig, "findById").returns({lean: () => Promise.resolve({
      subject: {prefixParameter: "", text: "NGX site ready for review", suffixParameter: "messageMergeFields.GROUP_NAME"},
      preSendActions: [], postSendActions: [], defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
      senderRole: "support", replyToRole: "support",
      bannerId: null, body: "Ready"
    })} as any);
    sandboxState.sandbox.stub(banner, "find").returns({lean: () => Promise.resolve([])} as any);
    sandboxState.sandbox.stub(config, "queryKey").withArgs(ConfigKey.COMMITTEE).resolves({
      value: {
        roles: [
          {type: "chairman", description: "Chair", email: "chair@group.example.org.uk", fullName: "Alex Reed"},
          {type: "support", description: "Support", email: "support@group.example.org.uk", fullName: "Jordan Blake"}
        ]
      }
    } as any);
    const send = sandboxState.sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").resolves({} as any);

    await sendRegistrationEmail(settings, RegistrationEmailType.REVIEW, "reviewer@example.com", {
      groupName: "Example Ramblers", actionUrl: "https://platform.example.com/admin/registrations"
    });

    const request = send.firstCall.args[0];
    expect(request.sender).toEqual({email: "support@group.example.org.uk", name: "Jordan Blake"});
    expect(request.replyTo).toEqual({email: "support@group.example.org.uk", name: "Jordan Blake"});
  });

  it("falls back to the registration sender only when the email configuration has no sender role", () => {
    const roles = [
      {type: "chairman", description: "Chair", email: "chair@group.example.org.uk", fullName: "Alex Reed"},
      {type: "support", description: "Support", email: "support@group.example.org.uk", fullName: "Jordan Blake"}
    ] as any;
    expect(registrationFromAddress({senderRole: "support"} as any, roles, settings))
      .toEqual({email: "support@group.example.org.uk", name: "Jordan Blake"});
    expect(registrationFromAddress({} as any, roles, settings))
      .toEqual({email: "sender@example.com", name: "NGX Ramblers"});
    expect(registrationFromAddress({senderRole: "missing"} as any, roles, settings))
      .toEqual({email: "sender@example.com", name: "NGX Ramblers"});
  });
});
