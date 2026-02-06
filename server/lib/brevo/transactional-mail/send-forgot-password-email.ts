import { Request, Response } from "express";
import debug from "debug";
import * as SibApiV3Sdk from "@getbrevo/brevo";
import { CreateSmtpEmail, SendSmtpEmail } from "@getbrevo/brevo";
import * as http from "http";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import { member } from "../../mongo/models/member";
import * as transforms from "../../mongo/controllers/transforms";
import * as stringUtils from "../../shared/string-utils";
import * as config from "../../mongo/controllers/config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { handleError, performTemplateSubstitution } from "../common/messages";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  EmailAddress,
  ForgotPasswordEmailRequest,
  ForgotPasswordEmailResponse,
  ForgotPasswordIdentificationMethod,
  MailConfig,
  NotificationConfig,
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { banner } from "../../mongo/models/banner";
import { notificationConfig } from "../../mongo/models/notification-config";
import { normalisePostcode } from "../../addresses/shared";

const messageType = "brevo:send-forgot-password-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const GENERIC_SUCCESS_MESSAGE = "Thanks! If those details match one of our members, a password reset email will be on its way shortly";

function committeeMemberForRole(roles: CommitteeMember[], role: string): CommitteeMember {
  return roles?.find(committeeMember => committeeMember.type === role);
}

function emailAddressForRole(roles: CommitteeMember[], role: string): EmailAddress {
  const committeeMember = committeeMemberForRole(roles, role);
  return { name: committeeMember?.fullName, email: committeeMember?.email };
}

function bannerImageSource(banners: BannerConfig[], bannerId: string, groupHref: string): string {
  const selectedBanner = banners?.find(item => item.id === bannerId);
  if (selectedBanner?.fileNameData) {
    return `${groupHref}/api/aws/s3/${selectedBanner.fileNameData.rootFolder}/${selectedBanner.fileNameData.awsFileName}`;
  }
  return "";
}

function buildCriteria(body: ForgotPasswordEmailRequest): object {
  if (body.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME) {
    const emailOrUsername = body.emailOrUsername?.toLowerCase().trim();
    return { $or: [{ email: { $eq: emailOrUsername } }, { userName: { $eq: emailOrUsername } }] };
  } else {
    const membershipNumber = body.membershipNumber?.trim();
    const postcode = normalisePostcode(body.postcode);
    debugLog("normalised postcode:", body.postcode, "->", postcode);
    return {
      $and: [
        { membershipNumber: { $eq: membershipNumber } },
        { postcode: { $eq: postcode } }
      ]
    };
  }
}

function validateRequest(body: ForgotPasswordEmailRequest): string {
  if (body.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME) {
    if (!body.emailOrUsername) {
      return "emailOrUsername is required";
    }
  } else if (body.identificationMethod === ForgotPasswordIdentificationMethod.MEMBERSHIP_DETAILS) {
    if (!body.membershipNumber || !body.postcode) {
      return "membershipNumber and postcode are required";
    }
  } else {
    return "identificationMethod is required";
  }
  return null;
}

