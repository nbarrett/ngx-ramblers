import { Request, Response } from "express";
import debug from "debug";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { dateTimeFromMillis, dateTimeNow } from "../../shared/dates";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { handleError, successfulResponse } from "../common/messages";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import {
  BLOCKED_CONTACT_REASON_LABELS,
  EmailAddress,
  NotificationConfig,
  SendSmtpEmailParams,
  SendSmtpEmailRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {
  BatchSendProgress,
  BatchSendProgressEntry,
  BatchSendStatus,
  BatchSendEntryStatus,
  BatchSendStartResponse,
  BatchTransactionalSendRequest,
  AddresseeType,
  ComposerExternalRecipient
} from "../../../../projects/ngx-ramblers/src/app/models/email-composer.model";
import { BrandingMode, WorkflowAction } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { recordMemberEmailSends } from "../../mongo/controllers/member-email-send";
import { Member, MemberEmailBlock } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { bulkDeleteMembersCascade } from "../../mongo/controllers/member-bulk-delete";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { ADMIN_SET_PASSWORD_PATH, SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import * as transforms from "../../mongo/controllers/transforms";
import * as config from "../../mongo/controllers/config";
import { notificationConfig as notificationConfigModel } from "../../mongo/models/notification-config";
import { banner } from "../../mongo/models/banner";
import { member as memberModel } from "../../mongo/models/member";
import { recordSendUsage } from "../../mongo/controllers/external-recipient";
import { randomUUID } from "crypto";
import { accountMergeFieldsFor } from "../account/account";
import { generatePasswordResetIdForMemberId } from "./send-forgot-password-email";
import { inboxMailboxConnection as inboxMailboxConnectionModel } from "../../mongo/models/inbox-mailbox-connection";
import { derivedAliasForRoleType } from "../../inbox/inbox-aliases";
import {
  InboxMessage,
  InboxMessageDirection,
  InboxReaderProvider
} from "../../../../projects/ngx-ramblers/src/app/models/inbox.model";
import { insertSentCopy } from "../../inbox/gmail-inbox-reader";
import { recordOutboundReply } from "../../inbox/inbox-message-import";

interface AuthenticatedRequest extends Request {
  user?: { memberId?: string; userName?: string };
}

const messageType = "brevo:batch-transactional-send";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const SEND_DELAY_MS = 400;
const jobs: Map<string, BatchSendProgress> = new Map();
const cancelled: Set<string> = new Set();

function committeeMemberForRole(roles: CommitteeMember[], role: string): CommitteeMember | undefined {
  return roles?.find(item => item.type === role);
}

function emailAddressForRole(roles: CommitteeMember[], role: string): EmailAddress {
  const found = committeeMemberForRole(roles, role);
  return { name: found?.fullName ?? "", email: found?.email ?? "" };
}

function describeBrevoError(error: any): string {
  if (!error) return "Unknown error";
  const statusCode = error?.statusCode ?? error?.response?.statusCode;
  const body = error?.body ?? error?.response?.body;
  if (statusCode || body) {
    const bodyText = isString(body) ? body : body?.message ?? (body ? JSON.stringify(body) : "");
    return [statusCode ? `Brevo ${statusCode}` : "Brevo", bodyText].filter(Boolean).join(": ").trim();
  }
  return error?.message ?? String(error);
}

function validateSenderRole(senderRole: string | undefined, committeeRoles: CommitteeMember[], context: string): string | null {
  if (!senderRole) return `${context} has no sender role configured`;
  const sender = emailAddressForRole(committeeRoles, senderRole);
  if (!sender.email) {
    const member = committeeMemberForRole(committeeRoles, senderRole);
    const label = member?.description || senderRole;
    if (!member) return `Sender role "${label}" is not assigned to a committee member - assign someone to that role in Mail Settings`;
    return `Sender role "${label}" has no email address - set one in Mail Settings before sending`;
  }
  return null;
}

function emailAddressesForRoles(roles: CommitteeMember[], roleNames: string[]): EmailAddress[] {
  return (roleNames || [])
    .map(role => emailAddressForRole(roles, role))
    .filter(address => !!address.email);
}

function bannerSourceFor(banners: BannerConfig[], bannerId: string | null, groupHref: string): string {
  if (!bannerId) return "";
  const found = banners?.find(item => item.id === bannerId);
  if (!found?.fileNameData) return "";
  return `${groupHref}/api/aws/s3/${found.fileNameData.rootFolder}/${found.fileNameData.awsFileName}`;
}

function addressLineFor(addresseeType: AddresseeType): string {
  if (addresseeType === AddresseeType.HI_ALL) return "Hi all,";
  if (addresseeType === AddresseeType.NONE) return "";
  return "Hi {{params.memberMergeFields.FNAME}},";
}

function memberFullName(member: Member | undefined): string {
  const firstName = member?.firstName || member?.title || "";
  const lastName = member?.lastName || "";
  const full = `${firstName} ${firstName === lastName ? "" : lastName}`.trim();
  return full || member?.displayName || "";
}

function memberMergeFields(member: Member, memberExpiry: string): SendSmtpEmailParams["memberMergeFields"] {
  return {
    FULL_NAME: memberFullName(member),
    EMAIL: member.email ?? "",
    FNAME: member.firstName ?? "",
    LNAME: member.lastName ?? "",
    MEMBER_NUM: member.membershipNumber ?? "",
    USERNAME: member.userName ?? "",
    PW_RESET: member.passwordResetId ?? "",
    MEMBER_EXP: memberExpiry
  };
}

function systemMergeFields(systemCfg: SystemConfig, groupHref: string, passwordResetLink: string = ""): SendSmtpEmailParams["systemMergeFields"] {
  return {
    APP_SHORTNAME: systemCfg?.group?.shortName ?? "",
    APP_LONGNAME: systemCfg?.group?.longName ?? "",
    APP_URL: groupHref,
    PW_RESET_LINK: passwordResetLink,
    FACEBOOK_URL: systemCfg?.externalSystems?.facebook?.groupUrl ?? "",
    TWITTER_URL: systemCfg?.externalSystems?.twitter?.groupUrl ?? "",
    INSTAGRAM_URL: systemCfg?.externalSystems?.instagram?.groupUrl ?? ""
  };
}

function passwordResetLinkFor(member: Member, groupHref: string): string {
  return member.passwordResetId ? `${groupHref}/${ADMIN_SET_PASSWORD_PATH}/${member.passwordResetId}` : "";
}

function buildSubject(notifConfig: NotificationConfig, suppliedSubject: string, params: SendSmtpEmailParams): string {
  const prefix = notifConfig.subject?.prefixParameter
    ? resolveParameter(notifConfig.subject.prefixParameter, params)
    : null;
  const suffix = notifConfig.subject?.suffixParameter
    ? resolveParameter(notifConfig.subject.suffixParameter, params)
    : null;
  return [prefix, suppliedSubject, suffix].filter(value => value).join(" - ");
}

function resolveParameter(path: string, params: SendSmtpEmailParams): string {
  return path.split(".").reduce<any>((value, key) => value?.[key], params) as string;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type WorkItem =
  | { kind: "member"; memberRecord: Member; entry: BatchSendProgressEntry }
  | { kind: "external"; recipient: ComposerExternalRecipient; entry: BatchSendProgressEntry };

function blockSkipReason(emailBlock: MemberEmailBlock): string {
  const label = BLOCKED_CONTACT_REASON_LABELS[emailBlock.reasonCode] || "Blocked from email";
  return emailBlock.reasonMessage ? `${label} - "${emailBlock.reasonMessage}"` : label;
}

function memberSuppressionReason(member: Member, referenceListId: number | null): string | null {
  if (member.emailBlock) {
    return blockSkipReason(member.emailBlock);
  }
  const subscriptions = member.mail?.subscriptions ?? [];
  if (referenceListId !== null) {
    return subscriptions.some(subscription => subscription.id === referenceListId && !subscription.subscribed && !!subscription.unsubscribedAt)
      ? "Unsubscribed from this mailing list"
      : null;
  }
  const hasGenuineUnsubscribe = subscriptions.some(subscription => !subscription.subscribed && !!subscription.unsubscribedAt);
  return hasGenuineUnsubscribe && !subscriptions.some(subscription => subscription.subscribed)
    ? "Unsubscribed from all mailing lists"
    : null;
}

function memberSkipReason(member: Member, referenceListId: number | null, respectEmailBlocks: boolean, respectHeadOfficeConsent: boolean): string | null {
  if (respectEmailBlocks) {
    const suppressionReason = memberSuppressionReason(member, referenceListId);
    if (suppressionReason) {
      return suppressionReason;
    }
  }
  if (respectHeadOfficeConsent && member.emailMarketingConsent === false) {
    return "No Head Office marketing consent";
  }
  return null;
}

function externalRecipientName(recipient: ComposerExternalRecipient): { full: string; first: string; last: string } {
  const trimmed = recipient.name?.trim() ?? "";
  if (!trimmed) {
    const localPart = recipient.email.split("@")[0] ?? "";
    return { full: recipient.email, first: localPart, last: "" };
  }
  const parts = trimmed.split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return { full: trimmed, first, last };
}

interface ResolvedSenderAddresses {
  sender: EmailAddress;
  replyTo: EmailAddress;
  bcc: EmailAddress[];
}

function resolveUnbrandedRole(request: BatchTransactionalSendRequest, committeeRoles: CommitteeMember[], currentMemberId: string | null): CommitteeMember | undefined {
  if (!currentMemberId) return undefined;
  const memberRoles = committeeRoles.filter(role => role.memberId === currentMemberId);
  if (request.unbrandedSenderRoleType) {
    return memberRoles.find(role => role.type === request.unbrandedSenderRoleType && !!role.email);
  }
  return memberRoles.find(role => !!role.email);
}

function resolveSenderAddresses(request: BatchTransactionalSendRequest, committeeRoles: CommitteeMember[], notifConfig: NotificationConfig | null, currentMemberId: string | null): ResolvedSenderAddresses | { error: string } {
  if (request.brandingMode === BrandingMode.UNBRANDED) {
    const role = resolveUnbrandedRole(request, committeeRoles, currentMemberId);
    if (!role?.email) {
      return { error: "Cannot send unbranded email - you are not linked to a committee role with a valid email on this site. Unbranded sends must come from a verified committee role address." };
    }
    const fromAddress: EmailAddress = { name: role.fullName ?? "", email: role.email };
    return { sender: fromAddress, replyTo: fromAddress, bcc: [] };
  }
  const senderRole = request.senderRoleOverride || notifConfig!.senderRole;
  const replyToRole = request.replyToRoleOverride || notifConfig!.replyToRole;
  const bccRoles = request.bccRolesOverride?.length
    ? request.bccRolesOverride
    : (notifConfig!.bccRoles?.length > 0 ? notifConfig!.bccRoles : notifConfig!.ccRoles ?? []);
  return {
    sender: emailAddressForRole(committeeRoles, senderRole),
    replyTo: emailAddressForRole(committeeRoles, replyToRole),
    bcc: emailAddressesForRoles(committeeRoles, bccRoles)
  };
}

function externalMemberMergeFields(recipient: ComposerExternalRecipient): SendSmtpEmailParams["memberMergeFields"] {
  const names = externalRecipientName(recipient);
  return {
    FULL_NAME: names.full,
    EMAIL: recipient.email,
    FNAME: names.first,
    LNAME: names.last,
    MEMBER_NUM: "",
    USERNAME: "",
    PW_RESET: "",
    MEMBER_EXP: ""
  };
}

function contentHasMemberMergeFields(request: BatchTransactionalSendRequest): boolean {
  return [request.subject, request.htmlBody, request.htmlBodyTop, request.htmlBodyBottom]
    .filter(Boolean)
    .some(value => String(value).includes("memberMergeFields"));
}

async function performInboxReplyWriteback(request: BatchTransactionalSendRequest, emailRequest: SendSmtpEmailRequest, brevoMessageId: string | null, transactionalDebugLog: debug.Debugger): Promise<void> {
  const context = request.inboxReplyContext;
  if (!context) {
    return;
  }
  try {
    const alias = await derivedAliasForRoleType(context.aliasId);
    if (!alias) {
      transactionalDebugLog("inbox writeback: no alias found for roleType", context.aliasId);
      return;
    }
    const mailboxConnectionDoc = context.mailboxConnectionId
      ? await inboxMailboxConnectionModel.findById(context.mailboxConnectionId).lean()
      : null;
    const recipient = emailRequest.to?.[0];
    const outboundMessageId = brevoMessageId
      ? (brevoMessageId.startsWith("<") ? brevoMessageId : `<${brevoMessageId}>`)
      : `<${randomUUID()}@ngx-ramblers.org.uk>`;
    const sentAt = dateTimeNow().toMillis();
    let gmailMessageId: string | null = null;
    if (mailboxConnectionDoc?.oauthRefreshTokenEncrypted && mailboxConnectionDoc.provider === InboxReaderProvider.GMAIL_API) {
      try {
        const rfc822 = buildRfc822(emailRequest, outboundMessageId, context.inReplyTo, context.references, sentAt);
        gmailMessageId = await insertSentCopy(mailboxConnectionDoc, rfc822);
      } catch (writeBackError) {
        transactionalDebugLog("inbox writeback: insertSentCopy failed", (writeBackError as Error).message);
      }
    }
    const replyMessage: InboxMessage = {
      threadId: context.threadId,
      mailboxConnectionId: context.mailboxConnectionId,
      direction: InboxMessageDirection.OUTBOUND,
      messageId: outboundMessageId,
      inReplyTo: context.inReplyTo,
      references: context.references,
      from: {name: emailRequest.sender?.name ?? null, email: emailRequest.sender?.email ?? ""},
      to: recipient ? [{name: recipient.name ?? null, email: recipient.email}] : [],
      cc: (emailRequest.cc ?? []).map(address => ({name: address.name ?? null, email: address.email})),
      subject: emailRequest.subject,
      bodyHtml: emailRequest.htmlContent ?? null,
      bodyText: null,
      receivedAt: null,
      sentAt,
      externalSource: InboxReaderProvider.GMAIL_API,
      externalId: gmailMessageId,
      attachments: []
    };
    await recordOutboundReply(alias, replyMessage, context.threadId);
  } catch (error) {
    transactionalDebugLog("inbox writeback failed:", (error as Error).message);
  }
}

function buildRfc822(emailRequest: SendSmtpEmailRequest, messageId: string, inReplyTo: string, references: string[], sentAt: number): string {
  const senderName = emailRequest.sender?.name ?? "";
  const fromHeader = senderName.length > 0
    ? `From: ${escapeHeaderName(senderName)} <${emailRequest.sender?.email}>`
    : `From: ${emailRequest.sender?.email}`;
  const recipient = emailRequest.to?.[0];
  const toHeader = recipient
    ? (recipient.name ? `To: ${escapeHeaderName(recipient.name)} <${recipient.email}>` : `To: ${recipient.email}`)
    : "";
  const lines = [
    fromHeader,
    toHeader,
    `Subject: ${emailRequest.subject}`,
    `Date: ${dateTimeFromMillis(sentAt).toUTC().toRFC2822()}`,
    `Message-ID: ${messageId}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${references.join(" ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    emailRequest.htmlContent ?? ""
  ];
  return lines.filter(line => line.length > 0 || line === "").join("\r\n");
}

function escapeHeaderName(raw: string): string {
  if (/[",<>]/.test(raw)) {
    return `"${raw.replace(/"/g, "\\\"")}"`;
  }
  return raw;
}

async function applyPostSendActions(notifConfig: NotificationConfig | null, sentMemberIds: string[], currentMemberId: string | null, log: debug.Debugger): Promise<void> {
  const postSendActions = notifConfig?.postSendActions ?? [];
  if (postSendActions.length === 0 || sentMemberIds.length === 0) {
    return;
  }
  if (postSendActions.includes(WorkflowAction.DISABLE_GROUP_MEMBER)) {
    const result = await memberModel.updateMany({ _id: { $in: sentMemberIds } }, { $set: { groupMember: false } });
    log("postSendAction DISABLE_GROUP_MEMBER: cleared groupMember on", result.modifiedCount, "of", sentMemberIds.length, "emailed members");
  }
  if (postSendActions.includes(WorkflowAction.BULK_DELETE_GROUP_MEMBER)) {
    const result = await bulkDeleteMembersCascade(sentMemberIds, currentMemberId ?? "");
    log("postSendAction BULK_DELETE_GROUP_MEMBER: deleted", result.deletionResponses.filter(response => response.deleted).length, "members,", result.auditRowsDeleted, "audit rows,", result.orphanRowsDeleted, "orphan audit rows; recorded", result.deletedMemberRows, "deletedMember rows");
  }
}

function annotateWorkflowActionNotes(sentEntries: BatchSendProgressEntry[], notifConfig: NotificationConfig | null, passwordResetGenerated: boolean): void {
  const postSendActions = notifConfig?.postSendActions ?? [];
  const notes: string[] = [];
  if (passwordResetGenerated) {
    notes.push("Password reset link generated");
  }
  if (postSendActions.includes(WorkflowAction.DISABLE_GROUP_MEMBER)) {
    notes.push("Removed from group");
  }
  if (postSendActions.includes(WorkflowAction.BULK_DELETE_GROUP_MEMBER)) {
    notes.push("Deleted from database");
  }
  if (notes.length === 0) {
    return;
  }
  const note = notes.join("; ");
  sentEntries.forEach(entry => { entry.note = note; });
}

async function processBatch(jobId: string, request: BatchTransactionalSendRequest, baseUrl: string, currentMemberId: string | null): Promise<void> {
  const progress = jobs.get(jobId);
  if (!progress) return;
  try {
    const isUnbrandedRequest = request.brandingMode === BrandingMode.UNBRANDED;
    const notifConfig: NotificationConfig | null = request.notificationConfigId
      ? await notificationConfigModel.findById(request.notificationConfigId)
        .lean()
        .then((doc: any) => doc ? transforms.toObjectWithId(doc) as NotificationConfig : null)
      : null;
    if (!notifConfig && !isUnbrandedRequest) {
      progress.status = BatchSendStatus.FAILED;
      progress.errorMessage = "Notification config not found";
      progress.completedAt = dateTimeNow().toMillis();
      return;
    }

    const systemConfigDoc = await config.queryKey(ConfigKey.SYSTEM);
    const systemCfg: SystemConfig = systemConfigDoc?.value;
    const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
    const brevoConfigDoc = await config.queryKey(ConfigKey.BREVO);
    const respectEmailBlocks: boolean = brevoConfigDoc?.value?.respectEmailBlocks === true;
    const respectHeadOfficeConsent: boolean = brevoConfigDoc?.value?.respectHeadOfficeConsent !== false;
    const allBanners: BannerConfig[] = await banner.find({}).lean().then((docs: any[]) => docs.map(transforms.toObjectWithId) as BannerConfig[]);
    const groupHref = systemCfg?.group?.href ?? baseUrl;
    const committeeRoles = committeeCfg?.roles ?? [];
    const isUnbranded = request.brandingMode === BrandingMode.UNBRANDED;
    const rawMemberDocs = await memberModel.find({ _id: { $in: request.memberIds } }).lean().then((docs: any[]) => docs.map(transforms.toObjectWithId) as Member[]);
    const generatePasswordResetIds = !!notifConfig?.preSendActions?.includes(WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID);
    const memberDocs: Member[] = generatePasswordResetIds
      ? await Promise.all(rawMemberDocs.map(async doc => (doc.id ? (await generatePasswordResetIdForMemberId(doc.id)) ?? doc : doc)))
      : rawMemberDocs;
    const membersById = new Map(memberDocs.map(item => [item.id ?? "", item]));
    const addresses = resolveSenderAddresses(request, committeeRoles, notifConfig, currentMemberId);
    if ("error" in addresses) {
      progress.status = BatchSendStatus.FAILED;
      progress.errorMessage = addresses.error;
      progress.completedAt = dateTimeNow().toMillis();
      return;
    }
    const { sender, replyTo, bcc } = addresses;
    const bannerImageSrc = bannerSourceFor(allBanners, request.bannerId, groupHref);
    const accountFields = await accountMergeFieldsFor();
    const externalRecipients = (request.externalRecipients ?? []).filter(item => !!item?.email?.trim());
    const ccAddresses: EmailAddress[] = (request.ccRecipients ?? []).filter(item => !!item?.email?.trim())
      .map(item => ({email: item.email, name: externalRecipientName(item).full}));
    const combinedBcc: EmailAddress[] = [...bcc, ...(request.bccRecipients ?? []).filter(item => !!item?.email?.trim())
      .map(item => ({email: item.email, name: externalRecipientName(item).full}))];
    const memberEntries: BatchSendProgressEntry[] = request.memberIds.map(id => {
      const memberRecord = membersById.get(id);
      return {
        memberId: id,
        email: memberRecord?.email ?? "",
        fullName: memberFullName(memberRecord),
        status: BatchSendEntryStatus.Pending
      } satisfies BatchSendProgressEntry;
    });
    const externalEntries: BatchSendProgressEntry[] = externalRecipients.map((recipient, idx) => ({
      memberId: `external:${idx}`,
      email: recipient.email,
      fullName: externalRecipientName(recipient).full,
      status: BatchSendEntryStatus.Pending
    } satisfies BatchSendProgressEntry));

    const personalised = contentHasMemberMergeFields(request);
    const workItems: WorkItem[] = [
      ...memberEntries.map(entry => ({ kind: "member" as const, memberRecord: membersById.get(entry.memberId)!, entry })),
      ...(personalised ? externalEntries.map((entry, idx) => ({ kind: "external" as const, recipient: externalRecipients[idx], entry })) : [])
    ];

    progress.entries = [...memberEntries, ...externalEntries];
    progress.startedAt = dateTimeNow().toMillis();

    for (const item of workItems) {
      if (cancelled.has(jobId)) {
        progress.status = BatchSendStatus.CANCELLED;
        progress.completedAt = dateTimeNow().toMillis();
        cancelled.delete(jobId);
        return;
      }
      const entry = item.entry;
      if (item.kind === "member") {
        const memberRecord = membersById.get(entry.memberId);
        if (!memberRecord || !memberRecord.email) {
          entry.status = BatchSendEntryStatus.Failed;
          entry.errorMessage = "Member missing email";
          progress.failedCount += 1;
          continue;
        }
        const referenceListId = request.narrowListId ?? notifConfig?.defaultListId ?? null;
        const suppressionReason = memberSkipReason(memberRecord, referenceListId, respectEmailBlocks, respectHeadOfficeConsent);
        if (suppressionReason) {
          entry.status = BatchSendEntryStatus.Skipped;
          entry.errorMessage = suppressionReason;
          progress.skippedCount += 1;
          continue;
        }
      } else if (!item.recipient.email) {
        entry.status = BatchSendEntryStatus.Failed;
        entry.errorMessage = "Recipient missing email";
        progress.failedCount += 1;
        continue;
      }
      try {
        const memberMergeFieldsValue = item.kind === "member"
          ? memberMergeFields(item.memberRecord, item.memberRecord.membershipExpiryDate ? dateTimeFromMillis(item.memberRecord.membershipExpiryDate).toFormat(UIDateFormat.DISPLAY_DATE) : "")
          : externalMemberMergeFields(item.recipient);
        const params: SendSmtpEmailParams = {
          messageMergeFields: {
            subject: null as unknown as string,
            BANNER_IMAGE_SOURCE: bannerImageSrc,
            ADDRESS_LINE: addressLineFor(request.addresseeType),
            BODY_CONTENT: request.htmlBody,
            BODY_CONTENT_TOP: request.htmlBodyTop ?? "",
            BODY_CONTENT_BOTTOM: request.htmlBodyBottom ?? "",
            ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor)
          },
          memberMergeFields: memberMergeFieldsValue,
          systemMergeFields: systemMergeFields(systemCfg, groupHref, item.kind === "member" ? passwordResetLinkFor(item.memberRecord, groupHref) : ""),
          accountMergeFields: accountFields
        };
        const subject = notifConfig ? buildSubject(notifConfig, request.subject, params) : request.subject;
        params.messageMergeFields.subject = subject;
        const recipientEmail = item.kind === "member" ? item.memberRecord.email : item.recipient.email;
        const replyHeaders = request.inboxReplyContext
          ? {"In-Reply-To": request.inboxReplyContext.inReplyTo, "References": request.inboxReplyContext.references.join(" ")}
          : undefined;
        const emailRequest: SendSmtpEmailRequest = {
          subject,
          sender,
          to: [{ email: recipientEmail, name: entry.fullName }],
          replyTo,
          cc: ccAddresses.length > 0 ? ccAddresses : undefined,
          bcc: combinedBcc.length > 0 ? combinedBcc : undefined,
          listId: notifConfig?.defaultListId,
          params,
          headers: replyHeaders,
          brandingMode: request.brandingMode,
          ...(isUnbranded
            ? { htmlContent: request.htmlBody }
            : { templateName: notifConfig!.templateName, templateOverrides: notifConfig!.templateOverrides, body: notifConfig!.body })
        };
        const sendResult = await sendTransactionalEmailRequest(emailRequest, debugLog, baseUrl);
        entry.status = BatchSendEntryStatus.Sent;
        entry.sentAt = dateTimeNow().toMillis();
        progress.sentCount += 1;
        if (request.inboxReplyContext) {
          await performInboxReplyWriteback(request, emailRequest, sendResult?.body?.messageId ?? null, debugLog);
        }
        if (item.kind === "external" && currentMemberId) {
          await recordSendUsage({
            email: item.recipient.email,
            name: item.recipient.name,
            createdBy: currentMemberId,
            saveForReuse: item.recipient.saveForReuse !== false
          });
        }
      } catch (error: any) {
        entry.status = BatchSendEntryStatus.Failed;
        entry.errorMessage = describeBrevoError(error);
        debugLog("send to", entry.email, "failed:", entry.errorMessage, "raw:", error);
        progress.failedCount += 1;
      }
      await delay(SEND_DELAY_MS);
    }

    if (!personalised && !cancelled.has(jobId) && externalRecipients.length > 0) {
      try {
        const externalParams: SendSmtpEmailParams = {
          messageMergeFields: {
            subject: null as unknown as string,
            BANNER_IMAGE_SOURCE: bannerImageSrc,
            ADDRESS_LINE: addressLineFor(request.addresseeType),
            BODY_CONTENT: request.htmlBody,
            BODY_CONTENT_TOP: request.htmlBodyTop ?? "",
            BODY_CONTENT_BOTTOM: request.htmlBodyBottom ?? "",
            ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor)
          },
          memberMergeFields: externalMemberMergeFields({ email: "", name: "" } as ComposerExternalRecipient),
          systemMergeFields: systemMergeFields(systemCfg, groupHref, ""),
          accountMergeFields: accountFields
        };
        const externalSubject = notifConfig ? buildSubject(notifConfig, request.subject, externalParams) : request.subject;
        externalParams.messageMergeFields.subject = externalSubject;
        const externalReplyHeaders = request.inboxReplyContext
          ? {"In-Reply-To": request.inboxReplyContext.inReplyTo, "References": request.inboxReplyContext.references.join(" ")}
          : undefined;
        const externalEmailRequest: SendSmtpEmailRequest = {
          subject: externalSubject,
          sender,
          to: externalRecipients.map(recipient => ({ email: recipient.email, name: externalRecipientName(recipient).full })),
          replyTo,
          cc: ccAddresses.length > 0 ? ccAddresses : undefined,
          bcc: combinedBcc.length > 0 ? combinedBcc : undefined,
          listId: notifConfig?.defaultListId,
          params: externalParams,
          headers: externalReplyHeaders,
          brandingMode: request.brandingMode,
          ...(isUnbranded
            ? { htmlContent: request.htmlBody }
            : { templateName: notifConfig!.templateName, templateOverrides: notifConfig!.templateOverrides, body: notifConfig!.body })
        };
        const externalSendResult = await sendTransactionalEmailRequest(externalEmailRequest, debugLog, baseUrl);
        const sentAt = dateTimeNow().toMillis();
        externalEntries.forEach(entry => { entry.status = BatchSendEntryStatus.Sent; entry.sentAt = sentAt; });
        progress.sentCount += externalEntries.length;
        if (request.inboxReplyContext) {
          await performInboxReplyWriteback(request, externalEmailRequest, externalSendResult?.body?.messageId ?? null, debugLog);
        }
        if (currentMemberId) {
          await externalRecipients.reduce<Promise<void>>(async (acc, recipient) => {
            await acc;
            await recordSendUsage({ email: recipient.email, name: recipient.name, createdBy: currentMemberId, saveForReuse: recipient.saveForReuse !== false });
          }, Promise.resolve());
        }
      } catch (error: any) {
        const failureMessage = describeBrevoError(error);
        externalEntries.forEach(entry => { entry.status = BatchSendEntryStatus.Failed; entry.errorMessage = failureMessage; });
        progress.failedCount += externalEntries.length;
        debugLog("combined external send failed:", failureMessage, "raw:", error);
      }
    }

    const sentEntries = memberEntries.filter(entry => entry.status === BatchSendEntryStatus.Sent);
    const sentMemberIds = sentEntries.map(entry => entry.memberId);
    await recordMemberEmailSends({
      jobId,
      notificationConfigId: notifConfig?.id ?? null,
      subject: request.subject,
      sentBy: currentMemberId,
      entries: sentEntries.map(entry => ({ memberId: entry.memberId, email: entry.email, sentAt: entry.sentAt ?? dateTimeNow().toMillis() }))
    });
    await applyPostSendActions(notifConfig, sentMemberIds, currentMemberId, debugLog);
    annotateWorkflowActionNotes(sentEntries, notifConfig, generatePasswordResetIds);
    progress.completedAt = dateTimeNow().toMillis();
    progress.status = progress.failedCount === 0 ? BatchSendStatus.COMPLETED : BatchSendStatus.COMPLETED_WITH_ERRORS;
  } catch (error: any) {
    progress.status = BatchSendStatus.FAILED;
    progress.errorMessage = error?.message ?? String(error);
    progress.completedAt = dateTimeNow().toMillis();
  }
}

