import { NgModule } from "@angular/core";
import { NotificationDirective } from "../../notifications/common/notification.directive";
import {
  ExpenseNotificationApproverFirstApprovalComponent
} from "../../notifications/expenses/templates/approver/expense-notification-approver-first-approval.component";
import {
  ExpenseNotificationApproverPaidComponent
} from "../../notifications/expenses/templates/approver/expense-notification-approver-paid.component";
import {
  ExpenseNotificationApproverReturnedComponent
} from "../../notifications/expenses/templates/approver/expense-notification-approver-returned.component";
import {
  ExpenseNotificationApproverSecondApprovalComponent
} from "../../notifications/expenses/templates/approver/expense-notification-approver-second-approval.component";
import {
  ExpenseNotificationApproverSubmittedComponent
} from "../../notifications/expenses/templates/approver/expense-notification-approver-submitted.component";
import {
  ExpenseNotificationDetailsComponent
} from "../../notifications/expenses/templates/common/expense-notification-details.component";
import {
  ExpenseNotificationCreatorPaidComponent
} from "../../notifications/expenses/templates/creator/expense-notification-creator-paid.component";
import {
  ExpenseNotificationCreatorReturnedComponent
} from "../../notifications/expenses/templates/creator/expense-notification-creator-returned.component";
import {
  ExpenseNotificationCreatorSecondApprovalComponent
} from "../../notifications/expenses/templates/creator/expense-notification-creator-second-approval.component";
import {
  ExpenseNotificationCreatorSubmittedComponent
} from "../../notifications/expenses/templates/creator/expense-notification-creator-submitted.component";
import {
  ExpenseNotificationTreasurerPaidComponent
} from "../../notifications/expenses/templates/treasurer/expense-notification-treasurer-paid.component";
import {
  ExpenseNotificationTreasurerSecondApprovalComponent
} from "../../notifications/expenses/templates/treasurer/expense-notification-treasurer-second-approval.component";
import { AdminComponent } from "../../pages/admin/admin/admin.component";
import { ExpensesComponent } from "../../pages/admin/expenses/expenses.component";
import { ExpenseDetailModalComponent } from "../../pages/admin/expenses/modals/expense-detail-modal.component";
import { ExpensePaidModalComponent } from "../../pages/admin/expenses/modals/expense-paid-modal.component";
import { ExpenseReturnModalComponent } from "../../pages/admin/expenses/modals/expense-return-modal.component";
import { ExpenseSubmitModalComponent } from "../../pages/admin/expenses/modals/expense-submit-modal.component";
import { MemberAdminModalComponent } from "../../pages/admin/member-admin-modal/member-admin-modal.component";
import { MemberAdminComponent } from "../../pages/admin/member-admin/member-admin.component";
import { MemberBulkLoadComponent } from "../../pages/admin/member-bulk-load/member-bulk-load.component";
import { MemberLoginAuditComponent } from "../../pages/admin/member-login-audit/member-login-audit.component";
import { ChangePasswordComponent } from "../../pages/admin/profile/change-password.component";
import { ContactDetailsComponent } from "../../pages/admin/profile/contact-details.component";
import { EmailSubscriptionsComponent } from "../../pages/admin/profile/email-subscriptions.component";
import { SendEmailsModalComponent } from "../../pages/admin/send-emails/send-emails-modal.component";
import { CommitteeMemberComponent } from "../../pages/admin/system-settings/committee/committee-member";
import { CommitteeMemberLookupComponent } from "../../pages/admin/system-settings/committee/committee-member-lookup";
import { CommitteeSettingsComponent } from "../../pages/admin/system-settings/committee/committee-settings";
import {
  ImageCollectionSettingsComponent
} from "../../pages/admin/system-settings/image-collection/image-collection-settings";
import { SystemImageEditComponent } from "../../pages/admin/system-settings/image/system-image-edit";
import {
  MailchimpCampaignDefaultsComponent
} from "../../pages/admin/system-settings/mailchimp/mailchimp-campaign-defaults";
import { MailchimpContactComponent } from "../../pages/admin/system-settings/mailchimp/mailchimp-contact";
import { MailchimpListSettingsComponent } from "../../pages/admin/system-settings/mailchimp/mailchimp-list-settings";
import { MailchimpSettingsComponent } from "../../pages/admin/system-settings/mailchimp/mailchimp-settings";
import { SystemSettingsComponent } from "../../pages/admin/system-settings/system-settings";
import { ForgotPasswordModalComponent } from "../../pages/login/forgot-password-modal/forgot-password-modal.component";
import { ResetPasswordModalComponent } from "../../pages/login/reset-password-modal/reset-password-modal.component";
import { MailingPreferencesModalComponent } from "../../pages/mailing-preferences/mailing-preferences-modal.component";
import { FormatAuditPipe } from "../../pipes/format-audit-pipe";
import { SharedModule } from "../../shared-module";
import { MailchimpSegmentEditorComponent } from "../../pages/admin/system-settings/mailchimp/mailchimp-segment-editor";
import { MailSettingsComponent } from "../../pages/admin/system-settings/mail/mail-settings";
import {
  MailNotificationTemplateMappingComponent
} from "../../pages/admin/system-settings/mail/mail-notification-template-editor";
import { SwitchIconComponent } from "../../pages/admin/system-settings/committee/switch-icon";
import {
  ForgotPasswordNotificationDetailsComponent
} from "../../notifications/admin/templates/forgot-password-notification-details";
import {
  NotificationConfigToProcessMappingComponent
} from "../../pages/admin/system-settings/mail/notification-config-to-process-mappings";