export async function sendForgotPasswordEmail(req: Request, res: Response): Promise<void> {
  try {
    const body: ForgotPasswordEmailRequest = req.body;
    debugLog("received request with identificationMethod:", body.identificationMethod, "emailOrUsername:", body.emailOrUsername, "membershipNumber:", body.membershipNumber, "postcode:", body.postcode);
    const validationError = validateRequest(body);

    if (validationError) {
      debugLog("validation failed:", validationError);
      res.status(400).json({ message: validationError });
      return;
    }

    const criteria = buildCriteria(body);
    debugLog("looking up member with criteria:", JSON.stringify(criteria));

    const foundMember = await member.findOne(criteria, {
      groupMember: 1,
      firstName: 1,
      lastName: 1,
      membershipNumber: 1,
      email: 1,
      userName: 1,
      membershipExpiryDate: 1,
      passwordResetId: 1,
    });

    if (!foundMember) {
      debugLog("no member found matching criteria - returning generic success");
      const response: ForgotPasswordEmailResponse = { message: GENERIC_SUCCESS_MESSAGE };
      res.status(200).json(response);
      return;
    }

    debugLog("found member:", foundMember.firstName, foundMember.lastName, "email:", foundMember.email, "userName:", foundMember.userName);

    if (!foundMember.email) {
      debugLog("member found but has no email address - returning generic success");
      const response: ForgotPasswordEmailResponse = { message: GENERIC_SUCCESS_MESSAGE };
      res.status(200).json(response);
      return;
    }

    const updatedMember: Member = await generatePasswordResetId(foundMember);
    debugLog("generated passwordResetId:", updatedMember.passwordResetId, "for member:", updatedMember.firstName, updatedMember.lastName);

    await sendEmailViaBrevo(req, updatedMember, res);
  } catch (error) {
    debugLog("unexpected error in sendForgotPasswordEmail:", error);
    const response: ForgotPasswordEmailResponse = { message: GENERIC_SUCCESS_MESSAGE };
    res.status(200).json(response);
  }
}

async function generatePasswordResetId(foundMember: any): Promise<Member> {
  foundMember.passwordResetId = stringUtils.generateUid();
  const savedDocument = await foundMember.save();
  return transforms.toObjectWithId(savedDocument);
}

