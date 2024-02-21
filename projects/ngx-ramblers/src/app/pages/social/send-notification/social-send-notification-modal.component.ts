import { Component, OnInit, ViewChild } from "@angular/core";
import get from "lodash-es/get";
import isUndefined from "lodash-es/isUndefined";
import set from "lodash-es/set";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../models/alert-target.model";
import { Identifiable } from "../../../models/api-response.model";
import { CommitteeMember } from "../../../models/committee.model";
import {
  MailchimpCampaignListResponse,
  MailchimpCampaignReplicateIdentifiersResponse,
  MailchimpConfig,
  MailchimpGenericOtherContent,
  OtherOptions
} from "../../../models/mailchimp.model";
import { Member, MemberFilterSelection } from "../../../models/member.model";
import { SocialEvent } from "../../../models/social-events.model";
import { ConfirmType } from "../../../models/ui-actions";
import {
  SocialNotificationComponentAndData,
  SocialNotificationDirective
} from "../../../notifications/social/social-notification.directive";
import {
  SocialNotificationDetailsComponent
} from "../../../notifications/social/templates/social-notification-details.component";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MailchimpConfigService } from "../../../services/mailchimp-config.service";
import { MailchimpCampaignService } from "../../../services/mailchimp/mailchimp-campaign.service";
import { MailchimpLinkService } from "../../../services/mailchimp/mailchimp-link.service";
import { MailchimpSegmentService } from "../../../services/mailchimp/mailchimp-segment.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { SocialEventsService } from "../../../services/social-events/social-events.service";
import { SocialDisplayService } from "../social-display.service";

@Component({
  selector: "app-social-send-notification-modal",
  styleUrls: ["social-send-notification-modal.component.sass"],
  templateUrl: "./social-send-notification-modal.component.html"
})
export class SocialSendNotificationModalComponent implements OnInit {
  @ViewChild(SocialNotificationDirective) notificationDirective: SocialNotificationDirective;
  public socialEvent: SocialEvent;
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;

  public roles: {
    replyTo: CommitteeMember[];
    signoff: CommitteeMember[];
  } = {replyTo: [], signoff: []};
  public campaigns: MailchimpCampaignListResponse;
  destinationType = "";
  committeeFiles = [];
  public mailchimpConfig: MailchimpConfig;

  constructor(private mailchimpSegmentService: MailchimpSegmentService,
              private mailchimpCampaignService: MailchimpCampaignService,
              private mailchimpConfigService: MailchimpConfigService,
              private notifierService: NotifierService,
              private memberService: MemberService,
              private mailchimpLinkService: MailchimpLinkService,
              public display: SocialDisplayService,
              private socialEventsService: SocialEventsService,
              protected dateUtils: DateUtilsService,
              public bsModalRef: BsModalRef,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(SocialSendNotificationModalComponent, NgxLoggerLevel.OFF);
  }

  async ngOnInit() {
    this.logger.debug("ngOnInit", this.socialEvent, "memberFilterSelections:", this.display.memberFilterSelections);
    this.mailchimpConfig = await this.mailchimpConfigService.getConfig();
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.memberService.all().then(members => {
      this.initialiseRoles(members);
      this.initialiseNotification();
    });
    this.display.confirm.as(ConfirmType.SEND_NOTIFICATION);
  }

  notReady(): boolean {
    return this.roles.replyTo.length === 0 || this.notifyTarget.busy || (this.socialEvent?.notification?.content.selectedMemberIds.length === 0 && this.socialEvent?.notification?.content.destinationType === "custom");
  }

  initialiseNotification() {
    this.defaultNotificationField(["destinationType"], "all-social-members");
    this.defaultNotificationField(["addresseeType"], "Hi *|FNAME|*,");
    this.defaultNotificationField(["title"], {include: true});
    this.defaultNotificationField(["text"], {include: true, value: ""});
    this.defaultNotificationField(["eventDetails"], {include: true, value: "Social Event details"});
    this.defaultNotificationField(["description"], {include: true});
    this.defaultNotificationField(["attendees"], {include: this.socialEvent.attendees.length > 0});
    this.defaultNotificationField(["attachment"], {include: !!this.socialEvent.attachment});
    this.defaultNotificationField(["replyTo"], {include: true, value: this.roleForType(this.socialEvent.displayName ? "organiser" : "social")?.memberId});
    this.defaultNotificationField(["signoffText"], {include: true, value: "If you have any questions about the above, please don't hesitate to contact me.\n\nBest regards,"});
    this.defaultNotificationField(["signoffAs"], {include: true, value: this.roleForType("social")?.memberId});
    this.logger.debug("onFirstNotificationOnly - creating this.socialEvent.notification ->", this.socialEvent.notification);
  }