@NgModule({
  declarations: [
    AdminComponent,
    ChangePasswordComponent,
    CommitteeMemberComponent,
    CommitteeMemberLookupComponent,
    CommitteeSettingsComponent,
    ContactDetailsComponent,
    EmailSubscriptionsComponent,
    ExpenseDetailModalComponent,
    ExpenseNotificationApproverFirstApprovalComponent,
    ExpenseNotificationApproverPaidComponent,
    ExpenseNotificationApproverReturnedComponent,
    ExpenseNotificationApproverSecondApprovalComponent,
    ExpenseNotificationApproverSubmittedComponent,
    ExpenseNotificationCreatorPaidComponent,
    ExpenseNotificationCreatorReturnedComponent,
    ExpenseNotificationCreatorSecondApprovalComponent,
    ExpenseNotificationCreatorSubmittedComponent,
    ExpenseNotificationDetailsComponent,
    ExpenseNotificationTreasurerPaidComponent,
    ExpenseNotificationTreasurerSecondApprovalComponent,
    ExpensePaidModalComponent,
    ExpenseReturnModalComponent,
    ExpenseSubmitModalComponent,
    ExpensesComponent,
    ForgotPasswordModalComponent,
    ForgotPasswordNotificationDetailsComponent,
    ImageCollectionSettingsComponent,
    MailNotificationTemplateMappingComponent,
    MailSettingsComponent,
    NotificationConfigToProcessMappingComponent,
    MailchimpCampaignDefaultsComponent,
    MailchimpContactComponent,
    MailchimpListSettingsComponent,
    MailchimpSegmentEditorComponent,
    MailchimpSettingsComponent,
    MailingPreferencesModalComponent,
    MemberAdminComponent,
    MemberAdminModalComponent,
    MemberBulkLoadComponent,
    MemberLoginAuditComponent,
    ResetPasswordModalComponent,
    SendEmailsModalComponent,
    SwitchIconComponent,
    SystemImageEditComponent,
    SystemSettingsComponent,
  ],
  imports: [
    SharedModule
  ],
  providers: [
    FormatAuditPipe
  ]
})
export class AdminModule {
}
