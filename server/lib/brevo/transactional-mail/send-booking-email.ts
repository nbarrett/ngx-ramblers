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
import { CommitteeConfig, CommitteeMember } from "../../../../projects/ngx-ramblers/src/app/models/committee.model";
import { SystemConfig } from "../../../../projects/ngx-ramblers/src/app/models/system.model";
import { BannerConfig } from "../../../../projects/ngx-ramblers/src/app/models/banner-configuration.model";
import { banner } from "../../mongo/models/banner";
import { notificationConfig } from "../../mongo/models/notification-config";
import { Booking, BookingAttendee } from "../../../../projects/ngx-ramblers/src/app/models/booking.model";
import { dateTimeFromIso } from "../../shared/dates";
import { sendTransactionalEmailRequest } from "./send-transactional-mail";

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

function formatEventDateTime(startDateTime: string): string {
  if (!startDateTime) {
    return "Date to be confirmed";
  }
  const dt = dateTimeFromIso(startDateTime);
  return dt.toFormat("EEEE, d MMMM yyyy 'at' h:mm a");
}

function publicEventLink(event: any, suppliedEventLink: string | null): string {
  if (suppliedEventLink?.trim()) {
    return suppliedEventLink.trim();
  }
  const storedUrl = event?.groupEvent?.url?.trim() || "";
  return storedUrl.startsWith("http://") || storedUrl.startsWith("https://") ? storedUrl : "";
}

function attendeeListHtml(attendees: BookingAttendee[]): string {
  if (!attendees?.length) {
    return "";
  }
  const items = attendees.map(a => `<li>${a.displayName} (${a.email})</li>`);
  return `<ul>${items.join("")}</ul>`;
}

type BookingEmailType = "confirmation" | "cancellation" | "waitlisted" | "restored";

function greetingLine(primaryAttendee: BookingAttendee): string {
  const firstName = primaryAttendee?.displayName?.split(" ")?.[0] || primaryAttendee?.displayName || "there";
  return `<p>Hi ${firstName},</p>`;
}

function buildBodyContent(emailType: BookingEmailType, eventTitle: string, eventDateTime: string, bookingRecord: Booking, eventLink: string): string {
  const placesCount = bookingRecord.attendees?.length || 0;
  const attendeeHtml = attendeeListHtml(bookingRecord.attendees);
  const greeting = greetingLine(bookingRecord.attendees?.[0]);
  const eventPageText = eventLink ? `<a href="${eventLink}">event page</a>` : "event page";

  if (emailType === "confirmation") {
    return `${greeting}
<p>Your booking has been confirmed for <strong>${eventTitle}</strong>.</p>
<p><strong>Date:</strong> ${eventDateTime}</p>
<p><strong>Places booked:</strong> ${placesCount}</p>
<p><strong>Attendees:</strong></p>
${attendeeHtml}
<p>If you need to cancel your booking, you can do so from the ${eventPageText} using the email address you booked with.</p>`;
  } else if (emailType === "cancellation") {
    return `${greeting}
<p>Your booking for <strong>${eventTitle}</strong> has been cancelled.</p>
<p><strong>Date:</strong> ${eventDateTime}</p>
<p><strong>Places released:</strong> ${placesCount}</p>
<p><strong>Attendees removed:</strong></p>
${attendeeHtml}
<p>If this was done in error, you can rebook from the ${eventPageText}.</p>`;
  } else if (emailType === "waitlisted") {
    return `${greeting}
<p>Your booking for <strong>${eventTitle}</strong> has been moved to the waiting list.</p>
<p><strong>Date:</strong> ${eventDateTime}</p>
<p><strong>Places affected:</strong> ${placesCount}</p>
<p><strong>Attendees:</strong></p>
${attendeeHtml}
<p>This happened because a member has booked during the member priority period and the event was full.
If a place becomes available, your booking will be automatically restored and you will be notified by email.</p>
<p>We apologise for any inconvenience. You can still view the event details on the ${eventPageText}.</p>`;
  } else {
    return `${greeting}
<p>Great news! Your booking for <strong>${eventTitle}</strong> has been restored.</p>
<p><strong>Date:</strong> ${eventDateTime}</p>
<p><strong>Places restored:</strong> ${placesCount}</p>
<p><strong>Attendees:</strong></p>
${attendeeHtml}
<p>A place became available and your booking has been automatically confirmed. No further action is needed. Event details are on the ${eventPageText}.</p>`;
  }
}

