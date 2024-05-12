import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { faPaste } from "@fortawesome/free-solid-svg-icons";
import omit from "lodash-es/omit";
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
import { MailchimpListService } from "../../../services/mailchimp/mailchimp-list.service";
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
import { MailConfig, MailListAudit, MailMessagingConfig } from "../../../models/mail.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { MailListAuditService } from "../../../services/mail/mail-list-audit.service";

@Component({
  selector: "app-member-admin-modal",
  templateUrl: "./member-admin-modal.component.html",
  styleUrls: ["./member-admin-modal.component.sass"]
})
export class MemberAdminModalComponent implements OnInit, OnDestroy {


  constructor(public systemConfigService: SystemConfigService,
              private notifierService: NotifierService,
              private memberUpdateAuditService: MemberUpdateAuditService,
              private memberAuthAuditService: MemberAuthAuditService,
              private memberNamingService: MemberNamingService,
              private stringUtils: StringUtilsService,
              private memberService: MemberService,
              private fullNameWithAliasPipe: FullNameWithAliasPipe,
              private memberLoginService: MemberLoginService,
              private mailListAuditService: MailListAuditService,
              private broadcastService: BroadcastService<MailListAudit>,
              private profileConfirmationService: ProfileConfirmationService,
              private mailchimpListService: MailchimpListService,
              private mailMessagingService: MailMessagingService,
              private dbUtils: DbUtilsService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberAdminModalComponent, NgxLoggerLevel.OFF);
  }

  public systemConfig: SystemConfig;
  public mailConfig: MailConfig;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public lastLoggedIn: number;
  private logger: Logger;
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
      .subscribe((config: MailMessagingConfig) => {
        this.mailConfig = config.mailConfig;
        this.logger.info("retrieved MailMessagingConfig event:", config.mailConfig);
      }));
    this.subscriptions.push(
      this.broadcastService.on(NamedEventType.MAIL_SUBSCRIPTION_CHANGED, (namedEvent: NamedEvent<MailListAudit>) => {
        this.pendingMailListAudits = this.pendingMailListAudits.filter(item => item.listId !== namedEvent.data.listId).concat(namedEvent.data);
        this.logger.info("event received:", namedEvent, "pendingMailListAudits:", this.pendingMailListAudits);
      }));
    this.logger.debug("constructed with member", this.member, this.members.length, "members");
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
      this.logger.debug("mailListAuditService:", mailListAudits.length, "events", mailListAudits);
      this.mailListAudits = mailListAudits;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => {
      this.logger.info("unsubscribing", subscription);
      subscription.unsubscribe();
    });
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
    switch (this.systemConfig.mailDefaults.mailProvider) {
      case MailProvider.BREVO:
        break;
      case MailProvider.MAILCHIMP:
        return this.mailchimpListService.resetUpdateStatusForMember(this.member);
      case MailProvider.NONE:
        break;
    }
  }
  copyDetailsToNewMember() {
    const mailProviderFields = this.systemConfig.mailDefaults.mailProvider === MailProvider.BREVO ? ["mail"] : ["mailchimpLists", "mailchimpSegmentIds"];
    const copiedMember = omit(this.member, mailProviderFields.concat(["id",
      "createdBy",
      "createdDate",
      "lastBulkLoadDate",
      "password",
      "profileSettingsConfirmed",
      "profileSettingsConfirmedAt",
      "profileSettingsConfirmedBy",
      "receivedInLastBulkLoad",
      "updatedBy",
      "updatedDate"])) as Member;
    this.mailchimpListService.defaultMailchimpSettings(copiedMember, true);
    this.profileConfirmationService.unconfirmProfile(copiedMember);
    this.member = copiedMember;
    this.editMode = EditMode.COPY_EXISTING;
    this.notify.success("Existing Member copied! Make changes here and save to create new member.");
  }


  defaultAssembleName() {
    this.member.contactId = this.fullNameWithAliasPipe.transform(this.member);
  }
}
