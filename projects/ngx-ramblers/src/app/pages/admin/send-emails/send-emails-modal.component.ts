import { Component, inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { faQuestion } from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import map from "lodash-es/map";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DateValue } from "../../../models/date.model";
import { HelpInfo, Member, MemberEmailConfig, MemberFilterSelection } from "../../../models/member.model";
import { Organisation } from "../../../models/system.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailMessagingConfig, MemberSelection, MemberSelector, WorkflowAction } from "../../../models/mail.model";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { MailService } from "../../../services/mail/mail.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { CommitteeRolesChangeEvent } from "../../../models/committee.model";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import first from "lodash-es/first";
import { BannerConfig } from "../../../models/banner-configuration.model";

@Component({
  selector: "app-member-admin-send-emails-modal",
  templateUrl: "./send-emails-modal.component.html",
  styleUrls: ["./send-emails-modal.component.sass"]
})

export class SendEmailsModalComponent implements OnInit, OnDestroy {

  constructor(protected mailMessagingService: MailMessagingService,
              private mailService: MailService,
              private notifierService: NotifierService,
              protected stringUtils: StringUtilsService,
              private memberService: MemberService,
              protected memberLoginService: MemberLoginService,
              private fullNameWithAliasPipe: FullNameWithAliasPipe,
              private systemConfigService: SystemConfigService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SendEmailsModalComponent", NgxLoggerLevel.OFF);
  }

  private mailLinkService: MailLinkService = inject(MailLinkService);
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  members: Member[] = [];
  public selectableMembers: MemberFilterSelection[] = [];
  public selectedMemberIds: string[] = [];
  currentMemberSelection: MemberSelection = MemberSelection.RECENTLY_ADDED;
  memberFilterDate: DateValue;
  public emailConfigs: MemberEmailConfig[] = [];
  public mailMessagingConfig: MailMessagingConfig;
  public helpInfo: HelpInfo = {showHelp: false, monthsInPast: 1};
  faQuestion = faQuestion;
  private group: Organisation;
  private subscriptions: Subscription[] = [];
  public emailConfig: MemberEmailConfig;

  protected readonly MemberSelection = MemberSelection;

  protected readonly first = first;

