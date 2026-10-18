import expect from "expect";
import {afterEach, beforeEach, describe, it} from "mocha";
import sinon from "sinon";
import {keys} from "es-toolkit/compat";
import {Request, Response} from "express";
import {startBatchTransactionalSend} from "./batch-transactional-send";
import * as transactionalMail from "./send-transactional-mail";
import * as config from "../../mongo/controllers/config";
import * as permissions from "../send-permission";
import * as salesforcePermissions from "../../salesforce/salesforce-permissions";
import * as aliases from "../../inbox/inbox-aliases";
import * as inbox from "../../inbox/inbox-message-import";
import * as sentHistory from "../../mongo/controllers/member-email-send";
import * as externalRecipients from "../../mongo/controllers/external-recipient";
import * as actions from "../../mongo/controllers/member-bulk-delete";
import {banner} from "../../mongo/models/banner";
import {notificationConfig} from "../../mongo/models/notification-config";
import {member} from "../../mongo/models/member";
import {BrandingMode, MemberSelection, MergeFieldParamsGroup, SendSmtpEmailRequest} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {AddresseeType, BatchTransactionalSendRequest, EmailCompositionKind, RecipientMode} from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import {ConfigKey} from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {composerFilterToken, composerListToken} from "../../../../projects/ngx-ramblers/src/app/functions/email-composer";
import {InboxAliasConfig} from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";

