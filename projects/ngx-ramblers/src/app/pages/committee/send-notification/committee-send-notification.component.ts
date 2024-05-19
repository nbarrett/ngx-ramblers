import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import {
  CommitteeFile,
  CommitteeMember,
  CommitteeRolesChangeEvent,
  GroupEvent,
  Notification
} from "../../../models/committee.model";
import { DateValue } from "../../../models/date.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { SystemConfig } from "../../../models/system.model";
import { ConfirmType } from "../../../models/ui-actions";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { sortBy } from "../../../services/arrays";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeDisplayService } from "../committee-display.service";
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { MailLinkService } from "../../../services/mail/mail-link.service";
import {
  CreateCampaignRequest,
  MailMessagingConfig,
  MemberSelection,
  NotificationConfig,
  NotificationConfigListing,
  StatusMappedResponseSingleInput
} from "../../../models/mail.model";
import { MailService } from "../../../services/mail/mail.service";
import { MailListUpdaterService } from "../../../services/mail/mail-list-updater.service";
import { NotificationDirective } from "../../../notifications/common/notification.directive";
import { KeyValue } from "../../../services/enums";
import { MemberLoginService } from "../../../services/member/member-login.service";

const SORT_BY_NAME = sortBy("order", "member.lastName", "member.firstName");

