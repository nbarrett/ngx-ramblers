import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { MemberSelection } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { RegistrationEmailType, RegistrationSettings } from "../../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import * as brevoConfig from "../brevo-config";
import { notificationConfig } from "../../mongo/models/notification-config";
import * as transactionalMail from "./send-transactional-mail";
import { sendRegistrationEmail } from "./send-site-registration-email";

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

  it("renders the mapped built-in configuration through the shared transactional sender", async () => {
    sandboxState.sandbox.stub(brevoConfig, "configuredBrevo").resolves({registrationConfirmationConfigId: "email-config-1"} as any);
    sandboxState.sandbox.stub(notificationConfig, "findById").returns({lean: () => Promise.resolve({
      subject: {prefixParameter: "", text: "Configured confirmation", suffixParameter: "messageMergeFields.GROUP_NAME"},
      preSendActions: [], postSendActions: [], defaultMemberSelection: MemberSelection.RECENTLY_ADDED,
      bannerId: null, body: "[Continue]({{params.messageMergeFields.ACTION_URL}})"
    })} as any);
    const send = sandboxState.sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").resolves({} as any);

    await sendRegistrationEmail(settings, RegistrationEmailType.CONFIRMATION, "committee@example.com", {
      groupName: "Example Ramblers", actionUrl: "https://platform.example.com/register/confirm/token",
      returnUrl: "https://platform.example.com/register/token"
    });

    const request = send.firstCall.args[0];
    expect(request.subject).toBe("Configured confirmation - Example Ramblers");
    expect(request.body).toContain("ACTION_URL");
    expect(request.params.messageMergeFields.ACTION_URL).toContain("/register/confirm/");
    expect(request.params.messageMergeFields.RETURN_URL).toContain("/register/token");
    expect(request.htmlContent).toBeUndefined();
  });
});