describe("composer batch delivery and sent inbox headers", () => {
  const sandbox = sinon.createSandbox();
  const senderId = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const role = {type: "secretary", memberId: senderId, email: "secretary@group.example.org.uk", fullName: "Alex Reed"};
  const to = [{email: "chair@group.example.org.uk"}, {email: "guest@example.com"}];
  const cc = [{email: "sam.taylor@example.com"}];
  const bcc = [{email: "casey.reed@example.com"}];

  beforeEach(() => {
    sandbox.stub(permissions, "assertSendAllowed").resolves();
    sandbox.stub(salesforcePermissions, "protectedEmailSendError").resolves(null);
    sandbox.stub(config, "queryKey").callsFake(async key => ({value: key === ConfigKey.COMMITTEE ? {roles: [role]} : {}}));
    sandbox.stub(banner, "find").returns({lean: async () => []} as any);
    sandbox.stub(member, "find").returns({lean: async () => []} as any);
    sandbox.stub(notificationConfig, "findById").returns({lean: async () => ({_id: "notification", senderRole: role.type})} as any);
    sandbox.stub(aliases, "derivedAliasForRoleType").resolves({roleEmail: role.email, mailboxConnectionId: null} as InboxAliasConfig);
    sandbox.stub(inbox, "recordOutboundMessage").resolves({} as any);
    sandbox.stub(sentHistory, "recordMemberEmailSends").resolves({} as any);
    sandbox.stub(externalRecipients, "recordSendUsage").resolves({} as any);
  });

  afterEach(() => sandbox.restore());

  async function send(overrides: Partial<BatchTransactionalSendRequest> = {}) {
    const sent: SendSmtpEmailRequest[] = [];
    sandbox.stub(transactionalMail, "sendTransactionalEmailRequest").callsFake(async request => {
      sent.push(request);
      return {response: null, body: {messageId: "message-1"}, renderedHtmlContent: "<p>Hello everyone</p>"};
    });
    const completion = new Promise<void>(resolve => {
      sandbox.stub(actions, "applyPostSendActionsToMembers").callsFake(async () => {
        resolve();
        return {} as any;
      });
    });
    const request: BatchTransactionalSendRequest = {
      brandingMode: BrandingMode.UNBRANDED,
      recipientMode: RecipientMode.SELECTED_MEMBERS,
      compositionKind: EmailCompositionKind.STANDARD,
      notificationConfigId: "notification",
      bannerId: null,
      subject: "Group arrangements",
      addresseeType: AddresseeType.NONE,
      signoffRoles: [],
      htmlBody: "Hello everyone",
      memberIds: [],
      externalRecipients: to,
      ccRecipients: cc,
      bccRecipients: bcc,
      sharedToRecipients: true,
      ...overrides
    };
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await startBatchTransactionalSend({body: request, user: {memberId: senderId}, protocol: "https", get: () => "group.example.org.uk"} as unknown as Request, response as unknown as Response);
    expect(response.status.calledOnceWithExactly(200)).toBe(true);
    await completion;
    return sent;
  }

  [BrandingMode.BRANDED, BrandingMode.UNBRANDED].forEach(brandingMode => {
    [composerListToken(7, "Committee", 2), composerFilterToken(MemberSelection.RECENTLY_ADDED, "All members", 2)].forEach(token => {
      [{externalRecipients: [token]}, {ccRecipients: [token]}, {bccRecipients: [token]}].forEach(header => {
        it(`rejects an unexpanded ${token.listId ? "list" : "filter"} in ${keys(header)[0]} for ${brandingMode}`, async () => {
          const sendMail = sandbox.stub(transactionalMail, "sendTransactionalEmailRequest");
          const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
          await startBatchTransactionalSend({body: {
            brandingMode,
            memberIds: [],
            externalRecipients: to,
            ...header
          }} as Request, response as unknown as Response);
          expect(response.status.calledOnceWithExactly(400)).toBe(true);
          expect(response.json.firstCall.args[0].error.message).toContain("must be expanded");
          expect(sendMail.called).toBe(false);
          expect((permissions.assertSendAllowed as sinon.SinonStub).called).toBe(false);
        });
      });
    });
  });

  it("rejects a non-committee list before starting any delivery", async () => {
    const sendMail = sandbox.stub(transactionalMail, "sendTransactionalEmailRequest");
    const response = {json: sandbox.spy(), status: sandbox.stub().returnsThis()};
    await startBatchTransactionalSend({body: {
      brandingMode: BrandingMode.UNBRANDED,
      recipientListIds: [42],
      memberIds: [],
      externalRecipients: to
    }, user: {memberId: senderId}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledOnceWithExactly(403)).toBe(true);
    expect(sendMail.called).toBe(false);
    expect(response.json.firstCall.args[0].error.message).toContain("all on the committee");
  });

  it("sends one mixed unbranded message and records the shared To and Cc without exposing Bcc", async () => {
    const sent = await send();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({to: to.map(recipient => ({...recipient, name: recipient.email})), cc: cc.map(recipient => ({...recipient, name: recipient.email})), bcc: bcc.map(recipient => ({...recipient, name: recipient.email})), replyTo: {email: role.email}});
    const record = (inbox.recordOutboundMessage as sinon.SinonStub).firstCall.args[1];
    expect(record.to.map(recipient => recipient.email)).toEqual(to.map(recipient => recipient.email));
    expect(record.cc.map(recipient => recipient.email)).toEqual(cc.map(recipient => recipient.email));
    expect(JSON.stringify(record)).not.toContain(bcc[0].email);
  });

  it("keeps an explicitly chosen role mailbox even when its holder has another role", async () => {
    (member.find as sinon.SinonStub).returns({lean: async () => [{_id: senderId, email: "alex.reed@example.com"}]});
    const chosen = [{email: "treasurer@group.example.org.uk", memberId: senderId, committeeRoleType: "treasurer"}, to[1]];
    const sent = await send({externalRecipients: chosen, useCommitteeRoleAddresses: true});
    expect(sent).toHaveLength(1);
    expect(sent[0].to.map(recipient => recipient.email)).toEqual(chosen.map(recipient => recipient.email));
    expect((member.find as sinon.SinonStub).called).toBe(false);
  });

  [
    {label: "a retained newsletter type", overrides: {compositionKind: EmailCompositionKind.NEWSLETTER}},
    {label: "a committee mailing list", overrides: {recipientMode: RecipientMode.ENTIRE_LIST, recipientListIds: [7]}}
  ].forEach(({label, overrides}) => {
    it(`sends one shared unbranded email with ${label}`, async () => {
      (member.find as sinon.SinonStub).returns({lean: async () => [{committee: true, email: "chair@group.example.org.uk"}]});
      const sent = await send(overrides);
      expect(sent).toHaveLength(1);
      expect(sent[0].to.map(recipient => recipient.email)).toEqual(to.map(recipient => recipient.email));
      expect(sent[0].cc.map(recipient => recipient.email)).toEqual(cc.map(recipient => recipient.email));
      expect(sent[0].bcc.map(recipient => recipient.email)).toEqual(bcc.map(recipient => recipient.email));
    });
  });

  [
    {label: "branded", overrides: {brandingMode: BrandingMode.BRANDED}},
    {label: "first-name personalised", overrides: {addresseeType: AddresseeType.FIRST_NAME}},
    {label: "member merge fields", overrides: {htmlBody: `{{params.${MergeFieldParamsGroup.MEMBER}.FNAME}}`}},
    {label: "branded mailing lists", overrides: {brandingMode: BrandingMode.BRANDED, recipientMode: RecipientMode.ENTIRE_LIST}}
  ].forEach(({label, overrides}) => {
    it(`sends ${label} to each recipient separately even if shared headers were requested`, async () => {
      const sent = await send(overrides);
      expect(sent).toHaveLength(to.length);
      expect(sent.map(request => request.to.map(recipient => recipient.email))).toEqual(to.map(recipient => [recipient.email]));
    });
  });
});
