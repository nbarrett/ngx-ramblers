import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgSelectComponent } from "@ng-select/ng-select";
import map from "lodash-es/map";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DateValue } from "../../../models/date.model";
import { Member, MemberBulkLoadAudit, MemberFilterSelection } from "../../../models/member.model";
import { Organisation } from "../../../models/system.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import {
  MailMessagingConfig,
  MemberSelection,
  MemberSelector,
  NotificationConfig,
  NotificationConfigListing,
  WorkflowAction
} from "../../../models/mail.model";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MailService } from "../../../services/mail/mail.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import first from "lodash-es/first";
import { KEY_NULL_VALUE_NONE } from "../../../functions/enums";
import { MemberBulkDeleteService } from "../../../services/member/member-bulk-delete.service";
import { MemberBulkLoadAuditService } from "../../../services/member/member-bulk-load-audit.service";

@Component({
  selector: "app-member-admin-send-emails-modal",
  template: `
    <div *ngIf="notificationConfig" class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title">Send <em>Emails</em> to Members</h4>
        <button type="button" class="close" aria-label="Close" (click)="bsModalRef.hide()">&times;</button>
      </div>
      <div class="modal-body">
        <tabset class="custom-tabset" *ngIf="mailMessagingConfig?.mailConfig">
          <tab heading="Email Type, Banner & Template">
            <div class="img-thumbnail thumbnail-admin-edit">
              <app-notification-config-selector (emailConfigChanged)="emailConfigChanged($event)"
                                                [notificationConfig]="notificationConfig"
                                                [notificationConfigListing]="notificationConfigListing"
                                                [busy]="notifyTarget.busy"/>
              <div class="row">
                <div class="col-sm-12">
                  <label>Email Configuration Workflow</label>
                </div>
                <div class="col-sm-6">
                  <div class="form-group">
                    <label>
                      Member Selection: {{ memberSelectionFor(notificationConfig) }}</label>
                  </div>
                </div>
                <div class="col-sm-3">
                  <div class="form-group">
                    <label>
                      Pre-Send Action: {{ actionFor(notificationConfig.preSendActions) }}</label>
                  </div>
                </div>
                <div class="col-sm-3">
                  <div class="form-group">
                    <label>
                      Post-Send Action: {{ actionFor(notificationConfig.postSendActions) }}</label>
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Member Selection">
            <div class="img-thumbnail thumbnail-admin-edit">
              <div class="row">
                <div class="col-sm-12">
                  <label for="radio-selections">Pre-select members</label>
                  <div id="radio-selections">
                    <div class="row">
                      <div class="col-sm-12">
                        <div class="form-inline">
                          <div class="custom-control custom-radio custom-control-inline">
                            <input type="radio" class="custom-control-input" [value]="MemberSelection.RECENTLY_ADDED"
                                   [ngModel]="notificationConfig.defaultMemberSelection"
                                   [disabled]="notifyTarget.busy" id="recently-added"
                                   (click)="populateMembersBasedOn(MemberSelection.RECENTLY_ADDED)">
                            <label class="custom-control-label text-nowrap" for="recently-added">
                              Added in the
                              last {{ stringUtils.pluraliseWithCount(notificationConfig.monthsInPast, "month") }}
                              on/after:
                            </label>
                            <app-date-picker startOfDay
                                             *ngIf="currentMemberSelection === MemberSelection.RECENTLY_ADDED"
                                             class="input-group ml-2"
                                             (dateChange)="onMemberFilterDateChange($event)"
                                             [value]="memberFilterDate">
                            </app-date-picker>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-sm-12">
                        <div class="form-inline">
                          <div class="custom-control custom-radio custom-control-inline">
                            <input type="radio" class="custom-control-input"
                                   [value]="MemberSelection.EXPIRED_MEMBERS"
                                   [ngModel]="notificationConfig.defaultMemberSelection"
                                   [disabled]="notifyTarget.busy"
                                   id="expired-members"
                                   (click)="populateMembersBasedOn(MemberSelection.EXPIRED_MEMBERS)">
                            <label class="custom-control-label text-nowrap" for="expired-members">
                              {{ notificationConfig.monthsInPast }} months past expiry date:
                            </label>
                            <app-date-picker startOfDay
                                             *ngIf="currentMemberSelection === MemberSelection.EXPIRED_MEMBERS"
                                             class="calendar-in-label"
                                             (dateChange)="onMemberFilterDateChange($event)"
                                             [value]="memberFilterDate">
                            </app-date-picker>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="row">
                      <div class="col-sm-6">
                        <div class="custom-control custom-radio">
                          <input
                            type="radio"
                            class="custom-control-input"
                            [value]="MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS"
                            [ngModel]="notificationConfig.monthsInPast"
                            [disabled]="notifyTarget.busy"
                            id="missing-from-bulk-load-members"
                            (click)="populateMembersBasedOn(MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS)">
                          <label class="custom-control-label" for="missing-from-bulk-load-members">Missing from last
                            bulk
                            load</label>
                        </div>
                        <div class="custom-control custom-radio">
                          <input
                            type="radio"
                            class="custom-control-input"
                            [disabled]="notifyTarget.busy"
                            value="Clear all"
                            [ngModel]="notificationConfig.monthsInPast"
                            id="clear-members"
                            (click)="clearSelectedMembers()"
                            title="Clear current selection">
                          <label class="custom-control-label" (click)="clearSelectedMembers()" for="clear-members">Clear
                            all and enter manually</label>
                        </div>
                      </div>
                      <div class="col-sm-12">
                        <div class="form-group">
                          <label>{{ passwordResetCaption() }}</label>
                          <ng-select #select [items]="selectableMembers"
                                     bindLabel="memberInformation"
                                     bindValue="member.id"
                                     placeholder="Select one or more members"
                                     [disabled]="notifyTarget.busy"
                                     [dropdownPosition]="'bottom'"
                                     [groupBy]="groupBy"
                                     [groupValue]="groupValue"
                                     [multiple]="true"
                                     (click)="selectClick(select)"
                                     [closeOnSelect]="true"
                                     (change)="onChange($event)"
                                     [(ngModel)]="selectedMemberIds">
                            <ng-template ng-optgroup-tmp let-item="item">
                              <span class="group-header">{{ item.name }} members </span>
                              <span class="ml-1 badge badge-secondary badge-group"> {{ item.total }} </span>
                            </ng-template>
                          </ng-select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </tab>
          <tab heading="Sender, Replies & Sign-off">
            <div class="img-thumbnail thumbnail-admin-edit">
              <app-sender-replies-and-sign-off [mailMessagingConfig]="mailMessagingConfig"
                                               [notificationConfig]="notificationConfig"/>
            </div>
          </tab>
        </tabset>
        <div class="form-group">
          <div *ngIf="notifyTarget.showAlert" class="alert {{notifyTarget.alertClass}}">
            <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
            <strong *ngIf="notifyTarget.alertTitle">
              {{ notifyTarget.alertTitle }}: </strong> {{ notifyTarget.alertMessage }}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <input type="submit" [disabled]="notifyTarget.busy || sendEmailsDisabled()"
             value="Send {{notificationConfig?.subject?.text}} email"
             (click)="sendEmails()"
             title="Send {{notificationConfig?.subject?.text}} email to the {{stringUtils.pluraliseWithCount(selectedMemberIds.length,'member')}}"
             [ngClass]="notifyTarget.busy || sendEmailsDisabled()? 'disabled-button-form button-form-left': 'button-form button-form-left'">
      <input type="submit" [disabled]="notifyTarget.busy" value="Cancel"
             (click)="cancelSendEmails()" title="Close this dialog"
             [ngClass]="notifyTarget.busy ? 'disabled-button-form button-form-left': 'button-form button-form-left'">
    </div>
    <div class="d-none">
      <ng-template app-notification-directive/>
    </div>`
})

