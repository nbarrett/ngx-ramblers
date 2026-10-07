import expect from "expect";
import sinon from "sinon";
import {afterEach, describe, it} from "mocha";
import {forgotPasswordMemberCriteria, sendForgotPasswordEmail} from "./send-forgot-password-email";
import {emailAddressForRole} from "./send-member-bulk-load-digest-email";
import * as brevoConfig from "../brevo-config";
import * as rateLimiting from "../common/rate-limiting";
import * as config from "../../mongo/controllers/config";
import * as transforms from "../../mongo/controllers/transforms";
import * as permission from "../send-permission";
import * as inboxAliases from "../../inbox/inbox-aliases";
import {member} from "../../mongo/models/member";
import {banner} from "../../mongo/models/banner";
import {notificationConfig} from "../../mongo/models/notification-config";
import {ConfigKey} from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {ForgotPasswordIdentificationMethod, ForgotPasswordNextStep} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {CommitteeMember} from "../../../../projects/ngx-ramblers/src/app/models/committee.model";

const roles = [
  {type: "chair", fullName: "Sam Taylor", email: "chair@group.example.org.uk"},
  {type: "support", fullName: "Alex Reed", email: "support@group.example.org.uk"}
] as CommitteeMember[];

describe("forgotten password member lookup", () => {
  it("matches a typed username to email or username", () => {
    expect(forgotPasswordMemberCriteria({
      identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME,
      emailOrUsername: "jamie.reed"
    })).toEqual({
      $or: [
        {email: {$eq: "jamie.reed"}},
        {userName: {$eq: "jamie.reed"}}
      ]
    });
  });

  it("also matches the username when the typed value is an email address", () => {
    expect(forgotPasswordMemberCriteria({
      identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME,
      emailOrUsername: "Jamie.Reed@group.example.org.uk"
    })).toEqual({
      $or: [
        {email: {$eq: "jamie.reed@group.example.org.uk"}},
        {userName: {$eq: "jamie.reed@group.example.org.uk"}},
        {userName: {$eq: "jamie.reed"}}
      ]
    });
  });

  it("matches membership number and normalised postcode", () => {
    expect(forgotPasswordMemberCriteria({
      identificationMethod: ForgotPasswordIdentificationMethod.MEMBERSHIP_DETAILS,
      membershipNumber: "1234567",
      postcode: "rg87aa"
    })).toEqual({
      $and: [
        {membershipNumber: {$eq: "1234567"}},
        {postcode: {$eq: "RG8 7AA"}}
      ]
    });
  });
});

describe("automated email sender roles", () => {
  it("does not substitute the first committee member for an absent or invalid role", () => {
    [null, "", " ", "missing"].forEach(role => expect(emailAddressForRole(roles, role)).toBe(null));
    expect(emailAddressForRole(roles, "support")).toEqual({name: "Alex Reed", email: "support@group.example.org.uk"});
  });
});

