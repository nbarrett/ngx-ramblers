import * as attachmentStore from "../inbox/inbox-attachment-store";
import {mailClientSubmission} from "../mongo/models/mail-client-submission";
import {MailClientSubmissionStatus} from "../../../projects/ngx-ramblers/src/app/models/mail-client-submission.model";
import expect from "expect";
import {describe, it, beforeEach, afterEach} from "mocha";
import sinon from "sinon";
import {MailClientSubmitError, recoverMailClientSubmissions, submitMailClientMessage} from "./mail-client-submit";
import * as auth from "./mail-client-auth";
import * as rateLimit from "./mail-client-rate-limit";
import {Member} from "../../../projects/ngx-ramblers/src/app/models/member.model";
import {CommitteeMember} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import * as transactionalMail from "../brevo/transactional-mail/send-transactional-mail";
import * as inboxImport from "../inbox/inbox-message-import";
import * as aliases from "../inbox/inbox-aliases";
import * as configuration from "../config/system-config";
import {performTemplateSubstitution} from "../brevo/common/messages";
import {rfc822ForMessage} from "./mail-client-rfc822";
import {RAMBLERS_EMAIL_TOKENS} from "../brevo/templates/ramblers-design-tokens";
import {Brevo} from "@getbrevo/brevo";
import {BrandingMode} from "../../../projects/ngx-ramblers/src/app/models/mail.model";