async function sendEmailViaBrevo(req: Request, updatedMember: Member, res: Response): Promise<void> {
  const brevoConfig: MailConfig = await configuredBrevo();
  debugLog("brevoConfig loaded - apiKey present:", !!brevoConfig?.apiKey, "forgotPasswordNotificationConfigId:", brevoConfig?.forgotPasswordNotificationConfigId);
  const systemConfigDoc = await config.queryKey(ConfigKey.SYSTEM);
  const systemCfg: SystemConfig = systemConfigDoc?.value;
  debugLog("systemConfig loaded - group:", systemCfg?.group?.shortName, "href:", systemCfg?.group?.href);
  const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
  debugLog("committeeConfig loaded - roles count:", committeeCfg?.roles?.length);
  const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));
  debugLog("banners loaded - count:", allBanners?.length);
  const forgotPasswordNotificationConfigId = brevoConfig?.forgotPasswordNotificationConfigId;

  if (!forgotPasswordNotificationConfigId) {
    debugLog("no forgotPasswordNotificationConfigId configured in brevoConfig - cannot send email");
    const response: ForgotPasswordEmailResponse = { message: GENERIC_SUCCESS_MESSAGE };
    res.status(200).json(response);
    return;
  }

  const notifConfig: NotificationConfig = await notificationConfig.findById(forgotPasswordNotificationConfigId)
    .lean()
    .then(doc => doc ? transforms.toObjectWithId(doc) : null);

  if (!notifConfig) {
    debugLog("notification config not found for id:", forgotPasswordNotificationConfigId);
    const response: ForgotPasswordEmailResponse = { message: GENERIC_SUCCESS_MESSAGE };
    res.status(200).json(response);
    return;
  }

  debugLog("notificationConfig loaded - templateId:", notifConfig.templateId, "senderRole:", notifConfig.senderRole, "replyToRole:", notifConfig.replyToRole, "subject:", JSON.stringify(notifConfig.subject));

  const groupHref = systemCfg?.group?.href || "";
  const groupShortName = systemCfg?.group?.shortName || "";
  const groupLongName = systemCfg?.group?.longName || "";
  const committeeRoles = committeeCfg?.roles || [];

  const sender: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.senderRole);
  const replyTo: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.replyToRole);
  const to: EmailAddress[] = [{ email: updatedMember.email, name: `${updatedMember.firstName} ${updatedMember.lastName}` }];
  debugLog("sender:", JSON.stringify(sender), "replyTo:", JSON.stringify(replyTo), "to:", JSON.stringify(to));

  const passwordResetLink = `${groupHref}/admin/set-password/${updatedMember.passwordResetId}`;
  debugLog("passwordResetLink:", passwordResetLink);
  const bannerImage = bannerImageSource(allBanners, notifConfig.bannerId, groupHref);

  const memberFullName = `${updatedMember.firstName} ${updatedMember.lastName}`;

  const params = {
    messageMergeFields: {
      subject: null as string,
      SIGNOFF_NAMES: signoffNamesHtml(committeeRoles, notifConfig.signOffRoles),
      BANNER_IMAGE_SOURCE: bannerImage,
      ADDRESS_LINE: "Hi {{params.messageMergeFields.FNAME}},",
      BODY_CONTENT: "",
    },
    memberMergeFields: {
      FULL_NAME: memberFullName,
      EMAIL: updatedMember.email,
      FNAME: updatedMember.firstName,
      LNAME: updatedMember.lastName,
      MEMBER_NUM: updatedMember.membershipNumber,
      MEMBER_EXP: updatedMember.membershipExpiryDate ? String(updatedMember.membershipExpiryDate) : "",
      USERNAME: updatedMember.userName,
      PW_RESET: updatedMember.passwordResetId || "",
    },
    systemMergeFields: {
      APP_SHORTNAME: groupShortName,
      APP_LONGNAME: groupLongName,
      APP_URL: groupHref,
      PW_RESET_LINK: passwordResetLink,
      FACEBOOK_URL: systemCfg?.externalSystems?.facebook?.groupUrl || "",
      TWITTER_URL: systemCfg?.externalSystems?.twitter?.groupUrl || "",
      INSTAGRAM_URL: systemCfg?.externalSystems?.instagram?.groupUrl || "",
    },
    accountMergeFields: {
      STREET: "",
      POSTCODE: "",
      TOWN: "",
    },
  };

  const subject = buildSubject(notifConfig, params);
  params.messageMergeFields.subject = subject;

  const emailRequest = {
    subject,
    sender,
    to,
    replyTo,
    params,
    templateId: notifConfig.templateId,
  };

  debugLog("Sending forgot password email with request:", emailRequest);

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, brevoConfig.apiKey);

  const sendSmtpEmail: SendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = emailRequest.subject;
  sendSmtpEmail.sender = emailRequest.sender;
  sendSmtpEmail.to = emailRequest.to;
  sendSmtpEmail.replyTo = emailRequest.replyTo;
  sendSmtpEmail.params = emailRequest.params;

  await performTemplateSubstitution(emailRequest, sendSmtpEmail, debugLog);

  debugLog("About to send forgot password email:", sendSmtpEmail);

  apiInstance.sendTransacEmail(sendSmtpEmail).then((data: {
    response: http.IncomingMessage;
    body: CreateSmtpEmail
  }) => {
    debugLog("Forgot password email sent successfully:", JSON.stringify(data));
    const response: ForgotPasswordEmailResponse = { message: GENERIC_SUCCESS_MESSAGE };
    res.status(200).json(response);
  }).catch((error: any) => {
    handleError(req, res, messageType, debugLog, error);
  });
}

function buildSubject(notifConfig: NotificationConfig, params: any): string {
  const prefix = notifConfig.subject?.prefixParameter
    ? resolveParameter(notifConfig.subject.prefixParameter, params)
    : null;
  const suffix = notifConfig.subject?.suffixParameter
    ? resolveParameter(notifConfig.subject.suffixParameter, params)
    : null;
  return [prefix, notifConfig.subject?.text, suffix].filter(item => item).join(" - ");
}

function resolveParameter(paramPath: string, params: any): string {
  return paramPath.split(".").reduce((obj, key) => obj?.[key], params) as string;
}

function signoffNamesHtml(committeeRoles: CommitteeMember[], signOffRoles: string[]): string {
  if (!signOffRoles?.length) {
    return "";
  }
  const names = signOffRoles
    .map(role => committeeMemberForRole(committeeRoles, role))
    .filter(committeeMember => committeeMember?.fullName)
    .map(committeeMember => `<li>${committeeMember.fullName} (${committeeMember.description})</li>`);
  return names.length > 0 ? `<ul>${names.join("")}</ul>` : "";
}
