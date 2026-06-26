import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as config from "../../mongo/controllers/config";
import * as transforms from "../../mongo/controllers/transforms";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { EmailAddress, NotificationConfig, SendSmtpEmailRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { banner } from "../../mongo/models/banner";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  MemberSyncNotification,
  MemberSyncNotificationResolution
} from "../../../../projects/ngx-ramblers/src/app/models/member-sync-notification.model";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import { signoffHtmlForConfig } from "./signoff-names";
import { logBrevoError } from "../common/error-log";
import { accountMergeFieldsFor } from "../account/account";
import { configuredBrevo } from "../brevo-config";
import { notificationConfig } from "../../mongo/models/notification-config";

const messageType = "brevo:send-member-sync-notification-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const TEMPLATE_NAME = "member-sync-notification";

function humaniseFieldName(fieldName: string): string {
  const spaced = fieldName.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function displayValue(value: string | null, fallback: string): string {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function resolutionLabel(resolution: MemberSyncNotificationResolution): string {
  return resolution === MemberSyncNotificationResolution.APPLIED_FROM_HEAD_OFFICE
    ? "Applied locally (from Head Office)"
    : "Kept (you may want to review)";
}

function bannerImageSource(banners: BannerConfig[], bannerId: string, groupHref: string): string {
  const selectedBanner = banners?.find(item => item.id === bannerId);
  if (selectedBanner?.fileNameData) {
    return `${groupHref}/api/aws/s3/${selectedBanner.fileNameData.rootFolder}/${selectedBanner.fileNameData.awsFileName}`;
  }
  return "";
}

function emailAddressForRole(roles: CommitteeMember[], role: string): EmailAddress | null {
  const committeeMember = roles.find(member => member?.type === role) || roles.find(member => !!member?.email);
  return committeeMember?.email ? {name: committeeMember.fullName, email: committeeMember.email} : null;
}

function buildSubject(notifConfig: NotificationConfig, params: any): string {
  const resolveParameter = (parameter: string): string | null =>
    parameter ? parameter.split(".").reduce((value: any, key: string) => value?.[key], params) : null;
  const prefix = resolveParameter(notifConfig.subject?.prefixParameter);
  const suffix = resolveParameter(notifConfig.subject?.suffixParameter);
  return [prefix, notifConfig.subject?.text, suffix].filter(item => item).join(" - ");
}

function buildBodyHtml(notifications: MemberSyncNotification[], contactDetailsUrl: string): string {
  const rows = notifications.map(notification => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #dddddd;">${humaniseFieldName(notification.fieldName)}</td>
      <td style="padding:6px 10px;border:1px solid #dddddd;">${displayValue(notification.localValue, "(not held)")}</td>
      <td style="padding:6px 10px;border:1px solid #dddddd;">${displayValue(notification.headOfficeValue, "(not provided)")}</td>
      <td style="padding:6px 10px;border:1px solid #dddddd;">${resolutionLabel(notification.resolution)}</td>
    </tr>`).join("");
  const appliedFields = notifications.filter(notification => notification.resolution === MemberSyncNotificationResolution.APPLIED_FROM_HEAD_OFFICE);
  const keptFields = notifications.filter(notification => notification.resolution === MemberSyncNotificationResolution.KEPT_LOCAL_DIVERGENCE);
  const appliedParagraph = appliedFields.length > 0
    ? "<p>The fields marked <strong>Applied locally (from Head Office)</strong> are now maintained at Ramblers Head Office. To change these, please contact Head Office directly.</p>"
    : "";
  const keptParagraph = keptFields.length > 0
    ? "<p>The fields marked <strong>Kept (you may want to review)</strong> still differ from what Head Office holds. You can correct these yourself on the site using the button below.</p>"
    : "";
  return `
    <p>We have compared your membership details with the records held at Ramblers Head Office and found the following differences:</p>
    <table role="presentation" style="border-collapse:collapse;width:100%;margin:12px 0;">
      <thead>
        <tr>
          <th style="padding:6px 10px;border:1px solid #dddddd;text-align:left;">Field</th>
          <th style="padding:6px 10px;border:1px solid #dddddd;text-align:left;">What we held</th>
          <th style="padding:6px 10px;border:1px solid #dddddd;text-align:left;">What Head Office says</th>
          <th style="padding:6px 10px;border:1px solid #dddddd;text-align:left;">Resolution</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${appliedParagraph}
    ${keptParagraph}
    <p style="margin:18px 0;">
      <a href="${contactDetailsUrl}" style="display:inline-block;padding:10px 18px;background-color:#ec6a09;color:#ffffff;text-decoration:none;border-radius:4px;">Review your details</a>
    </p>`;
}

export async function sendMemberSyncNotificationEmail(member: Member, notifications: MemberSyncNotification[]): Promise<boolean> {
  if (!member?.email || notifications.length === 0) {
    return false;
  }
  const brevoConfig = await configuredBrevo();
  const configId = brevoConfig?.memberSyncNotificationConfigId;
  if (!configId) {
    debugLog("no memberSyncNotificationConfigId configured - skipping member sync notification email for", member.email);
    return false;
  }
  const notifConfig: NotificationConfig = await notificationConfig.findById(configId).lean()
    .then(doc => doc ? transforms.toObjectWithId(doc) as NotificationConfig : null);
  if (!notifConfig) {
    debugLog("memberSyncNotificationConfigId set but config not found - skipping for", member.email);
    return false;
  }
  const systemConfigDoc = await config.queryKey(ConfigKey.SYSTEM);
  const systemCfg: SystemConfig = systemConfigDoc?.value;
  const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
  const committeeRoles: CommitteeMember[] = committeeCfg?.roles || [];
  const sender = emailAddressForRole(committeeRoles, notifConfig.senderRole);
  if (!sender) {
    debugLog("no sender email resolved for senderRole", notifConfig.senderRole, "- skipping member sync notification email for", member.email);
    return false;
  }
  const replyTo = emailAddressForRole(committeeRoles, notifConfig.replyToRole) || sender;
  const groupHref = systemCfg?.group?.href || "";
  const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));
  const contactDetailsUrl = `${groupHref}/admin/contact-details`;
  const firstName = member.firstName || member.displayName?.split(" ")?.[0] || "there";
  const params = {
    messageMergeFields: {
      subject: "",
      BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, notifConfig.bannerId, groupHref),
      ADDRESS_LINE: `Hi ${firstName},`,
      BODY_CONTENT: buildBodyHtml(notifications, contactDetailsUrl),
      BODY_CONTENT_BOTTOM: signoffHtmlForConfig(notifConfig, committeeRoles, groupHref),
      ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor),
    },
    memberMergeFields: {
      FULL_NAME: `${member.firstName || ""} ${member.lastName || ""}`.trim() || member.displayName || "",
      EMAIL: member.email,
      FNAME: member.firstName || "",
      LNAME: member.lastName || "",
      MEMBER_NUM: member.membershipNumber || "",
      USERNAME: "",
      PW_RESET: "",
      MEMBER_EXP: "",
    },
    systemMergeFields: {
      APP_SHORTNAME: systemCfg?.group?.shortName || "",
      APP_LONGNAME: systemCfg?.group?.longName || "",
      APP_URL: groupHref,
      PW_RESET_LINK: "",
      FACEBOOK_URL: systemCfg?.externalSystems?.facebook?.groupUrl || "",
      TWITTER_URL: systemCfg?.externalSystems?.twitter?.groupUrl || "",
      INSTAGRAM_URL: systemCfg?.externalSystems?.instagram?.groupUrl || "",
    },
    accountMergeFields: await accountMergeFieldsFor(),
  };
  const subject = buildSubject(notifConfig, params);
  params.messageMergeFields.subject = subject;
  const emailRequest: SendSmtpEmailRequest = {
    subject,
    sender,
    to: [{email: member.email, name: params.memberMergeFields.FULL_NAME}],
    replyTo,
    params,
    templateName: TEMPLATE_NAME
  };
  try {
    await sendTransactionalEmailRequest(emailRequest, debugLog);
    debugLog("member sync notification email sent to", member.email, "for", notifications.length, "fields");
    return true;
  } catch (error: any) {
    logBrevoError(messageType, error, {email: member.email});
    debugLog("error sending member sync notification email:", error?.body || error?.message || error);
    return false;
  }
}
