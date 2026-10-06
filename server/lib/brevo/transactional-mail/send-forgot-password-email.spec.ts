import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {sendForgotPasswordEmail} from "./send-forgot-password-email";
import {emailAddressForRole} from "./send-member-bulk-load-digest-email";
import * as brevoConfig from "../brevo-config";
import * as rateLimiting from "../common/rate-limiting";
import * as config from "../../mongo/controllers/config";
import * as transforms from "../../mongo/controllers/transforms";
import * as permission from "../send-permission";
import {member} from "../../mongo/models/member";
import {banner} from "../../mongo/models/banner";
import {notificationConfig} from "../../mongo/models/notification-config";
import {ConfigKey} from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {ForgotPasswordIdentificationMethod} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {CommitteeMember} from "../../../../projects/ngx-ramblers/src/app/models/committee.model";

const roles = [
  {type: "chair", fullName: "Sam Taylor", email: "chair@group.example.org.uk"},
  {type: "support", fullName: "Alex Reed", email: "support@group.example.org.uk"}
] as CommitteeMember[];

describe("automated email sender roles", () => {
  it("does not substitute the first committee member for an absent or invalid role", () => {
    [null, "", " ", "missing"].forEach(role => expect(emailAddressForRole(roles, role)).toBe(null));
    expect(emailAddressForRole(roles, "support")).toEqual({name: "Alex Reed", email: "support@group.example.org.uk"});
  });
});

describe("forgotten password saved reply-to defaults", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  [null, "", " ", "chair"].forEach(replyToRole => {
    it(`sends without a logged-in user when saved Reply-To is ${JSON.stringify(replyToRole)}`, async () => {
      const foundMember = {email: "member@example.com", firstName: "Jamie", lastName: "Reed", userName: "jamie", passwordResetId: "previous-token", save: sandbox.stub()};
      foundMember.save.callsFake(async () => foundMember);
      sandbox.stub(member, "findOne").resolves(foundMember as any);
      sandbox.stub(transforms, "toObjectWithId").callsFake(document => document as any);
      sandbox.stub(brevoConfig, "configuredBrevo").resolves({forgotPasswordNotificationConfigId: "config-1"} as any);
      sandbox.stub(config, "queryKey").callsFake(async key => ({value: key === ConfigKey.SYSTEM ? {group: {href: "https://group.example.org.uk"}} : {roles}}) as any);
      sandbox.stub(banner, "find").returns({lean: async () => []} as any);
      sandbox.stub(notificationConfig, "findById").returns({lean: async () => ({senderRole: "support", replyToRole, signOffRoles: [], subject: {text: "Reset your password"}})} as any);
      sandbox.stub(permission, "assertSendAllowed").resolves();
      const send = sandbox.stub().resolves({messageId: "sent-message"});
      sandbox.stub(brevoConfig, "brevoClient").resolves({transactionalEmails: {sendTransacEmail: send}} as any);
      sandbox.stub(rateLimiting, "scheduleBrevo").callsFake(async action => action());
      const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
      await sendForgotPasswordEmail({body: {identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME, emailOrUsername: "jamie"}, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
      expect(send.calledOnce).toBe(true);
      expect(send.firstCall.args[0]).toMatchObject({
        sender: {email: "support@group.example.org.uk"}
      });
      if (replyToRole === "chair") {
        expect(send.firstCall.args[0].replyTo).toEqual({email: "chair@group.example.org.uk", name: "Sam Taylor"});
      } else {
        expect(send.firstCall.args[0]).not.toHaveProperty("replyTo");
      }
      expect(foundMember.save.calledOnce).toBe(true);
      expect(foundMember.passwordResetId).not.toBe("previous-token");
    });
  });

  it("returns an error and does not save a reset link when the saved sender role does not exist", async () => {
    const foundMember = {email: "member@example.com", firstName: "Jamie", lastName: "Reed", userName: "jamie", passwordResetId: "previous-token", save: sandbox.stub()};
    sandbox.stub(member, "findOne").resolves(foundMember as any);
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({forgotPasswordNotificationConfigId: "config-1"} as any);
    sandbox.stub(config, "queryKey").callsFake(async key => ({value: key === ConfigKey.SYSTEM ? {group: {href: "https://group.example.org.uk"}} : {roles: roles.filter(role => role.type !== "support")}}) as any);
    sandbox.stub(banner, "find").returns({lean: async () => []} as any);
    sandbox.stub(notificationConfig, "findById").returns({lean: async () => ({senderRole: "support", replyToRole: "support", signOffRoles: [], subject: {text: "Reset your password"}})} as any);
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME, emailOrUsername: "jamie"}, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(response.status.calledWith(500)).toBe(true);
    expect(response.json.firstCall.args[0].error.message).toContain("Sender and Reply-To");
    expect(foundMember.save.called).toBe(false);
    expect(foundMember.passwordResetId).toBe("previous-token");
  });
});
