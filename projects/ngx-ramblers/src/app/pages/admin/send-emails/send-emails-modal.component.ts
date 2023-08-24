import { Component, OnDestroy, OnInit } from "@angular/core";
import { faQuestion } from "@fortawesome/free-solid-svg-icons";
import { NgSelectComponent } from "@ng-select/ng-select";
import map from "lodash-es/map";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DateValue } from "../../../models/date.model";
import { MailchimpCampaignSendRequest, SaveSegmentResponse } from "../../../models/mailchimp.model";
import { Member, MemberEmailType, MemberFilterSelection, MemberSelector } from "../../../models/member.model";
import { Organisation } from "../../../models/system.model";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpListSubscriptionService } from "../../../services/mailchimp/mailchimp-list-subscription.service";
import { MailchimpListService } from "../../../services/mailchimp/mailchimp-list.service";
import { MailchimpSegmentService } from "../../../services/mailchimp/mailchimp-segment.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";

@Component({
  selector: "app-member-admin-send-emails-modal",
  templateUrl: "./send-emails-modal.component.html",
  styleUrls: ["./send-emails-modal.component.sass"]
})

export class SendEmailsModalComponent implements OnInit, OnDestroy {
  tooltips: TooltipDirective[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public showHelp: false;
  members: Member[] = [];
  public selectableMembers: MemberFilterSelection[] = [];
  public selectedMemberIds: string[] = [];
  memberSelectorName = "recently-added";
  private alertTypeResetPassword: boolean;
  memberFilterDate: DateValue;
  public emailTypes: MemberEmailType[] = [];
  public emailType: MemberEmailType;
  public helpInfo: { monthsInPast: number; showHelp: boolean };
  faQuestion = faQuestion;
  private group: Organisation;
  private subscriptions: Subscription[] = [];

  constructor(private mailchimpSegmentService: MailchimpSegmentService,
              private mailchimpCampaignService: MailchimpCampaignService,
              private mailchimpConfig: MailchimpConfigService,
              private notifierService: NotifierService,
              private stringUtils: StringUtilsService,
              private memberService: MemberService,
              private fullNameWithAliasPipe: FullNameWithAliasPipe,
              private modalService: BsModalService,
              private mailchimpConfigService: MailchimpConfigService,
              private mailchimpListSubscriptionService: MailchimpListSubscriptionService,
              private mailchimpListService: MailchimpListService,
              private systemConfigService: SystemConfigService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("SendEmailsModalComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed with members", this.members.length, "members");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.memberFilterDate = this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().valueOf());
    this.mailchimpConfig.getConfig()
      .then(config => {
        this.emailTypes = [
          {
            preSend: () => this.addPasswordResetIdToMembers(),
            name: config.campaigns.welcome.name,
            monthsInPast: config.campaigns.welcome.monthsInPast,
            campaignId: config.campaigns.welcome.campaignId,
            segmentId: config.segments.general.welcomeSegmentId,
            memberSelectorName: "recently-added",
            label: `Added in last ${config.campaigns.welcome.monthsInPast} month(s)`,
            dateTooltip: `All members created in the last ${config.campaigns.welcome.monthsInPast} month are displayed as a default, as these are most likely to need a welcome email sent`
          },
          {
            preSend: () => this.addPasswordResetIdToMembers(),
            name: config.campaigns.passwordReset.name,
            monthsInPast: config.campaigns.passwordReset.monthsInPast,
            campaignId: config.campaigns.passwordReset.campaignId,
            segmentId: config.segments.general.passwordResetSegmentId,
            memberSelectorName: "recently-added",
            dateTooltip: `All members created in the last ${config.campaigns.passwordReset.monthsInPast} month are displayed as a default`
          },
          {
            preSend: () => this.includeInNextMailchimpListUpdate(),
            name: config.campaigns.expiredMembersWarning.name,
            monthsInPast: config.campaigns.expiredMembersWarning.monthsInPast,
            campaignId: config.campaigns.expiredMembersWarning.campaignId,
            segmentId: config.segments.general.expiredMembersWarningSegmentId,
            memberSelectorName: "expired-members",
            dateTooltip: `Using the expiry date field, you can choose which members will automatically be included. A date ${config.campaigns.expiredMembersWarning.monthsInPast} months in the past has been pre-selected, to avoid including members whose membership renewal is still progress`
          },
          {
            preSend: () => this.includeInNextMailchimpListUpdate(),
            name: config.campaigns.expiredMembers.name,
            monthsInPast: config.campaigns.expiredMembers.monthsInPast,
            campaignId: config.campaigns.expiredMembers.campaignId,
            segmentId: config.segments.general.expiredMembersSegmentId,
            memberSelectorName: "expired-members",
            postSend: () => this.removeExpiredMembersFromGroup(),
            dateTooltip: "Using the expiry date field, you can choose which members will automatically be included. " +
              "A date 3 months in the past has been pre-selected, to avoid including members whose membership renewal is still progress"
          }
        ];
        this.emailType = this.emailTypes[0];
        this.populateSelectedMembers();
        this.populateMembers("recently-added");
        this.helpInfo = {
          showHelp: false,
          monthsInPast: 1,
        };
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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

  emailTypeChanged(memberEmailType: MemberEmailType) {
    this.populateMembers(memberEmailType.memberSelectorName);
    this.tooltips.forEach(tooltip => tooltip.hide());
    this.helpInfo.showHelp = false;
  }

  memberSelectorNamed(name: string): MemberSelector {
    return this.memberSelectors().find(item => item.name === name);
  }

  memberSelectors(): MemberSelector[] {
    return [
      {
        name: "recently-added",
        memberMapper: (member) => this.renderCreatedInformation(member),
        memberFilter: (member) => this.recentlyAddedMembers(member)
      },
      {
        name: "expired-members",
        memberMapper: (member) => this.renderExpiryInformation(member),
        memberFilter: (member) => this.expiredMembers(member)
      },
      {
        name: "missing-from-bulk-load-members",
        memberMapper: (member) => this.renderExpiryInformation(member),
        memberFilter: (member) => this.missingFromBulkLoad(member)
      }];
  }

  passwordResetCaption() {
    return `About to send a ${this.emailType.name} to ${this.selectedMemberIds.length} member${this.selectedMemberIds.length === 1 ? "" : "s"}`;
  }

  helpMembers() {
    return `In the member selection field, choose the members that you want to send a ${this.emailType.name} email to. You can type in  part of their name to find them more quickly. Repeat this step as many times as required to build up an list of members`;
  }

  toggleHelp(show: boolean, tooltips: TooltipDirective[]) {
    this.logger.debug("tooltip:", show, "tooltips:", tooltips);
    tooltips.forEach(tooltip => show ? tooltip.show() : tooltip.hide());
    this.helpInfo.showHelp = show;
    this.tooltips = tooltips;
  }

  cancel() {
    this.bsModalRef.hide();
  }

  populateSelectedMembers(): void {
    const memberSelector = this.memberSelectorNamed(this.memberSelectorName);
    this.selectableMembers = this.members
      .filter(member => this.mailchimpListService.includeMemberInEmailList("general", member))
      .map(member => memberSelector.memberMapper(member));
    this.selectedMemberIds = this.selectableMembers
      .filter(member => memberSelector.memberFilter(member.member))
      .map(member => member.member.id);
    this.logger.debug("populateSelectableMembers:based on", this.memberSelectorName, "filtered", this.members.length, "members -> ", this.selectableMembers.length, "email enabled members ->", this.selectedMemberIds.length, "selected members");
    this.notify.warning({
      title: "Member selection",
      message: `${this.selectedMemberIds.length} members were added to selection based on ${memberSelector.name}`
    });
  }

  calculateMemberFilterDate() {
    const dateFilter = this.dateUtils.momentNowNoTime().subtract(this.helpInfo && this.emailType.monthsInPast, "months");
    this.memberFilterDate = this.dateUtils.asDateValue(dateFilter);
    this.logger.debug("calculateMemberFilterDate:", this.memberFilterDate);
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

  populateMembers(value: string) {
    this.memberSelectorName = value;
    this.logger.debug("populateMembers:memberSelectorName:", this.memberSelectorName, "value:", value);
    this.calculateMemberFilterDate();
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
      this.mailchimpListService.resetUpdateStatusForMember(member);
      saveMemberPromises.push(this.memberService.createOrUpdate(member));
    });

    return Promise.all(saveMemberPromises).then(() => this.notifySuccess(`Password reset prepared for ${saveMemberPromises.length} member(s)`));

  }

  includeInNextMailchimpListUpdate() {

    const saveMemberPromises = this.selectedMembersWithEmails().map(member => {
      this.mailchimpListService.resetUpdateStatusForMember(member);
      return this.memberService.createOrUpdate(member);
    });

    return Promise.all(saveMemberPromises).then(() => this.notifySuccess(`Member expiration prepared for ${saveMemberPromises.length} member(s)`));

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
        this.mailchimpListService.resetUpdateStatusForMember(member);
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
    this.alertTypeResetPassword = true;
    this.notify.setBusy();
    Promise.resolve(this.notifySuccess(`Preparing to email ${this.selectedMemberIds.length} member${this.selectedMemberIds.length === 1 ? "" : "s"}`))
      .then(() => this.invokeIfDefined(this.emailType.preSend))
      .then(() => this.updateGeneralList())
      .then(() => this.createOrSaveMailchimpSegment())
      .then(segmentResponse => this.saveSegmentDataToMailchimpConfig(segmentResponse))
      .then(segmentId => this.sendEmailCampaign(segmentId))
      .then(() => this.invokeIfDefined(this.emailType.postSend))
      .then(() => this.notify.clearBusy())
      .then(() => this.cancel())
      .then(() => this.resetSendFlags())
      .catch((error) => this.handleSendError(error));
  }

  resetSendFlags() {
    this.logger.debug("resetSendFlags");
    this.notify.clearBusy();
  }

  updateGeneralList() {
    return this.mailchimpListSubscriptionService.createBatchSubscriptionForList("general", this.members).then(updatedMembers => {
      this.members = updatedMembers;
    });
  }

  createOrSaveMailchimpSegment(): Promise<SaveSegmentResponse> {
    return this.mailchimpSegmentService.saveSegment("general", {segmentId: this.emailType.segmentId}, this.selectedMemberIds, this.emailType.name, this.members);
  }

  saveSegmentDataToMailchimpConfig(segmentResponse: SaveSegmentResponse) {
    this.logger.debug("saveSegmentDataToMailchimpConfig:segmentResponse", segmentResponse);
    return this.mailchimpConfig.getConfig()
      .then(config => {
        config.segments.general[`${this.emailType.name}SegmentId`] = segmentResponse.segment.id;
        return this.mailchimpConfig.saveConfig(config)
          .then(() => {
            this.logger.debug("saveSegmentDataToMailchimpConfig:returning segment id", segmentResponse.segment.id);
            return segmentResponse.segment.id;
          });
      });
  }

  sendEmailCampaign(segmentId) {
    const members = `${this.selectedMemberIds.length} member(s)`;
    this.notifySuccess(`Sending ${this.emailType.name} email to ${members}`);
    this.logger.debug("about to sendEmailCampaign:", this.emailType.name, "campaign Id", this.emailType.campaignId, "segmentId", segmentId, "campaignName", this.emailType.name);
    const campaignRequest: MailchimpCampaignSendRequest = {
      campaignId: this.emailType.campaignId,
      campaignName: this.emailType.name,
      segmentId
    };
    return this.mailchimpCampaignService.replicateAndSendWithOptions(campaignRequest).then(() => {
      this.notifySuccess(`Sending of ${this.emailType.name} to ${members} was successful`);
    });
  }

  handleSendError(errorResponse) {
    this.notify.clearBusy();
    this.notify.error({
      title: "Your notification could not be sent",
      message: `${errorResponse.message || errorResponse}${errorResponse.error ? (`. Error was: ${this.stringUtils.stringify(errorResponse.error)}`) : ""}`
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

}
