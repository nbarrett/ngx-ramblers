import { ActionButtonColumn } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {
  AdminPath,
  AdminProfilePath,
  AdminMembersPath,
  AdminContentPath,
  AdminSettingsPath,
  AdminPlatformPath,
} from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";

export const CONTRIBUTOR_ENVIRONMENT_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "committee",
  title: "Contributor Environment",
  icon: "faLaptopCode",
  href: AdminPlatformPath.CONTRIBUTOR_ENVIRONMENT,
  contentText: "Generate a developer environment bundle so a contributor can run NGX on their own machine against this group's environment"
};

export const LEGACY_REDIRECTS_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "committee",
  title: "Legacy Redirects",
  icon: "faRoute",
  href: AdminContentPath.LEGACY_REDIRECTS,
  contentText: "Map URLs from a migrated legacy site to their new NGX pages and manage redirects"
};

export const SEND_NOTIFICATION_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "committee",
  title: "Email Composer",
  icon: "faPenToSquare",
  href: AdminPath.SEND_NOTIFICATION,
  contentText: "Compose an email notification and send to group or area members"
};

export const INBOX_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "committee",
  title: "Inbox",
  icon: "faInbox",
  href: AdminPath.INBOX,
  contentText: "Read and reply to emails sent to the group's shared mailboxes"
};

