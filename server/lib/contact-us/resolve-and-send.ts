import { NextFunction, Request, Response } from "express";
import debug from "debug";
import { randomUUID } from "crypto";
import { Brevo } from "@getbrevo/brevo";
import { sendTransactionalMail } from "../brevo/transactional-mail/send-transactional-mail";
import { accountMergeFieldsFor } from "../brevo/account/account";
import { performTemplateSubstitution } from "../brevo/common/messages";
import * as config from "../mongo/controllers/config";
import { ConfigKey } from "../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  CommitteeConfig,
  CommitteeMember,
  ForwardEmailTarget
} from "../../../projects/ngx-ramblers/src/app/models/committee.model";
import {
  EmailAddress,
  SendSmtpEmailRequest
} from "../../../projects/ngx-ramblers/src/app/models/mail.model";
import { member } from "../mongo/models/member";
import { envConfig } from "../env-config/env-config";
import { normaliseEmail } from "../../../projects/ngx-ramblers/src/app/functions/strings";
import {
  catchAllConnectionEmail,
  cloudflareIngressProviderActive,
  connectedInboxEmails,
  connectionIdentifier,
  defaultTenantSlug
} from "../inbox/inbox-aliases";
import { ensureCloudflareIngressConnection } from "../cloudflare/cloudflare-ingress-connection";
import { storeInboundMessage } from "../inbox/inbox-message-import";
import {
  InboxAliasConfig,
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider
} from "../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { htmlToPlainText } from "../shared/string-utils";
import { dateTimeNow } from "../shared/dates";
import { systemConfig } from "../config/system-config";

const debugLog = debug(envConfig.logNamespace("contact-us:resolve-recipients"));
debugLog.enabled = true;

function findRoleByEmail(roles: CommitteeMember[], email: string): CommitteeMember | null {
  const target = normaliseEmail(email);
  if (!target) {
    return null;
  }
  return roles.find(role => normaliseEmail(role.email) === target) || null;
}

function findRoleByType(roles: CommitteeMember[], roleType: string): CommitteeMember | null {
  return roleType ? (roles.find(role => role.type === roleType) || null) : null;
}

async function linkedMemberEmailFor(memberId: string): Promise<string | null> {
  if (!memberId) {
    return null;
  }
  try {
    const linked: any = await member.findById(memberId, { email: 1 }).lean().exec();
    return linked?.email || null;
  } catch (error: any) {
    debugLog("linkedMemberEmailFor:failed", memberId, error?.message || error);
    return null;
  }
}

function forwardsToConnectedInbox(role: CommitteeMember, connectedEmails: Set<string>): boolean {
  return role.forwardEmailTarget === ForwardEmailTarget.CUSTOM
    && Boolean(role.forwardEmailCustom)
    && connectedEmails.has(normaliseEmail(role.forwardEmailCustom));
}

function effectiveTarget(role: CommitteeMember, connectedEmails: Set<string>): ForwardEmailTarget | undefined {
  if (role.contactUsTarget != null) {
    return role.contactUsTarget;
  }
  if (forwardsToConnectedInbox(role, connectedEmails)) {
    return ForwardEmailTarget.ROLE_EMAIL;
  }
  return role.forwardEmailTarget;
}

function effectiveCustom(role: CommitteeMember): string {
  return role.contactUsCustom ?? role.forwardEmailCustom;
}

function effectiveRecipients(role: CommitteeMember): string[] {
  return (role.contactUsRecipients ?? role.forwardEmailRecipients) || [];
}

function nameFor(role: CommitteeMember): string {
  return role.contactUsLabel || role.fullName;
}

async function resolveOne(recipient: EmailAddress, roles: CommitteeMember[], connectedEmails: Set<string>): Promise<EmailAddress[]> {
  const role = findRoleByEmail(roles, recipient.email);
  if (!role) {
    return [recipient];
  }
  const target = effectiveTarget(role, connectedEmails);
  const label = nameFor(role);
  switch (target) {
    case ForwardEmailTarget.ROLE_EMAIL: {
      debugLog("resolveOne:ROLE_EMAIL keeping role address", role.email);
      return [{ name: label, email: role.email }];
    }
    case ForwardEmailTarget.CUSTOM: {
      const custom = effectiveCustom(role);
      if (custom) {
        debugLog("resolveOne:CUSTOM rewrote", recipient.email, "to", custom);
        return [{ name: label, email: custom }];
      }
      return [{ name: label, email: recipient.email }];
    }
    case ForwardEmailTarget.CATCHALL: {
      const catchAll = await catchAllConnectionEmail(defaultTenantSlug());
      if (catchAll) {
        debugLog("resolveOne:CATCHALL rewrote", recipient.email, "to catch-all", catchAll);
        return [{ name: label, email: catchAll }];
      }
      return [{ name: label, email: recipient.email }];
    }
    case ForwardEmailTarget.MULTIPLE: {
      const list = effectiveRecipients(role).filter(Boolean);
      if (list.length > 0) {
        debugLog("resolveOne:MULTIPLE rewrote", recipient.email, "to", list);
        return list.map(email => ({ name: label, email }));
      }
      return [{ name: label, email: recipient.email }];
    }
    case ForwardEmailTarget.NONE:
      debugLog("resolveOne:NONE dropping", recipient.email);
      return [];
    case ForwardEmailTarget.MEMBER_EMAIL:
    default: {
      if (!role.memberId) {
        return [{ name: label, email: recipient.email }];
      }
      const linkedEmail = await linkedMemberEmailFor(role.memberId);
      if (!linkedEmail) {
        return [{ name: label, email: recipient.email }];
      }
      debugLog("resolveOne:MEMBER_EMAIL rewrote", recipient.email, "to linked member", linkedEmail);
      return [{ name: label, email: linkedEmail }];
    }
  }
}

