import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { LoggedInGuard } from "../../guards/admin-login-guard";
import { hasDynamicPath } from "../../services/path-matchers";
import { AdminModule } from "./admin.module";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { AdminAuthGuard } from "../../guards/admin-auth-guard";

@NgModule({
  imports: [AdminModule, RouterModule.forChild([
    {
      path: "", loadComponent: () => import("../../pages/admin/admin/admin.component")
        .then(m => m.AdminComponent), canActivate: [AreaExistsGuard]
    },
    {
      path: "expenses", loadComponent: () => import("../../pages/admin/expenses/expenses.component")
        .then(m => m.ExpensesComponent), canActivate: [LoggedInGuard]
    },
    {
      path: "expenses/:expense-id", loadComponent: () => import("../../pages/admin/expenses/expenses.component")
        .then(m => m.ExpensesComponent), canActivate: [LoggedInGuard]
    },
    {
      path: "mailing-preferences",
      loadComponent: () => import("../../pages/mailing-preferences/mailing-preferences-modal.component")
        .then(m => m.MailingPreferencesModalComponent),
      canActivate: [AdminAuthGuard]
    },
    {
      path: "member-login-audit",
      loadComponent: () => import("../../pages/admin/member-login-audit/member-login-audit.component")
        .then(m => m.MemberLoginAuditComponent),
      canActivate: [AdminAuthGuard]
    },
    {
      path: "member-admin", loadComponent: () => import("../../pages/admin/member-admin/member-admin.component")
        .then(m => m.MemberAdminComponent), canActivate: [AdminAuthGuard]
    },
    {
      path: "change-password", loadComponent: () => import("../../pages/admin/profile/change-password.component")
        .then(m => m.ChangePasswordComponent), canActivate: [LoggedInGuard]
    },
    {
      path: "email-subscriptions",
      loadComponent: () => import("../../pages/admin/profile/email-subscriptions.component")
        .then(m => m.EmailSubscriptionsComponent),
      canActivate: [LoggedInGuard]
    },
    {
      path: "contact-details", loadComponent: () => import("../../pages/admin/profile/contact-details.component")
        .then(m => m.ContactDetailsComponent), canActivate: [LoggedInGuard]
    },
    {
      path: "member-bulk-load/:tab",
      loadComponent: () => import("../../pages/admin/member-bulk-load/member-bulk-load.component")
        .then(m => m.MemberBulkLoadComponent),
      canActivate: [AdminAuthGuard]
    },
    {
      path: "member-bulk-load",
      loadComponent: () => import("../../pages/admin/member-bulk-load/member-bulk-load.component")
        .then(m => m.MemberBulkLoadComponent),
      canActivate: [AdminAuthGuard]
    },
    {
      path: "system-settings", loadComponent: () => import("../../pages/admin/system-settings/system-settings")
        .then(m => m.SystemSettingsComponent), canActivate: [AdminAuthGuard]
    },
    {
      path: "set-password/:password-reset-id", loadComponent: () => import("../../login/set-password.component")
        .then(m => m.SetPasswordComponent)
    },
    {
      path: "mailchimp-settings",
      loadComponent: () => import("../../pages/admin/system-settings/mailchimp/mailchimp-settings")
        .then(m => m.MailchimpSettingsComponent),
      canActivate: [AdminAuthGuard]
    },
    {
      path: "mail-settings", loadComponent: () => import("../../pages/admin/system-settings/mail/mail-settings")
        .then(m => m.MailSettingsComponent), canActivate: [AdminAuthGuard]
    },
    {
      path: "committee-settings",
      loadComponent: () => import("../../pages/admin/system-settings/committee/committee-settings")
        .then(m => m.CommitteeSettingsComponent),
      canActivate: [AdminAuthGuard]
    },
    {
      path: "banners", loadComponent: () => import("../../pages/banner/banner.component")
        .then(m => m.BannerComponent)
    },
    {
      path: "carousel-editor", loadComponent: () => import("../../carousel/edit/image-list-page/image-list-edit-page")
        .then(m => m.ImageListEditPageComponent)
    },
    {
      matcher: hasDynamicPath, loadComponent: () => import("../common/dynamic-content-page/dynamic-content-page")
        .then(m => m.DynamicContentPageComponent)
    },
  ])]
})
export class AdminRoutingModule {
}
