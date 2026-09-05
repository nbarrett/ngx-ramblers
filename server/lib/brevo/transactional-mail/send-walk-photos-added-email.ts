import debug from "debug";
import { isValidObjectId } from "mongoose";
import { envConfig } from "../../env-config/env-config";
import * as config from "../../mongo/controllers/config";
import * as transforms from "../../mongo/controllers/transforms";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EmailAddress,
  NotificationConfig,
  SendSmtpEmailRequest,
  WalkPhotosAddedNotificationRequest,
  WalkPhotosAddedNotificationResponse
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { ExtendedGroupEvent } from "../../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { StoredValue } from "../../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";
import { banner } from "../../mongo/models/banner";
import { member } from "../../mongo/models/member";
import { extendedGroupEvent } from "../../mongo/models/extended-group-event";
import { notificationConfig } from "../../mongo/models/notification-config";
import { configuredBrevo } from "../brevo-config";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import { signoffHtmlForConfig } from "./signoff-names";
import { logBrevoError } from "../common/error-log";
import { ramblersAccountMergeFields } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-legal.model";
import { bannerImageSource, buildSubject, emailAddressForRole } from "./send-member-bulk-load-digest-email";
import { dateTimeFromIso, formatDateTime } from "../../shared/dates";

const messageType = "brevo:send-walk-photos-added-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const TEMPLATE_NAME = "fully-automated-text-body";

function walkQuery(walkId: string) {
  return isValidObjectId(walkId) ? {$or: [{_id: walkId}, {"groupEvent.id": walkId}]} : {"groupEvent.id": walkId};
}

function toEmailAddress(recipient: Member | null): EmailAddress | null {
  return recipient?.email ? {email: recipient.email, name: recipient.displayName || `${recipient.firstName} ${recipient.lastName}`.trim()} : null;
}

function uniqueByEmail(addresses: EmailAddress[]): EmailAddress[] {
  return addresses.filter((address, index, all) => !!address?.email && all.findIndex(item => item.email?.toLowerCase() === address.email.toLowerCase()) === index);
}

