import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { LoggedInGuard } from "../../guards/admin-login-guard";
import { SetPasswordComponent } from "../../login/set-password.component";
import { AdminComponent } from "../../pages/admin/admin/admin.component";
import { ExpensesComponent } from "../../pages/admin/expenses/expenses.component";
import { MemberAdminComponent } from "../../pages/admin/member-admin/member-admin.component";
import { MemberBulkLoadComponent } from "../../pages/admin/member-bulk-load/member-bulk-load.component";
import { MemberLoginAuditComponent } from "../../pages/admin/member-login-audit/member-login-audit.component";
import { ChangePasswordComponent } from "../../pages/admin/profile/change-password.component";
import { ContactDetailsComponent } from "../../pages/admin/profile/contact-details.component";
import { EmailSubscriptionsComponent } from "../../pages/admin/profile/email-subscriptions.component";
import { CommitteeSettingsComponent } from "../../pages/admin/system-settings/committee/committee-settings";
import { MailchimpSettingsComponent } from "../../pages/admin/system-settings/mailchimp/mailchimp-settings";
import { SystemSettingsComponent } from "../../pages/admin/system-settings/system-settings";
import { BannerComponent } from "../../pages/banner/banner.component";
import { MailingPreferencesModalComponent } from "../../pages/mailing-preferences/mailing-preferences-modal.component";
import { hasDynamicPath } from "../../services/path-matchers";
import { DynamicContentPageComponent } from "../common/dynamic-content-page/dynamic-content-page";
import { AdminModule } from "./admin.module";
import { AreaExistsGuard } from "../../guards/area-exists-guard";
import { ImageListEditPageComponent } from "../../carousel/edit/image-list-page/image-list-edit-page";
import { AdminAuthGuard } from "../../guards/admin-auth-guard";
import { MailSettingsComponent } from "../../pages/admin/system-settings/mail/mail-settings";

@NgModule({
  imports: [AdminModule, RouterModule.forChild([
    {path: "", component: AdminComponent, canActivate: [AreaExistsGuard]},
    {path: "expenses", component: ExpensesComponent, canActivate: [LoggedInGuard]},
    {path: "expenses/:expense-id", component: ExpensesComponent, canActivate: [LoggedInGuard]},
    {path: "mailing-preferences", component: MailingPreferencesModalComponent, canActivate: [AdminAuthGuard]},
    {path: "member-login-audit", component: MemberLoginAuditComponent, canActivate: [AdminAuthGuard]},
    {path: "member-admin", component: MemberAdminComponent, canActivate: [AdminAuthGuard]},
    {path: "change-password", component: ChangePasswordComponent, canActivate: [LoggedInGuard]},
    {path: "email-subscriptions", component: EmailSubscriptionsComponent, canActivate: [LoggedInGuard]},
    {path: "contact-details", component: ContactDetailsComponent, canActivate: [LoggedInGuard]},
    {path: "member-bulk-load/:tab", component: MemberBulkLoadComponent, canActivate: [AdminAuthGuard]},
    {path: "member-bulk-load", component: MemberBulkLoadComponent, canActivate: [AdminAuthGuard]},
    {path: "system-settings", component: SystemSettingsComponent, canActivate: [AdminAuthGuard]},
    {path: "set-password/:password-reset-id", component: SetPasswordComponent},
    {path: "mailchimp-settings", component: MailchimpSettingsComponent, canActivate: [AdminAuthGuard]},
    {path: "mail-settings", component: MailSettingsComponent, canActivate: [AdminAuthGuard]},
    {path: "committee-settings", component: CommitteeSettingsComponent, canActivate: [AdminAuthGuard]},
    {path: "banners", component: BannerComponent},
    {path: "carousel-editor", component: ImageListEditPageComponent},
    {matcher: hasDynamicPath, component: DynamicContentPageComponent},
  ])]
})
export class AdminRoutingModule {
}
