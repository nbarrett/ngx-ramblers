import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import * as brevoConfig from "./brevo-config";
import * as account from "./account/account";
import { sendSmtpKeepalive, smtpKeepaliveAuths } from "./smtp-relay";
import nodemailer from "nodemailer";

describe("smtp keepalive auths", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("combines the configured SMTP login with the Brevo relay username and extra key", async () => {
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({
      smtpUser: "brevo@group.example.org.uk",
      smtpPassword: "xsmtpsib-key-one",
      smtpPasswordSecondary: "xsmtpsib-key-two"
    } as any);
    sandbox.stub(account, "fetchBrevoAccount").resolves({
      email: "brevo@group.example.org.uk",
      relay: {enabled: true, data: {userName: "aa0001@smtp-brevo.com", relay: "smtp-relay.brevo.com", port: 587}}
    } as any);
    const auths = await smtpKeepaliveAuths();
    expect(auths.map(auth => `${auth.user}:${auth.pass}`).sort()).toEqual([
      "aa0001@smtp-brevo.com:xsmtpsib-key-one",
      "aa0001@smtp-brevo.com:xsmtpsib-key-two",
      "brevo@group.example.org.uk:xsmtpsib-key-one",
      "brevo@group.example.org.uk:xsmtpsib-key-two"
    ]);
  });

  it("uses the account relay login when Mail Settings has a key but no SMTP login", async () => {
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({
      smtpPassword: "xsmtpsib-key-one"
    } as any);
    sandbox.stub(account, "fetchBrevoAccount").resolves({
      email: "group@group.example.org.uk",
      relay: {enabled: true, data: {userName: "bb0001@smtp-brevo.com", relay: "smtp-relay.brevo.com", port: 587}}
    } as any);
    const auths = await smtpKeepaliveAuths();
    expect(auths.map(auth => auth.user).sort()).toEqual([
      "bb0001@smtp-brevo.com",
      "group@group.example.org.uk"
    ]);
  });

  it("returns no auths when no SMTP key is configured", async () => {
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({smtpUser: "brevo@group.example.org.uk"} as any);
    const accountStub = sandbox.stub(account, "fetchBrevoAccount");
    expect(await smtpKeepaliveAuths()).toEqual([]);
    expect(accountStub.called).toBe(false);
  });
});

describe("sendSmtpKeepalive", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("sends a probe with each login and still succeeds if one login is refused", async () => {
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({
      smtpUser: "brevo@group.example.org.uk",
      smtpPassword: "xsmtpsib-key-one",
      smtpKeepaliveRecipient: "probe@group.example.org.uk"
    } as any);
    sandbox.stub(account, "fetchBrevoAccount").resolves({
      email: "brevo@group.example.org.uk",
      relay: {enabled: true, data: {userName: "aa0001@smtp-brevo.com", relay: "smtp-relay.brevo.com", port: 587}}
    } as any);
    const sendMail = sandbox.stub();
    sandbox.stub(nodemailer, "createTransport").callsFake((options: any) => ({
      sendMail: (mail: any) => {
        sendMail(mail);
        if (options?.auth?.user === "aa0001@smtp-brevo.com") {
          return Promise.reject(new Error("535 Authentication failed"));
        } else {
          return Promise.resolve({messageId: "1", response: "250 ok"});
        }
      }
    }) as any);
    const recipient = await sendSmtpKeepalive();
    expect(recipient).toEqual("probe@group.example.org.uk");
    expect(sendMail.callCount).toEqual(2);
  });
  it("fails when the primary key works but every login refuses the secondary key", async () => {
    sandbox.stub(brevoConfig, "configuredBrevo").resolves({
      smtpUser: "sender@group.example.org.uk",
      smtpPassword: "key-one",
      smtpPasswordSecondary: "key-two",
      smtpKeepaliveRecipient: "probe@group.example.org.uk"
    } as any);
    sandbox.stub(account, "fetchBrevoAccount").resolves({email: "sender@group.example.org.uk"} as any);
    sandbox.stub(nodemailer, "createTransport").callsFake((options: any) => ({
      sendMail: () => options.auth.pass === "key-one"
        ? Promise.resolve({messageId: "accepted", response: "250 ok"})
        : Promise.reject(new Error("535 Authentication failed"))
    }) as any);
    await expect(sendSmtpKeepalive()).rejects.toThrow("one or more configured keys");
  });

});
