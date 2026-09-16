import debug from "debug";
import {
  BuiltInProcessMappings, EmailTemplateName, NotificationConfig, SendPurpose, SendSmtpEmailRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import {
  RegistrationEmailParameters, RegistrationEmailType, RegistrationSettings
} from "../../../../projects/ngx-ramblers/src/app/models/site-registration.model";
import { envConfig } from "../../env-config/env-config";
import { notificationConfig } from "../../mongo/models/notification-config";
import { configuredBrevo } from "../brevo-config";
import { bannerImageSource, buildSubject } from "./send-member-bulk-load-digest-email";
import { banner } from "../../mongo/models/banner";
import * as transforms from "../../mongo/controllers/transforms";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";

const debugLog = debug(envConfig.logNamespace("brevo:send-site-registration-email"));
const processMapping: Record<RegistrationEmailType, keyof BuiltInProcessMappings> = {
  [RegistrationEmailType.CONFIRMATION]: "registrationConfirmationConfigId",
  [RegistrationEmailType.INVITATION]: "registrationInvitationConfigId",
  [RegistrationEmailType.REVIEW]: "registrationReviewConfigId"
};

export async function sendRegistrationEmail(settings: RegistrationSettings, type: RegistrationEmailType, recipient: string, values: RegistrationEmailParameters): Promise<void> {
  const mailConfig = await configuredBrevo();
  const configId = mailConfig?.[processMapping[type]];
  const configured: NotificationConfig = configId ? await notificationConfig.findById(configId).lean() : null;
  if (!configured?.body) {
    throw new Error(`The built-in ${type} registration email configuration is not mapped.`);
  } else {
    const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));
    const params = {
      messageMergeFields: {
        subject: "", BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, configured.bannerId || allBanners[0]?.id, (settings.publicUrl || "").replace(/\/+$/, "")), ADDRESS_LINE: "Hello,", BODY_CONTENT: "", BODY_CONTENT_BOTTOM: "",
        GROUP_NAME: values.groupName, ACTION_URL: values.actionUrl,
        RETURN_URL: values.returnUrl || "", SITE_URL: values.siteUrl || ""
      },
      memberMergeFields: {FULL_NAME: "", EMAIL: recipient, FNAME: "", LNAME: "", MEMBER_NUM: "", USERNAME: "", PW_RESET: "", MEMBER_EXP: ""},
      systemMergeFields: {APP_SHORTNAME: "NGX Ramblers", APP_LONGNAME: "NGX Ramblers", APP_URL: settings.publicUrl,
        PW_RESET_LINK: "", FACEBOOK_URL: "", TWITTER_URL: "", INSTAGRAM_URL: ""},
      accountMergeFields: {STREET: "", POSTCODE: "", TOWN: "", REGISTERED_OFFICE: ""}
    };
    const subject = buildSubject(configured, params);
    params.messageMergeFields.subject = subject;
    const request: SendSmtpEmailRequest = {
      subject, sender: {email: settings.senderEmail, name: "NGX Ramblers"},
      to: [{email: recipient, name: values.groupName}], replyTo: {email: settings.senderEmail, name: "NGX Ramblers"},
      params, body: configured.body, templateName: configured.templateName || EmailTemplateName.FULLY_AUTOMATED_TEXT_BODY,
      templateOverrides: configured.templateOverrides
    };
    await sendTransactionalEmailRequest(request, debugLog, settings.publicUrl, SendPurpose.TRANSACTIONAL);
  }
}
