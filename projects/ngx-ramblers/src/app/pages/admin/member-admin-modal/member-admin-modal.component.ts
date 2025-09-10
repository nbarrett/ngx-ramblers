import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faPaste } from "@fortawesome/free-solid-svg-icons";
import { omit } from "es-toolkit/compat";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DateValue } from "../../../models/date.model";
import { MailchimpConfig } from "../../../models/mailchimp.model";
import { Member, MemberUpdateAudit } from "../../../models/member.model";
import { MailProvider, SystemConfig } from "../../../models/system.model";
import { EditMode } from "../../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { DbUtilsService } from "../../../services/db-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberAuthAuditService } from "../../../services/member/member-auth-audit.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberNamingService } from "../../../services/member/member-naming.service";
import { MemberUpdateAuditService } from "../../../services/member/member-update-audit.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { ProfileConfirmationService } from "../../../services/profile-confirmation.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailListAudit, MailMessagingConfig } from "../../../models/mail.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { MailListAuditService } from "../../../services/mail/mail-list-audit.service";
import { MemberDefaultsService } from "../../../services/member/member-defaults.service";
import { NO_CHANGES_OR_DIFFERENCES } from "../../../models/ramblers-insight-hub";
import { TabDirective, TabsetComponent } from "ngx-bootstrap/tabs";
import { FormsModule } from "@angular/forms";
import { DatePicker } from "../../../date-and-time/date-picker";
import { MarkdownEditorComponent } from "../../../markdown-editor/markdown-editor.component";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MailChimpSubscriptionSettingsComponent } from "./mailchimp-subscription-settings";
import { MailSubscriptionSettingsComponent } from "./mail-subscription-settings";
import { SwitchIconComponent } from "../system-settings/committee/switch-icon";
import { JsonPipe } from "@angular/common";
import { CreatedAuditPipe } from "../../../pipes/created-audit-pipe";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { LastConfirmedDateDisplayed } from "../../../pipes/last-confirmed-date-displayed.pipe";
import { UpdatedAuditPipe } from "../../../pipes/updated-audit-pipe";
import { FormatAuditPipe } from "../../../pipes/format-audit-pipe";