export async function startBatchTransactionalSend(req: Request, res: Response): Promise<void> {
  try {
    const request: BatchTransactionalSendRequest = req.body;
    const externalCount = request?.externalRecipients?.filter(item => !!item?.email?.trim()).length ?? 0;
    const memberCount = request?.memberIds?.length ?? 0;
    if (memberCount === 0 && externalCount === 0) {
      res.status(400).json({ request: { messageType }, error: { message: "No recipients supplied" } });
      return;
    }
    const isUnbranded = request.brandingMode === BrandingMode.UNBRANDED;
    const currentMemberIdForValidation = (req as AuthenticatedRequest).user?.memberId ?? null;
    if (isUnbranded) {
      const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
      const committeeRoles: CommitteeMember[] = committeeConfigDoc?.value?.roles ?? [];
      const role = resolveUnbrandedRole(request, committeeRoles, currentMemberIdForValidation);
      if (!role?.email) {
        const requestedType = request.unbrandedSenderRoleType;
        const errorMessage = requestedType
          ? `Cannot send unbranded email - the role "${requestedType}" you chose is not one of your committee roles with a valid email. Pick another or contact a site administrator.`
          : "Cannot send unbranded email - you are not linked to a committee role with a valid email on this site. Unbranded sends must come from a verified committee role address.";
        res.status(400).json({ request: { messageType }, error: { message: errorMessage } });
        return;
      }
    } else {
      const notifConfig: NotificationConfig | null = request.notificationConfigId
        ? await notificationConfigModel.findById(request.notificationConfigId)
          .lean()
          .then((doc: any) => doc ? transforms.toObjectWithId(doc) as NotificationConfig : null)
        : null;
      if (!notifConfig) {
        res.status(400).json({ request: { messageType }, error: { message: `Notification config ${request.notificationConfigId} not found` } });
        return;
      }
      const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
      const committeeRoles: CommitteeMember[] = committeeConfigDoc?.value?.roles ?? [];
      const effectiveSenderRole = request.senderRoleOverride || notifConfig.senderRole;
      const senderContext = `Email type "${notifConfig.subject?.text ?? notifConfig.id}"`;
      const senderError = validateSenderRole(effectiveSenderRole, committeeRoles, senderContext);
      if (senderError) {
        res.status(400).json({ request: { messageType }, error: { message: senderError } });
        return;
      }
    }
    const totalRecipients = memberCount + externalCount;
    const jobId = randomUUID();
    const progress: BatchSendProgress = {
      jobId,
      status: BatchSendStatus.RUNNING,
      totalRecipients,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      startedAt: dateTimeNow().toMillis(),
      entries: []
    };
    jobs.set(jobId, progress);
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const currentMemberId = (req as AuthenticatedRequest).user?.memberId ?? null;
    void processBatch(jobId, request, baseUrl, currentMemberId);
    const response: BatchSendStartResponse = { jobId, totalRecipients };
    successfulResponse({ req, res, response, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}

export async function batchTransactionalStatus(req: Request, res: Response): Promise<void> {
  try {
    const jobId = req.params["jobId"];
    const progress = jobs.get(jobId);
    if (!progress) {
      res.status(404).json({ request: { messageType }, error: { message: "Job not found" } });
      return;
    }
    successfulResponse({ req, res, response: progress, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}

export async function cancelBatchTransactional(req: Request, res: Response): Promise<void> {
  try {
    const jobId = req.params["jobId"];
    const progress = jobs.get(jobId);
    if (!progress) {
      res.status(404).json({ request: { messageType }, error: { message: "Job not found" } });
      return;
    }
    cancelled.add(jobId);
    successfulResponse({ req, res, response: progress, messageType, debugLog });
  } catch (error) {
    handleError(req, res, messageType, debugLog, error);
  }
}
