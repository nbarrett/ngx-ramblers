import { Component, OnDestroy, OnInit } from "@angular/core";
import { faPaste } from "@fortawesome/free-solid-svg-icons";
import omit from "lodash-es/omit";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DateValue } from "../../../models/date.model";
import { MailchimpConfig, MailchimpSubscription } from "../../../models/mailchimp.model";
import { Member, MemberUpdateAudit } from "../../../models/member.model";
import { SystemConfig } from "../../../models/system.model";
import { EditMode } from "../../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { DbUtilsService } from "../../../services/db-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpLinkService } from "../../../services/mailchimp/mailchimp-link.service";
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
              private mailchimpLinkService: MailchimpLinkService,
              private fullNameWithAliasPipe: FullNameWithAliasPipe,
              private memberLoginService: MemberLoginService,
              private profileConfirmationService: ProfileConfirmationService,
              private mailchimpListService: MailchimpListService,
              private dbUtils: DbUtilsService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(MemberAdminModalComponent, NgxLoggerLevel.OFF);
  }

  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  lastLoggedIn: number;
  private logger: Logger;
  memberUpdateAudits: MemberUpdateAudit[] = [];
  public allowEdits: boolean;
  public allowDelete: boolean;
  public allowCopy: boolean;
  public allowConfirmDelete = false;
  public saveInProgress: boolean;
  public member: Member;
  public editMode: EditMode;
  public members: Member[] = [];
  public mailchimpConfig: MailchimpConfig;
  private subscriptions: Subscription[] = [];
  public config: SystemConfig;
  public readonly faPaste = faPaste;

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
        this.logger.info("retrieved config", config);
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
    } else {
      this.logger.debug("new member with default values", this.member);
    }
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

  viewMailchimpListEntry(webId: number) {
    return window.open(`${this.mailchimpLinkService.listView(webId)}`);
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
      .then(() => this.saveAndHide())
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
    return this.mailchimpListService.resetUpdateStatusForMember(this.member);
  }

  saveAndHide() {
    return this.memberService.createOrUpdate(this.member)
      .then(() => this.bsModalRef.hide());
  }

  copyDetailsToNewMember() {
    const copiedMember = omit(this.member,
      "id",
      "mailchimpLists",
      "mailchimpSegmentIds",
      "password",
      "profileSettingsConfirmed",
      "receivedInLastBulkLoad",
      "lastBulkLoadDate",
      "createdDate",
      "createdBy",
      "updatedDate",
      "updatedBy",
      "profileSettingsConfirmedAt",
      "profileSettingsConfirmedBy");
    this.mailchimpListService.defaultMailchimpSettings(copiedMember, true);
    this.profileConfirmationService.unconfirmProfile(copiedMember);
    this.member = copiedMember;
    this.editMode = EditMode.COPY_EXISTING;
    this.notify.success("Existing Member copied! Make changes here and save to create new member.");
  }

  changeSubscribed(listType: string) {
    const mailchimpSubscription: MailchimpSubscription = this.member.mailchimpLists[listType];
    this.logger.info("listType", listType, "subscribed:", mailchimpSubscription.subscribed);
    if (!mailchimpSubscription.subscribed) {
      mailchimpSubscription.leid = null;
      mailchimpSubscription.unique_email_id = null;
      mailchimpSubscription.email = null;
      mailchimpSubscription.web_id = null;
      mailchimpSubscription.updated = false;
      this.logger.info("listType", listType, "mailchimpSubscription now:", mailchimpSubscription);
    }
  }

  defaultAssembleName() {
    this.member.contactId = this.fullNameWithAliasPipe.transform(this.member);
  }

}