@Component({
  selector: "app-committee-send-notification",
  templateUrl: "./committee-send-notification.component.html",
  styleUrls: ["./committee-send-notification.component.sass"]
})
export class CommitteeSendNotificationComponent implements OnInit, OnDestroy {
  @ViewChild("notificationContent") notificationContent: ElementRef;
  @ViewChild(NotificationDirective) notificationDirective: NotificationDirective;
  public segmentEditingSupported = false;
  public committeeFile: CommitteeFile;
  public members: Member[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  public roles: { replyTo: any[]; signoff: CommitteeMember[] };
  public selectableRecipients: MemberFilterSelection[];
  public mailMessagingConfig: MailMessagingConfig;
  public committeeEventId: string;
  public systemConfig: SystemConfig;
  public pageTitle: string;
  public notificationConfigListing: NotificationConfigListing;

  constructor(
    private route: ActivatedRoute,
    private pageService: PageService,
    private memberLoginService: MemberLoginService,
    private committeeQueryService: CommitteeQueryService,
    private mailService: MailService,
    protected mailMessagingService: MailMessagingService,
    private notifierService: NotifierService,
    public display: CommitteeDisplayService,
    public stringUtils: StringUtilsService,
    public googleMapsService: GoogleMapsService,
    private memberService: MemberService,
    private fullNameWithAlias: FullNameWithAliasPipe,
    public mailLinkService: MailLinkService,
    private mailListUpdaterService: MailListUpdaterService,
    private systemConfigService: SystemConfigService,
    private urlService: UrlService,
    protected dateUtils: DateUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeSendNotificationComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit with", this.members.length, "members");
    this.display.confirm.as(ConfirmType.SEND_NOTIFICATION);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget, NgxLoggerLevel.OFF);
    this.notify.setBusy();
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.mailMessagingService.events().subscribe(mailMessagingConfig => {
      this.mailMessagingConfig = mailMessagingConfig;
      this.notificationConfigListing = {mailMessagingConfig, includeMemberSelections: [MemberSelection.MAILING_LIST]};
      this.generateNotificationDefaults("mailMessagingService");
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => this.systemConfig = systemConfig));
    this.subscriptions.push(this.display.configEvents().subscribe(() => {
      this.roles = {signoff: this.display.committeeReferenceData.committeeMembers(), replyTo: []};
      this.generateNotificationDefaults("committeeReferenceData");
      this.logger.info("initialised on open: committeeFile", this.committeeFile, ", roles", this.roles);
      this.logger.info("initialised on open: notification ->", this.notification);
      this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
        this.committeeEventId = paramMap.get("committee-event-id");
        this.logger.info("initialised with committee-event-id:", this.committeeEventId);
        if (this.committeeEventId) {
          this.committeeQueryService.queryFiles(this.committeeEventId)
            .then(() => {
              this.logger.info("this.committeeQueryService.committeeFiles:", this.committeeQueryService.committeeFiles);
              if (this.committeeQueryService.committeeFiles?.length > 0) {
                const committeeFile = this.committeeQueryService.committeeFiles[0];
                this.committeeFile = committeeFile;
                this.logger.info("committeeFile:", committeeFile);
                this.pageService.setTitle(committeeFile.fileType);
                this.pageTitle = committeeFile.fileType;
                this.generateNotificationDefaults("committeeQueryService.queryFiles");
              }
            });
        }
      }));
    }));
  }

  private initialiseMembersAndGroupEvents() {
    return Promise.all([
      this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS).then(members => {
        this.members = members;
        this.logger.info("refreshMembers -> populated ->", this.members.length, "members");
        this.selectableRecipients = members
          .map(member => this.toMemberFilterSelection(member))
          .sort(SORT_BY_NAME);
        this.logger.info("refreshMembers -> populated ->", this.selectableRecipients.length, "selectableRecipients:", this.selectableRecipients);
      }),
      this.committeeFile ? Promise.resolve() : this.populateGroupEvents()
    ]).then((tasksCompleted) => {
      this.logger.info("performed total of", tasksCompleted.length, "preparatory steps");
      this.notify.clearBusy();
    }).catch(error => {
      this.logger.error("Error caught:", error);
      this.notify.error({title: "Failed to initialise message sending", message: error});
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private generateNotificationDefaults(reason: string) {
    const ready = !!(this.mailMessagingConfig && this.display.committeeReferenceData);
    this.logger.info("generateNotificationDefaults due to:", reason, "ready:", ready);
    if (ready) {
      const notificationConfig = this.mailMessagingService.notificationConfigs(this.notificationConfigListing)?.[0];
      this.notification = {
        cancelled: false,
        content: {
          notificationConfig,
          text: {value: "", include: true},
          signoffText: {
            value: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,",
            include: true
          },
          includeDownloadInformation: !!this.committeeFile,
          destinationType: "send-to-general",
          addresseeType: "Hi {{contact.FIRSTNAME}},",
          selectedMemberIds: [],
          signoffAs: {
            include: true,
            value: this.display.committeeReferenceData.loggedOnRole()?.type || "secretary"
          },
          title: {value: "Committee Notification", include: true}
        },
        groupEvents: [],
        groupEventsFilter: {
          search: null,
          selectAll: true,
          fromDate: this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().valueOf()),
          toDate: this.dateUtils.asDateValue(this.dateUtils.momentNowNoTime().add(2, "weeks").valueOf()),
          includeContact: true,
          includeDescription: true,
          includeLocation: true,
          includeWalks: true,
          includeSocialEvents: true,
          includeCommitteeEvents: true
        },
      };
      this.logger.info("generateNotificationDefaults:notification:", this.notification);
      this.emailConfigChanged(notificationConfig);
      if (this.committeeFile) {
        this.notification.content.title.value = this.committeeFile.fileType;
        this.notification.content.text.value = `This is just a quick note to let you know in case you are interested, that I've uploaded a new file to the ${this?.systemConfig?.group?.shortName} website. The file information is as follows:`;
      }
      this.initialiseMembersAndGroupEvents().then(() => this.clearRecipientsForCampaignOfType("general"));
    }
  }

  populateGroupEvents(): Promise<GroupEvent[]> {
    return this.committeeQueryService.groupEvents(this.notification?.groupEventsFilter)
      .then(events => {
        this.notification.groupEvents = events;
        this.logger.info("groupEvents", events);
        return events;
      });
  }

  changeGroupEventSelection(groupEvent) {
    groupEvent.selected = !groupEvent.selected;
  }

  subscribedToCampaignEmails(): MemberFilterSelection[] {
    return this.members
      .filter(this.memberService.filterFor.GENERAL_MEMBERS_SUBSCRIBED)
      .map(member => this.toMemberFilterSelection(member))
      .sort(SORT_BY_NAME);
  }

  allSocialSubscribedList(): MemberFilterSelection[] {
    return this.members
      .filter(member => this.memberService.filterFor.SOCIAL_MEMBERS_SUBSCRIBED(member))
      .map(member => this.toSelectSocialMember(member))
      .sort(SORT_BY_NAME);
  }

  allCommitteeList(): MemberFilterSelection[] {
    return this.members
      .filter(member => this.memberService.filterFor.COMMITTEE_MEMBERS(member))
      .map(member => this.toMemberFilterSelection(member))
      .sort(SORT_BY_NAME);
  }

  notReady() {
    return this.stringUtils.arrayFromDelimitedData(this.notification?.content?.signoffAs?.value)?.length === 0 || this.members.length === 0 || this.notifyTarget.busy || (this.notification.content.selectedMemberIds.length === 0 && this.notification.content.destinationType === "custom");
  }

  toMemberFilterSelection(member: Member): MemberFilterSelection {
    let memberGrouping;
    let order;
    if (member.groupMember && this.subscribedToCampaigns(member)) {
      memberGrouping = "Subscribed to general emails";
      order = 0;
    } else if (member.groupMember && !this.subscribedToCampaigns(member)) {
      memberGrouping = "Not subscribed to general emails";
      order = 1;
    } else if (!member.groupMember) {
      memberGrouping = "Not a group member";
      order = 2;
    } else {
      memberGrouping = "Unexpected state";
      order = 3;
    }
    return {
      id: member.id,
      order,
      memberGrouping,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
    };
  }

  toSelectSocialMember(member: Member): MemberFilterSelection {
    let memberGrouping;
    let order;
    if (member.groupMember && this.subscribedToSocial(member)) {
      memberGrouping = "Subscribed to social emails";
      order = 0;
    } else if (member.groupMember && !this.subscribedToSocial(member)) {
      memberGrouping = "Not subscribed to social emails";
      order = 1;
    } else if (!member.groupMember) {
      memberGrouping = "Not a group member";
      order = 2;
    } else {
      memberGrouping = "Unexpected state";
      order = 3;
    }
    return {
      id: member.id,
      order,
      memberGrouping,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
    };
  }

  private showSelectedMemberIds() {
    this.onChange();
    this.logger.info("notification.content.destinationType", this.notification.content.destinationType, "notification.content.addresseeType", this.notification.content.addresseeType);
  }

  editAllGroupRecipients() {
    if (this.segmentEditingSupported) {
      this.notification.content.destinationType = "custom";
      this.notification.content.list = "general";
      this.notification.content.selectedMemberIds = this.subscribedToCampaignEmails().map(item => this.memberService.toIdString(item));
      this.showSelectedMemberIds();
    }
  }

  editAllSocialRecipients() {
    if (this.segmentEditingSupported) {
      this.logger.info("editAllSocialRecipients");
      this.notification.content.destinationType = "custom";
      this.notification.content.list = "socialEvents";
      this.notification.content.selectedMemberIds = this.allSocialSubscribedList().map(item => this.memberService.toIdString(item));
      this.showSelectedMemberIds();
    }
  }

  editCommitteeRecipients() {
    if (this.segmentEditingSupported) {
      this.logger.info("editCommitteeRecipients");
      this.notification.content.destinationType = "custom";
      this.notification.content.list = "general";
      this.notification.content.selectedMemberIds = this.allCommitteeList().map(item => this.memberService.toIdString(item));
      this.showSelectedMemberIds();
    }
  }

  clearRecipientsForCampaignOfType(campaignType?: string) {
    this.logger.info("clearRecipientsForCampaignOfType:", campaignType);
    this.notification.content.customCampaignType = campaignType;
    this.notification.content.list = "general";
    this.notification.content.selectedMemberIds = [];
    this.showSelectedMemberIds();
  }

  handleNotificationError(errorResponse) {
    this.notify.clearBusy();
    this.notify.error({
      title: "Your notification could not be sent",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
  }

  async createThenEditOrSendEmailCampaign(bodyContent: string, campaignName: string, createAsDraft: boolean) {
    this.notify.progress(createAsDraft ? (`Preparing to complete ${campaignName} in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`) : ("Sending " + campaignName));
    const lists: KeyValue<number>[] = this.mailListUpdaterService.mapToKeyValues(this.mailMessagingConfig.mailConfig.lists);
    const roles: string[] = this.stringUtils.arrayFromDelimitedData(this.notification.content.signoffAs.value);
    this.logger.info("roles", roles);
    const role = roles[0];
    const senderEmail = this.display.committeeReferenceData.contactUsField(role, "email");
    const member: Member = await this.memberService.getById(this.memberLoginService.loggedInMember().memberId);
    const createCampaignRequest: CreateCampaignRequest = {
      createAsDraft,
      templateId: this.notification.content.notificationConfig.templateId,
      htmlContent: bodyContent,
      inlineImageActivation: false,
      mirrorActive: false,
      name: campaignName,
      params: this.mailMessagingService.createSendSmtpEmailParams(roles, this.notificationDirective, member, this.notification.content.notificationConfig, bodyContent, this.notification?.content.signoffAs.include, this.notification.content.title.value, this.notification.content.addresseeType),
      recipients: {listIds: lists.map(list => list.value)},
      replyTo: senderEmail,
      sender: {
        email: senderEmail,
        name: this.display.committeeReferenceData.contactUsField(role, "fullName")
      },
      subject: campaignName
    };
    this.logger.info("sendEmailCampaign:notification:", this.notification);
    this.logger.info("sendEmailCampaign:createCampaignRequest:", createCampaignRequest);
    if (lists.length > 0) {
      this.logger.info("about to replicateAndSendWithOptions to lists", lists, "with campaignName:", campaignName, "createAsDraft:", createAsDraft);
      const createCampaignResponse: StatusMappedResponseSingleInput = await this.mailService.createCampaign(createCampaignRequest);
      const campaignId: number = createCampaignResponse?.responseBody?.id;
      this.logger.info("sendEmailCampaign:createCampaignResponse:", createCampaignResponse, "createAsDraft:", createAsDraft, "campaignId:", campaignId);
      if (createAsDraft) {
        window.open(`${this.mailLinkService.campaignEditRichText(campaignId)}`, "_blank");
      } else {
        const sendCampaignResponse: StatusMappedResponseSingleInput = await this.mailService.sendCampaign({campaignId});
        this.logger.info("sendCampaignResponse:", sendCampaignResponse);
      }
      this.notifyEmailSendComplete(campaignName, createAsDraft);
    } else {
      this.notify.error({
        title: "Send Committee notification",
        message: `${this.creationOrSending(createAsDraft)} of ${campaignName} was not successful as no lists were found to send to`
      });
    }
  }

  notifyEmailSendComplete(campaignName: string, dontSend: boolean) {
    this.notify.clearBusy();
    if (!this.notification.cancelled) {
      this.notify.success({
        title: "Send Committee notification",
        message: `${this.creationOrSending(dontSend)} of ${campaignName} was successful`
      });
      this.display.confirm.clear();
    }
  }

  creationOrSending(dontSend: boolean): string {
    return dontSend ? "Creation" : "Sending";
  }

  runCampaignCreationAndSendWorkflow(createAsDraft?: boolean) {
    const campaignName = this.notification.content.title.value;
    this.logger.info("campaignName", campaignName);
    this.notify.setBusy();
    return Promise.resolve(this.generateNotificationHTML())
      .then(bodyContent => this.createThenEditOrSendEmailCampaign(bodyContent, campaignName, createAsDraft))
      .catch((error) => this.handleNotificationError(error));
  }

  generateNotificationHTML(): string {
    const bodyContent = this.notificationContent?.nativeElement?.innerHTML;
    this.logger.info("this.generateNotificationHTML bodyContent ->", bodyContent);
    return bodyContent;
  }

  completeInMailSystem() {
    this.notify.warning({
      title: `Complete in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`,
      message: `You can close this dialog now as the message was presumably completed and sent in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)}`
    });
    this.runCampaignCreationAndSendWorkflow(true);
  }

  backToCommittee() {
    if (this.notifyTarget.busy) {
      this.notification.cancelled = true;
      this.notify.error({
        title: "Cancelling during send",
        message: `Because notification sending was already in progress when you cancelled, campaign may have already been sent - check in ${this.stringUtils.asTitle(this.systemConfig?.mailDefaults?.mailProvider)} if in doubt.`
      });
    } else {
      this.logger.info("calling cancelSendNotification");
      this.display.confirm.clear();
      this.urlService.navigateTo(["committee"]);
    }
  }

  onFromDateChange(dateValue: DateValue) {
    this.notification.groupEventsFilter.fromDate = dateValue;
    this.populateGroupEvents();
  }

  onToDateChange(dateValue: DateValue) {
    this.notification.groupEventsFilter.toDate = dateValue;
    this.populateGroupEvents();
  }

  helpMembers() {
    return `Click below and select`;
  }

  onChange() {
    if (this.notification.content.selectedMemberIds.length > 0) {
      this.notify.warning({
        title: "Member selection",
        message: `${this.notification.content.selectedMemberIds.length} members manually selected`
      });
    } else {
      this.notify.hide();
    }
  }

  groupBy(member: MemberFilterSelection) {
    return member.memberGrouping;
  }

  groupValue(_: string, children: any[]) {
    return ({name: children[0].memberGrouping, total: children.length});
  }

  selectAllGroupEvents() {
    this.notification.groupEventsFilter.selectAll = !this.notification.groupEventsFilter.selectAll;
    this.logger.info("select all=", this.notification.groupEventsFilter.selectAll);
    this.notification.groupEvents.forEach(event => event.selected = this.notification.groupEventsFilter.selectAll);
  }

  idForIndex(index) {
    const id = "select-" + index;
    this.logger.off("id:", id);
    return id;
  }

  toggleEvent(groupEvent: GroupEvent) {
    this.logger.info("toggleEvent:", groupEvent);
    groupEvent.selected = !groupEvent.selected;
  }

  selectedCount() {
    return this.notification.groupEvents.filter(item => item.selected).length;
  }

  setSignOffValue(rolesChangeEvent: CommitteeRolesChangeEvent) {
    this.notification.content.signoffAs.value = rolesChangeEvent.roles.join(",");
    this.logger.info("rolesChangeEvent:", rolesChangeEvent, "this.notification.content.signoffAs.value:", this.notification.content.signoffAs.value);
  }

  private subscribedToCampaigns(member: Member): boolean {
    return this.mailListUpdaterService.memberSubscribed(member);
  }

  private subscribedToSocial(member: Member) {
    return member.socialMember && this.mailListUpdaterService.memberSubscribed(member);
  }

  emailConfigChanged(notificationConfig: NotificationConfig) {
    this.notification.content.title.value = notificationConfig.subject.text;
  }
}
