import {
  MailConfig,
  NotificationConfig,
  REGISTRATION_CONFIRMATION_SUBJECT_TEXT,
  REGISTRATION_INVITATION_SUBJECT_TEXT,
  REGISTRATION_REVIEW_SUBJECT_TEXT,
  VOLUNTEER_NOTIFICATION_SUBJECT_TEXT
} from "../models/mail.model";

export const PLATFORM_NOTIFICATION_SUBJECTS = [
  REGISTRATION_CONFIRMATION_SUBJECT_TEXT,
  REGISTRATION_INVITATION_SUBJECT_TEXT,
  REGISTRATION_REVIEW_SUBJECT_TEXT
];

export interface NotificationConfigVisibilityFlags {
  platformMailConfigsVisible: boolean;
  volunteerManagementEnabled: boolean;
}

export function platformNotificationConfigIds(mailConfig: MailConfig | null): string[] {
  return [
    mailConfig?.registrationConfirmationConfigId,
    mailConfig?.registrationInvitationConfigId,
    mailConfig?.registrationReviewConfigId
  ].filter(id => !!id);
}

export function volunteerNotificationConfigIds(mailConfig: MailConfig | null): string[] {
  return [mailConfig?.volunteerNotificationConfigId].filter(id => !!id);
}

export function notificationConfigVisible(
  config: NotificationConfig,
  mailConfig: MailConfig | null,
  flags: NotificationConfigVisibilityFlags
): boolean {
  const subject = config?.subject?.text;
  const isPlatform = PLATFORM_NOTIFICATION_SUBJECTS.includes(subject)
    || (!!config?.id && platformNotificationConfigIds(mailConfig).includes(config.id));
  const isVolunteer = subject === VOLUNTEER_NOTIFICATION_SUBJECT_TEXT
    || (!!config?.id && volunteerNotificationConfigIds(mailConfig).includes(config.id));
  if (isPlatform) {
    return flags.platformMailConfigsVisible;
  } else if (isVolunteer) {
    return flags.volunteerManagementEnabled;
  } else {
    return true;
  }
}

export function visibleNotificationConfigs(
  configs: NotificationConfig[] | null,
  mailConfig: MailConfig | null,
  flags: NotificationConfigVisibilityFlags
): NotificationConfig[] {
  return (configs || []).filter(config => notificationConfigVisible(config, mailConfig, flags));
}
