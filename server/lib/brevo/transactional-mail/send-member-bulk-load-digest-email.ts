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
import { MemberBulkLoadDigest } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { memberBulkLoadDigestHtml } from "../../../../projects/ngx-ramblers/src/app/functions/member-bulk-load-digest";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import { signoffHtmlForConfig } from "./signoff-names";
import { logBrevoError } from "../common/error-log";
import { ramblersAccountMergeFields } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-legal.model";
import { configuredBrevo } from "../brevo-config";
import { notificationConfig } from "../../mongo/models/notification-config";
import { AdminMembersPath } from "../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { dateTimeFromMillis, formatDateTime } from "../../shared/dates";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";

const messageType = "brevo:send-member-bulk-load-digest-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const TEMPLATE_NAME = "member-sync-notification";

function bannerImageSource(banners: BannerConfig[], bannerId: string, groupHref: string): string {
  const selectedBanner = banners?.find(item => item.id === bannerId);
  if (selectedBanner?.fileNameData) {
    return `${groupHref}/api/aws/s3/${selectedBanner.fileNameData.rootFolder}/${selectedBanner.fileNameData.awsFileName}`;
  } else {
    return "";
  }
}

function emailAddressForRole(roles: CommitteeMember[], role: string): EmailAddress | null {
  const committeeMember = roles.find(member => member?.type === role) || roles.find(member => !!member?.email);
  return committeeMember?.email ? {name: committeeMember.fullName, email: committeeMember.email} : null;
}

function emailAddressesForRoles(roles: CommitteeMember[], roleNames: string[]): EmailAddress[] {
  return (roleNames || [])
    .map(role => emailAddressForRole(roles, role))
    .filter(address => !!address?.email);
}

function buildSubject(notifConfig: NotificationConfig, params: Record<string, any>): string {
  const resolveParameter = (parameter: string): string | null =>
    parameter ? parameter.split(".").reduce((value: any, key: string) => value?.[key], params) : null;
  const prefix = resolveParameter(notifConfig.subject?.prefixParameter);
  const suffix = resolveParameter(notifConfig.subject?.suffixParameter);
  return [prefix, notifConfig.subject?.text, suffix].filter(item => item).join(" - ");
}

export async function sendMemberBulkLoadDigestEmail(digest: MemberBulkLoadDigest): Promise<{sent: boolean; recipients: EmailAddress[]}> {
  const brevoConfig = await configuredBrevo();
  const configId = brevoConfig?.memberBulkLoadDigestConfigId;
  const notifConfig: NotificationConfig = configId
    ? await notificationConfig.findById(configId).lean()
      .then(doc => doc ? transforms.toObjectWithId(doc) as NotificationConfig : null)
    : null;
  const systemConfigDoc = await config.queryKey(ConfigKey.SYSTEM);
  const systemCfg: SystemConfig = systemConfigDoc?.value;
  const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
  const committeeRoles: CommitteeMember[] = committeeCfg?.roles || [];
  const sender = notifConfig ? emailAddressForRole(committeeRoles, notifConfig.senderRole) : null;
  const recipients = notifConfig
    ? emailAddressesForRoles(committeeRoles, notifConfig.bccRoles || [])
    : [];
  if (!configId) {
    debugLog("no memberBulkLoadDigestConfigId configured - skipping committee digest");
    return {sent: false, recipients: []};
  } else if (!notifConfig) {
    debugLog("memberBulkLoadDigestConfigId set but config not found - skipping");
    return {sent: false, recipients: []};
  } else if (!sender) {
    debugLog("no sender email resolved for senderRole", notifConfig.senderRole);
    return {sent: false, recipients: []};
  } else if (recipients.length === 0) {
    debugLog("no committee recipients resolved for bulk load digest");
    return {sent: false, recipients: []};
  } else {
  const replyTo = emailAddressForRole(committeeRoles, notifConfig.replyToRole) || sender;
  const groupHref = systemCfg?.group?.href || "";
  const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));
  const uploadedOnLabel = digest.uploadedOn
    ? formatDateTime(dateTimeFromMillis(digest.uploadedOn), UIDateFormat.DISPLAY_DATE_AND_TIME)
    : "";
  const historyUrl = `${groupHref}/${AdminMembersPath.MEMBER_BULK_LOAD}?tab=upload-history`;
  const params = {
    messageMergeFields: {
      subject: "",
      BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, notifConfig.bannerId, groupHref),
      ADDRESS_LINE: "Hi all,",
      BODY_CONTENT: memberBulkLoadDigestHtml(digest, uploadedOnLabel, historyUrl),
      BODY_CONTENT_BOTTOM: signoffHtmlForConfig(notifConfig, committeeRoles, groupHref),
      ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor),
    },
    memberMergeFields: {
      FULL_NAME: "Committee",
      EMAIL: recipients[0].email,
      FNAME: "",
      LNAME: "",
      MEMBER_NUM: "",
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
    accountMergeFields: ramblersAccountMergeFields(),
  };
  const subject = buildSubject(notifConfig, params);
  params.messageMergeFields.subject = subject;
  const emailRequest: SendSmtpEmailRequest = {
    subject,
    sender,
    to: recipients,
    replyTo,
    params,
    templateName: notifConfig.templateName || TEMPLATE_NAME
  };
  try {
    await sendTransactionalEmailRequest(emailRequest, debugLog);
    debugLog("committee bulk load digest sent to", recipients.map(recipient => recipient.email));
    return {sent: true, recipients};
  } catch (error: any) {
    logBrevoError(messageType, error, {email: recipients.map(recipient => recipient.email).join(",")});
    debugLog("error sending committee bulk load digest:", error?.body || error?.message || error);
    return {sent: false, recipients};
  }
  }
}
