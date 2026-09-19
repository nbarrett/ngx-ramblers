import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import * as config from "../../mongo/controllers/config";
import * as transforms from "../../mongo/controllers/transforms";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { EmailAddress, EmailTemplateName, NotificationConfig, SendPurpose, SendSmtpEmailRequest } from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { banner } from "../../mongo/models/banner";
import { MemberBulkLoadDigest, MemberBulkLoadDigestEmail, MemberBulkLoadDigestPreview } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import { memberBulkLoadDigestHtml } from "../../../../projects/ngx-ramblers/src/app/functions/member-bulk-load-digest";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import { signoffHtmlForConfig } from "./signoff-names";
import { logBrevoError } from "../common/error-log";
import { performTemplateSubstitution } from "../common/messages";
import { Brevo } from "@getbrevo/brevo";
import { ramblersAccountMergeFields } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-legal.model";
import { configuredBrevo } from "../brevo-config";
import { notificationConfig } from "../../mongo/models/notification-config";
import { AdminMembersPath } from "../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import { dateTimeFromMillis, formatDateTime } from "../../shared/dates";
import { UIDateFormat } from "../../../../projects/ngx-ramblers/src/app/models/date-format.model";

const messageType = "brevo:send-member-bulk-load-digest-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = false;

const TEMPLATE_NAME = EmailTemplateName.MEMBER_SYNC_NOTIFICATION;

export function bannerImageSource(banners: BannerConfig[], bannerId: string, groupHref: string): string {
  const selectedBanner = banners?.find(item => item.id === bannerId);
  if (selectedBanner?.fileNameData) {
    return `${groupHref}/api/aws/s3/${selectedBanner.fileNameData.rootFolder}/${selectedBanner.fileNameData.awsFileName}`;
  } else {
    return "";
  }
}

export function emailAddressForRole(roles: CommitteeMember[], role: string): EmailAddress | null {
  const committeeMember = roles.find(member => member?.type === role) || roles.find(member => !!member?.email);
  return committeeMember?.email ? {name: committeeMember.fullName, email: committeeMember.email} : null;
}

export function emailAddressesForRoles(roles: CommitteeMember[], roleNames: string[]): EmailAddress[] {
  return (roleNames || [])
    .map(role => emailAddressForRole(roles, role))
    .filter(address => !!address?.email);
}

export function buildSubject(notifConfig: NotificationConfig, params: Record<string, any>): string {
  const resolveParameter = (parameter: string): string | null =>
    parameter ? parameter.split(".").reduce((value: any, key: string) => value?.[key], params) : null;
  const prefix = resolveParameter(notifConfig.subject?.prefixParameter);
  const suffix = resolveParameter(notifConfig.subject?.suffixParameter);
  return [prefix, notifConfig.subject?.text, suffix].filter(item => item).join(" - ");
}

async function memberBulkLoadDigestEmailRequest(digest: MemberBulkLoadDigest): Promise<MemberBulkLoadDigestEmail> {
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
  const defaultRecipients = notifConfig
    ? emailAddressesForRoles(committeeRoles, notifConfig.bccRoles || [])
    : [];
  if (!configId) {
    return {request: null, defaultRecipients, problem: "No email configuration is mapped to the member bulk load summary on Mail Settings → Built-in Processes."};
  } else if (!notifConfig) {
    return {request: null, defaultRecipients, problem: "The email configuration mapped to the member bulk load summary no longer exists."};
  } else if (!sender) {
    return {request: null, defaultRecipients, problem: `No committee member holds the sender role "${notifConfig.senderRole}" for the member bulk load summary.`};
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
        EMAIL: defaultRecipients[0]?.email || sender.email,
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
    const request: SendSmtpEmailRequest = {
      subject,
      sender,
      to: defaultRecipients,
      replyTo,
      params,
      templateName: notifConfig.templateName || TEMPLATE_NAME
    };
    return {request, defaultRecipients, problem: null};
  }
}

export async function previewMemberBulkLoadDigestEmail(digest: MemberBulkLoadDigest): Promise<MemberBulkLoadDigestPreview> {
  const email = await memberBulkLoadDigestEmailRequest(digest);
  if (email.request) {
    const rendered: Brevo.SendTransacEmailRequest = {};
    await performTemplateSubstitution(email.request, rendered, debugLog);
    return {digest, subject: email.request.subject, htmlContent: rendered.htmlContent || "", recipients: email.defaultRecipients, problem: null};
  } else {
    return {digest, subject: "", htmlContent: "", recipients: email.defaultRecipients, problem: email.problem};
  }
}

export async function sendMemberBulkLoadDigestEmail(digest: MemberBulkLoadDigest, chosenRecipients: EmailAddress[]): Promise<{sent: boolean; recipients: EmailAddress[]; problem: string | null}> {
  const email = await memberBulkLoadDigestEmailRequest(digest);
  const recipients = (chosenRecipients || []).filter(recipient => !!recipient?.email?.trim());
  if (!email.request) {
    debugLog("bulk load digest not sent:", email.problem);
    return {sent: false, recipients: [], problem: email.problem};
  } else if (recipients.length === 0) {
    return {sent: false, recipients: [], problem: "Choose at least one recipient for the member bulk load summary."};
  } else {
    const emailRequest: SendSmtpEmailRequest = {...email.request, to: recipients};
    try {
      await sendTransactionalEmailRequest(emailRequest, debugLog, undefined, SendPurpose.BULK_LOAD_DIGEST);
      debugLog("committee bulk load digest sent to", recipients.map(recipient => recipient.email));
      return {sent: true, recipients, problem: null};
    } catch (error: any) {
      logBrevoError(messageType, error, {email: recipients.map(recipient => recipient.email).join(",")});
      debugLog("error sending committee bulk load digest:", error?.body || error?.message || error);
      return {sent: false, recipients, problem: error?.body?.message || error?.message || "Brevo refused the email."};
    }
  }
}