describe("mail client submit", () => {
  const member = {id: "member-1", userName: "alex", firstName: "Alex", lastName: "Reed"} as Member;
  const webmaster: CommitteeMember = {
    type: "webmaster",
    description: "Webmaster",
    fullName: "Alex Reed",
    email: "webmaster@group.example.org.uk",
    vacant: false
  } as CommitteeMember;
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    const rows = new Map<string, any>();
    sandbox.stub(mailClientSubmission, "findOneAndUpdate").callsFake((filter: any, update: any) => ({
      lean: async () => {
        const prior = rows.get(filter._id) ?? null;
        if (!prior) {
          rows.set(filter._id, {...update.$setOnInsert});
        }
        return prior ? {...prior} : null;
      }
    }) as any);
    sandbox.stub(mailClientSubmission, "findById").callsFake((id: any) => ({lean: async () => rows.get(id)}) as any);
    sandbox.stub(mailClientSubmission, "updateOne").callsFake(async (filter: any, update: any) => {
      const row = rows.get(filter._id);
      const matched = row && (!filter.status || row.status === filter.status);
      if (matched) {
        rows.set(filter._id, {...row, ...update.$set});
      }
      return {modifiedCount: matched ? 1 : 0} as any;
    });
    sandbox.stub(auth, "mailClientAccessEnabled").resolves(true);
    sandbox.stub(auth, "committeeRolesForMember").resolves([webmaster]);
    sandbox.stub(rateLimit, "mailClientSendAllowed").returns(true);
  });

  afterEach(() => sandbox.restore());

  it("uses composer formatting for rich mail and preserves the delivered HTML in Sent and IMAP", async () => {
    sandbox.stub(configuration, "systemConfig").resolves({group: {href: "https://group.example.org.uk"}} as any);
    sandbox.stub(aliases, "derivedAliasForEmail").resolves({roleType: "webmaster", mailboxConnectionId: null} as any);
    sandbox.stub(rateLimit, "recordMailClientSend");
    const record = sandbox.stub(inboxImport, "recordOutboundMessage").resolves(null);
    const send = sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").callsFake(async (request, logger) => {
      const payload: Brevo.SendTransacEmailRequest = {};
      await performTemplateSubstitution(request, payload, logger);
      return {response: null, body: {messageId: "<sent@group.example.org.uk>"}, renderedHtmlContent: payload.htmlContent};
    });
    const raw = Buffer.from([
      "From: Webmaster <webmaster@group.example.org.uk>",
      "To: jamie.cole@example.com",
      "Subject: Walk planning",
      "Content-Type: text/html; charset=utf-8",
      "",
      `<p style="font-family:Times New Roman;font-size:28pt">Hello <strong>Jamie</strong>,</p><p><em>Meet at Hillside Park.</em> <a href="https://group.example.org.uk/walks" style="font-family:Courier;color:blue;text-decoration:none">Walk details</a></p>`,
      `<table><tr><th>Start</th><td>Morning</td></tr></table>`,
      `<blockquote><p>Earlier reply</p><img src="https://images.example.com/map.png"></blockquote>`,
      `<img src="site-content/route.png">`
    ].join("\r\n"));
    await submitMailClientMessage(member, raw);
    expect(send.firstCall.args[0].brandingMode).toBe(BrandingMode.UNBRANDED);
    const delivered = (await send.firstCall.returnValue).renderedHtmlContent;
    expect(delivered).toContain(`font-family: ${RAMBLERS_EMAIL_TOKENS.fontFamily}`);
    expect(delivered).toContain(`font-size: ${RAMBLERS_EMAIL_TOKENS.bodyFontSize}`);
    expect(delivered).toContain(`line-height: ${RAMBLERS_EMAIL_TOKENS.bodyLineHeight}`);
    expect(delivered).toContain(">Jamie</strong>");
    expect(delivered).not.toContain("Times New Roman");
    expect(delivered).not.toContain("Courier");
    expect(delivered).not.toContain("28pt");
    expect(delivered).toContain(">Meet at Hillside Park.</em>");
    expect(delivered).toContain("border:1px solid #ced4da;");
    expect(delivered).toContain("border-left:4px solid #9bc8ab;");
    expect(delivered).toContain("max-width:300px;height:auto;");
    expect(delivered).toContain("color: rgb(192, 87, 17)");
    expect(delivered).toContain("https://group.example.org.uk/api/aws/s3/site-content/route.png");
    expect(delivered).toContain("<title>Walk planning</title>");
    const stored = record.firstCall.args[1];
    expect(stored.bodyHtml).toBe(delivered);
    expect(rfc822ForMessage(stored).split("\r\n\r\n").slice(1).join("\r\n\r\n")).toBe(delivered);
  });

  function rawMessage(bccOnly = false): Buffer {
    return Buffer.from([
      "Message-ID: <submission-1@group.example.org.uk>",
      "In-Reply-To: <earlier@group.example.org.uk>",
      "References: <original@group.example.org.uk> <earlier@group.example.org.uk>",
      "From: Webmaster <webmaster@group.example.org.uk>",
      bccOnly ? "Bcc: jamie.cole@example.com" : "To: jamie.cole@example.com",
      "Subject: Walk planning", "", "Hello"
    ].join("\r\n"));
  }

  function delivery() {
    sandbox.stub(configuration, "systemConfig").resolves({group: {href: "https://group.example.org.uk"}} as any);
    sandbox.stub(aliases, "derivedAliasForEmail").resolves({roleType: "webmaster", mailboxConnectionId: null} as any);
    sandbox.stub(rateLimit, "recordMailClientSend");
    const record = sandbox.stub(inboxImport, "recordOutboundMessage").resolves(null);
    const send = sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").resolves({response: null, body: {messageId: "provider-id"}, renderedHtmlContent: "Delivered body"});
    return {send, record};
  }

  it("validates the inbox alias before any delivery", async () => {
    const {send, record} = delivery();
    (aliases.derivedAliasForEmail as sinon.SinonStub).resolves(null);
    await expect(submitMailClientMessage(member, rawMessage())).rejects.toMatchObject({smtpCode: 550});
    expect(send.called).toBe(false);
    expect(record.called).toBe(false);
  });

  it("durably records the request before sending and acknowledges a repeated Message-ID without resending", async () => {
    const {send} = delivery();
    await submitMailClientMessage(member, rawMessage());
    await submitMailClientMessage(member, rawMessage());
    expect(send.callCount).toBe(1);
    const updates = mailClientSubmission.updateOne as sinon.SinonStub;
    expect(updates.firstCall.args[1].$set.status).toBe(MailClientSubmissionStatus.SENDING);
    expect(updates.firstCall.calledBefore(send.firstCall)).toBe(true);
    expect(send.firstCall.args[0].headers).toMatchObject({"Message-ID": "<submission-1@group.example.org.uk>", "In-Reply-To": "<earlier@group.example.org.uk>"});
    expect(updates.lastCall.args[1].$set.status).toBe(MailClientSubmissionStatus.COMPLETED);
  });

  it("keeps delivery successful when Sent recording fails and repairs recording on retry without sending again", async () => {
    const {send, record} = delivery();
    record.onFirstCall().rejects(new Error("database interrupted"));
    await submitMailClientMessage(member, rawMessage());
    await submitMailClientMessage(member, rawMessage());
    expect(send.callCount).toBe(1);
    expect(record.callCount).toBe(2);
    expect((mailClientSubmission.updateOne as sinon.SinonStub).lastCall.args[1].$set.status).toBe(MailClientSubmissionStatus.COMPLETED);
  });

  it("retains uncertain provider outcomes without recording a sent message or resending", async () => {
    const {send, record} = delivery();
    send.rejects(new Error("socket closed after request"));
    await submitMailClientMessage(member, rawMessage());
    await expect(submitMailClientMessage(member, rawMessage())).rejects.toMatchObject({smtpCode: 450});
    expect(send.callCount).toBe(1);
    expect(record.called).toBe(false);
    expect((mailClientSubmission.updateOne as sinon.SinonStub).lastCall.args[1].$set.status).toBe(MailClientSubmissionStatus.UNCERTAIN);
  });

  it("repairs an expired preparation and a stuck sent recording without sending again", async () => {
    const rows = new Map<string, any>([
      ["preparing-1", {_id: "preparing-1", status: MailClientSubmissionStatus.PREPARING, updatedAt: 1}],
      ["recording-1", {
        _id: "recording-1",
        status: MailClientSubmissionStatus.RECORDING,
        updatedAt: 1,
        alias: {roleType: "webmaster"},
        outbound: {messageId: "<kept@group.example.org.uk>"},
        internalEmails: []
      }]
    ]);
    sandbox.stub(mailClientSubmission, "updateMany").resolves({modifiedCount: 1} as any);
    sandbox.stub(mailClientSubmission, "find").returns({lean: async () => [rows.get("recording-1")]} as any);
    (mailClientSubmission.updateOne as sinon.SinonStub).callsFake(async (filter: any, update: any) => {
      const row = rows.get(filter._id);
      const matched = row && (!filter.status || row.status === filter.status);
      if (matched) {
        rows.set(filter._id, {...row, ...update.$set});
      }
      return {modifiedCount: matched ? 1 : 0} as any;
    });
    const record = sandbox.stub(inboxImport, "recordOutboundMessage").resolves(null);
    const send = sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").resolves({response: null, body: {messageId: "<sent@group.example.org.uk>"}, renderedHtmlContent: "<p>Hi</p>"} as any);
    await recoverMailClientSubmissions();
    expect(send.called).toBe(false);
    expect(record.calledOnce).toBe(true);
    expect(rows.get("recording-1").status).toBe(MailClientSubmissionStatus.COMPLETED);
    expect((mailClientSubmission.updateMany as sinon.SinonStub).firstCall.args[0].status).toBe(MailClientSubmissionStatus.PREPARING);
  });

  it("allows retry after an explicit provider refusal without falsely recording Sent", async () => {
    const {send, record} = delivery();
    send.onFirstCall().rejects(Object.assign(new Error("rate limited"), {statusCode: 429}));
    await expect(submitMailClientMessage(member, rawMessage())).rejects.toMatchObject({smtpCode: 450});
    expect(record.called).toBe(false);
    await submitMailClientMessage(member, rawMessage());
    expect(send.callCount).toBe(2);
    expect(record.callCount).toBe(1);
  });

  it("preserves Bcc-only delivery without adding recipients to the public headers", async () => {
    const {send, record} = delivery();
    await submitMailClientMessage(member, rawMessage(true));
    expect(send.firstCall.args[0].to).toEqual([]);
    expect(send.firstCall.args[0].bcc).toEqual([{name: "", email: "jamie.cole@example.com"}]);
    expect(record.firstCall.args[1].to).toEqual([]);
    expect(record.firstCall.args[1].deliveryRecipients).toEqual([{name: null, email: "jamie.cole@example.com"}]);
  });

  it("resolves CID images through the existing stored-attachment API path", async () => {
    const {send} = delivery();
    sandbox.stub(attachmentStore, "storeInboxAttachmentBuffer").resolves({filename: "map.png", contentType: "image/png", s3Key: "inbox-attachments/map.png", contentId: "route-map", sizeBytes: 3});
    const raw = Buffer.from([
      "From: Webmaster <webmaster@group.example.org.uk>", "To: jamie.cole@example.com",
      "Message-ID: <inline@group.example.org.uk>", "Subject: Route", 'Content-Type: multipart/related; boundary="images"', "",
      "--images", "Content-Type: text/html", "", '<p>Route</p><img src="cid:route-map"><img src=cid:route-map>',
      "--images", "Content-Type: image/png", "Content-ID: <route-map>", 'Content-Disposition: inline; filename="map.png"', "Content-Transfer-Encoding: base64", "", "YWJj", "--images--"
    ].join("\r\n"));
    await submitMailClientMessage(member, raw);
    expect(send.firstCall.args[0].htmlContent).toContain("https://group.example.org.uk/api/aws/s3/inbox-attachments/map.png");
    expect(send.firstCall.args[0].htmlContent).not.toContain("cid:");
  });

  it("rejects Message-ID reuse with different content before delivering again", async () => {
    const {send} = delivery();
    await submitMailClientMessage(member, rawMessage());
    await expect(submitMailClientMessage(member, Buffer.from(rawMessage().toString().replace("Hello", "Changed")))).rejects.toMatchObject({smtpCode: 550});
    expect(send.callCount).toBe(1);
  });

  it("does not convert a provider duplicate response into a retryable failure", async () => {
    const {send, record} = delivery();
    send.rejects(Object.assign(new Error("duplicate"), {statusCode: 400, body: {code: "duplicate_parameter"}}));
    await submitMailClientMessage(member, rawMessage());
    await expect(submitMailClientMessage(member, rawMessage())).rejects.toMatchObject({smtpCode: 450});
    expect(send.callCount).toBe(1);
    expect(record.called).toBe(false);
  });

  it("never delivers when the durable pre-send write fails", async () => {
    const {send, record} = delivery();
    (mailClientSubmission.updateOne as sinon.SinonStub).onFirstCall().rejects(new Error("database unavailable"));
    await expect(submitMailClientMessage(member, rawMessage())).rejects.toMatchObject({smtpCode: 450});
    expect(send.called).toBe(false);
    expect(record.called).toBe(false);
  });

  it("acknowledges provider acceptance even if the outcome write initially fails", async () => {
    const {send} = delivery();
    (mailClientSubmission.updateOne as sinon.SinonStub).onSecondCall().rejects(new Error("database interrupted"));
    await submitMailClientMessage(member, rawMessage());
    await submitMailClientMessage(member, rawMessage());
    expect(send.callCount).toBe(1);
  });

  it("refuses a concurrent retry while the original submission is still awaiting the provider", async () => {
    const {send} = delivery();
    const gate = {release: () => null as void, entered: () => null as void};
    const waiting = new Promise<void>(resolve => gate.release = resolve);
    const entered = new Promise<void>(resolve => gate.entered = resolve);
    send.callsFake(async () => {
      gate.entered();
      await waiting;
      return {response: null, body: {messageId: "provider-id"}, renderedHtmlContent: "Delivered"};
    });
    const original = submitMailClientMessage(member, rawMessage());
    await entered;
    await expect(submitMailClientMessage(member, rawMessage())).rejects.toMatchObject({smtpCode: 450});
    gate.release();
    await original;
    expect(send.callCount).toBe(1);
  });

  it("refuses a personal From address", async () => {
    const raw = Buffer.from([
      "From: Alex Reed <alex.reed@example.com>",
      "To: jamie.cole@example.com",
      "Subject: Hello",
      "",
      "Body"
    ].join("\r\n"));
    try {
      await submitMailClientMessage(member, raw);
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(MailClientSubmitError);
      expect((error as MailClientSubmitError).smtpCode).toEqual(550);
      expect((error as Error).message).toContain("committee role address");
    }
  });

  it("refuses when mail application access is off", async () => {
    (auth.mailClientAccessEnabled as sinon.SinonStub).resolves(false);
    try {
      await submitMailClientMessage(member, Buffer.from("From: a@b.c\r\n\r\nHi"));
      throw new Error("expected refusal");
    } catch (error) {
      expect((error as MailClientSubmitError).smtpCode).toEqual(550);
      expect((error as Error).message).toContain("switched off");
    }
  });
});