  generateNotificationHTML(notificationDirective: SocialNotificationDirective, members: Member[]): string {
    const componentAndData = new SocialNotificationComponentAndData(SocialNotificationDetailsComponent);
    notificationDirective.viewContainerRef.clear();
    const componentRef = notificationDirective.viewContainerRef.createComponent(componentAndData.component);
    componentRef.instance.socialEvent = this.socialEvent;
    componentRef.instance.members = members;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.debug("notification html ->", html);
    return html;
  }

  defaultNotificationField(path: string[], value: any) {
    if (!this.socialEvent?.notification?.content) {
      this.socialEvent.notification.content = {};
      this.logger.debug("creating notification content");
    }
    const target = get(this.socialEvent?.notification?.content, path);
    if (isUndefined(target)) {
      this.logger.debug("existing target:", target, "setting path:", path, "to value:", value,);
      set(this.socialEvent?.notification?.content, path, value);
    } else {
      this.logger.debug("path", path, "already", target);
    }
  }

  roleForType(type: string): CommitteeMember {
    const role = this.roles.replyTo.find(role => role.type === type);
    this.logger.debug("roleForType for", type, "->", role);
    return role;
  }

  roleForMemberId(memberId: string): CommitteeMember {
    const role = this.roles.replyTo.find(role => role.type === memberId);
    this.logger.debug("roleForMemberId for", memberId, "->", role);
    return role;
  }

  initialiseRoles(members: Member[]) {
    const roles = this.display.committeeMembersPlusOrganiser(this.socialEvent, members);
    this.roles.replyTo = roles;
    this.roles.signoff = roles;
  }

  editAllSocialRecipients() {
    this.logger.debug("editAllSocialRecipients - after:", this.socialEvent?.notification?.content.selectedMemberIds);
    this.socialEvent.notification.content.destinationType = "custom";
    this.socialEvent.notification.content.selectedMemberIds = this.display.memberFilterSelections.map(attendee => attendee.id);
  }

  editAttendeeRecipients() {
    this.socialEvent.notification.content.destinationType = "custom";
    this.socialEvent.notification.content.selectedMemberIds = this.socialEvent.attendees.map(attendee => attendee.id);
    this.logger.debug("editAllSocialRecipients - after:", this.socialEvent?.notification?.content.selectedMemberIds);
  }

  clearRecipients() {
    this.logger.debug("clearRecipients: pre clear - recipients:", this.socialEvent?.notification?.content.selectedMemberIds);
    this.socialEvent.notification.content.selectedMemberIds = [];
  }

  formattedSignoffText() {
    return this.socialEvent?.notification?.content.signoffText.value;
  }

  memberGrouping(member) {
    return member.memberGrouping;
  }

  cancelSendNotification() {
    this.bsModalRef.hide();
  }

  saveAndSendLater() {
    this.socialEventsService.update(this.socialEvent).then(() => this.bsModalRef.hide());
  }

  completeInMailchimp() {
    this.notify.warning({
      title: "Complete in Mailchimp",
      message: "You can close this dialog now as the message was presumably completed and sent in Mailchimp"
    });
    this.confirmSendNotification(true);
  }

  confirmSendNotification(dontSend?: boolean) {
    this.notify.setBusy();
    const campaignName = this.socialEvent.briefDescription;
    this.logger.debug("sendSocialNotification:notification->", this.socialEvent.notification);
    this.notify.progress({title: campaignName, message: "preparing and sending notification"});
    return Promise.resolve(this.createOrSaveMailchimpSegment())
      .then(() => this.generateNotificationHTML(this.notificationDirective, this.toMembers()))
      .then((notificationText) => this.populateContentSections(notificationText))
      .then((contentSections) => this.sendEmailCampaign(contentSections, dontSend, campaignName))
      .then(() => this.saveSocialEvent())
      .then(() => this.notifyEmailSendComplete(campaignName))
      .catch((error) => this.handleError(error));
  }

  handleError(errorResponse) {
    this.notify.error({
      continue: true,
      title: "Your notification could not be sent",
      message: (errorResponse.message || errorResponse) + (errorResponse.error ? (". Error was: " + JSON.stringify(errorResponse.error)) : "")
    });
    this.notify.clearBusy();
  }

