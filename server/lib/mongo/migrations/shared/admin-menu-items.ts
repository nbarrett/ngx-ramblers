import { ActionButtonColumn } from "./page-content-actions";

export const ADMIN_MENU_ITEMS: ActionButtonColumn[] = [
  {
    accessLevel: "loggedInMember",
    title: "Contact details",
    icon: "faIdCard",
    href: "admin/contact-details",
    contentText: "Amend name, email address and address information"
  },
  {
    accessLevel: "loggedInMember",
    title: "Change Password",
    icon: "faUnlockAlt",
    href: "admin/change-password",
    contentText: "On this page you can:\n\n- Change your password\n- Change your username"
  },
  {
    accessLevel: "loggedInMember",
    title: "Email subscriptions",
    icon: "faEnvelopeOpenText",
    href: "admin/email-subscriptions",
    contentText: "Subscribe to or unsubscribe from EKWG mailing lists for walks, social and general comms"
  },
  {
    accessLevel: "loggedInMember",
    title: "Expenses",
    icon: "faCashRegister",
    href: "admin/expenses",
    contentText: "- Create expense claims\n- Approve expense claims (admins)"
  },
  {
    accessLevel: "committee",
    title: "Member Admin",
    icon: "faUsersCog",
    href: "admin/member-admin",
    contentText: "- Manually edit member details\n- Send member emails"
  },
  {
    accessLevel: "committee",
    title: "Member Bulk Load",
    icon: "faMailBulk",
    href: "admin/member-bulk-load",
    contentText: "Load monthly reports from Ramblers"
  },
  {
    accessLevel: "committee",
    title: "Member Login Audit",
    icon: "faBook",
    href: "admin/member-login-audit",
    contentText: "View login history on system to help diagnose:\n\n- Member login problems\n- Unauthorised hacking attempts\n- Success/failure of password resets"
  },
  {
    accessLevel: "committee",
    title: "System Settings",
    icon: "faCogs",
    href: "admin/system-settings",
    contentText: "Enter settings that affect:\n\n- Group\n- Area\n- National Ramblers\n- External Systems"
  },
  {
    accessLevel: "committee",
    title: "Committee Settings",
    icon: "faUsersCog",
    href: "admin/committee-settings",
    contentText: "Enter settings that affect:\n\n- The list of Committee members\n- The file types can be uploaded to the committee page"
  },
  {
    accessLevel: "committee",
    title: "Migration Settings",
    icon: "faExchangeAlt",
    href: "admin/migration-settings",
    contentText: "Configure settings for migrating content from legacy static websites"
  },
  {
    accessLevel: "committee",
    title: "Maintenance",
    icon: "faTools",
    href: "admin/maintenance",
    contentText: "View system maintenance status, retry migrations, and access admin controls when required"
  },
  {
    accessLevel: "committee",
    title: "Backup & Restore",
    icon: "faDatabase",
    href: "admin/backup-and-restore",
    contentText: "Backup and restore MongoDB databases across environments"
  },
  {
    accessLevel: "committee",
    title: "Configure Banners",
    icon: "faImages",
    href: "admin/banners",
    contentText: "Edit Banners with latest Ramblers styling that can be saved as images and then used in Mailchimp Campaign Masters"
  },
  {
    accessLevel: "committee",
    title: "Edit Carousel Images",
    icon: "faImages",
    href: "admin/carousel-editor",
    contentText: "Edit photos that are used in albums across the website"
  },
  {
    accessLevel: "committee",
    title: "Page Content Navigator",
    icon: "faPencil",
    href: "admin/page-content-navigator",
    contentText: "Allows the user to navigate and manage all page content, including identifying and resolving duplicates"
  },
  {
    accessLevel: "committee",
    title: "Fragment Index",
    icon: "faList",
    href: "admin/fragment-index",
    contentText: "Lists all Shared Fragments, shows a live preview for each, and links to all pages that reference them"
  }
];

export const MAIL_PROVIDER_MENU_ITEMS: { [key: string]: ActionButtonColumn } = {
  brevo: {
    accessLevel: "committee",
    title: "Mail Settings",
    icon: "faMailBulk",
    href: "admin/mail-settings",
    contentText: "This page allows you to configure the email settings for the site"
  },
  mailchimp: {
    accessLevel: "committee",
    title: "Mailchimp Settings",
    icon: "faMailBulk",
    href: "admin/mailchimp-settings",
    contentText: "Configure Mailchimp integration and defaults for the site"
  }
};
