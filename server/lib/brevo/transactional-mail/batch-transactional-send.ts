import { Request, Response } from "express";
import debug from "debug";
import { isString } from "es-toolkit/compat";
import { envConfig } from "../../env-config/env-config";
import { dateTimeFromMillis, dateTimeNow } from "../../shared/dates";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { handleError, successfulResponse } from "../common/messages";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import {
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
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
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

function memberMergeFields(member: Member, memberExpiry: string): SendSmtpEmailParams["memberMergeFields"] {
  return {
    FULL_NAME: member.displayName ?? `${member.firstName} ${member.lastName}`.trim(),
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
    const memberEntries: BatchSendProgressEntry[] = request.memberIds.map(id => {
      const memberRecord = membersById.get(id);
      return {
        memberId: id,
        email: memberRecord?.email ?? "",
        fullName: memberRecord?.displayName ?? `${memberRecord?.firstName ?? ""} ${memberRecord?.lastName ?? ""}`.trim(),
        status: BatchSendEntryStatus.Pending
      } satisfies BatchSendProgressEntry;
    });
    const externalEntries: BatchSendProgressEntry[] = externalRecipients.map((recipient, idx) => ({
      memberId: `external:${idx}`,
      email: recipient.email,
      fullName: externalRecipientName(recipient).full,
      status: BatchSendEntryStatus.Pending
    } satisfies BatchSendProgressEntry));

    const workItems: WorkItem[] = [
      ...memberEntries.map((entry, idx) => ({ kind: "member" as const, memberRecord: memberDocs[idx], entry })),
      ...externalEntries.map((entry, idx) => ({ kind: "external" as const, recipient: externalRecipients[idx], entry }))
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
      } else if (!item.recipient.email) {
        entry.status = BatchSendEntryStatus.Failed;
        entry.errorMessage = "Recipient missing email";
        progress.failedCount += 1;
        continue;
      }
      try {
        const memberMergeFieldsValue = item.kind === "member"
          ? memberMergeFields(item.memberRecord, item.memberRecord.membershipExpiryDate ? dateTimeFromMillis(item.memberRecord.membershipExpiryDate).toFormat(UIDateFormat.YEAR_MONTH_DAY_WITH_DASHES) : "")
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
        const emailRequest: SendSmtpEmailRequest = {
          subject,
          sender,
          to: [{ email: recipientEmail, name: entry.fullName }],
          replyTo,
          bcc: bcc.length > 0 ? bcc : undefined,
          listId: notifConfig?.defaultListId,
          params,
          brandingMode: request.brandingMode,
          ...(isUnbranded
            ? { htmlContent: request.htmlBody }
            : { templateId: notifConfig!.templateId, templateOverrides: notifConfig!.templateOverrides })
        };
        await sendTransactionalEmailRequest(emailRequest, debugLog, baseUrl);
        entry.status = BatchSendEntryStatus.Sent;
        entry.sentAt = dateTimeNow().toMillis();
        progress.sentCount += 1;
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