describe("forgotten password saved reply-to defaults", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(() => {
    sandbox.stub(inboxAliases, "emailGoesToInbox").resolves(false);
  });
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

describe("forgotten password inbox destination", () => {
  const sandbox = sinon.createSandbox();
  const inboxMemberEmail = "chair@group.example.org.uk";
  const personalEmail = "jamie.reed@example.com";

  afterEach(() => sandbox.restore());

  function inboxMember() {
    const foundMember = {
      email: inboxMemberEmail,
      firstName: "Jamie",
      lastName: "Reed",
      userName: "jamie.reed",
      membershipNumber: "1234567",
      postcode: "RG8 7AA",
      passwordResetId: "previous-token",
      save: sandbox.stub()
    };
    foundMember.save.callsFake(async () => foundMember);
    return foundMember;
  }

  function stubLookup(foundMember: ReturnType<typeof inboxMember>) {
    sandbox.stub(member, "findOne").resolves(foundMember as any);
    sandbox.stub(transforms, "toObjectWithId").callsFake(document => document as any);
    sandbox.stub(config, "queryKey").callsFake(async key => ({value: key === ConfigKey.SYSTEM ? {group: {href: "https://group.example.org.uk"}} : {roles}}) as any);
    sandbox.stub(inboxAliases, "emailGoesToInbox").callsFake(async (email: string) => email === inboxMemberEmail);
  }

  function stubSend() {
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({forgotPasswordNotificationConfigId: "config-1"} as any);
    sandbox.stub(banner, "find").returns({lean: async () => []} as any);
    sandbox.stub(notificationConfig, "findById").returns({lean: async () => ({senderRole: "support", replyToRole: "support", signOffRoles: [], subject: {text: "Reset your password"}})} as any);
    sandbox.stub(permission, "assertSendAllowed").resolves();
    const send = sandbox.stub().resolves({messageId: "sent-message"});
    sandbox.stub(brevoConfig, "brevoClient").resolves({transactionalEmails: {sendTransacEmail: send}} as any);
    sandbox.stub(rateLimiting, "scheduleBrevo").callsFake(async action => action());
    return send;
  }

  it("asks for membership details instead of sending to an inbox address", async () => {
    const foundMember = inboxMember();
    stubLookup(foundMember);
    const send = stubSend();
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME, emailOrUsername: "jamie.reed"}, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(response.status.calledWith(200)).toBe(true);
    expect(response.json.firstCall.args[0].nextStep).toBe(ForgotPasswordNextStep.MEMBERSHIP_DETAILS);
    expect(send.called).toBe(false);
    expect(foundMember.save.called).toBe(false);
  });

  it("asks again when membership details do not match the same member", async () => {
    const foundMember = inboxMember();
    stubLookup(foundMember);
    const send = stubSend();
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {
      identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME,
      emailOrUsername: "jamie.reed",
      membershipNumber: "9999999",
      postcode: "RG8 7AA"
    }, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(response.json.firstCall.args[0].nextStep).toBe(ForgotPasswordNextStep.MEMBERSHIP_DETAILS);
    expect(send.called).toBe(false);
  });

  it("asks for a personal delivery email after membership details match", async () => {
    const foundMember = inboxMember();
    stubLookup(foundMember);
    const send = stubSend();
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {
      identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME,
      emailOrUsername: "jamie.reed",
      membershipNumber: "1234567",
      postcode: "rg87aa"
    }, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(response.json.firstCall.args[0].nextStep).toBe(ForgotPasswordNextStep.DELIVERY_EMAIL);
    expect(send.called).toBe(false);
    expect(foundMember.save.called).toBe(false);
  });

  it("refuses a delivery email that also goes to the inbox", async () => {
    const foundMember = inboxMember();
    stubLookup(foundMember);
    const send = stubSend();
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {
      identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME,
      emailOrUsername: "jamie.reed",
      membershipNumber: "1234567",
      postcode: "RG8 7AA",
      deliveryEmail: inboxMemberEmail
    }, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(response.status.calledWith(400)).toBe(true);
    expect(response.json.firstCall.args[0].message).toContain("committee mail");
    expect(send.called).toBe(false);
  });

  it("sends the reset link to a personal delivery email", async () => {
    const foundMember = inboxMember();
    stubLookup(foundMember);
    const send = stubSend();
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {
      identificationMethod: ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME,
      emailOrUsername: "jamie.reed",
      membershipNumber: "1234567",
      postcode: "RG8 7AA",
      deliveryEmail: personalEmail
    }, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(send.calledOnce).toBe(true);
    expect(send.firstCall.args[0].to).toEqual([{email: personalEmail, name: "Jamie Reed"}]);
    expect(response.json.firstCall.args[0].nextStep).toBe(ForgotPasswordNextStep.COMPLETE);
    expect(foundMember.save.calledOnce).toBe(true);
  });

  it("skips membership details when the member was found by membership number and postcode", async () => {
    const foundMember = inboxMember();
    stubLookup(foundMember);
    const send = stubSend();
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.spy()};
    await sendForgotPasswordEmail({body: {
      identificationMethod: ForgotPasswordIdentificationMethod.MEMBERSHIP_DETAILS,
      membershipNumber: "1234567",
      postcode: "RG8 7AA"
    }, protocol: "https", get: () => "group.example.org.uk"} as any, response as any);
    expect(response.json.firstCall.args[0].nextStep).toBe(ForgotPasswordNextStep.DELIVERY_EMAIL);
    expect(send.called).toBe(false);
  });
});