  ngOnInit() {
    this.logger.info("constructed with", this.stringUtils.pluraliseWithCount(this.members.length, "member"));
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.memberFilterDate = this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().valueOf());
    this.mailMessagingService.events().subscribe((config: MailMessagingConfig) => {
      this.logger.info("mailMessagingConfig:", config);
      this.mailMessagingConfig = config;
      this.emailConfigs = config.notificationConfigs
        .filter(item => ![config.mailConfig.forgotPasswordNotificationConfigId, config.mailConfig.walkNotificationConfigId].includes(item.id))
        .map(notificationConfig => {
          return {
            notificationConfig,
            preSend: () => notificationConfig.preSendActions.includes(WorkflowAction.GENERATE_GROUP_MEMBER_PASSWORD_RESET_ID) ? this.addPasswordResetIdToMembers() : null,
            postSend: () => notificationConfig.preSendActions.includes(WorkflowAction.DISABLE_GROUP_MEMBER) ? this.removeExpiredMembersFromGroup() : null,
          };
        });
      this.emailConfig = this.emailConfigs[0];
      this.logger.info("emailConfigs:", this.emailConfigs, "selecting first one:", this.emailConfig);
      this.populateMembers(this.emailConfig.notificationConfig.defaultMemberSelection);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  populateMembers(memberSelection: MemberSelection) {
    if (memberSelection) {
      this.currentMemberSelection = memberSelection;
    } else {
      this.notify.warning({
        title: "Member selection",
        message: `No member selection has been setup for ${this.emailConfig.notificationConfig.subject} - this can be done in the mail settings`
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

  toBannerInformation(bannerConfig: BannerConfig) {
    return `${bannerConfig.name || "Unnamed"} (${this.stringUtils.asTitle(bannerConfig.bannerType)})`;
  }

  editTemplate(templateId: number) {
    const templateUrl = this.mailLinkService.templateEdit(templateId);
    this.logger.info("editing template:", templateUrl);
    window.open(templateUrl, "_blank");
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

  emailConfigChanged(memberEmailConfig: MemberEmailConfig) {
    this.populateMembers(memberEmailConfig.notificationConfig.defaultMemberSelection);
  }

  memberSelectorNamed(name: MemberSelection): MemberSelector {
    return this.memberSelectors().find(item => item.name === name);
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
    return `About to send a ${this.emailConfig.notificationConfig.subject.text} to ${this.selectedMemberIds.length} member${this.selectedMemberIds.length === 1 ? "" : "s"}`;
  }

  helpMembers() {
    return `In the member selection field, choose the members that you want to send a ${this.emailConfig.notificationConfig.subject.text} email to. You can type in  part of their name to find them more quickly. Repeat this step as many times as required to build up a list of members`;
  }

  toggleHelp(show: boolean) {
    this.logger.debug("tooltip:", show);
    this.helpInfo.showHelp = show;
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
      message: `${this.selectedMemberIds.length} members were added to selection based on ${memberSelector.name}`
    });
  }

  calculateMemberFilterDate() {
    const dateFilter = this.dateUtils.momentNowNoTime().subtract(this.emailConfig.notificationConfig.monthsInPast, "months");
    this.memberFilterDate = this.dateUtils.asDateValue(dateFilter);
    this.logger.info("calculateMemberFilterDate:for this.emailConfig:", this.emailConfig, "memberFilterDate:", this.memberFilterDate);
  }

  clearSelectedMembers() {
    this.selectedMemberIds = [];
    this.notify.warning({
      title: "Member selection",
      message: "current member selection was cleared"
    });
  }

  renderExpiryInformation(member): MemberFilterSelection {
    const today = this.dateUtils.momentNowNoTime().valueOf();
    const expiredActive = member.membershipExpiryDate < today ? "expired" : "active";
    const memberGrouping = member.receivedInLastBulkLoad ? expiredActive : "missing from last bulk load";
    const datePrefix = memberGrouping === "expired" ? ": " : ", " + (member.membershipExpiryDate < today ? "expired" : "expiry") + ": ";
    const memberInformation = `${this.fullNameWithAliasPipe.transform(member)} (${memberGrouping}${datePrefix}${this.dateUtils.displayDate(member.membershipExpiryDate) || "not known"})`;
    return {id: member.id, member, memberInformation, memberGrouping};
  }

  renderCreatedInformation(member): MemberFilterSelection {
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
    return member.groupMember && member.membershipExpiryDate && !member.receivedInLastBulkLoad;
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
    this.logger.debug("removing ", this.selectedMemberIds.length, "members from group");
    const saveMemberPromises = [];

    this.selectedMemberIds
      .map(memberId => this.members.find(member => this.memberService.extractMemberId(member) === memberId))
      .filter(member => {
        this.logger.debug("in memberIds:", this.selectedMemberIds, "member exists:", member);
        return !!member;
      })
      .forEach(member => {
        member.groupMember = false;
        saveMemberPromises.push(this.memberService.createOrUpdate(member));
      });

    return Promise.all(saveMemberPromises)
      .then(() => this.notifySuccess(`${this?.group?.shortName} group membership has now been removed for ${saveMemberPromises.length} member(s)`));
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
      .then(() => this.invokeIfDefined(this.emailConfig.preSend))
      .then(() => this.sendEmailsToMembers())
      .then(() => this.invokeIfDefined(this.emailConfig.postSend))
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
          notificationConfig: this.emailConfig.notificationConfig,
          notificationDirective: this.notificationDirective
        });
      })
      .map(emailRequest => this.mailService.sendTransactionalMessage(emailRequest)))
      .then((response) => {
        this.logger.info("response:", response);
        this.notifySuccess(`Sending of ${this.emailConfig.notificationConfig.subject.text} to ${members} was successful`);
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

  private invokeIfDefined(possibleFunction: () => any) {
    this.logger.debug("invokeIfDefined:", possibleFunction);
    if (possibleFunction) {
      return possibleFunction();
    } else {
      return Promise.resolve();
    }
  }

  assignRolesTo(rolesChangeEvent: CommitteeRolesChangeEvent) {
    this.emailConfig.notificationConfig.signOffRoles = rolesChangeEvent.roles;
  }
}