function subjectForType(emailType: BookingEmailType, eventTitle: string): string {
  if (emailType === "confirmation") {
    return `Booking Confirmed — ${eventTitle}`;
  } else if (emailType === "cancellation") {
    return `Booking Cancelled — ${eventTitle}`;
  } else if (emailType === "waitlisted") {
    return `Booking Waitlisted — ${eventTitle}`;
  } else {
    return `Booking Restored — ${eventTitle}`;
  }
}

export async function sendBookingConfirmationEmail(savedBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification("confirmation", savedBooking, event, eventLink);
}

export async function sendBookingCancellationEmail(cancelledBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification("cancellation", cancelledBooking, event, eventLink);
}

export async function sendBookingWaitlistedEmail(waitlistedBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification("waitlisted", waitlistedBooking, event, eventLink);
}

export async function sendBookingRestoredEmail(restoredBooking: Booking, event: any, eventLink: string | null): Promise<void> {
  await sendBookingNotification("restored", restoredBooking, event, eventLink);
}

async function sendBookingNotification(emailType: BookingEmailType, bookingRecord: Booking, event: any, suppliedEventLink: string | null): Promise<void> {
  try {
    const primaryAttendee = bookingRecord.attendees?.[0];
    if (!primaryAttendee?.email) {
      debugLog("no primary attendee email - skipping", emailType);
      return;
    }

    const brevoConfig: MailConfig = await configuredBrevo();
    const notificationConfigId = brevoConfig?.bookingNotificationConfigId;

    if (!notificationConfigId) {
      debugLog("no bookingNotificationConfigId configured - skipping email");
      return;
    }

    const notifConfig: NotificationConfig = await notificationConfig.findById(notificationConfigId)
      .lean()
      .then(doc => doc ? transforms.toObjectWithId(doc) : null);

    if (!notifConfig) {
      debugLog("notification config not found for id:", notificationConfigId);
      return;
    }

    const eventTitle = event?.groupEvent?.title || "Event";
    const eventDateTime = formatEventDateTime(event?.groupEvent?.start_date_time);
    const systemConfigDoc = await config.queryKey(ConfigKey.SYSTEM);
    const systemCfg: SystemConfig = systemConfigDoc?.value;
    const eventLink = publicEventLink(event, suppliedEventLink);
    const bodyContent = buildBodyContent(emailType, eventTitle, eventDateTime, bookingRecord, eventLink);

    debugLog("sending", emailType, "email - templateId:", notifConfig.templateId, "senderRole:", notifConfig.senderRole);

    const committeeConfigDoc = await config.queryKey(ConfigKey.COMMITTEE);
    const committeeCfg: CommitteeConfig = committeeConfigDoc?.value;
    const allBanners: BannerConfig[] = await banner.find({}).lean().then(docs => docs.map(transforms.toObjectWithId));

    const groupHref = systemCfg?.group?.href || "";
    const groupShortName = systemCfg?.group?.shortName || "";
    const groupLongName = systemCfg?.group?.longName || "";
    const committeeRoles = committeeCfg?.roles || [];

    const sender: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.senderRole);
    const replyTo: EmailAddress = emailAddressForRole(committeeRoles, notifConfig.replyToRole);
    const to: EmailAddress[] = [{email: primaryAttendee.email, name: primaryAttendee.displayName}];
    const bccRoles = notifConfig?.bccRoles?.length > 0 ? notifConfig.bccRoles : notifConfig?.ccRoles || [];
    const bcc: EmailAddress[] = emailAddressesForRoles(committeeRoles, bccRoles);

    const params = {
      messageMergeFields: {
        subject: null as string,
        SIGNOFF_NAMES: signoffNamesHtml(committeeRoles, notifConfig.signOffRoles),
        BANNER_IMAGE_SOURCE: bannerImageSource(allBanners, notifConfig.bannerId, groupHref),
        ADDRESS_LINE: `Hi ${primaryAttendee.displayName?.split(" ")?.[0] || primaryAttendee.displayName},`,
        BODY_CONTENT: bodyContent,
      },
      memberMergeFields: {
        FULL_NAME: primaryAttendee.displayName,
        EMAIL: primaryAttendee.email,
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

    const emailRequest: SendSmtpEmailRequest = {subject, sender, to, bcc, replyTo, params, templateId: notifConfig.templateId};
    debugLog("sending booking email:", emailType, "to:", primaryAttendee.email, "subject:", subject);
    sendTransactionalEmailRequest(emailRequest, debugLog).then(data => {
      debugLog("booking email sent successfully:", JSON.stringify(data));
    }).catch((error: any) => {
      debugLog("error sending booking email:", error?.body || error?.message || error);
    });
  } catch (error) {
    debugLog("error sending booking notification:", emailType, error);
  }
}
