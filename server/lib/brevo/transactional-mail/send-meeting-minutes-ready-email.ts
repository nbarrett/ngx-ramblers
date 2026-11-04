import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as config from "../../mongo/controllers/config";
import * as transforms from "../../mongo/controllers/transforms";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EMAIL_COMPOSER_BODY_PLACEHOLDER,
  EmailAddress,
  EmailTemplateName,
  NotificationConfig,
  SendPurpose,
  SendSmtpEmailRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { CommitteeConfig, CommitteeFile, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { committeeRoleForMemberId, memberRecordId, outboundEmailForMember } from "../../../../projects/ngx-ramblers/src/app/functions/committee-members";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { banner } from "../../mongo/models/banner";
import { member } from "../../mongo/models/member";
import { notificationConfig } from "../../mongo/models/notification-config";
import { configuredBrevo } from "../brevo-config";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import { signoffHtmlForConfig } from "./signoff-names";
import { logBrevoError } from "../common/error-log";
import { ramblersAccountMergeFields } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-legal.model";
import { bannerImageSource, buildSubject, emailAddressForRole } from "./send-member-bulk-load-digest-email";
import { escapeHtml, stripTrailingSlash } from "../../../../projects/ngx-ramblers/src/app/functions/strings";
import { renderMarkdownToHtml } from "../../shared/markdown-renderer";
import { isString } from "es-toolkit/compat";

const messageType = "brevo:send-meeting-minutes-ready-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const TEMPLATE_NAME = EmailTemplateName.FULLY_AUTOMATED_TEXT_BODY;

export interface MeetingMinutesReadyEmailRequest {
  committeeFile: CommitteeFile;
  link: string;
  recorderMemberId?: string;
}

function mappingId(configId: string): string | null {
  if (!configId || !isString(configId)) {
    return null;
  } else {
    const trimmed = configId.trim();
    if (!trimmed || trimmed === "null") {
      return null;
    } else {
      return trimmed;
    }
  }
}

function defaultBodyHtml(title: string, link: string): string {
  const linkHtml = link ? `<p><a href="${link}">Review the draft minutes</a></p>` : "";
  return `<p>A draft of the minutes for "${escapeHtml(title)}" is ready to review.</p>`
    + linkHtml
    + `<p>Edit the draft if you need to, then save it onto the committee documents page.</p>`;
}

function bodyFromConfig(notifConfig: NotificationConfig, title: string, link: string): string {
  const written = (notifConfig.body || "").trim();
  if (!written || written === EMAIL_COMPOSER_BODY_PLACEHOLDER) {
    return defaultBodyHtml(title, link);
  } else {
    const withFields = written
      .split("{{MINUTES_TITLE}}").join(title)
      .split("{{MINUTES_LINK}}").join(link);
    return renderMarkdownToHtml(withFields);
  }
}

async function recorderMember(memberId: string): Promise<Member | null> {
  if (!memberId) {
    return null;
  } else {
    const byMemberId = await member.findOne({memberId}).lean().exec();
    if (byMemberId) {
      return transforms.toObjectWithId(byMemberId);
    } else {
      const byId = await member.findById(memberId).lean().exec().catch(() => null);
      return byId ? transforms.toObjectWithId(byId) : null;
    }
  }
}

function recorderAddress(roles: CommitteeMember[], person: Member | null, memberId: string): EmailAddress | null {
  const lookup = person || {id: memberId, memberId, email: null};
  const email = outboundEmailForMember(lookup, roles);
  if (!email) {
    return null;
  } else {
    const role = committeeRoleForMemberId(roles, memberRecordId(lookup) || memberId);
    const name = role?.fullName || [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim() || email;
    return {name, email};
  }
}

export async function sendMeetingMinutesReadyEmail(request: MeetingMinutesReadyEmailRequest): Promise<boolean> {
  const brevoConfig = await configuredBrevo();
  const configId = mappingId(brevoConfig?.meetingMinutesNotificationConfigId);
  const notifConfig: NotificationConfig = configId
    ? await notificationConfig.findById(configId).lean().then(doc => doc ? transforms.toObjectWithId(doc) : null)
    : null;
  const systemCfg: SystemConfig = (await config.queryKey(ConfigKey.SYSTEM))?.value;
  const committeeCfg: CommitteeConfig = (await config.queryKey(ConfigKey.COMMITTEE))?.value;
  const committeeRoles: CommitteeMember[] = committeeCfg?.roles || [];
  const memberId = request.recorderMemberId || request.committeeFile?.meeting?.createdBy;
  const recorder = await recorderMember(memberId);
  const recipient = recorderAddress(committeeRoles, recorder, memberId);
  const sender = notifConfig ? emailAddressForRole(committeeRoles, notifConfig.senderRole) : null;
  if (!configId) {
    debugLog("no meetingMinutesNotificationConfigId configured - skipping");
    return false;
  } else if (!notifConfig) {
    debugLog("meetingMinutesNotificationConfigId set but config not found - skipping");
    return false;
  } else if (!recipient) {
    debugLog("not emailing recorder: no committee or personal address", {memberId});
    return false;
  } else if (!sender) {
    debugLog("no sender email resolved for senderRole", notifConfig.senderRole);
    return false;
  } else {
    const groupHref = stripTrailingSlash(systemCfg?.group?.href);
    const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));
    const title = request.committeeFile?.document?.title || "Meeting minutes";
    const firstName = recorder?.firstName || recipient.name || "";
    const params = {
      messageMergeFields: {
        subject: "",
        BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, notifConfig.bannerId, groupHref),
        ADDRESS_LINE: firstName ? `Hi ${firstName},` : "Hi,",
        BODY_CONTENT: bodyFromConfig(notifConfig, title, request.link),
        BODY_CONTENT_BOTTOM: signoffHtmlForConfig(notifConfig, committeeRoles, groupHref),
        ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor)
      },
      memberMergeFields: {
        FULL_NAME: recipient.name || "",
        EMAIL: recipient.email,
        FNAME: recorder?.firstName || "",
        LNAME: recorder?.lastName || "",
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
      to: [recipient],
      replyTo: emailAddressForRole(committeeRoles, notifConfig.replyToRole) || sender,
      params,
      templateName: notifConfig.templateName || TEMPLATE_NAME
    };
    try {
      await sendTransactionalEmailRequest(emailRequest, debugLog, undefined, SendPurpose.MEETING_MINUTES);
      debugLog("meeting minutes ready email sent to", recipient.email);
      return true;
    } catch (error: any) {
      logBrevoError(messageType, error, {email: recipient.email});
      debugLog("error sending meeting minutes ready email:", error?.body || error?.message || error);
      return false;
    }
  }
}
