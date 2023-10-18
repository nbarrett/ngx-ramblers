import { Component, ComponentFactoryResolver, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import extend from "lodash-es/extend";
import keys from "lodash-es/keys";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { chain } from "../../../functions/chain";
import { AlertTarget } from "../../../models/alert-target.model";
import { CommitteeFile, CommitteeMember, GroupEvent, Notification } from "../../../models/committee.model";
import { DateValue } from "../../../models/date.model";
import {
  CampaignConfig,
  MailchimpCampaignListResponse,
  MailchimpCampaignReplicateIdentifiersResponse,
  MailchimpConfig,
  MailchimpGenericOtherContent,
  OtherOptions,
  SaveSegmentResponse
} from "../../../models/mailchimp.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { Organisation } from "../../../models/system.model";
import { ConfirmType } from "../../../models/ui-actions";
import {
  CommitteeNotificationComponentAndData,
  CommitteeNotificationDirective
} from "../../../notifications/committee/committee-notification.directive";
import {
  CommitteeNotificationDetailsComponent
} from "../../../notifications/committee/templates/committee-notification-details.component";
import { FullNameWithAliasPipe } from "../../../pipes/full-name-with-alias.pipe";
import { LineFeedsToBreaksPipe } from "../../../pipes/line-feeds-to-breaks.pipe";
import { sortBy } from "../../../services/arrays";
import { CommitteeQueryService } from "../../../services/committee/committee-query.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpLinkService } from "../../../services/mailchimp/mailchimp-link.service";
import { MailchimpListService } from "../../../services/mailchimp/mailchimp-list.service";
import { MailchimpSegmentService } from "../../../services/mailchimp/mailchimp-segment.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { CommitteeDisplayService } from "../committee-display.service";

const SORT_BY_NAME = sortBy("order", "member.lastName", "member.firstName");

@Component({
  selector: "app-committee-send-notification",
  templateUrl: "./committee-send-notification.component.html",
  styleUrls: ["./committee-send-notification.component.sass"]
})
export class CommitteeSendNotificationComponent implements OnInit, OnDestroy {
  @ViewChild(CommitteeNotificationDirective) notificationDirective: CommitteeNotificationDirective;
  public committeeFile: CommitteeFile;
  public members: Member[] = [];
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public notification: Notification;
  private logger: Logger;
  private subscriptions: Subscription[] = [];
  public roles: { replyTo: any[]; signoff: CommitteeMember[] };
  public selectableRecipients: MemberFilterSelection[];
  public mailchimpConfig: MailchimpConfig;
  public mailchimpCampaignListResponse: MailchimpCampaignListResponse;
  public draftMailchimpCampaignListResponse: MailchimpCampaignListResponse;
  public committeeEventId: string;
  private group: Organisation;
  public pageTitle: string;
  public draftCampaignId: string;

  constructor(
    private route: ActivatedRoute,
    private pageService: PageService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private mailchimpSegmentService: MailchimpSegmentService,
    private committeeQueryService: CommitteeQueryService,
    private mailchimpCampaignService: MailchimpCampaignService,
    private mailchimpConfigService: MailchimpConfigService,
    private notifierService: NotifierService,
    public display: CommitteeDisplayService,
    public stringUtils: StringUtilsService,
    public googleMapsService: GoogleMapsService,
    private memberService: MemberService,
    private fullNameWithAlias: FullNameWithAliasPipe,
    private lineFeedsToBreaks: LineFeedsToBreaksPipe,
    private mailchimpLinkService: MailchimpLinkService,
    private memberLoginService: MemberLoginService,
    private mailchimpListService: MailchimpListService,
    private systemConfigService: SystemConfigService,
    private urlService: UrlService,
    protected dateUtils: DateUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("CommitteeSendNotificationComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed with", this.members.length, "members");
    this.display.confirm.as(ConfirmType.SEND_NOTIFICATION);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget, NgxLoggerLevel.OFF);
    this.notify.setBusy();
    this.logger.info("subscribing to systemConfigService events");
    this.mailchimpConfigService.getConfig().then(config => this.mailchimpConfig = config);
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
    this.subscriptions.push(this.display.configEvents().subscribe(() => {
      this.roles = {signoff: this.display.committeeReferenceData.committeeMembers(), replyTo: []};
      this.generateNotification();
      this.logger.debug("initialised on open: committeeFile", this.committeeFile, ", roles", this.roles);
      this.logger.debug("initialised on open: notification ->", this.notification);
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
                this.generateNotification();
              }
            });
        }
      }));

      const masterSearchTeam = "Master";
      Promise.all([
        this.memberService.publicFields(this.memberService.filterFor.GROUP_MEMBERS).then(members => {
          this.members = members;
          this.logger.debug("refreshMembers -> populated ->", this.members.length, "members");
          this.selectableRecipients = members
            .map(member => this.toMemberFilterSelection(member))
            .sort(SORT_BY_NAME);
          this.logger.debug("refreshMembers -> populated ->", this.selectableRecipients.length, "selectableRecipients:", this.selectableRecipients);
        }),
        this.mailchimpConfigService.getConfig()
          .then(config => {
            this.mailchimpConfig = config;
            this.logger.debug("retrieved mailchimpConfig", this.mailchimpConfig);
            this.clearRecipientsForCampaignOfType("committee");
          }),
        this.mailchimpCampaignService.list({
          concise: true,
          limit: 1000,
          start: 0,
          status: "save",
          query: masterSearchTeam
        }).then((mailchimpCampaignListResponse: MailchimpCampaignListResponse) => {
          this.mailchimpCampaignListResponse = mailchimpCampaignListResponse;
          this.logger.debug("mailchimpCampaignListResponse.campaigns", mailchimpCampaignListResponse.campaigns);
        }),
        this.mailchimpCampaignService.list({
          concise: true,
          limit: 1000,
          start: 0,
          status: "save",
        }).then((mailchimpCampaignListResponse: MailchimpCampaignListResponse) => {
          this.draftMailchimpCampaignListResponse = {
            ...mailchimpCampaignListResponse,
            campaigns: mailchimpCampaignListResponse.campaigns.filter(item => !keys(this.mailchimpConfig.campaigns).map(key => this.mailchimpConfig.campaigns[key].campaignId).includes(item.id))
          };
          this.logger.debug("draftMailchimpCampaignListResponse.campaigns", mailchimpCampaignListResponse.campaigns);
        }),
        this.committeeFile ? Promise.resolve() : this.populateGroupEvents()
      ]).then((tasksCompleted) => {
        this.logger.debug("performed total of", tasksCompleted.length, "preparatory steps");
        this.notify.clearBusy();
      }).catch(error => {
        this.logger.info("Error caught:", error);
        this.notify.error({title: "Failed to initialise message sending", message: error});
      });
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  private generateNotification() {
    this.notification = {
      cancelled: false,
      content: {
        text: {value: "", include: true},
        signoffText: {value: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,", include: true},
        includeDownloadInformation: !!this.committeeFile,
        destinationType: "committee",
        addresseeType: "Hi *|FNAME|*,",
        selectedMemberIds: [],
        signoffAs: {
          include: true,
          value: this.display.committeeReferenceData.loggedOnRole()?.type || "secretary"
        },
        title: {value: "Committee Notification", include: true}
      },
      groupEvents: [],
      groupEventsFilter: {
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
    if (this.committeeFile) {
      this.notification.content.title.value = this.committeeFile.fileType;
      this.notification.content.text.value = `This is just a quick note to let you know in case you are interested, that I've uploaded a new file to the ${this?.group?.shortName} website. The file information is as follows:`;
    }
  }

  populateGroupEvents(): Promise<GroupEvent[]> {
    return this.committeeQueryService.groupEvents(this.notification.groupEventsFilter)
      .then(events => {
        this.notification.groupEvents = events;
        this.logger.debug("groupEvents", events);
        return events;
      });
  }

  changeGroupEventSelection(groupEvent) {
    groupEvent.selected = !groupEvent.selected;
  }

  allGeneralSubscribedList(): MemberFilterSelection[] {
    return this.members
      .filter(this.memberService.filterFor.GENERAL_MEMBERS_SUBSCRIBED)
      .map(member => this.toMemberFilterSelection(member))
      .sort(SORT_BY_NAME);
  }

  allWalksSubscribedList(): MemberFilterSelection[] {
    return this.members
      .filter(member => this.memberService.filterFor.WALKS_MEMBERS_SUBSCRIBED(member))
      .map(member => this.toSelectWalksMember(member))
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
    return this.members.length === 0 || this.notifyTarget.busy || (this.notification.content.selectedMemberIds.length === 0 && this.notification.content.destinationType === "custom");
  }

  toMemberFilterSelection(member: Member): MemberFilterSelection {
    let memberGrouping;
    let order;
    if (member.groupMember && member.mailchimpLists?.general?.subscribed) {
      memberGrouping = "Subscribed to general emails";
      order = 0;
    } else if (member.groupMember && !member.mailchimpLists?.general?.subscribed) {
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
      id: this.memberService.extractMemberId(member),
      order,
      memberGrouping,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
    };
  }

  toSelectWalksMember(member: Member): MemberFilterSelection {
    let memberGrouping;
    let order;
    if (member.groupMember && member.mailchimpLists?.walks?.subscribed) {
      memberGrouping = "Subscribed to walks emails";
      order = 0;
    } else if (member.groupMember && !member.mailchimpLists?.walks?.subscribed) {
      memberGrouping = "Not subscribed to walks emails";
      order = 1;
    } else if (!member.groupMember) {
      memberGrouping = "Not a group member";
      order = 2;
    } else {
      memberGrouping = "Unexpected state";
      order = 3;
    }
    return {
      id: this.memberService.extractMemberId(member),
      order,
      memberGrouping,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
    };
  }

  toSelectSocialMember(member: Member): MemberFilterSelection {
    let memberGrouping;
    let order;
    if (member.groupMember && member.mailchimpLists?.socialEvents?.subscribed) {
      memberGrouping = "Subscribed to social emails";
      order = 0;
    } else if (member.groupMember && !member.mailchimpLists?.socialEvents?.subscribed) {
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
      id: this.memberService.extractMemberId(member),
      order,
      memberGrouping,
      member,
      memberInformation: this.fullNameWithAlias.transform(member)
    };
  }

  private showSelectedMemberIds() {
    this.onChange();
    this.campaignIdChanged();
    this.logger.debug("notification.content.destinationType", this.notification.content.destinationType, "notification.content.addresseeType", this.notification.content.addresseeType);
  }

  editAllGroupRecipients() {
    this.notification.content.destinationType = "custom";
    this.notification.content.campaignId = this.campaignIdFor("general");
    this.notification.content.list = "general";
    this.notification.content.selectedMemberIds = this.allGeneralSubscribedList().map(item => this.memberService.toIdString(item));
    this.showSelectedMemberIds();

  }

  editAllWalksRecipients() {
    this.logger.debug("editAllWalksRecipients");
    this.notification.content.destinationType = "custom";
    this.notification.content.campaignId = this.campaignIdFor("walks");
    this.notification.content.list = "walks";
    this.notification.content.selectedMemberIds = this.allWalksSubscribedList().map(item => this.memberService.toIdString(item));
    this.showSelectedMemberIds();
  }

  editAllSocialRecipients() {
    this.logger.debug("editAllSocialRecipients");
    this.notification.content.destinationType = "custom";
    this.notification.content.campaignId = this.campaignIdFor("socialEvents");
    this.notification.content.list = "socialEvents";
    this.notification.content.selectedMemberIds = this.allSocialSubscribedList().map(item => this.memberService.toIdString(item));
    this.showSelectedMemberIds();
  }

  editCommitteeRecipients() {
    this.logger.debug("editCommitteeRecipients");
    this.notification.content.destinationType = "custom";
    this.notification.content.campaignId = this.campaignIdFor("committee");
    this.notification.content.list = "general";
    this.notification.content.selectedMemberIds = this.allCommitteeList().map(item => this.memberService.toIdString(item));
    this.showSelectedMemberIds();
  }

  clearRecipientsForCampaignOfType(campaignType?: string) {
    this.notification.content.customCampaignType = campaignType;
    this.notification.content.campaignId = this.campaignIdFor(campaignType);
    this.notification.content.list = "general";
    this.notification.content.selectedMemberIds = [];
    this.showSelectedMemberIds();
  }

  campaignIdFor(campaignType: string): string {
    switch (campaignType) {
      case "committee":
        return this.mailchimpConfig.campaigns?.committee?.campaignId;
      case "general":
        return this.mailchimpConfig.campaigns?.newsletter?.campaignId;
      case "socialEvents":
        return this.mailchimpConfig.campaigns?.socialEvents?.campaignId;
      case "walks":
        return this.mailchimpConfig.campaigns?.walkNotification?.campaignId;
      default:
        return this.mailchimpConfig.campaigns?.committee?.campaignId;
    }
  }

  campaignInfoForCampaign(campaignId: string): CampaignConfig {
    return chain(this.mailchimpConfig.campaigns)
      .map((data, campaignType) => {
        const campaignData = extend({campaignType}, data);
        this.logger.off("campaignData for", campaignType, "->", campaignData);
        return campaignData;
      }).find({campaignId})
      .value();
  }

  campaignIdChanged() {
    const infoForCampaign = this.campaignInfoForCampaign(this.notification.content.campaignId);
    this.logger.debug("for campaignId", this.notification.content.campaignId, "infoForCampaign", infoForCampaign);
    if (infoForCampaign) {
      this.notification.content.title.value = infoForCampaign.name;
    }
  }

  handleNotificationError(errorResponse) {
    this.notify.clearBusy();
    this.notify.error({
      title: "Your notification could not be sent",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
  }

  populateContentSections(notificationText: string): MailchimpGenericOtherContent {
    this.logger.debug("populateContentSections -> notificationText", notificationText);
    return {
      sections: {
        notification_text: notificationText
      }
    };
  }

  saveSegmentDataToMember(saveSegmentResponse: SaveSegmentResponse, member: Member, segmentType: string): Promise<SaveSegmentResponse> {
    this.mailchimpSegmentService.setMemberSegmentId(member, segmentType, saveSegmentResponse.segment.id);
    return this.memberService.update(member)
      .then(() => saveSegmentResponse);
  }

  sendEmailCampaign(notificationText: string, campaignName: string, dontSend: boolean) {
    const contentSections = this.populateContentSections(notificationText);
    this.notify.progress(dontSend ? ("Preparing to complete " + campaignName + " in Mailchimp") : ("Sending " + campaignName));

    const validateExistenceOf = (list: string, fieldName: string) => {
      return Promise.reject("Cannot send email from " + list + " list as there is no mailchimp " + fieldName + " configured. Check Committee Notification settings and make sure all fields are complete.");
    };
    return this.memberService.getById(this.memberLoginService.loggedInMember().memberId)
      .then(currentMember => {
        return this.mailchimpConfigService.getConfig()
          .then((config) => {
            const replyToRole = this.notification.content.signoffAs.value || "secretary";
            this.logger.debug("replyToRole", replyToRole);

            let members: MemberFilterSelection[];
            const list = this.notification.content.list;
            const otherOptions: OtherOptions = {
              from_name: this.display.committeeReferenceData.contactUsField(replyToRole, "fullName"),
              from_email: this.display.committeeReferenceData.contactUsField(replyToRole, "email"),
              list_id: config.lists[list]
            };
            this.logger.debug("Sending", campaignName, "with otherOptions", otherOptions, "config", config);
            const segmentId = this.mailchimpSegmentService.getMemberSegmentId(currentMember, list);
            const campaignId = this.notification.content?.campaignId;

            if (!campaignId) {
              return validateExistenceOf(list, "campaign id");
            }

            this.logger.debug("Sending", campaignId, "segmentId", segmentId, "for member", currentMember);

            switch (this.notification.content.destinationType) {
              case "custom":
                members = this.notification.content.selectedMemberIds.filter(item => this.notification.content.selectedMemberIds.includes(item))
                  .map(item => this.toMemberFilterSelection(this.members.find(member => member.id === item)));
                break;
              case "committee":
                members = this.allCommitteeList();
                break;
              default:
                members = [];
                break;
            }

            this.logger.debug("sendCommitteeNotification:notification->", this.notification);

            if (members.length === 0) {
              this.logger.debug("about to replicateAndSendWithOptions to", list, "list with campaignName", campaignName, "campaign Id", campaignId, "dontSend", dontSend);
              return this.mailchimpCampaignService.replicateAndSendWithOptions({
                campaignId,
                campaignName,
                contentSections,
                otherOptions,
                dontSend
              }).then((replicateCampaignResponse) => this.openInMailchimpIf(replicateCampaignResponse, dontSend));
            } else {
              const segmentPrefix = "Committee Notification Recipients";
              return this.mailchimpSegmentService.saveSegment(list, {segmentId}, members, segmentPrefix, this.members)
                .then((segmentResponse: SaveSegmentResponse) => this.saveSegmentDataToMember(segmentResponse, currentMember, list))
                .then((segmentResponse: SaveSegmentResponse) => {
                  this.logger.debug("segmentResponse following save segment of segmentPrefix:", segmentPrefix, "->", segmentResponse);
                  this.logger.debug("about to replicateAndSendWithOptions to committee with campaignName", campaignName, "campaign Id", campaignId, "segmentId", segmentResponse.segment.id);
                  return this.mailchimpCampaignService.replicateAndSendWithOptions({
                    campaignId,
                    campaignName,
                    contentSections,
                    segmentId: segmentResponse.segment.id,
                    otherOptions,
                    dontSend
                  }).then((replicateCampaignResponse) => this.openInMailchimpIf(replicateCampaignResponse, dontSend));
                });
            }
          });
      });
  }

  openInMailchimpIf(replicateCampaignResponse: MailchimpCampaignReplicateIdentifiersResponse, dontSend) {
    this.logger.debug("openInMailchimpIf:replicateCampaignResponse", replicateCampaignResponse, "dontSend", dontSend);
    if (dontSend) {
      return window.open(`${this.mailchimpLinkService.completeInMailchimp(replicateCampaignResponse.web_id)}`, "_blank");
    } else {
      return true;
    }
  }

  notifyEmailSendComplete(campaignName: string) {
    this.notify.clearBusy();
    if (!this.notification.cancelled) {
      this.notify.success("Sending of " + campaignName + " was successful.", false);
      this.display.confirm.clear();
      this.urlService.navigateTo(["committee"]);
    }
  }

  confirmSendNotification(dontSend?: boolean) {
    const campaignName = this.notification.content.title.value;
    this.logger.debug("campaignName", campaignName, "based on this.notification.content.campaignId", this.notification.content.campaignId);
    this.notify.setBusy();
    return Promise.resolve(this.generateNotificationHTML(this.notificationDirective, this.committeeFile, this.notification, this.members))
      .then(notificationText => this.sendEmailCampaign(notificationText, campaignName, dontSend))
      .then(() => this.notifyEmailSendComplete(campaignName))
      .catch((error) => this.handleNotificationError(error));
  }

  generateNotificationHTML(notificationDirective: CommitteeNotificationDirective, committeeFile: CommitteeFile, notification: Notification, members: Member[]): string {
    const componentAndData = new CommitteeNotificationComponentAndData(CommitteeNotificationDetailsComponent);
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(componentAndData.component);
    const viewContainerRef = notificationDirective.viewContainerRef;
    viewContainerRef.clear();
    const componentRef = viewContainerRef.createComponent(componentFactory);
    componentRef.instance.committeeFile = committeeFile;
    componentRef.instance.notification = notification;
    componentRef.instance.members = members;
    componentRef.instance.notification = notification;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.debug("notification html ->", html);
    return html;
  }

  completeInMailchimp() {
    this.notify.warning({
      title: "Complete in Mailchimp",
      message: "You can close this dialog now as the message was presumably completed and sent in Mailchimp"
    });
    this.confirmSendNotification(true);
  }

  cancelSendNotification() {
    if (this.notifyTarget.busy) {
      this.notification.cancelled = true;
      this.notify.error({
        title: "Cancelling during send",
        message: "Because notification sending was already in progress when you cancelled, campaign may have already been sent - check in Mailchimp if in doubt."
      });
    } else {
      this.logger.debug("calling cancelSendNotification");
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
    this.logger.debug("select all=", this.notification.groupEventsFilter.selectAll);
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
}