export async function resolveContactRecipients(to: EmailAddress[], roles: CommitteeMember[], connectedEmails: Set<string>): Promise<EmailAddress[]> {
  if (!to?.length || !roles?.length) {
    return to || [];
  }
  const resolved = await Promise.all(to.map(recipient => resolveOne(recipient, roles, connectedEmails)));
  return resolved.flat();
}

function roleForContactRequest(
  emailRequest: SendSmtpEmailRequest,
  originalTo: EmailAddress[],
  roles: CommitteeMember[]
): CommitteeMember | null {
  const fromField = emailRequest.contactUsRecipientRole;
  const byType = findRoleByType(roles, fromField);
  const fromOriginal = originalTo
    .map(address => findRoleByEmail(roles, address.email))
    .find(Boolean);
  const fromResolved = (emailRequest.to || [])
    .map(address => findRoleByEmail(roles, address.email))
    .find(Boolean);
  return byType || fromOriginal || fromResolved || null;
}

function deliversViaSiteInbox(role: CommitteeMember, connectedEmails: Set<string>): boolean {
  const target = effectiveTarget(role, connectedEmails);
  return target === ForwardEmailTarget.ROLE_EMAIL
    || target === ForwardEmailTarget.CATCHALL
    || target == null;
}

function externalSmtpRecipients(
  resolvedTo: EmailAddress[],
  role: CommitteeMember | null
): EmailAddress[] {
  const roleEmail = normaliseEmail(role?.email);
  return (resolvedTo || []).filter(address => {
    const email = normaliseEmail(address.email);
    return email && email !== roleEmail;
  });
}

const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

async function sitePublicBaseUrl(emailRequest: SendSmtpEmailRequest): Promise<string> {
  const fromParams = emailRequest.params?.systemMergeFields?.APP_URL || "";
  const configured = (await systemConfig())?.group?.href || "";
  const preferred = fromParams && !DEV_ORIGIN.test(fromParams) ? fromParams : configured;
  return preferred.replace(/\/+$/, "");
}

async function withoutDevHostUrls(emailRequest: SendSmtpEmailRequest): Promise<SendSmtpEmailRequest> {
  const publicBase = await sitePublicBaseUrl(emailRequest);
  let result = emailRequest;
  if (publicBase && emailRequest.params) {
    const banner = emailRequest.params.messageMergeFields?.BANNER_IMAGE_SOURCE || "";
    const appUrl = emailRequest.params.systemMergeFields?.APP_URL || "";
    const nextMessage = emailRequest.params.messageMergeFields
      ? {
        ...emailRequest.params.messageMergeFields,
        BANNER_IMAGE_SOURCE: DEV_ORIGIN.test(banner) ? banner.replace(DEV_ORIGIN, publicBase) : banner
      }
      : emailRequest.params.messageMergeFields;
    const nextSystem = emailRequest.params.systemMergeFields
      ? {
        ...emailRequest.params.systemMergeFields,
        APP_URL: DEV_ORIGIN.test(appUrl) ? publicBase : appUrl
      }
      : emailRequest.params.systemMergeFields;
    result = {
      ...emailRequest,
      params: {
        ...emailRequest.params,
        messageMergeFields: nextMessage,
        systemMergeFields: nextSystem
      }
    };
  }
  return result;
}

