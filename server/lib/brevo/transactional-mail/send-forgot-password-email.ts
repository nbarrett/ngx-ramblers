import { Request, Response } from "express";
import debug from "debug";
import { Brevo } from "@getbrevo/brevo";
import { envConfig } from "../../env-config/env-config";
import { brevoClient, configuredBrevo } from "../brevo-config";
import { scheduleBrevo } from "../common/rate-limiting";
import { member } from "../../mongo/models/member";
import * as transforms from "../../mongo/controllers/transforms";
import * as stringUtils from "../../shared/string-utils";
import * as config from "../../mongo/controllers/config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import { handleError, renderLocalBrandedTemplate } from "../common/messages";
import { Member } from "../../../../projects/ngx-ramblers/src/app/models/member.model";
import {
  EmailAddress,
  EmailTemplateName,
  ForgotPasswordEmailRequest,
  ForgotPasswordEmailResponse,
  ForgotPasswordIdentificationMethod,
  ForgotPasswordNextStep,
  MailConfig,
  NotificationConfig,
  SendPurpose,
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { ADMIN_SET_PASSWORD_PATH, SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { banner } from "../../mongo/models/banner";
import { notificationConfig } from "../../mongo/models/notification-config";
import { normalisePostcode } from "../../addresses/shared";
import { signoffHtmlForConfig } from "./signoff-names";
import { assertSendAllowed } from "../send-permission";
import { ramblersAccountMergeFields } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-legal.model";
import { emailLocalPart, stripTrailingSlash, validEmail } from "../../../../projects/ngx-ramblers/src/app/functions/strings";
import {emailAddressForRole} from "./send-member-bulk-load-digest-email";
import {separateReplyToAddress} from "../../../../projects/ngx-ramblers/src/app/functions/email-addresses";
import * as inboxAliases from "../../inbox/inbox-aliases";

const messageType = "brevo:send-forgot-password-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

const GENERIC_SUCCESS_MESSAGE = "Thanks! If those details match one of our members, a password reset email will be on its way shortly";
const MEMBERSHIP_DETAILS_MESSAGE = "Please enter your Ramblers membership number and home postcode so we can continue.";
const MEMBERSHIP_DETAILS_CHECK_MESSAGE = "Please check your Ramblers membership number and home postcode.";
const DELIVERY_EMAIL_MESSAGE = "Please enter a personal email address we can send the reset link to.";
const INBOX_DELIVERY_EMAIL_MESSAGE = "That address is used for committee mail. Enter a personal email you can read without signing in.";

function completeSuccess(): ForgotPasswordEmailResponse {
  return {message: GENERIC_SUCCESS_MESSAGE, nextStep: ForgotPasswordNextStep.COMPLETE};
}

function membershipDetailsMatch(foundMember: Member, body: ForgotPasswordEmailRequest): boolean {
  const membershipNumber = (body.membershipNumber || "").trim();
  const postcode = normalisePostcode(body.postcode);
  const memberMembershipNumber = (foundMember.membershipNumber || "").trim();
  const memberPostcode = normalisePostcode(foundMember.postcode);
  return Boolean(membershipNumber) && Boolean(postcode)
    && membershipNumber === memberMembershipNumber
    && postcode === memberPostcode;
}

function bannerImageSource(banners: BannerConfig[], bannerId: string, groupHref: string): string {
  const selectedBanner = banners?.find(item => item.id === bannerId);
  if (selectedBanner?.fileNameData) {
    return `${groupHref}/api/aws/s3/${selectedBanner.fileNameData.rootFolder}/${selectedBanner.fileNameData.awsFileName}`;
  }
  return "";
}

export function forgotPasswordMemberCriteria(body: ForgotPasswordEmailRequest): object {
  if (body.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME) {
    const identifier = (body.emailOrUsername || "").trim().toLowerCase();
    const localPart = emailLocalPart(identifier);
    const alsoMatchLocalPartAsUserName = identifier.includes("@") && localPart && localPart !== identifier;
    return {
      $or: [
        { email: { $eq: identifier } },
        { userName: { $eq: identifier } },
        ...(alsoMatchLocalPartAsUserName ? [{ userName: { $eq: localPart } }] : [])
      ]
    };
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
    debugLog("received request with identificationMethod:", body.identificationMethod, "emailOrUsername:", body.emailOrUsername, "membershipNumber:", body.membershipNumber, "postcode:", body.postcode, "deliveryEmail:", body.deliveryEmail);
    const validationError = validateRequest(body);

    if (validationError) {
      debugLog("validation failed:", validationError);
      res.status(400).json({ message: validationError });
    } else {
      const criteria = forgotPasswordMemberCriteria(body);
      debugLog("looking up member with criteria:", JSON.stringify(criteria));

      const foundMember = await member.findOne(criteria, {
        groupMember: 1,
        firstName: 1,
        lastName: 1,
        membershipNumber: 1,
        postcode: 1,
        email: 1,
        userName: 1,
        membershipExpiryDate: 1,
        passwordResetId: 1,
      });

      if (!foundMember || !foundMember.email) {
        debugLog(!foundMember ? "no member found matching criteria - returning generic success" : "member found but has no email address - returning generic success");
        res.status(200).json(completeSuccess());
      } else {
        debugLog("found member:", foundMember.firstName, foundMember.lastName, "email:", foundMember.email, "userName:", foundMember.userName);
        const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
        const roles: CommitteeMember[] = committeeConfigDoc?.value?.roles || [];
        const storedEmailGoesToInbox = await inboxAliases.emailGoesToInbox(foundMember.email, roles);
        if (!storedEmailGoesToInbox) {
          await sendEmailViaBrevo(req, foundMember, res, foundMember.email);
        } else {
          await continueInboxMemberReset(req, foundMember, body, roles, res);
        }
      }
    }
  } catch (error) {
    debugLog("unexpected error in sendForgotPasswordEmail:", error);
    handleError(req, res, messageType, debugLog, error);
  }
}

async function continueInboxMemberReset(req: Request, foundMember: Member, body: ForgotPasswordEmailRequest, roles: CommitteeMember[], res: Response): Promise<void> {
  const membershipProvided = Boolean((body.membershipNumber || "").trim()) && Boolean((body.postcode || "").trim());
  const membershipConfirmed = body.identificationMethod === ForgotPasswordIdentificationMethod.MEMBERSHIP_DETAILS
    || membershipDetailsMatch(foundMember, body);
  if (body.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME && !membershipProvided) {
    res.status(200).json({
      message: MEMBERSHIP_DETAILS_MESSAGE,
      nextStep: ForgotPasswordNextStep.MEMBERSHIP_DETAILS
    });
  } else if (body.identificationMethod === ForgotPasswordIdentificationMethod.EMAIL_OR_USERNAME && !membershipConfirmed) {
    res.status(200).json({
      message: MEMBERSHIP_DETAILS_CHECK_MESSAGE,
      nextStep: ForgotPasswordNextStep.MEMBERSHIP_DETAILS
    });
  } else {
    const deliveryEmail = (body.deliveryEmail || "").trim().toLowerCase();
    if (!deliveryEmail) {
      res.status(200).json({
        message: DELIVERY_EMAIL_MESSAGE,
        nextStep: ForgotPasswordNextStep.DELIVERY_EMAIL
      });
    } else if (!validEmail(deliveryEmail)) {
      res.status(400).json({message: "Enter a valid personal email address"});
    } else if (await inboxAliases.emailGoesToInbox(deliveryEmail, roles)) {
      res.status(400).json({message: INBOX_DELIVERY_EMAIL_MESSAGE});
    } else {
      await sendEmailViaBrevo(req, foundMember, res, deliveryEmail);
    }
  }
}

export async function generatePasswordResetIdForMemberId(memberId: string): Promise<Member | null> {
  const found: any = await member.findById(memberId);
  if (!found) return null;
  return generatePasswordResetId(found);
}

async function generatePasswordResetId(foundMember: any): Promise<Member> {
  foundMember.passwordResetId = stringUtils.generateUid();
  const savedDocument = await foundMember.save();
  return transforms.toObjectWithId(savedDocument);
}

async function sendEmailViaBrevo(req: Request, foundMember: any, res: Response, toEmail: string): Promise<void> {
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
    throw new Error("Forgotten Password has no email configuration selected");
  }

  const notifConfig: NotificationConfig = await notificationConfig.findById(forgotPasswordNotificationConfigId)
    .lean()
    .then(doc => doc ? transforms.toObjectWithId(doc) : null);

  if (!notifConfig) {
    throw new Error(`Forgotten Password email configuration ${forgotPasswordNotificationConfigId} was not found`);
  }

  debugLog("notificationConfig loaded - templateName:", notifConfig.templateName, "senderRole:", notifConfig.senderRole, "replyToRole:", notifConfig.replyToRole, "subject:", JSON.stringify(notifConfig.subject));

  const configuredHref = systemCfg?.group?.href?.trim();
  const requestDerivedHref = `${req.protocol}://${req.get("host")}`;
  const groupHref = stripTrailingSlash(configuredHref || requestDerivedHref);
  debugLog("resolved groupHref:", groupHref, "(configured:", configuredHref, "requestDerived:", requestDerivedHref, ")");
  const groupShortName = systemCfg?.group?.shortName || "";
  const groupLongName = systemCfg?.group?.longName || "";
  const committeeRoles = committeeCfg?.roles || [];

  const sender: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.senderRole);
  const replyTo: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.replyToRole?.trim() || notifConfig.senderRole);
  if (!sender?.email || !replyTo?.email) {
    throw new Error("Forgotten Password requires valid saved Sender and Reply-To committee roles");
  }
  const updatedMember: Member = await generatePasswordResetId(foundMember);
  debugLog("generated passwordResetId:", updatedMember.passwordResetId, "for member:", updatedMember.firstName, updatedMember.lastName);
  const to: EmailAddress[] = [{ email: toEmail, name: `${updatedMember.firstName} ${updatedMember.lastName}` }];
  debugLog("sender:", JSON.stringify(sender), "replyTo:", JSON.stringify(replyTo), "to:", JSON.stringify(to));

  const passwordResetLink = `${groupHref}/${ADMIN_SET_PASSWORD_PATH}/${updatedMember.passwordResetId}`;
  debugLog("passwordResetLink:", passwordResetLink);
  const bannerImage = bannerImageSource(allBanners, notifConfig.bannerId, groupHref);

  const memberFullName = `${updatedMember.firstName} ${updatedMember.lastName}`;

  const params = {
    messageMergeFields: {
      subject: null as string,
      BANNER_IMAGE_SOURCE: bannerImage,
      ADDRESS_LINE: "Hi {{params.memberMergeFields.FNAME}},",
      BODY_CONTENT: "",
      BODY_CONTENT_BOTTOM: signoffHtmlForConfig(notifConfig, committeeRoles, groupHref),
      ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor),
    },
    memberMergeFields: {
      FULL_NAME: memberFullName,
      EMAIL: toEmail,
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
    accountMergeFields: ramblersAccountMergeFields(),
  };

  const subject = buildSubject(notifConfig, params);
  params.messageMergeFields.subject = subject;

  const emailRequest = {
    subject,
    sender,
    to,
    replyTo,
    params,
  };

  debugLog("Sending forgot password email with request:", emailRequest);

  await assertSendAllowed(SendPurpose.PASSWORD_RESET, {subject, recipientCount: to.length});
  const client = await brevoClient();
  const separateReplyTo = separateReplyToAddress(emailRequest.replyTo, emailRequest.sender);

  const sendSmtpEmail: Brevo.SendTransacEmailRequest = {
    subject: emailRequest.subject,
    sender: emailRequest.sender,
    to: emailRequest.to,
    ...(separateReplyTo ? {replyTo: separateReplyTo} : {}),
    params: emailRequest.params,
    htmlContent: renderLocalBrandedTemplate(EmailTemplateName.FORGOT_PASSWORD, params)
  };

  debugLog("About to send forgot password email:", sendSmtpEmail);

  try {
    const data: Brevo.SendTransacEmailResponse = await scheduleBrevo(() => client.transactionalEmails.sendTransacEmail(sendSmtpEmail));
    debugLog("Forgot password email sent successfully:", JSON.stringify(data));
    res.status(200).json(completeSuccess());
  } catch (error: any) {
    handleError(req, res, messageType, debugLog, error);
  }
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
