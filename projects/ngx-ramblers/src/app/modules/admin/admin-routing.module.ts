import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { LoggedInGuard } from "../../guards/admin-login-guard";
import { hasDynamicPath } from "../../services/path-matchers";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { AdminAuthGuard } from "../../guards/admin-auth-guard";
import { MaintenanceGuard } from "../../guards/maintenance-guard";
import { SystemHealthyGuard } from "../../guards/system-healthy-guard";

@NgModule({
  imports: [RouterModule.forChild([
    {
      path: "maintenance", loadComponent: () => import("../../pages/admin/site-maintenance/site-maintenance.component")
        .then(m => m.SiteMaintenanceComponent), canActivate: [MaintenanceGuard]
    },
    {
      path: "", loadComponent: () => import("../../pages/admin/admin/admin.component")
        .then(m => m.AdminComponent), canActivate: [SystemHealthyGuard, AreaExistsGuard]
    },
    {
      path: "fragment-index", loadComponent: () => import("../../pages/admin/content/fragment-index")
        .then(m => m.FragmentIndexComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "expenses", loadComponent: () => import("../../pages/admin/expenses/expenses.component")
        .then(m => m.ExpensesComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: "page-content-navigator", loadComponent: () => import("../../pages/admin/content/page-content-navigator")
        .then(m => m.PageContentNavigatorComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "duplicate-page-content-navigator", redirectTo: "page-content-navigator", pathMatch: "full"
    },
    {
      path: "expenses/:expense-id", loadComponent: () => import("../../pages/admin/expenses/expenses.component")
        .then(m => m.ExpensesComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: "mailing-preferences",
      loadComponent: () => import("../../pages/mailing-preferences/mailing-preferences-modal.component")
        .then(m => m.MailingPreferencesModalComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "member-login-audit",
      loadComponent: () => import("../../pages/admin/member-login-audit/member-login-audit.component")
        .then(m => m.MemberLoginAuditComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "member-admin", loadComponent: () => import("../../pages/admin/member-admin/member-admin.component")
        .then(m => m.MemberAdminComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "change-password", loadComponent: () => import("../../pages/admin/profile/change-password.component")
        .then(m => m.ChangePasswordComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: "email-subscriptions",
      loadComponent: () => import("../../pages/admin/profile/email-subscriptions.component")
        .then(m => m.EmailSubscriptionsComponent),
      canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: "contact-details", loadComponent: () => import("../../pages/admin/profile/contact-details.component")
        .then(m => m.ContactDetailsComponent), canActivate: [SystemHealthyGuard, LoggedInGuard]
    },
    {
      path: "member-bulk-load/:tab",
      loadComponent: () => import("../../pages/admin/member-bulk-load/member-bulk-load.component")
        .then(m => m.MemberBulkLoadComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "member-bulk-load",
      loadComponent: () => import("../../pages/admin/member-bulk-load/member-bulk-load.component")
        .then(m => m.MemberBulkLoadComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "system-settings", loadComponent: () => import("../../pages/admin/system-settings/system-settings")
        .then(m => m.SystemSettingsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "set-password/:password-reset-id", loadComponent: () => import("../../login/set-password.component")
        .then(m => m.SetPasswordComponent),
      canActivate: [SystemHealthyGuard]
    },
    {
      path: "mailchimp-settings",
      loadComponent: () => import("../../pages/admin/system-settings/mailchimp/mailchimp-settings")
        .then(m => m.MailchimpSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "mail-settings", loadComponent: () => import("../../pages/admin/system-settings/mail/mail-settings")
        .then(m => m.MailSettingsComponent), canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "committee-settings",
      loadComponent: () => import("../../pages/admin/system-settings/committee/committee-settings")
        .then(m => m.CommitteeSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "migration-settings",
      loadComponent: () => import("../../pages/admin/system-settings/migration/migration-settings")
        .then(m => m.MigrationSettingsComponent),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "backup-and-restore",
      loadComponent: () => import("../../pages/admin/backup-and-restore/backup-and-restore")
        .then(m => m.BackupAndRestore),
      canActivate: [SystemHealthyGuard, AdminAuthGuard]
    },
    {
      path: "banners", loadComponent: () => import("../../pages/banner/banner.component")
        .then(m => m.BannerComponent),
      canActivate: [SystemHealthyGuard]
    },
    {
      path: "carousel-editor", loadComponent: () => import("../../carousel/edit/image-list-page/image-list-edit-page")
        .then(m => m.ImageListEditPageComponent),
      canActivate: [SystemHealthyGuard]
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
