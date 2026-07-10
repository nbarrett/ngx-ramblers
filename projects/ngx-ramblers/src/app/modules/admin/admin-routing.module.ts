import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { LoggedInGuard } from "../../guards/admin-login-guard";
import { hasDynamicPath, hasEmailComposerPath, hasSendNotificationPath } from "../../services/path-matchers";
import { CommitteeAuthGuard } from "../../guards/committee-auth-guard";
import { EmailComposerAuthGuard } from "../../guards/email-composer-auth-guard";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { AdminAuthGuard, MemberAdminAuthGuard } from "../../guards/admin-auth-guard";
import { EnvironmentAdminGuard } from "../../guards/environment-admin-guard";
import { MaintenanceGuard } from "../../guards/maintenance-guard";
import { SystemHealthyGuard } from "../../guards/system-healthy-guard";
import {
  adminRelativePath,
  AdminPath,
  AdminProfilePath,
  AdminMembersPath,
  AdminContentPath,
  AdminSettingsPath,
  AdminPlatformPath,
} from "../../models/admin-route-paths.model";

const rp = adminRelativePath;

@NgModule({
  imports: [RouterModule.forChild([
    {
      path: rp(AdminPath.MAINTENANCE), loadComponent: () => import("../../pages/admin/site-maintenance/site-maintenance.component")
        .then(m => m.SiteMaintenanceComponent), canActivate: [MaintenanceGuard]
    },
    {
      path: rp(AdminPath.ADMIN), loadComponent: () => import("../../pages/admin/admin/admin.component")
        .then(m => m.AdminComponent), canActivate: [SystemHealthyGuard, AreaExistsGuard]
    },
    {
      path: rp(AdminPath.BANNERS), loadComponent: () => import("../../pages/banner/banner.component")
        .then(m => m.BannerComponent),
      canActivate: [SystemHealthyGuard]
    },

    {
      path: rp(AdminProfilePath.CONTACT_DETAILS), loadComponent: () => import("../../pages/admin/profile/contact-details.component")
        .then(m => m.ContactDetailsComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: rp(AdminProfilePath.CHANGE_PASSWORD), loadComponent: () => import("../../pages/admin/profile/change-password.component")
        .then(m => m.ChangePasswordComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: rp(AdminProfilePath.EMAIL_SUBSCRIPTIONS),
      loadComponent: () => import("../../pages/admin/profile/email-subscriptions.component")
        .then(m => m.EmailSubscriptionsComponent),
      canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: rp(AdminProfilePath.EXPENSES) + "/:expense-id",
      loadComponent: () => import("../../pages/admin/expenses/expenses.component")
        .then(m => m.ExpensesComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: rp(AdminProfilePath.EXPENSES), loadComponent: () => import("../../pages/admin/expenses/expenses.component")
        .then(m => m.ExpensesComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: rp(AdminProfilePath.ROOT), loadComponent: () => import("../../pages/admin/profile/profile-landing.component")
        .then(m => m.ProfileLandingComponent),
      canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    { path: "contact-details", redirectTo: rp(AdminProfilePath.CONTACT_DETAILS), pathMatch: "full" },
    { path: "change-password", redirectTo: rp(AdminProfilePath.CHANGE_PASSWORD), pathMatch: "full" },
    { path: "email-subscriptions", redirectTo: rp(AdminProfilePath.EMAIL_SUBSCRIPTIONS), pathMatch: "full" },
    { path: "expenses/:expense-id", redirectTo: rp(AdminProfilePath.EXPENSES) + "/:expense-id", pathMatch: "full" },
    { path: "expenses", redirectTo: rp(AdminProfilePath.EXPENSES), pathMatch: "full" },

    {
      path: rp(AdminMembersPath.MEMBER_ADMIN),
      loadComponent: () => import("../../pages/admin/member-admin/member-admin.component")
        .then(m => m.MemberAdminComponent), canActivate: [SystemHealthyGuard, MemberAdminAuthGuard]
    },
    {
      path: rp(AdminMembersPath.MEMBER_BULK_LOAD) + "/:tab",
      loadComponent: () => import("../../pages/admin/member-bulk-load/member-bulk-load.component")
        .then(m => m.MemberBulkLoadComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminMembersPath.MEMBER_BULK_LOAD),
      loadComponent: () => import("../../pages/admin/member-bulk-load/member-bulk-load.component")
        .then(m => m.MemberBulkLoadComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminMembersPath.MEMBER_LOGIN_AUDIT),
      loadComponent: () => import("../../pages/admin/member-login-audit/member-login-audit.component")
        .then(m => m.MemberLoginAuditComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminMembersPath.AGM_STATS), loadComponent: () => import("../../pages/admin/agm-stats/agm-stats")
        .then(m => m.AGMStatsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminMembersPath.MEMBER_SYNC_NOTIFICATIONS),
      loadComponent: () => import("../../pages/admin/member-sync-notifications/member-sync-notifications.component")
        .then(m => m.MemberSyncNotificationsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminMembersPath.ROOT), loadComponent: () => import("../../pages/admin/members/members-landing.component")
        .then(m => m.MembersLandingComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    { path: "member-admin", redirectTo: rp(AdminMembersPath.MEMBER_ADMIN), pathMatch: "full" },
    { path: "member-bulk-load/:tab", redirectTo: rp(AdminMembersPath.MEMBER_BULK_LOAD) + "/:tab", pathMatch: "full" },
    { path: "member-bulk-load", redirectTo: rp(AdminMembersPath.MEMBER_BULK_LOAD), pathMatch: "full" },
    { path: "member-login-audit", redirectTo: rp(AdminMembersPath.MEMBER_LOGIN_AUDIT), pathMatch: "full" },
    { path: "agm-stats", redirectTo: rp(AdminMembersPath.AGM_STATS), pathMatch: "full" },
    { path: "member-sync-notifications", redirectTo: rp(AdminMembersPath.MEMBER_SYNC_NOTIFICATIONS), pathMatch: "full" },

    {
      path: rp(AdminContentPath.CAROUSEL_EDITOR),
      loadComponent: () => import("../../carousel/edit/image-list-page/image-list-edit-page")
        .then(m => m.ImageListEditPageComponent),
      canActivate: [SystemHealthyGuard]
    },
    {
      path: rp(AdminContentPath.PAGE_CONTENT_NAVIGATOR),
      loadComponent: () => import("../../pages/admin/content/page-content-navigator")
        .then(m => m.PageContentNavigatorComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminContentPath.CONTENT_TEMPLATES),
      loadComponent: () => import("../../pages/admin/content/content-templates")
        .then(m => m.ContentTemplatesComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminContentPath.CONTENT_MIGRATION),
      loadComponent: () => import("../../pages/admin/system-settings/image-migration/image-migration-settings")
        .then(m => m.ContentMigrationSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "content/image-migration", redirectTo: rp(AdminContentPath.CONTENT_MIGRATION), pathMatch: "full"
    },
    {
      path: rp(AdminContentPath.LEGACY_REDIRECTS),
      loadComponent: () => import("../../pages/admin/legacy-redirects/legacy-redirects.component")
        .then(m => m.LegacyRedirectsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminContentPath.ROOT), loadComponent: () => import("../../pages/admin/content/content-landing.component")
        .then(m => m.ContentLandingComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    { path: "content/banners", redirectTo: rp(AdminPath.BANNERS), pathMatch: "full" },
    { path: "carousel-editor", redirectTo: rp(AdminContentPath.CAROUSEL_EDITOR), pathMatch: "full" },
    { path: "page-content-navigator", redirectTo: rp(AdminContentPath.PAGE_CONTENT_NAVIGATOR), pathMatch: "full" },
    { path: "content-templates", redirectTo: rp(AdminContentPath.CONTENT_TEMPLATES), pathMatch: "full" },
    { path: "content-migration", redirectTo: rp(AdminContentPath.CONTENT_MIGRATION), pathMatch: "full" },
    { path: "image-migration", redirectTo: rp(AdminContentPath.CONTENT_MIGRATION), pathMatch: "full" },
    { path: "legacy-redirects", redirectTo: rp(AdminContentPath.LEGACY_REDIRECTS), pathMatch: "full" },

    {
      path: rp(AdminSettingsPath.SYSTEM_SETTINGS),
      loadComponent: () => import("../../pages/admin/system-settings/system-settings")
        .then(m => m.SystemSettingsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminSettingsPath.COMMITTEE_SETTINGS),
      loadComponent: () => import("../../pages/admin/system-settings/committee/committee-settings")
        .then(m => m.CommitteeSettingsComponent),
      canActivate: [SystemHealthyGuard, MemberAdminAuthGuard]
    },
    {
      path: rp(AdminSettingsPath.MIGRATION_SETTINGS),
      loadComponent: () => import("../../pages/admin/system-settings/migration/migration-settings")
        .then(m => m.MigrationSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminSettingsPath.VENUE_SETTINGS),
      loadComponent: () => import("../../pages/admin/system-settings/venue/venue-settings")
        .then(m => m.VenueSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminSettingsPath.BOOKINGS), loadComponent: () => import("../../pages/admin/bookings/bookings.component")
        .then(m => m.BookingsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminSettingsPath.MAINTENANCE), loadComponent: () => import("../../pages/admin/site-maintenance/site-maintenance.component")
        .then(m => m.SiteMaintenanceComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminSettingsPath.ROOT), loadComponent: () => import("../../pages/admin/settings/settings-landing.component")
        .then(m => m.SettingsLandingComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    { path: "system-settings", redirectTo: rp(AdminSettingsPath.SYSTEM_SETTINGS), pathMatch: "full" },
    { path: "committee-settings", redirectTo: rp(AdminSettingsPath.COMMITTEE_SETTINGS), pathMatch: "full" },
    { path: "migration-settings", redirectTo: rp(AdminSettingsPath.MIGRATION_SETTINGS), pathMatch: "full" },
    { path: "venue-settings", redirectTo: rp(AdminSettingsPath.VENUE_SETTINGS), pathMatch: "full" },
    { path: "bookings", redirectTo: rp(AdminSettingsPath.BOOKINGS), pathMatch: "full" },

    {
      path: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT),
      loadComponent: () => import("../../pages/admin/environment-management/environment-management-landing.component")
        .then(m => m.EnvironmentManagementLandingComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP),
      loadComponent: () => import("../../pages/admin/environment-setup/environment-setup")
        .then(m => m.EnvironmentSetupComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_BACKUP),
      loadComponent: () => import("../../pages/admin/backup-and-restore/backup-and-restore")
        .then(m => m.BackupAndRestore),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MIGRATION),
      loadComponent: () => import("../../pages/admin/environment-migration/environment-migration")
        .then(m => m.EnvironmentMigrationComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_HEALTH),
      loadComponent: () => import("../../pages/admin/migration-health/migration-health.component")
        .then(m => m.MigrationHealthComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MAINTENANCE),
      loadComponent: () => import("../../pages/admin/site-maintenance/site-maintenance.component")
        .then(m => m.SiteMaintenanceComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.CONTRIBUTOR_ENVIRONMENT),
      loadComponent: () => import("../../pages/admin/contributor-environment/contributor-environment.component")
        .then(m => m.ContributorEnvironmentComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminPlatformPath.LITE_TEMPLATES),
      loadComponent: () => import("../../pages/admin/platform/lite-templates.component")
        .then(m => m.LiteTemplatesComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    {
      path: rp(AdminPlatformPath.ROOT), loadComponent: () => import("../../pages/admin/platform/platform-landing.component")
        .then(m => m.PlatformLandingComponent),
      canActivate: [SystemHealthyGuard, EnvironmentAdminGuard]
    },
    { path: "environment-management", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT), pathMatch: "full" },
    { path: "environment-management/setup", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP), pathMatch: "full" },
    { path: "environment-management/backup", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_BACKUP), pathMatch: "full" },
    { path: "environment-management/migration", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MIGRATION), pathMatch: "full" },
    { path: "environment-management/health", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_HEALTH), pathMatch: "full" },
    { path: "environment-management/maintenance", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_MAINTENANCE), pathMatch: "full" },
    { path: "environment-setup", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP), pathMatch: "full" },
    { path: "backup-and-restore", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_BACKUP), pathMatch: "full" },
    { path: "migration-health", redirectTo: rp(AdminPlatformPath.ENVIRONMENT_MANAGEMENT_HEALTH), pathMatch: "full" },
    { path: "contributor-environment", redirectTo: rp(AdminPlatformPath.CONTRIBUTOR_ENVIRONMENT), pathMatch: "full" },

    {
      path: rp(AdminPath.SET_PASSWORD) + "/:password-reset-id", loadComponent: () => import("../../login/set-password.component")
        .then(m => m.SetPasswordComponent)
    },
    {
      path: rp(AdminPath.MAILING_PREFERENCES),
      loadComponent: () => import("../../pages/mailing-preferences/mailing-preferences-modal.component")
        .then(m => m.MailingPreferencesModalComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminPath.MAILCHIMP_SETTINGS),
      loadComponent: () => import("../../pages/admin/system-settings/mailchimp/mailchimp-settings")
        .then(m => m.MailchimpSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminPath.MAIL_SETTINGS), loadComponent: () => import("../../pages/admin/system-settings/mail/mail-settings")
        .then(m => m.MailSettingsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminPath.MAIL_REPORTS), loadComponent: () => import("../../pages/admin/system-settings/mail/mail-reports")
        .then(m => m.MailReportsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminPath.MAIL_REPORTS_CAMPAIGN), loadComponent: () => import("../../pages/admin/system-settings/mail/campaign-detail")
        .then(m => m.CampaignDetailComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: rp(AdminPath.INBOX), loadComponent: () => import("../../pages/admin/inbox/inbox.component")
        .then(m => m.InboxComponent),
      canActivate: [SystemHealthyGuard, CommitteeAuthGuard]
    },

    {
      matcher: hasSendNotificationPath,
      loadComponent: () => import("../../pages/email-composer/email-composer")
        .then(m => m.EmailComposer),
      canActivate: [SystemHealthyGuard, EmailComposerAuthGuard]
    },
    {
      matcher: hasEmailComposerPath,
      loadComponent: () => import("../../pages/email-composer/email-composer")
        .then(m => m.EmailComposer),
      canActivate: [SystemHealthyGuard, EmailComposerAuthGuard]
    },
    {
      matcher: hasDynamicPath, loadComponent: () => import("../common/dynamic-content-page/dynamic-content-page")
        .then(m => m.DynamicContentPageComponent),
      canActivate: [SystemHealthyGuard]
    },
  ])]
})
export class AdminRoutingModule {
}