function escapeHtml(value: string): string {
  return (value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function bodyHtml(uploaderName: string, photoCount: number, walkTitle: string, walkDate: string, walkLink: string, reviewLink: string): string {
  const photos = photoCount === 1 ? "a photo" : `${photoCount} photos`;
  const walkText = walkDate ? `${escapeHtml(walkTitle)} on ${escapeHtml(walkDate)}` : escapeHtml(walkTitle);
  const walkHtml = walkLink ? `<a href="${walkLink}">${walkText}</a>` : walkText;
  return [
    `<p>${escapeHtml(uploaderName)} has added ${photos} to the album for ${walkHtml}.</p>`,
    "<p>The photos stay hidden from visitors until the walk leader or an administrator approves them.</p>",
    reviewLink ? `<p><a href="${reviewLink}">Review and approve the photos</a></p>` : ""
  ].filter(Boolean).join("\n");
}

export async function sendWalkPhotosAddedEmail(request: WalkPhotosAddedNotificationRequest, uploadedByMemberId: string): Promise<WalkPhotosAddedNotificationResponse> {
  const brevoConfig = await configuredBrevo();
  const configId = brevoConfig?.photoUploadNotificationConfigId;
  const notifConfig: NotificationConfig = configId
    ? await notificationConfig.findById(configId).lean().then(doc => doc ? transforms.toObjectWithId(doc) as NotificationConfig : null)
    : null;
  const walk: ExtendedGroupEvent = await extendedGroupEvent.findOne(walkQuery(request.walkId)).lean().then(doc => doc ? transforms.toObjectWithId(doc) as ExtendedGroupEvent : null);
  const leaderMemberId = walk?.fields?.contactDetails?.memberId;
  const leader: Member = leaderMemberId && isValidObjectId(leaderMemberId) ? await member.findById(leaderMemberId).lean().then(doc => doc ? transforms.toObjectWithId(doc) as Member : null) : null;
  const coordinators: Member[] = await member.find({walkChangeNotifications: true}).lean().then(docs => docs.map(doc => transforms.toObjectWithId(doc) as Member));
  const uploader: Member = uploadedByMemberId && isValidObjectId(uploadedByMemberId) ? await member.findById(uploadedByMemberId).lean().then(doc => doc ? transforms.toObjectWithId(doc) as Member : null) : null;
  const recipients = uniqueByEmail([toEmailAddress(leader), ...coordinators.map(toEmailAddress)]);
  const systemCfg: SystemConfig = (await config.queryKey(ConfigKey.SYSTEM))?.value;
  const committeeCfg: CommitteeConfig = (await config.queryKey(ConfigKey.COMMITTEE))?.value;
  const committeeRoles: CommitteeMember[] = committeeCfg?.roles || [];
  const sender = notifConfig ? emailAddressForRole(committeeRoles, notifConfig.senderRole) : null;
  if (!configId) {
    debugLog("no photoUploadNotificationConfigId configured - skipping");
    return {sent: false, recipients: []};
  } else if (!notifConfig) {
    debugLog("photoUploadNotificationConfigId set but config not found - skipping");
    return {sent: false, recipients: []};
  } else if (!walk) {
    debugLog("walk not found for", request.walkId, "- skipping");
    return {sent: false, recipients: []};
  } else if (!sender) {
    debugLog("no sender email resolved for senderRole", notifConfig.senderRole);
    return {sent: false, recipients: []};
  } else if (recipients.length === 0) {
    debugLog("no walk leader or walk notification recipients with an email address");
    return {sent: false, recipients: []};
  } else {
    const groupHref = (systemCfg?.group?.href || "").replace(/\/+$/, "");
    const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));
    const walkTitle = walk.groupEvent?.title || "the walk";
    const walkDate = walk.groupEvent?.start_date_time ? formatDateTime(dateTimeFromIso(walk.groupEvent.start_date_time), UIDateFormat.DISPLAY_DATE) : "";
    const walkSlug = (walk.groupEvent?.url || "").replace(/\/+$/, "").split("/").filter(Boolean).pop() || walk.id;
    const walkLink = groupHref ? `${groupHref}/walks/${encodeURIComponent(walkSlug)}` : "";
    const albumPath = (request.albumPath || "").replace(/^\/+/, "");
    const reviewLink = groupHref && albumPath ? `${groupHref}/${albumPath}?${StoredValue.ALBUM_WORKFLOW}=1` : "";
    const contributorLabel = [request.contributorName, request.contributorEmail].filter(Boolean).join(" (") + (request.contributorEmail && request.contributorName ? ")" : "");
    const uploaderName = uploader?.displayName || `${uploader?.firstName || ""} ${uploader?.lastName || ""}`.trim() || contributorLabel || "A visitor";
    const params = {
      messageMergeFields: {
        subject: "",
        BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, notifConfig.bannerId, groupHref),
        ADDRESS_LINE: "Hi all,",
        BODY_CONTENT: bodyHtml(uploaderName, request.photoCount, walkTitle, walkDate, walkLink, reviewLink),
        BODY_CONTENT_BOTTOM: signoffHtmlForConfig(notifConfig, committeeRoles, groupHref),
        ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor)
      },
      memberMergeFields: {
        FULL_NAME: recipients[0].name || "",
        EMAIL: recipients[0].email,
        FNAME: "",
        LNAME: "",
        MEMBER_NUM: "",
        USERNAME: "",
        PW_RESET: "",
        MEMBER_EXP: ""
      },
      systemMergeFields: {
        APP_SHORTNAME: systemCfg?.group?.shortName || "",
        APP_LONGNAME: systemCfg?.group?.longName || "",
        APP_URL: groupHref,
        PW_RESET_LINK: "",
        FACEBOOK_URL: systemCfg?.externalSystems?.facebook?.groupUrl || "",
        TWITTER_URL: systemCfg?.externalSystems?.twitter?.groupUrl || "",
        INSTAGRAM_URL: systemCfg?.externalSystems?.instagram?.groupUrl || ""
      },
      accountMergeFields: ramblersAccountMergeFields()
    };
    const subject = buildSubject(notifConfig, params);
    params.messageMergeFields.subject = subject;
    const emailRequest: SendSmtpEmailRequest = {
      subject,
      sender,
      to: recipients,
      replyTo: emailAddressForRole(committeeRoles, notifConfig.replyToRole) || sender,
      params,
      templateName: notifConfig.templateName || TEMPLATE_NAME
    };
    try {
      await sendTransactionalEmailRequest(emailRequest, debugLog);
      debugLog("walk photos added email sent to", recipients.map(recipient => recipient.email));
      return {sent: true, recipients};
    } catch (error: any) {
      logBrevoError(messageType, error, {email: recipients.map(recipient => recipient.email).join(",")});
      debugLog("error sending walk photos added email:", error?.body || error?.message || error);
      return {sent: false, recipients};
    }
  }
}