async function brandedContactUsHtml(emailRequest: SendSmtpEmailRequest): Promise<string> {
  const safeRequest = await withoutDevHostUrls(emailRequest);
  const formBody = emailRequest.contactUsFormBodyHtml
    || safeRequest.params?.messageMergeFields?.BODY_CONTENT
    || "";
  const forInbox: SendSmtpEmailRequest = safeRequest.params?.messageMergeFields
    ? {
      ...safeRequest,
      params: {
        ...safeRequest.params,
        messageMergeFields: {
          ...safeRequest.params.messageMergeFields,
          BODY_CONTENT: formBody,
          BODY_CONTENT_TOP: "",
          BODY_CONTENT_BOTTOM: ""
        }
      }
    }
    : safeRequest;
  const draft: Brevo.SendTransacEmailRequest = {
    subject: forInbox.subject,
    sender: forInbox.sender,
    to: forInbox.to,
    replyTo: forInbox.replyTo,
    params: forInbox.params as unknown as Record<string, unknown>
  };
  await performTemplateSubstitution(forInbox, draft, debugLog);
  return draft.htmlContent
    || formBody
    || forInbox.htmlContent
    || forInbox.body
    || "";
}

async function storeContactUsInInbox(
  emailRequest: SendSmtpEmailRequest,
  role: CommitteeMember
): Promise<boolean> {
  const providerActive = await cloudflareIngressProviderActive();
  let stored = false;
  if (!providerActive) {
    debugLog("storeContactUsInInbox: skipped (provider is not cloudflare-ingress)");
  } else {
    const connection = await ensureCloudflareIngressConnection();
    const connectionId = connectionIdentifier(connection);
    const tenantSlug = defaultTenantSlug();
    const alias: InboxAliasConfig = {
      id: role.type,
      tenantSlug,
      roleType: role.type,
      roleEmail: role.email,
      mailboxConnectionId: connectionId,
      enabled: true,
      inboxMessageNotifications: role.inboxMessageNotifications === true,
      inboxNotificationEmail: role.inboxNotificationEmail?.trim() || null,
      memberId: role.memberId ?? null
    };
    const visitor = {
      name: emailRequest.replyTo?.name || null,
      email: emailRequest.replyTo?.email || ""
    };
    const roleRecipient = {
      name: role.description || role.contactUsLabel || role.fullName || role.type,
      email: role.email
    };
    const bodyHtml = await brandedContactUsHtml(emailRequest);
    const bodyText = bodyHtml ? htmlToPlainText(bodyHtml) : "";
    const now = dateTimeNow().toMillis();
    const message: InboxMessage = {
      threadId: "",
      mailboxConnectionId: connectionId,
      direction: InboxMessageDirection.INBOUND,
      messageId: `<contact-us-${randomUUID()}@ngx-inbox>`,
      inReplyTo: null,
      references: [],
      from: visitor,
      replyTo: visitor.email ? {...visitor} : null,
      autoReply: false,
      to: [roleRecipient],
      cc: [],
      subject: emailRequest.subject || "Website Enquiry",
      bodyHtml: bodyHtml || null,
      bodyText: bodyText || null,
      receivedAt: now,
      sentAt: null,
      externalSource: InboxReaderProvider.CLOUDFLARE_INGRESS,
      externalId: null,
      attachments: [],
      conversationKey: null
    };
    await storeInboundMessage(alias, message);
    debugLog("storeContactUsInInbox: stored branded message under role %s for %s", role.type, visitor.email);
    stored = true;
  }
  return stored;
}

export async function sendContactUsTransactionalMail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const emailRequest: SendSmtpEmailRequest = req.body;
    const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
    const roles: CommitteeMember[] = committeeCfg?.roles || [];
    const connectedEmails = new Set(await connectedInboxEmails(defaultTenantSlug()));
    const originalTo = [...(emailRequest.to || [])];
    emailRequest.to = await resolveContactRecipients(emailRequest.to || [], roles, connectedEmails);
    if (!emailRequest.to?.length) {
      res.status(400).json({
        error: "No contact recipient is configured for this role. Ask the site admin to set where contact-us messages should go."
      });
    } else {
      if (emailRequest.params) {
        emailRequest.params.accountMergeFields = await accountMergeFieldsFor();
      }
      const role = roleForContactRequest(emailRequest, originalTo, roles);
      const inboxEligible = role && deliversViaSiteInbox(role, connectedEmails);
      const storedToInbox = inboxEligible ? await storeContactUsInInbox(emailRequest, role) : false;
      const externalTo = externalSmtpRecipients(emailRequest.to, role);
      if (storedToInbox && externalTo.length === 0) {
        debugLog("sendContactUsTransactionalMail: delivered to site inbox for %s; skipping SMTP to role address", role?.type);
        res.status(200).json({
          request: {messageType: "contact-us:transactional-send"},
          response: {storedToInbox: true, roleType: role?.type || null}
        });
      } else {
        if (storedToInbox && externalTo.length > 0) {
          emailRequest.to = externalTo;
          debugLog("sendContactUsTransactionalMail: stored to inbox and sending SMTP to external recipients %o", externalTo);
        } else {
          debugLog("sendContactUsTransactionalMail:resolved to:", emailRequest.to);
        }
        return sendTransactionalMail(req, res, next);
      }
    }
  } catch (error) {
    next(error);
  }
}