export class SendEmailsModalComponent implements OnInit, OnDestroy {

  constructor(protected mailMessagingService: MailMessagingService,
              private mailService: MailService,
              private notifierService: NotifierService,
              protected stringUtils: StringUtilsService,
              private memberService: MemberService,
              private memberBulkDeleteService: MemberBulkDeleteService,
              private memberBulkLoadAuditService: MemberBulkLoadAuditService,
              protected memberLoginService: MemberLoginService,
              private fullNameWithAliasPipe: FullNameWithAliasPipe,
              private systemConfigService: SystemConfigService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SendEmailsModalComponent", NgxLoggerLevel.OFF);
  }

  private latestMemberBulkLoadAudit: MemberBulkLoadAudit;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  members: Member[] = [];
  public selectableMembers: MemberFilterSelection[] = [];
  public selectedMemberIds: string[] = [];
  currentMemberSelection: MemberSelection = MemberSelection.RECENTLY_ADDED;
  memberFilterDate: DateValue;
  public notificationConfigs: NotificationConfig[] = [];
  public mailMessagingConfig: MailMessagingConfig;
  private group: Organisation;
  private subscriptions: Subscription[] = [];
  public notificationConfig: NotificationConfig;
  public notificationConfigListing: NotificationConfigListing;
  protected readonly MemberSelection = MemberSelection;
  protected readonly first = first;

