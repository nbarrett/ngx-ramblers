import debug from "debug";
import { envConfig } from "../../env-config/env-config";
import { configuredBrevo } from "../brevo-config";
import * as transforms from "../../mongo/controllers/transforms";
import * as config from "../../mongo/controllers/config";
import { ConfigKey } from "../../../../projects/ngx-ramblers/src/app/models/config.model";
import {
  EmailAddress,
  MailConfig,
  NotificationConfig,
  SendSmtpEmailRequest
} from "../../../../projects/ngx-ramblers/src/app/models/mail.model";
import { resolveAccentColor } from "../../../../projects/ngx-ramblers/src/app/models/email-accent-palette";
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { banner } from "../../mongo/models/banner";
import { notificationConfig } from "../../mongo/models/notification-config";
import { Booking, BookingEmailBuild } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";
import { BookingEmailType, templatesIncludeSalutation } from "../../../../projects/ngx-ramblers/src/app/models/booking-config.model";
import { RamblersEventType } from "../../../../projects/ngx-ramblers/src/app/models/ramblers-walks-manager";
import { resolveBookingTemplate, subjectForType } from "./booking-template-resolver";
import { loadBookingConfig } from "../../config/booking-config";
import { kebabCase } from "es-toolkit/compat";
import { dateTimeFromIso } from "../../shared/dates";

export async function buildBookingEmailRequest(
  emailType: BookingEmailType,
  bookingRecord: Booking,
  event: any,
  suppliedEventLink: string | null
): Promise<BookingEmailBuild | null> {
  const primaryAttendee = bookingRecord.attendees?.[0];
  if (!primaryAttendee) {
    return null;
  }

  const brevoConfig: MailConfig = await configuredBrevo();
  const notificationConfigId = brevoConfig?.bookingNotificationConfigId;
  if (!notificationConfigId) {
    return null;
  }

  const notifConfig: NotificationConfig = await notificationConfig.findById(notificationConfigId)
    .lean()
    .then(doc => doc ? transforms.toObjectWithId(doc) : null);
  if (!notifConfig) {
    return null;
  }

  const eventTitle = event?.groupEvent?.title || "Event";
  const systemConfigDoc = await config.queryKey(ConfigKey.SYSTEM);
  const systemCfg: SystemConfig = systemConfigDoc?.value;
  const eventLink = publicEventLink(event, suppliedEventLink, systemCfg);
  const bookingConfig = await loadBookingConfig();
  const bodyContent = resolveBookingTemplate(emailType, event, bookingRecord, eventLink, bookingConfig);

  const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
  const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
  const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));

  const groupHref = systemCfg?.group?.href || "";
  const groupShortName = systemCfg?.group?.shortName || "";
  const groupLongName = systemCfg?.group?.longName || "";
  const committeeRoles = committeeCfg?.roles || [];

  const sender: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.senderRole);
  const replyTo: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.replyToRole);
  const to: EmailAddress[] = primaryAttendee.email
    ? [{email: primaryAttendee.email, name: primaryAttendee.displayName}]
    : [];
  const bccRoles = notifConfig?.bccRoles?.length > 0 ? notifConfig.bccRoles : notifConfig?.ccRoles || [];
  const bcc: EmailAddress[] = emailAddressesForRoles(committeeRoles, bccRoles);

  const params = {
    messageMergeFields: {
      subject: null as string,
      SIGNOFF_NAMES: signoffNamesHtml(committeeRoles, notifConfig.signOffRoles),
      BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, notifConfig.bannerId, groupHref),
      ADDRESS_LINE: templatesIncludeSalutation(bookingConfig)
        ? ""
        : `Hi ${primaryAttendee.displayName?.split(" ")?.[0] || primaryAttendee.displayName},`,
      BODY_CONTENT: bodyContent,
      ACCENT_COLOR: resolveAccentColor(notifConfig?.accentColor),
    },
    memberMergeFields: {
      FULL_NAME: primaryAttendee.displayName,
      EMAIL: primaryAttendee.email || "",
      FNAME: primaryAttendee.displayName?.split(" ")?.[0] || primaryAttendee.displayName,
      LNAME: primaryAttendee.displayName?.split(" ")?.slice(1)?.join(" ") || "",
      MEMBER_NUM: "",
      USERNAME: "",
      PW_RESET: "",
      MEMBER_EXP: "",
    },
    systemMergeFields: {
      APP_SHORTNAME: groupShortName,
      APP_LONGNAME: groupLongName,
      APP_URL: groupHref,
      PW_RESET_LINK: "",
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

  const subject = buildSubject(notifConfig, subjectForType(emailType, eventTitle), params);
  params.messageMergeFields.subject = subject;

  return {
    notifConfig,
    sender,
    replyTo,
    to,
    bcc,
    subject,
    bodyContent,
    params,
    templateId: notifConfig.templateId
  };
}

const messageType = "brevo:send-booking-email";
const debugLog: debug.Debugger = debug(envConfig.logNamespace(messageType));
debugLog.enabled = true;

function committeeMemberForRole(roles: CommitteeMember[], role: string): CommitteeMember {
  return roles?.find(committeeMember => committeeMember.type === role);
}

