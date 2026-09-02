import { ActionButtonColumn } from "../../../../../projects/ngx-ramblers/src/app/models/content-text.model";
import {
  AdminPath,
  AdminProfilePath,
  AdminMembersPath,
  AdminContentPath,
  AdminSettingsPath,
  AdminPlatformPath,
} from "../../../../../projects/ngx-ramblers/src/app/models/admin-route-paths.model";
import {
  DEFAULT_WALKS_AREA,
  WALKS_HOW_TO_DOCUMENTATION_URL,
  WalksAdminSegment,
  walksAdminPath,
  walksLeaderPath
} from "../../../../../projects/ngx-ramblers/src/app/models/walks-route-paths.model";

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
    contentText: "Subscribe to or unsubscribe from your group's mailing lists for walks, social and general comms"
  },
  {
    accessLevel: "loggedInMember",
    title: "Expenses",
    icon: "faCashRegister",
    href: AdminProfilePath.EXPENSES,
    contentText: "- Create expense claims\n- Approve expense claims (admins)"
  },
  {
    accessLevel: "memberAdmin",
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
    accessLevel: "memberAdmin",
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

export function osMapsExportMenuItem(walksArea = DEFAULT_WALKS_AREA): ActionButtonColumn {
  return {
    accessLevel: "loggedInMember",
    title: "OS Maps Routes",
    icon: "faMapLocationDot",
    iconColour: "ramblers",
    href: walksAdminPath(walksArea, WalksAdminSegment.OS_MAPS_EXPORT),
    contentText: "* Load the routes saved on the group's OS Maps account\n* Convert chosen routes to GPX\n* Attach an imported GPX to a walk that already has an OS Maps link"
  };
}

export const OS_MAPS_EXPORT_MENU_ITEM: ActionButtonColumn = osMapsExportMenuItem();

export const SOCIAL_MEDIA_PUBLISHING_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "loggedInMember",
  title: "Social Media Publishing",
  icon: "faShareNodes",
  iconColour: "ramblers",
  href: "walks/admin/social-publishing",
  contentText: "* Post walks and social events to Facebook and Instagram\n* Preview the exact wording and photos before anything is sent\n* See what has already been posted, and what has changed since"
};

export const ENVIRONMENT_MIGRATION_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "committee",
  title: "Environment Migration",
  icon: "faExchangeAlt",
  href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MIGRATION,
  contentText: "Move an environment to isolated MongoDB credentials with validation, restore verification, and explicit cutover"
};

export const ESTATE_REBUILD_CAPTURE_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "environmentAdmin",
  title: "Platform Configuration Values",
  icon: "faClipboardList",
  href: AdminPlatformPath.ENVIRONMENT_MANAGEMENT_ESTATE_REBUILD,
  contentText: "View and inventory platform and site configuration values, system logins, and offline export packs"
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
  ESTATE_REBUILD_CAPTURE_MENU_ITEM
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