export const ADMIN_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "loggedInMember",
    title: "Contact details",
    icon: "faIdCard",
    href: AdminProfilePath.CONTACT_DETAILS,
    contentText: "Amend name, email address and address information"
  },
  {
    accessLevel: "loggedInMember",
    title: "Change Password",
    icon: "faUnlockAlt",
    href: AdminProfilePath.CHANGE_PASSWORD,
    contentText: "On this page you can:\n\n- Change your password\n- Change your username"
  },
  {
    accessLevel: "loggedInMember",
    title: "Email subscriptions",
    icon: "faEnvelopeOpenText",
    href: AdminProfilePath.EMAIL_SUBSCRIPTIONS,
    contentText: "Subscribe to or unsubscribe from EKWG mailing lists for walks, social and general comms"
  },
  {
    accessLevel: "loggedInMember",
    title: "Expenses",
    icon: "faCashRegister",
    href: AdminProfilePath.EXPENSES,
    contentText: "- Create expense claims\n- Approve expense claims (admins)"
  },
  {
    accessLevel: "committee",
    title: "Member Admin",
    icon: "faUsersCog",
    href: AdminMembersPath.MEMBER_ADMIN,
    contentText: "- Manually edit member details\n- Send member emails"
  },
  {
    accessLevel: "committee",
    title: "Member Bulk Load",
    icon: "faMailBulk",
    href: AdminMembersPath.MEMBER_BULK_LOAD,
    contentText: "Load monthly reports from Ramblers"
  },
  {
    accessLevel: "committee",
    title: "Member Sync Notifications",
    icon: "faBell",
    href: AdminMembersPath.MEMBER_SYNC_NOTIFICATIONS,
    contentText: "Review and send notifications when a member's record differs from Head Office records"
  },
  {
    accessLevel: "committee",
    title: "Member Login Audit",
    icon: "faBook",
    href: AdminMembersPath.MEMBER_LOGIN_AUDIT,
    contentText: "View login history on system to help diagnose:\n\n- Member login problems\n- Unauthorised hacking attempts\n- Success/failure of password resets"
  },
  {
    accessLevel: "committee",
    title: "AGM Statistics Report",
    icon: "faChartBar",
    href: AdminMembersPath.AGM_STATS,
    contentText: "View comprehensive statistics for walks and social events:\n\n- Walk metrics including miles walked, leaders, and attendance\n- Social event statistics and organisers\n- Year-over-year comparisons\n- Ideal for preparing AGM reports"
  },
  {
    accessLevel: "committee",
    title: "System Settings",
    icon: "faCogs",
    href: AdminSettingsPath.SYSTEM_SETTINGS,
    contentText: "Enter settings that affect:\n\n- Group\n- Area\n- National Ramblers\n- External Systems"
  },
  {
    accessLevel: "committee",
    title: "Committee Settings",
    icon: "faUsersCog",
    href: AdminSettingsPath.COMMITTEE_SETTINGS,
    contentText: "Enter settings that affect:\n\n- The list of Committee members\n- The file types can be uploaded to the committee page"
  },
  {
    accessLevel: "committee",
    title: "Migration Settings",
    icon: "faExchangeAlt",
    href: AdminSettingsPath.MIGRATION_SETTINGS,
    contentText: "Configure settings for migrating content from legacy static websites"
  },
  {
    accessLevel: "committee",
    title: "Content Migration",
    icon: "faCloudUploadAlt",
    href: AdminContentPath.CONTENT_MIGRATION,
    contentText: "Scan site content for images, PDFs, and documents hosted on external domains and migrate them to S3 storage"
  },
  LEGACY_REDIRECTS_MENU_ITEM,
  {
    accessLevel: "committee",
    title: "Maintenance",
    icon: "faTools",
    href: AdminSettingsPath.MAINTENANCE,
    contentText: "View system maintenance status, retry migrations, and access admin controls when required"
  },
  {
    accessLevel: "environmentAdmin",
    title: "Environment Management",
    icon: "faServer",
    href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT,
    contentText: "Manage environment setup, backups, environments monitoring, and maintenance"
  },
  CONTRIBUTOR_ENVIRONMENT_MENU_ITEM,
  {
    accessLevel: "committee",
    title: "Configure Banners",
    icon: "faImages",
    href: AdminPath.BANNERS,
    contentText: "Edit Banners with latest Ramblers styling that can be saved as images and then used in Mailchimp Campaign Masters"
  },
  {
    accessLevel: "committee",
    title: "Edit Carousel Images",
    icon: "faImages",
    href: AdminContentPath.CAROUSEL_EDITOR,
    contentText: "Edit photos that are used in albums across the website"
  },
  {
    accessLevel: "committee",
    title: "Page Content Navigator",
    icon: "faPencil",
    href: AdminContentPath.PAGE_CONTENT_NAVIGATOR,
    contentText: "Allows the user to navigate and manage all page content, including identifying and resolving duplicates"
  },
  {
    accessLevel: "committee",
    title: "Content templates",
    icon: "faList",
    href: AdminContentPath.CONTENT_TEMPLATES,
    contentText: "Browse shared fragments, user templates, and migration templates with live previews and usage links"
  },
  {
    accessLevel: "committee",
    title: "Venue Settings",
    icon: "faMapMarkerAlt",
    href: AdminSettingsPath.VENUE_SETTINGS,
    contentText: "Manage stored venues used for walk meeting points and post-walk pubs"
  },
  {
    accessLevel: "committee",
    title: "Bookings",
    icon: "faTicket",
    href: AdminSettingsPath.BOOKINGS,
    contentText: "View and manage event bookings, attendee lists, and download CSV reports"
  }
];

export const ENVIRONMENT_MIGRATION_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "committee",
  title: "Environment Migration",
  icon: "faExchangeAlt",
  href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MIGRATION,
  contentText: "Move an environment to isolated MongoDB credentials with validation, restore verification, and explicit cutover"
};

export const ENVIRONMENT_MANAGEMENT_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "committee",
    title: "Environment Setup",
    icon: "faServer",
    href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP,
    contentText: "Provision new NGX-Ramblers environments for Ramblers groups"
  },
  {
    accessLevel: "committee",
    title: "Backup & Restore",
    icon: "faDatabase",
    href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_BACKUP,
    contentText: "Backup and restore MongoDB databases across environments"
  },
  ENVIRONMENT_MIGRATION_MENU_ITEM,
  {
    accessLevel: "committee",
    title: "Environments Monitoring",
    icon: "faHeartbeat",
    href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_HEALTH,
    contentText: "Monitor migration status and health across all environments"
  },
];