  ngOnInit() {
    this.logger.info("constructed with", this.stringUtils.pluraliseWithCount(this.members.length, "member"));
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.memberFilterDate = this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().valueOf());
    this.mailMessagingService.events().subscribe((mailMessagingConfig: MailMessagingConfig) => {
      this.logger.info("mailMessagingConfig:", mailMessagingConfig);
      this.mailMessagingConfig = mailMessagingConfig;
      this.notificationConfigListing = {
        includeWorkflowRelatedConfigs: false,
        excludeMemberSelections: [MemberSelection.MAILING_LIST],
        mailMessagingConfig
      };
      this.notificationConfigs = this.mailMessagingService.notificationConfigs(this.notificationConfigListing);
      this.notificationConfig = this.notificationConfigs[0];
      this.logger.info("emailConfigs:", this.notificationConfigs, "selecting first one:", this.notificationConfig);
      this.populateMembersBasedOn(this.notificationConfig?.defaultMemberSelection);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  performWorkflowAction(action: WorkflowAction[]) {
    if (!action) {
      return Promise.resolve();
    } else if (action.includes(WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID)) {
      return this.addPasswordResetIdToMembers();
    } else if (action.includes(WorkflowAction.DISABLE_GROUP_MEMBER)) {
      return this.removeExpiredMembersFromGroup();
    } else if (action.includes(WorkflowAction.BULK_DELETE_GROUP_MEMBER)) {
      return this.deleteMembersFromGroup();
    }
  }

  populateMembersBasedOn(memberSelection: MemberSelection) {
    if (memberSelection) {
      this.currentMemberSelection = memberSelection;
    } else {
      this.notify.warning({
        title: "Member selection",
        message: `No member selection has been setup for ${this.notificationConfig.subject} - this can be done in the mail settings`
      });
    }
    this.logger.info("populateMembers:memberSelectorName:", this.currentMemberSelection, "memberSelection:", memberSelection);
    this.calculateMemberFilterDate();
    this.populateSelectedMembers();
    this.notify.clearBusy();
  }

  selectClick(select: NgSelectComponent) {
    this.logger.debug("selectClick:select.isOpen", select.isOpen);
  }

  onChange(event?: any) {
    this.notify.warning({
      title: "Member selection",
      message: `${this.selectedMemberIds.length} members manually selected`
    });
  }

  groupBy(member: MemberFilterSelection) {
    return member.memberGrouping;
  }

  groupValue(_: string, children: any[]) {
    return ({name: children[0].memberGrouping, total: children.length});
  }

  emailConfigChanged(notificationConfig: NotificationConfig) {
    this.notificationConfig = notificationConfig;
    this.populateMembersBasedOn(notificationConfig.defaultMemberSelection);
  }

  memberSelectorNamed(suppliedMemberSelection: MemberSelection): MemberSelector {
    const memberSelection = suppliedMemberSelection === KEY_NULL_VALUE_NONE.value || !suppliedMemberSelection ? MemberSelection.RECENTLY_ADDED : suppliedMemberSelection;
    const memberSelector = this.memberSelectors().find(memberSelector => memberSelector.name === memberSelection);
    this.logger.info("memberSelectorNamed:suppliedMemberSelection:", suppliedMemberSelection, "used memberSelection:", memberSelection, "MemberSelector:", memberSelector);
    return memberSelector;
  }

  memberSelectors(): MemberSelector[] {
    return [
      {
        name: MemberSelection.RECENTLY_ADDED,
        memberMapper: (member) => this.renderCreatedInformation(member),
        memberFilter: (member) => this.recentlyAddedMembers(member)
      },
      {
        name: MemberSelection.EXPIRED_MEMBERS,
        memberMapper: (member) => this.renderExpiryInformation(member),
        memberFilter: (member) => this.expiredMembers(member)
      },
      {
        name: MemberSelection.MISSING_FROM_BULK_LOAD_MEMBERS,
        memberMapper: (member) => this.renderExpiryInformation(member),
        memberFilter: (member) => this.missingFromBulkLoad(member)
      }];
  }

  passwordResetCaption() {
    return `About to send a ${this.notificationConfig.subject.text} to ${this.selectedMemberIds.length} member${this.selectedMemberIds.length === 1 ? "" : "s"}`;
  }

  cancel() {
    this.logger.info("hiding modal");
    this.bsModalRef.hide();
  }

  populateSelectedMembers(): void {
    const memberSelector: MemberSelector = this.memberSelectorNamed(this.currentMemberSelection);
    this.selectableMembers = this.members
      .map(member => memberSelector.memberMapper(member));
    this.selectedMemberIds = this.selectableMembers
      .filter(member => memberSelector.memberFilter(member.member))
      .map(member => member.member.id);
    this.logger.debug("populateSelectableMembers:based on", this.currentMemberSelection, "filtered", this.members.length, "members -> ", this.selectableMembers.length, "email enabled members ->", this.selectedMemberIds.length, "selected members");
    this.notify.warning({
      title: "Member selection",
      message: `${this.stringUtils.pluraliseWithCount(this.selectedMemberIds.length, "member")} ${this.stringUtils.pluralise(this.selectedMemberIds.length, "was", "were")} added to the selection based on ${this.stringUtils.asTitle(memberSelector.name)}`
    });
  }

  calculateMemberFilterDate() {
    const dateFilter = this.dateUtils.momentNowNoTime().subtract(this.notificationConfig.monthsInPast, "months");
    this.memberFilterDate = this.dateUtils.asDateValue(dateFilter);
    this.logger.info("calculateMemberFilterDate:for this.emailConfig:", this.notificationConfig, "memberFilterDate:", this.memberFilterDate);
  }

  clearSelectedMembers() {
    this.selectedMemberIds = [];
    this.notify.warning({
      title: "Member selection",
      message: "current member selection was cleared"
    });
  }

  renderExpiryInformation(member: Member): MemberFilterSelection {
    const today = this.dateUtils.momentNowNoTime().valueOf();
    const expiredActive = member.membershipExpiryDate < today ? "expired" : "active";
    const memberGrouping = this.memberBulkLoadAuditService.receivedInBulkLoad(member, true, this.latestMemberBulkLoadAudit) ? expiredActive : "missing from last bulk load";
    const datePrefix = memberGrouping === "expired" ? ": " : ", " + (member.membershipExpiryDate < today ? "expired" : "expiry") + ": ";
    const memberInformation = `${this.fullNameWithAliasPipe.transform(member)} (${memberGrouping}${datePrefix}${this.dateUtils.displayDate(member.membershipExpiryDate) || "not known"})`;
    return {id: member.id, member, memberInformation, memberGrouping};
  }

  renderCreatedInformation(member: Member): MemberFilterSelection {
    const memberGrouping = member.membershipExpiryDate < this.dateUtils.momentNowNoTime().valueOf() ? "expired" : "active";
    const memberInformation = `${this.fullNameWithAliasPipe.transform(member)} (created ${this.dateUtils.displayDate(member.createdDate) || "not known"})`;
    return {id: member.id, member, memberInformation, memberGrouping};
  }

  memberGrouping(member: MemberFilterSelection) {
    return member.memberGrouping;
  }

  onMemberFilterDateChange(dateValue: DateValue) {
    this.memberFilterDate = dateValue;
    this.logger.debug("this.memberFilterDate", this.memberFilterDate);
    this.populateSelectedMembers();
  }

  recentlyAddedMembers(member: Member): boolean {
    const selected = !!(member.groupMember && (member.createdDate >= this.memberFilterDate.value));
    this.logger.off("populateMembersBasedOnFilter:selected", selected, "member:", member);
    return selected;
  }

  expiredMembers(member: Member): boolean {
    const expirationExceeded = member.membershipExpiryDate < this.memberFilterDate.value;
    this.logger.off("populateMembersBasedOnFilter:expirationExceeded", expirationExceeded, member);
    return member.groupMember && member.membershipExpiryDate && expirationExceeded;
  }

  missingFromBulkLoad(member: Member): boolean {
    return member.groupMember && member.membershipExpiryDate && this.memberBulkLoadAuditService.receivedInBulkLoad(member, false, this.latestMemberBulkLoadAudit);
  }

  selectedMembersWithEmails() {
    return this.selectedMemberIds.map(memberId => this.members.find(member => member.id === memberId))
      .filter(member => member && member.email);
  }

  addPasswordResetIdToMembers() {
    const saveMemberPromises = [];
    map(this.selectedMembersWithEmails(), member => {
      this.memberService.setPasswordResetId(member);
      saveMemberPromises.push(this.memberService.createOrUpdate(member));
    });
    return Promise.all(saveMemberPromises).then(() => this.notifySuccess(`Password reset prepared for ${saveMemberPromises.length} member(s)`));

  }

  removeExpiredMembersFromGroup() {
    this.logger.info("removing ", this.selectedMemberIds.length, "members from group");
    const saveMemberPromises = [];

    this.selectedMemberIds
      .map(memberId => this.members.find(member => member.id === memberId))
      .filter(member => {
        this.logger.debug("in memberIds:", this.selectedMemberIds, "member exists:", member);
        return !!member;
      })
      .forEach(member => {
        member.groupMember = false;
        saveMemberPromises.push(this.memberService.createOrUpdate(member));
      });

    return Promise.all(saveMemberPromises)
      .then(() => this.notifySuccess(`${this.stringUtils.pluraliseWithCount(saveMemberPromises.length, "member")} are no longer ${this?.group?.shortName}, but still exist in the database. To remove permanently, choose the Member Delete function`));
  }

  deleteMembersFromGroup() {
    this.logger.info("deleting", this.selectedMemberIds.length, "members from group");
    this.notifySuccess(`Deleting ${this.stringUtils.pluraliseWithCount(this.selectedMemberIds.length, "member")} from ${this?.group?.shortName}`);
    this.memberBulkDeleteService.performBulkDelete(this.members, this.selectedMemberIds)
      .then(() => this.notifySuccess(`${this.stringUtils.pluraliseWithCount(this.selectedMemberIds.length, "member")} have been deleted from ${this?.group?.shortName}`));
  }

  cancelSendEmails() {
    this.cancel();
  }

  sendEmailsDisabled() {
    return this.selectedMemberIds.length === 0;
  }

  sendEmails() {
    this.notify.setBusy();
    Promise.resolve(this.notifySuccess(`Preparing to email ${this.stringUtils.pluraliseWithCount(this.selectedMemberIds.length, "member")}`))
      .then(() => this.performWorkflowAction(this.notificationConfig.preSendActions))
      .then(() => this.sendEmailsToMembers())
      .then(() => this.performWorkflowAction(this.notificationConfig.postSendActions))
      .then(() => this.resetSendFlags())
      .catch((error) => this.handleSendError(error));
  }

  resetSendFlags() {
    this.logger.debug("resetSendFlags");
    this.notify.clearBusy();
  }


  sendEmailsToMembers() {
    const members = `${this.stringUtils.pluraliseWithCount(this.selectedMemberIds.length, "member")}`;
    Promise.all(this.selectableMembers
      .filter(item => this.selectedMemberIds.includes(item.id))
      .map(member => {
        return this.mailMessagingService.createEmailRequest({
          member: member.member,
          notificationConfig: this.notificationConfig,
          notificationDirective: this.notificationDirective
        });
      })
      .map(emailRequest => this.mailService.sendTransactionalMessage(emailRequest)))
      .then((response) => {
        this.logger.info("response:", response);
        this.notifySuccess(`Sending of ${this.notificationConfig.subject.text} to ${members} was successful`);
      })
      .then(() => this.notify.clearBusy())
      .catch((error) => this.handleSendError(error));
  }

  handleSendError(errorResponse: any) {
    this.logger.error("handleSendError:", errorResponse);
    this.notify.clearBusy();
    this.notify.error({
      title: "Your notification could not be sent",
      message: `${errorResponse.message || errorResponse}${errorResponse.error ? (`. Error was: ${this.stringUtils.stringify(errorResponse.error)}`) : ""}`,
    });
    this.notify.clearBusy();
  }

  private notifySuccess(message: string) {
    this.notify.success({title: "Send emails", message});
  }

  actionFor(workflowActions: WorkflowAction[]): string {
    return workflowActions?.map(item => this.stringUtils.asTitle(item)).join(", ") || "(none)";
  }

  memberSelectionFor(selectedNotificationConfig: NotificationConfig) {
    return selectedNotificationConfig.monthsInPast > 0 ? `${this.stringUtils.asTitle(selectedNotificationConfig.defaultMemberSelection)} in the last ${this.stringUtils.pluraliseWithCount(selectedNotificationConfig.monthsInPast, "month")}` : this.stringUtils.asTitle(selectedNotificationConfig.defaultMemberSelection);
  }
}