@Component({
  selector: "app-member-admin-modal",
  templateUrl: "./member-admin-modal.component.html",
  styleUrls: ["./member-admin-modal.component.sass"],
  providers: [FormatAuditPipe],
  imports: [TabsetComponent, TabDirective, FormsModule, DatePicker, MarkdownEditorComponent, TooltipDirective,
    FontAwesomeModule, MailChimpSubscriptionSettingsComponent, MailSubscriptionSettingsComponent, SwitchIconComponent,
    JsonPipe, CreatedAuditPipe, DisplayDateAndTimePipe, FullNameWithAliasPipe, LastConfirmedDateDisplayed, UpdatedAuditPipe]
})
export class MemberAdminModalComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MemberAdminModalComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private notifierService = inject(NotifierService);
  private memberUpdateAuditService = inject(MemberUpdateAuditService);
  private memberAuthAuditService = inject(MemberAuthAuditService);
  private memberNamingService = inject(MemberNamingService);
  private stringUtils = inject(StringUtilsService);
  private memberService = inject(MemberService);
  private fullNameWithAliasPipe = inject(FullNameWithAliasPipe);
  private memberLoginService = inject(MemberLoginService);
  private mailListAuditService = inject(MailListAuditService);
  private broadcastService = inject<BroadcastService<MailListAudit>>(BroadcastService);
  private profileConfirmationService = inject(ProfileConfirmationService);
  private memberDefaultsService = inject(MemberDefaultsService);
  private mailMessagingService = inject(MailMessagingService);
  private dbUtils = inject(DbUtilsService);
  protected dateUtils = inject(DateUtilsService);
  bsModalRef = inject(BsModalRef);
  public systemConfig: SystemConfig;
  public mailMessagingConfig: MailMessagingConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public lastLoggedIn: number;
  public memberUpdateAudits: MemberUpdateAudit[] = [];
  public allowEdits: boolean;
  public allowDelete: boolean;
  public allowCopy: boolean;
  public allowConfirmDelete = false;
  public saveInProgress: boolean;
  public member: Member;
  public receivedInLastBulkLoad: boolean;
  public lastBulkLoadDate: number;
  public editMode: EditMode;
  public NO_CHANGES_OR_DIFFERENCES = NO_CHANGES_OR_DIFFERENCES;
  public members: Member[] = [];
  public pendingMailListAudits: MailListAudit[] = [];
  public mailListAudits: MailListAudit[] = [];
  public mailchimpConfig: MailchimpConfig;
  private subscriptions: Subscription[] = [];
  public readonly faPaste = faPaste;
  protected readonly MailProvider = MailProvider;

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((systemConfig: SystemConfig) => {
        this.systemConfig = systemConfig;
        this.logger.info("received SystemConfig event:", systemConfig);
      }));
    this.subscriptions.push(this.mailMessagingService.events()
      .subscribe((mailMessagingConfig: MailMessagingConfig) => {
        this.mailMessagingConfig = mailMessagingConfig;
        this.logger.info("retrieved MailMessagingConfig event:", mailMessagingConfig?.mailConfig);
      }));
    this.subscriptions.push(
      this.broadcastService.on(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, (namedEvent: NamedEvent<MailListAudit>) => {
        this.pendingMailListAudits = this.pendingMailListAudits.filter(item => item.listId !== namedEvent.data.listId).concat(namedEvent.data);
        this.logger.info("event received:", namedEvent, "pendingMailListAudits:", this.pendingMailListAudits);
      }));
    this.logger.info("constructed with member", this.member, this.members.length, "members");
    this.allowEdits = this.memberLoginService.allowMemberAdminEdits();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    const existingRecordEditEnabled = this.allowEdits && this.editMode === EditMode.EDIT;
    const memberId = this.member.id;
    this.allowConfirmDelete = false;
    this.allowCopy = existingRecordEditEnabled;
    this.allowDelete = !!memberId;
    this.memberUpdateAudits = [];
    if (memberId) {
      this.refreshMemberUpdateAuditsForMember(memberId);
      this.refreshMailListAuditsForMember(memberId);
    } else {
      this.logger.debug("new member with default values", this.member);
    }
  }

  private refreshMemberUpdateAuditsForMember(memberId: string) {
    this.logger.debug("querying MemberUpdateAuditService for memberId", memberId);
    this.memberUpdateAuditService.all({
      criteria: {
        memberId
      }, sort: {updateTime: -1}
    }).then(memberUpdateAudits => {
      this.logger.debug("MemberUpdateAuditService:", memberUpdateAudits.length, "events", memberUpdateAudits);
      this.memberUpdateAudits = memberUpdateAudits;
      this.findLastLoginTimeForMember();
    });
  }

  private refreshMailListAuditsForMember(memberId: string) {
    this.logger.info("querying mailListAuditService for memberId", memberId);
    this.mailListAuditService.all({
      criteria: {
        memberId
      }, sort: {timestamp: -1}
    }).then(mailListAudits => {
      this.logger.info("mailListAuditService:", mailListAudits.length, "events", mailListAudits);
      this.mailListAudits = mailListAudits;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  deleteMemberDetails() {
    this.allowDelete = false;
    this.allowConfirmDelete = true;
  }

  findLastLoginTimeForMember() {
    return this.memberAuthAuditService.all({criteria: {userName: {$eq: this.member.userName}}, sort: {loginTime: -1}})
      .then(results => {
        if (results.length > 0) {
          this.lastLoggedIn = results[0].loginTime;
        }
      });
  }

  confirmDeleteMemberDetails() {
    this.memberService.delete(this.member).then(() => this.bsModalRef.hide());
  }


  profileSettingsConfirmedChecked(profileSettingsConfirmed: boolean) {
    this.profileConfirmationService.processMember(this.member, profileSettingsConfirmed);
  }

  close() {
    this.bsModalRef.hide();
  }

  onMembershipDateChange(dateValue: DateValue) {
    this.logger.debug("onMembershipDateChange:date", dateValue);
    this.member.membershipExpiryDate = dateValue?.value || null;
  }

  saveMemberDetails() {
    this.saveInProgress = true;

    if (!this.member.userName) {
      this.member.userName = this.memberNamingService.createUniqueUserName(this.member, this.members);
      this.logger.debug("creating username", this.member.userName);
    }

    if (!this.member.displayName) {
      this.member.displayName = this.memberNamingService.createUniqueDisplayName(this.member, this.members);
      this.logger.debug("creating displayName", this.member.displayName);
    }

    return Promise.resolve(this.notify.success("Saving member", true))
      .then(() => this.preProcessMemberBeforeSave())
      .then(() => this.memberService.createOrUpdate(this.member))
      .then(() => this.mailListAuditService.createOrUpdateAll(this.pendingMailListAudits))
      .then(() => this.bsModalRef.hide())
      .then(() => this.notify.success("Member saved successfully"))
      .catch((error) => this.handleSaveError(error));
  }

  handleSaveError(errorResponse) {

    this.logger.debug("handleSaveError:errorResponse", errorResponse);
    this.saveInProgress = false;
    const message = this.stringUtils.stringify(errorResponse);
    const duplicate = message.includes("duplicate");

    this.logger.debug("errorResponse", errorResponse, "duplicate", duplicate);
    let notifyMessage;
    if (duplicate) {
      notifyMessage = `You've entered duplicate data: ${this.dbUtils.duplicateErrorFields(message)}.
         A member record must have a unique Email Address, Display Name, Ramblers Membership Number and combination of First Name,
          Last Name and Alias. Please amend the current details and try again.`;
    } else {
      notifyMessage = errorResponse;
    }
    this.notify.clearBusy();
    this.notify.error({
      title: "Member could not be saved",
      message: notifyMessage
    });
  }

  preProcessMemberBeforeSave() {
    return this.memberDefaultsService.resetUpdateStatusForMember(this.member, this.systemConfig);
  }

  copyDetailsToNewMember() {
    const mailProviderFields = this.systemConfig.mailDefaults.mailProvider === MailProvider.BREVO ? ["mail"] : ["mailchimpLists", "mailchimpSegmentIds"];
    const copiedMember = omit(this.member, mailProviderFields.concat(["id",
      "createdBy",
      "createdDate",
      "lastBulkLoadDate",
      "mail",
      "mailchimpLists",
      "password",
      "profileSettingsConfirmed",
      "profileSettingsConfirmedAt",
      "profileSettingsConfirmedBy",
      "receivedInLastBulkLoad",
      "updatedBy",
      "updatedDate"])) as Member;
    this.memberDefaultsService.applyDefaultMailSettingsToMember(copiedMember, this.systemConfig, this.mailMessagingConfig);
    this.profileConfirmationService.unconfirmProfile(copiedMember);
    this.member = copiedMember;
    this.editMode = EditMode.COPY_EXISTING;
    this.memberUpdateAudits = [];
    this.mailListAudits = [];
    this.lastLoggedIn = null;
    this.notify.success("Existing Member copied! Make changes here and save to create new member.");
  }

  defaultContactName() {
    this.member.contactId = this.fullNameWithAliasPipe.transform(this.member);
  }

  jointWith(jointWith: string): string {
    const member = this?.members?.find(member => member.membershipNumber === jointWith);
    return member ? this.fullNameWithAliasPipe.transform(member) : null;
  }
}