export const ADMIN_CATEGORY_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "loggedInMember",
    title: "My Profile",
    icon: "faUserCircle",
    href: AdminProfilePath.ROOT,
    contentText: "Manage your contact details, password, email subscriptions, and expenses"
  },
  {
    accessLevel: "committee",
    title: "Member Management",
    icon: "faUsers",
    href: AdminMembersPath.ROOT,
    contentText: "Manage members, bulk load data, view login audit, and generate AGM reports"
  },
  {
    accessLevel: "committee",
    title: "Content & Media",
    icon: "faPencilAlt",
    href: AdminContentPath.ROOT,
    contentText: "Manage carousel images, page content, templates, migration, and legacy redirects"
  },
  {
    accessLevel: "committee",
    title: "Configure Banners",
    icon: "faImages",
    href: AdminPath.BANNERS,
    contentText: "Edit Banners with latest Ramblers styling that can be saved as images and then used in Mailchimp Campaign Masters"
  },
  {
    accessLevel: "committee",
    title: "System Configuration",
    icon: "faCogs",
    href: AdminSettingsPath.ROOT,
    contentText: "Configure system settings, committees, venues, bookings, and maintenance"
  },
  {
    accessLevel: "committee",
    title: "Mail Settings",
    icon: "faMailBulk",
    href: AdminPath.MAIL_SETTINGS,
    contentText: "Configure email provider, Gmail inbox, sender settings, templates, and mailing lists"
  },
  SEND_NOTIFICATION_MENU_ITEM,
  {
    accessLevel: "committee",
    title: "Mail Reports",
    icon: "faChartBar",
    href: AdminPath.MAIL_REPORTS,
    contentText: "View Brevo campaign and transactional email statistics with configurable date range"
  },
  INBOX_MENU_ITEM,
  {
    accessLevel: "environmentAdmin",
    title: "Platform Administration",
    icon: "faServer",
    href: AdminPlatformPath.ROOT,
    contentText: "Manage environments, backups, monitoring, contributor setup, and platform-level tools"
  }
];

export const PROFILE_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "loggedInMember",
    title: "Contact details",
    icon: "faIdCard",
    href: AdminProfilePath.CONTACT_DETAILS,
    contentText: "Amend name, email address and address information"
  },
  {
    accessLevel: "loggedInMember",
    title: "Change Password",
    icon: "faUnlockAlt",
    href: AdminProfilePath.CHANGE_PASSWORD,
    contentText: "On this page you can:\n\n- Change your password\n- Change your username"
  },
  {
    accessLevel: "loggedInMember",
    title: "Email subscriptions",
    icon: "faEnvelopeOpenText",
    href: AdminProfilePath.EMAIL_SUBSCRIPTIONS,
    contentText: "Subscribe to or unsubscribe from EKWG mailing lists for walks, social and general comms"
  },
  {
    accessLevel: "loggedInMember",
    title: "Expenses",
    icon: "faCashRegister",
    href: AdminProfilePath.EXPENSES,
    contentText: "- Create expense claims\n- Approve expense claims (admins)"
  }
];

export const MEMBERS_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "committee",
    title: "Member Admin",
    icon: "faUsersCog",
    href: AdminMembersPath.MEMBER_ADMIN,
    contentText: "- Manually edit member details\n- Send member emails"
  },
  {
    accessLevel: "committee",
    title: "Member Bulk Load",
    icon: "faMailBulk",
    href: AdminMembersPath.MEMBER_BULK_LOAD,
    contentText: "Load monthly reports from Ramblers"
  },
  {
    accessLevel: "committee",
    title: "Member Sync Notifications",
    icon: "faBell",
    href: AdminMembersPath.MEMBER_SYNC_NOTIFICATIONS,
    contentText: "Review and send notifications when a member's record differs from Head Office records"
  },
  {
    accessLevel: "committee",
    title: "Member Login Audit",
    icon: "faBook",
    href: AdminMembersPath.MEMBER_LOGIN_AUDIT,
    contentText: "View login history on system to help diagnose:\n\n- Member login problems\n- Unauthorised hacking attempts\n- Success/failure of password resets"
  },
  {
    accessLevel: "committee",
    title: "AGM Statistics Report",
    icon: "faChartBar",
    href: AdminMembersPath.AGM_STATS,
    contentText: "View comprehensive statistics for walks and social events:\n\n- Walk metrics including miles walked, leaders, and attendance\n- Social event statistics and organisers\n- Year-over-year comparisons\n- Ideal for preparing AGM reports"
  }
];