  populateContentSections(notificationText): MailchimpGenericOtherContent {
    this.logger.debug("populateContentSections -> notificationText", notificationText);
    return {
      sections: {
        notification_text: notificationText
      }
    };
  }

  writeSegmentResponseDataToEvent(segmentResponse) {
    this.socialEvent.mailchimp = {
      segmentId: segmentResponse.segment.id
    };

    if (segmentResponse.members) {
      this.socialEvent.mailchimp.members = segmentResponse.members;
    }

  }

  createOrSaveMailchimpSegment(): Promise<any> {
    const members = this.querySegmentMembers();

    if (members.length > 0) {
      return this.mailchimpSegmentService.saveSegment("socialEvents", this.socialEvent.mailchimp, members, this.mailchimpSegmentService.formatSegmentName(this.socialEvent.briefDescription), this.toMembers())
        .then((response) => this.writeSegmentResponseDataToEvent(response))
        .catch((error) => this.handleError(error));
    } else {
      this.logger.debug("not saving segment data as destination type is whole mailing list ->", this.socialEvent?.notification?.content.destinationType);
      return Promise.resolve();
    }
  }

  public toMembers(): Member[] {
    return this.display.memberFilterSelections.map(item => item.member);
  }

  querySegmentMembers(): Identifiable[] {
    switch (this.socialEvent?.notification?.content.destinationType) {
      case "attendees":
        return this.socialEvent.attendees;
      case "custom":
        return this.socialEvent?.notification?.content.selectedMemberIds.map(item => this.memberService.toIdentifiable(item));
      default:
        return [];
    }
  }

  sendEmailCampaign(contentSections, dontSend: boolean, campaignName: string) {
    const replyToRole = this.socialEvent?.notification?.content.replyTo.value ? this.roleForMemberId(this.socialEvent?.notification?.content.replyTo.value) : this.roleForType("social");
    const otherOptions: OtherOptions = (this.socialEvent?.notification?.content.replyTo.include && replyToRole) ? {
      from_name: replyToRole.fullName,
      from_email: replyToRole.email
    } : {};
    this.notify.progress(dontSend ? ("Preparing to complete " + campaignName + " in Mailchimp") : ("Sending " + campaignName));
    this.logger.debug("Sending " + campaignName, "with otherOptions", otherOptions);
    return this.mailchimpConfigService.getConfig()
      .then((config) => {
        this.mailchimpConfig = config;
        const campaignId = config.campaigns.socialEvents.campaignId;
        switch (this.socialEvent?.notification?.content.destinationType) {
          case "all-social-members":
            this.logger.debug("about to replicateAndSendWithOptions with campaignName", campaignName, "campaign Id", campaignId);
            return this.mailchimpCampaignService.replicateAndSendWithOptions({
              campaignId,
              campaignName,
              contentSections,
              otherOptions,
              dontSend
            }).then((response) => this.openInMailchimpIf(response, dontSend));
          default:
            if (!this.socialEvent.mailchimp) {
              this.notify.warning("Cant send campaign due to previous request failing. This could be due to network problems - please try this again");
            }
            const segmentId = this.socialEvent.mailchimp.segmentId;
            this.logger.debug("about to replicateAndSendWithOptions to social with campaignName", campaignName, "campaign Id", campaignId, "segmentId", segmentId);
            return this.mailchimpCampaignService.replicateAndSendWithOptions({
              campaignId,
              campaignName,
              contentSections,
              segmentId,
              otherOptions,
              dontSend
            }).then((response) => this.openInMailchimpIf(response, dontSend));
        }
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

  saveSocialEvent() {
    return this.socialEventsService.createOrUpdate(this.socialEvent);
  }

  notifyEmailSendComplete(campaignName: string) {
    this.notify.success("Sending of " + campaignName + " was successful.", false);
    this.notify.clearBusy();
    this.bsModalRef.hide();
  }

  onChange($event: any) {
    this.logger.debug("$event", $event, "socialEvent.notification.content.selectedMemberIds:", this.socialEvent?.notification?.content.selectedMemberIds);
    if (this.socialEvent?.notification?.content.selectedMemberIds.length > 0) {
      this.notify.warning({
        title: "Member selection",
        message: `${this.socialEvent?.notification?.content.selectedMemberIds.length} members manually selected`
      });
    } else {
      this.notify.hide();
    }
  }

  helpMembers() {
    return `Click below and select`;
  }

  groupBy(member: MemberFilterSelection) {
    return member.memberGrouping;
  }

  groupValue(_: string, children: any[]) {
    return ({name: children[0].memberGrouping, total: children.length});
  }

}
