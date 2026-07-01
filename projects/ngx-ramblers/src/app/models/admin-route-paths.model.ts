import { isArray, isString, values } from "es-toolkit/compat";

export enum AdminCategory {
  PROFILE = "profile",
  MEMBERS = "members",
  CONTENT = "content",
  SETTINGS = "settings",
  PLATFORM = "platform",
}

export enum AdminPath {
  ADMIN = "admin",
  BANNERS = "admin/banners",
  MAIL_SETTINGS = "admin/mail-settings",
  MAIL_REPORTS = "admin/mail-reports",
  MAIL_REPORTS_CAMPAIGN = "admin/mail-reports/campaign",
  MAILCHIMP_SETTINGS = "admin/mailchimp-settings",
  INBOX = "admin/inbox",
  MAILING_PREFERENCES = "admin/mailing-preferences",
  EMAIL_COMPOSER = "admin/email-composer",
  SEND_NOTIFICATION = "admin/send-notification",
  MAINTENANCE = "admin/maintenance",
  SET_PASSWORD = "admin/set-password",
}

export function adminRelativePath(fullPath: string): string {
  return fullPath === AdminPath.ADMIN ? "" : fullPath.replace(/^admin\//, "");
}

export enum AdminProfilePath {
  ROOT = "admin/profile",
  CONTACT_DETAILS = "admin/profile/contact-details",
  CHANGE_PASSWORD = "admin/profile/change-password",
  EMAIL_SUBSCRIPTIONS = "admin/profile/email-subscriptions",
  EXPENSES = "admin/profile/expenses",
}

export enum AdminMembersPath {
  ROOT = "admin/members",
  MEMBER_ADMIN = "admin/members/member-admin",
  MEMBER_BULK_LOAD = "admin/members/member-bulk-load",
  MEMBER_LOGIN_AUDIT = "admin/members/member-login-audit",
  AGM_STATS = "admin/members/agm-stats",
  MEMBER_SYNC_NOTIFICATIONS = "admin/members/member-sync-notifications",
}

export enum AdminContentPath {
  ROOT = "admin/content",
  CAROUSEL_EDITOR = "admin/content/carousel-editor",
  PAGE_CONTENT_NAVIGATOR = "admin/content/page-content-navigator",
  CONTENT_TEMPLATES = "admin/content/content-templates",
  CONTENT_MIGRATION = "admin/content/content-migration",
  LEGACY_REDIRECTS = "admin/content/legacy-redirects",
}

export enum AdminSettingsPath {
  ROOT = "admin/settings",
  SYSTEM_SETTINGS = "admin/settings/system-settings",
  COMMITTEE_SETTINGS = "admin/settings/committee-settings",
  MIGRATION_SETTINGS = "admin/settings/migration-settings",
  VENUE_SETTINGS = "admin/settings/venue-settings",
  BOOKINGS = "admin/settings/bookings",
  MAINTENANCE = "admin/settings/maintenance",
}

export enum AdminPlatformPath {
  ROOT = "admin/platform",
  ENVIRONMENT_MANAGEMENT = "admin/platform/environment-management",
  ENVIRONMENT_MANAGEMENT_SETUP = "admin/platform/environment-management/setup",
  ENVIRONMENT_MANAGEMENT_BACKUP = "admin/platform/environment-management/backup",
  ENVIRONMENT_MANAGEMENT_MIGRATION = "admin/platform/environment-management/migration",
  ENVIRONMENT_MANAGEMENT_HEALTH = "admin/platform/environment-management/health",
  ENVIRONMENT_MANAGEMENT_MAINTENANCE = "admin/platform/environment-management/maintenance",
  CONTRIBUTOR_ENVIRONMENT = "admin/platform/contributor-environment",
  LITE_TEMPLATES = "admin/platform/lite-templates",
}

const NGX_LITE_ADMIN_PATHS: string[] = [
  AdminProfilePath.ROOT,
  AdminMembersPath.ROOT,
  AdminPath.BANNERS,
  AdminPath.MAIL_SETTINGS,
  AdminPath.MAIL_REPORTS,
  AdminPath.MAILCHIMP_SETTINGS,
  AdminPath.INBOX,
  AdminPath.MAILING_PREFERENCES,
  AdminPath.EMAIL_COMPOSER,
  AdminPath.SEND_NOTIFICATION,
  AdminSettingsPath.SYSTEM_SETTINGS,
  AdminSettingsPath.COMMITTEE_SETTINGS,
  AdminSettingsPath.MAINTENANCE,
];

export function adminPathAllowedInNgxLite(href: string): boolean {
  const isAdminPath = href === AdminPath.ADMIN || href?.startsWith("admin/");
  if (!isAdminPath) {
    return true;
  }
  if (href === AdminPath.ADMIN || href === AdminSettingsPath.ROOT) {
    return true;
  }
  return NGX_LITE_ADMIN_PATHS.some(path => href === path || href.startsWith(path + "/"));
}

export function adminParentPath(pathOrSegments: string | string[]): string {
  const segments = isArray(pathOrSegments)
    ? pathOrSegments
    : isString(pathOrSegments)
      ? pathOrSegments.replace(/^\//, "").split("/")
      : [];
  if (segments.length > 2 && (values(AdminCategory) as string[]).includes(segments[1])) {
    return segments.slice(0, 2).join("/");
  }
  return AdminPath.ADMIN;
}