export const CONTENT_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "committee",
    title: "Edit Carousel Images",
    icon: "faImages",
    href: AdminContentPath.CAROUSEL_EDITOR,
    contentText: "Edit photos that are used in albums across the website"
  },
  {
    accessLevel: "committee",
    title: "Page Content Navigator",
    icon: "faPencil",
    href: AdminContentPath.PAGE_CONTENT_NAVIGATOR,
    contentText: "Allows the user to navigate and manage all page content, including identifying and resolving duplicates"
  },
  {
    accessLevel: "committee",
    title: "Content templates",
    icon: "faList",
    href: AdminContentPath.CONTENT_TEMPLATES,
    contentText: "Browse shared fragments, user templates, and migration templates with live previews and usage links"
  },
  {
    accessLevel: "committee",
    title: "Content Migration",
    icon: "faCloudUploadAlt",
    href: AdminContentPath.CONTENT_MIGRATION,
    contentText: "Scan site content for images, PDFs, and documents hosted on external domains and migrate them to S3 storage"
  },
  LEGACY_REDIRECTS_MENU_ITEM
];

export const SETTINGS_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "committee",
    title: "System Settings",
    icon: "faCogs",
    href: AdminSettingsPath.SYSTEM_SETTINGS,
    contentText: "Enter settings that affect:\n\n- Group\n- Area\n- National Ramblers\n- External Systems"
  },
  {
    accessLevel: "committee",
    title: "Committee Settings",
    icon: "faUsersCog",
    href: AdminSettingsPath.COMMITTEE_SETTINGS,
    contentText: "Enter settings that affect:\n\n- The list of Committee members\n- The file types can be uploaded to the committee page"
  },
  {
    accessLevel: "committee",
    title: "Migration Settings",
    icon: "faExchangeAlt",
    href: AdminSettingsPath.MIGRATION_SETTINGS,
    contentText: "Configure settings for migrating content from legacy static websites"
  },
  {
    accessLevel: "committee",
    title: "Venue Settings",
    icon: "faMapMarkerAlt",
    href: AdminSettingsPath.VENUE_SETTINGS,
    contentText: "Manage stored venues used for walk meeting points and post-walk pubs"
  },
  {
    accessLevel: "committee",
    title: "Bookings",
    icon: "faTicket",
    href: AdminSettingsPath.BOOKINGS,
    contentText: "View and manage event bookings, attendee lists, and download CSV reports"
  },
  {
    accessLevel: "committee",
    title: "Maintenance",
    icon: "faTools",
    href: AdminSettingsPath.MAINTENANCE,
    contentText: "View system maintenance status, retry migrations, and access admin controls when required"
  }
];

export const PLATFORM_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "environmentAdmin",
    title: "Environment Management",
    icon: "faServer",
    href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT,
    contentText: "Manage environment setup, backups, environments monitoring, and maintenance"
  },
  CONTRIBUTOR_ENVIRONMENT_MENU_ITEM
];

export const MAIL_PROVIDER_MENU_ITEMS: { [key: string]: ActionButtonColumn } = {
  brevo: {
    accessLevel: "committee",
    title: "Mail Settings",
    icon: "faMailBulk",
    href: AdminPath.MAIL_SETTINGS,
    contentText: "This page allows you to configure the email settings for the site"
  },
  "mail-reports": {
    accessLevel: "committee",
    title: "Mail Reports",
    icon: "faChartBar",
    href: AdminPath.MAIL_REPORTS,
    contentText: "View Brevo campaign and transactional email statistics with configurable date range"
  },
  mailchimp: {
    accessLevel: "committee",
    title: "Mailchimp Settings",
    icon: "faMailBulk",
    href: AdminPath.MAILCHIMP_SETTINGS,
    contentText: "Configure Mailchimp integration and defaults for the site"
  }
};