function emailAddressForRole(roles: CommitteeMember[], role: string): EmailAddress {
  const committeeMember = committeeMemberForRole(roles, role);
  return {name: committeeMember?.fullName, email: committeeMember?.email};
}

function emailAddressesForRoles(roles: CommitteeMember[], notificationRoles: string[]): EmailAddress[] {
  return (notificationRoles || [])
    .map(role => emailAddressForRole(roles, role))
    .filter(address => !!address?.email);
}

function bannerImageSource(banners: BannerConfig[], bannerId: string, groupHref: string): string {
  const selectedBanner = banners?.find(item => item.id === bannerId);
  if (selectedBanner?.fileNameData) {
    return `${groupHref}/api/aws/s3/${selectedBanner.fileNameData.rootFolder}/${selectedBanner.fileNameData.awsFileName}`;
  }
  return "";
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

function buildSubject(notifConfig: NotificationConfig, subjectText: string, params: any): string {
  const prefix = notifConfig.subject?.prefixParameter
    ? resolveParameter(notifConfig.subject.prefixParameter, params)
    : null;
  return [prefix, subjectText].filter(item => item).join(" - ");
}

function resolveParameter(paramPath: string, params: any): string {
  return paramPath.split(".").reduce((obj, key) => obj?.[key], params) as string;
}

function eventSlug(event: any): string {
  const rawUrl: string = event?.groupEvent?.url?.trim() || "";
  if (rawUrl) {
    const segments = rawUrl.replace(/\/+$/, "").split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return last;
    }
  }
  const title: string = event?.groupEvent?.title || "";
  const startDate: string = event?.groupEvent?.start_date_time || "";
  if (title) {
    const datePart = startDate ? dateTimeFromIso(startDate).toFormat("yyyy-MM-dd") : "";
    const combined = datePart ? `${title} ${datePart}` : title;
    const slug = kebabCase(combined);
    if (slug) {
      return slug;
    }
  }
  return event?.groupEvent?.id || event?.id || "";
}

function localEventAreaHref(systemCfg: SystemConfig | null, itemType: RamblersEventType | undefined): string {
  const pages = systemCfg?.group?.pages || [];
  const walksHref = pages.find(page => page.href === "walks")?.href || "walks";
  const socialHref = pages.find(page => page.href === "social-events")?.href
    || pages.find(page => page.href === "events")?.href
    || "social-events";
  return itemType === RamblersEventType.GROUP_EVENT ? socialHref : walksHref;
}

function publicEventLink(event: any, suppliedEventLink: string | null, systemCfg: SystemConfig | null): string {
  if (suppliedEventLink?.trim()) {
    return suppliedEventLink.trim();
  }
  const groupHref = (systemCfg?.group?.href || "").trim().replace(/\/+$/, "");
  if (groupHref) {
    const slug = eventSlug(event);
    if (slug) {
      const area = localEventAreaHref(systemCfg, event?.groupEvent?.item_type);
      return `${groupHref}/${area}/${encodeURIComponent(slug)}`;
    }
  }
  const storedUrl = event?.groupEvent?.url?.trim() || "";
  return storedUrl.startsWith("http://") || storedUrl.startsWith("https://") ? storedUrl : "";
}

export async function sendBookingConfirmationEmail(savedBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification(BookingEmailType.CONFIRMATION, savedBooking, event, eventLink);
}

export async function sendBookingCancellationEmail(cancelledBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification(BookingEmailType.CANCELLATION, cancelledBooking, event, eventLink);
}

export async function sendBookingWaitlistedEmail(waitlistedBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification(BookingEmailType.WAITLISTED, waitlistedBooking, event, eventLink);
}

export async function sendBookingRestoredEmail(restoredBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification(BookingEmailType.RESTORED, restoredBooking, event, eventLink);
}

export async function sendBookingReminderEmail(bookingRecord: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification(BookingEmailType.REMINDER, bookingRecord, event, eventLink);
}

async function sendBookingNotification(emailType: BookingEmailType, bookingRecord: Booking, event: any, suppliedEventLink: string | null): Promise<void> {
  try {
    const primaryAttendee = bookingRecord.attendees?.[0];
    if (!primaryAttendee?.email) {
      debugLog("no primary attendee email - skipping", emailType);
      return;
    }

    const build = await buildBookingEmailRequest(emailType, bookingRecord, event, suppliedEventLink);
    if (!build) {
      debugLog("booking email request could not be built - skipping", emailType);
      return;
    }

    const emailRequest: SendSmtpEmailRequest = {
      subject: build.subject,
      sender: build.sender,
      to: build.to,
      bcc: build.bcc,
      replyTo: build.replyTo,
      params: build.params,
      templateId: build.templateId
    };
    debugLog("sending booking email:", emailType, "to:", primaryAttendee.email, "subject:", build.subject);
    sendTransactionalEmailRequest(emailRequest, debugLog).then(data => {
      debugLog("booking email sent successfully:", JSON.stringify(data));
    }).catch((error: any) => {
      debugLog("error sending booking email:", error?.body || error?.message || error);
    });
  } catch (error) {
    debugLog("error sending booking notification:", emailType, error);
  }
}