export const PHOTO_VIDEO_OPT_OUT_MENU_ITEM: ActionButtonColumn = {
  accessLevel: "loggedInMember",
  title: "Photos and video",
  icon: "faCamera",
  href: AdminProfilePath.PHOTOS_AND_VIDEO,
  contentText: "Opt out of identifiable photographs and video used for group publicity"
};

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
    contentText: "Subscribe to or unsubscribe from your group's mailing lists for walks, social and general comms"
  },
  PHOTO_VIDEO_OPT_OUT_MENU_ITEM,
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
    title: "Volunteer Management",
    icon: "faUsersCog",
    href: AdminMembersPath.VOLUNTEERS,
    contentText: "Manage rights-of-way volunteers, parish coverage, vacancies and temporary assignments"
  },
  {
    accessLevel: "loggedInMember",
    title: "My Volunteer Information",
    icon: "faPersonHiking",
    href: AdminMembersPath.MY_VOLUNTEER_INFORMATION,
    contentText: "See the rights-of-way parishes you cover, the officers alongside you, and each parish's council contacts"
  },
  {
    accessLevel: "memberAdmin",
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
    accessLevel: "memberAdmin",
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

export function walkAdminMenuItems(walksArea: string): ActionButtonColumn[] {
  return [
    {
      accessLevel: "loggedInMember",
      title: "Ramblers Walk Export",
      icon: "faFileExport",
      iconColour: "ramblers",
      href: walksAdminPath(walksArea, WalksAdminSegment.EXPORT),
      contentText: "* Upload walks directly to [Ramblers Walks Manager](https://walks-manager.ramblers.org.uk/walks-manager)\n* Export walks in CSV format\n* Review audits of previous upload sessions"
    },
    {
      accessLevel: "loggedInMember",
      title: "Ramblers Walk Import",
      icon: "faFileImport",
      iconColour: "ramblers",
      href: walksAdminPath(walksArea, WalksAdminSegment.IMPORT),
      contentText: "* Upload a walks CSV exported from [Ramblers Walks Manager](https://walks-manager.ramblers.org.uk/walks-manager)\n* Match imported walk leaders to members in your database\n* Review and save the imported walks into your local database"
    },
    osMapsExportMenuItem(walksArea),
    {
      accessLevel: "loggedInMember",
      title: "Add Walk Slots",
      icon: "faCalendarPlus",
      iconColour: "calendar",
      href: walksAdminPath(walksArea, WalksAdminSegment.ADD_WALK_SLOTS),
      contentText: "* Add walk slots in bulk for any number of up and coming dates on your configured regular walk day\n* Add a non-standard walk slot - for example on a different day of the week or a weekday evening"
    },
    {
      accessLevel: "loggedInMember",
      title: "Programme Overview",
      icon: "faListCheck",
      iconColour: "calendar",
      href: walksAdminPath(walksArea, WalksAdminSegment.PROGRAMME),
      contentText: "* See the whole programme grouped by status: awaiting a leader, awaiting walk details, awaiting approval, approved, published and cancelled\n* Headline counts across the top take you straight to that set of walks when you click them\n* The filter is held in the web address, so a view can be bookmarked or sent to somebody else"
    },
    {
      accessLevel: "loggedInMember",
      title: "Programme Calendar",
      icon: "faCalendarDays",
      iconColour: "calendar",
      href: walksAdminPath(walksArea, WalksAdminSegment.CALENDAR),
      contentText: "* View the programme as a month or a week\n* Colour walks by status, grade or leader\n* Show group events alongside walks, or walks on their own\n* Drag a walk to a new date, when dragging is switched on in walk configuration"
    },
    {
      accessLevel: "loggedInMember",
      title: "Programme Map",
      icon: "faMap",
      iconColour: "calendar",
      href: walksAdminPath(walksArea, WalksAdminSegment.MAP),
      contentText: "* See where the whole programme takes place on one map\n* Walks are coloured by their status\n* Narrow the map down to a single status"
    },
    {
      accessLevel: "loggedInMember",
      title: "My Walks (Leader View)",
      icon: "faPersonHiking",
      iconColour: "calendar",
      href: walksLeaderPath(walksArea),
      contentText: "* See your own upcoming walks in one place\n* Check what is still outstanding on each of them\n* Open to any walk leader, whether or not they administer walks"
    },
    {
      accessLevel: "loggedInMember",
      title: "Walk Configuration",
      icon: "faGear",
      iconColour: "ramblers",
      href: walksAdminPath(walksArea, WalksAdminSegment.CONFIG),
      contentText: "* Configure walk validation rules and default walking pace\n* Maintain content that automatically gets added to our walk description\n* Configure defaults for Meetup publishing"
    },
    {
      accessLevel: "loggedInMember",
      title: "Event Data Management",
      icon: "faDatabase",
      iconColour: "meetup",
      href: walksAdminPath(walksArea, WalksAdminSegment.EVENT_DATA_MANAGEMENT),
      contentText: "* Used to view and manage the total number of events per group code and event type categories\n* Bulk delete data within these categories"
    },
    {
      accessLevel: "loggedInMember",
      title: "How To Documentation",
      icon: "faBook",
      iconColour: "ramblers",
      href: WALKS_HOW_TO_DOCUMENTATION_URL,
      contentText: "* All documentation related to administering all walk-related activities"
    }
  ];
}

export function walkAdminLegacyHelpNames(walksArea: string): { [href: string]: string } {
  return {
    [walksAdminPath(walksArea, WalksAdminSegment.EXPORT)]: "ramblers-export-help",
    [walksAdminPath(walksArea, WalksAdminSegment.IMPORT)]: "ramblers-import-help",
    [walksAdminPath(walksArea, WalksAdminSegment.ADD_WALK_SLOTS)]: "add-walks-slots-help",
    [walksAdminPath(walksArea, WalksAdminSegment.CONFIG)]: "walk-config-help",
    [walksAdminPath(walksArea, WalksAdminSegment.EVENT_DATA_MANAGEMENT)]: "event-data-management-help",
    [WALKS_HOW_TO_DOCUMENTATION_URL]: "how-to-documentation-help"
  };
}
