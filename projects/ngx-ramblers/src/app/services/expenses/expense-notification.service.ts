import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { MailchimpExpenseOtherContent, SaveSegmentResponse } from "../../models/mailchimp.model";
import {
  ExpenseEventType,
  ExpenseNotificationMapping,
  ExpenseNotificationRequest
} from "../../notifications/expenses/expense.model";
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
import { FullNameWithAliasPipe } from "../../pipes/full-name-with-alias.pipe";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { MailchimpConfigService } from "../mailchimp-config.service";
import { MailchimpCampaignService } from "../mailchimp/mailchimp-campaign.service";
import { MailchimpSegmentService } from "../mailchimp/mailchimp-segment.service";
import { MemberService } from "../member/member.service";
import { AlertInstance } from "../notifier.service";
import { UrlService } from "../url.service";
import { ExpenseClaimService } from "./expense-claim.service";
import { ExpenseDisplayService } from "./expense-display.service";
import { NotificationComponent } from "../../notifications/common/notification.component";
import {
  ExpenseNotificationDetailsComponent
} from "../../notifications/expenses/templates/common/expense-notification-details.component";

@Injectable({
  providedIn: "root"
})

export class ExpenseNotificationService {
  private logger: Logger;

  constructor(
    private mailchimpSegmentService: MailchimpSegmentService,
    private mailchimpCampaignService: MailchimpCampaignService,
    private mailchimpConfig: MailchimpConfigService,
    protected memberService: MemberService,
    private urlService: UrlService,
    private expenseClaimService: ExpenseClaimService,
    private fullNameWithAliasPipe: FullNameWithAliasPipe,
    public display: ExpenseDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ExpenseNotificationService, NgxLoggerLevel.OFF);
  }

  private expenseEventNotificationMappingsFor(eventType: ExpenseEventType): ExpenseNotificationMapping {
    const mappings: ExpenseNotificationMapping[] = [
      {
        expenseEventType: this.display.eventTypes.submitted,
        notifyCreator: ExpenseNotificationCreatorSubmittedComponent,
        notifyApprover: ExpenseNotificationApproverSubmittedComponent
      },
      {
        expenseEventType: this.display.eventTypes["first-approval"],
        notifyApprover: ExpenseNotificationApproverFirstApprovalComponent,
      },
      {
        expenseEventType: this.display.eventTypes["second-approval"],
        notifyCreator: ExpenseNotificationCreatorSecondApprovalComponent,
        notifyApprover: ExpenseNotificationApproverSecondApprovalComponent,
        notifyTreasurer: ExpenseNotificationTreasurerSecondApprovalComponent
      },
      {
        expenseEventType: this.display.eventTypes.returned,
        notifyCreator: ExpenseNotificationCreatorReturnedComponent,
        notifyApprover: ExpenseNotificationApproverReturnedComponent,
      },
      {
        expenseEventType: this.display.eventTypes.paid,
        notifyCreator: ExpenseNotificationCreatorPaidComponent,
        notifyApprover: ExpenseNotificationApproverPaidComponent,
        notifyTreasurer: ExpenseNotificationTreasurerPaidComponent
      },
    ];
    return mappings.find(mapping => mapping.expenseEventType === eventType);
  }

  public generateNotificationHTML(request: ExpenseNotificationRequest): string {
    const componentAndData = new NotificationComponent<ExpenseNotificationDetailsComponent>(request.component);
    request.notificationDirective.viewContainerRef.clear();
    const componentRef = request.notificationDirective.viewContainerRef.createComponent(componentAndData.component);
    componentRef.instance.expenseClaim = request.expenseClaim;
    componentRef.changeDetectorRef.detectChanges();
    const html = componentRef.location.nativeElement.innerHTML;
    this.logger.debug("notification html ->", html);
    return html;
  }

  sendCreatorNotifications(request: ExpenseNotificationRequest): Promise<any> {
    if (request.eventType.notifyCreator) {
      request.memberIds = [request.expenseClaimCreatedEvent.memberId];
      request.segmentType = "directMail";
      request.segmentNameSuffix = "";
      request.destination = "creator";
      request.component = this.expenseEventNotificationMappingsFor(request.eventType).notifyCreator;
      return this.sendNotificationsTo(request);
    }
    return Promise.resolve(false);
  }

  sendApproverNotifications(request: ExpenseNotificationRequest): Promise<any> {
    if (request.eventType.notifyApprover) {
      request.component = this.expenseEventNotificationMappingsFor(request.eventType).notifyApprover;
      request.memberIds = this.memberService.allMemberIdsWithPrivilege("financeAdmin", request.members);
      request.segmentType = "expenseApprover";
      request.segmentNameSuffix = "approval ";
      request.destination = "approvers";
      return this.sendNotificationsTo(request);
    }
    return Promise.resolve(false);
  }

  sendTreasurerNotifications(request: ExpenseNotificationRequest): Promise<any> {
    request.component = this.expenseEventNotificationMappingsFor(request.eventType).notifyTreasurer;
    if (request.eventType.notifyTreasurer) {
      request.memberIds = this.memberService.allMemberIdsWithPrivilege("treasuryAdmin", request.members);
      request.segmentType = "expenseTreasurer";
      request.segmentNameSuffix = "payment ";
      request.destination = "treasurer";
      return this.sendNotificationsTo(request);
    }
    return Promise.resolve(false);
  }

  createOrSaveMailchimpSegment(request: ExpenseNotificationRequest): Promise<SaveSegmentResponse> {
    return this.mailchimpSegmentService.saveSegment("general",
      {segmentId: this.mailchimpSegmentService.getMemberSegmentId(request.member, request.segmentType)},
      request.memberIds, request.segmentName, request.members);
  }

  saveSegmentDataToMember(saveSegmentResponse: SaveSegmentResponse, request: ExpenseNotificationRequest) {
    this.mailchimpSegmentService.setMemberSegmentId(request.member, request.segmentType, saveSegmentResponse.segment.id);
    return this.memberService.update(request.member);
  }

  sendEmailCampaign(request: ExpenseNotificationRequest, contentSections: MailchimpExpenseOtherContent) {
    this.display.showExpenseProgressAlert(request.notify, `Sending ${request.campaignNameAndMember}`);
    return this.mailchimpConfig.getConfig()
      .then(config => {
        const campaignId = config.campaigns.expenseNotification.campaignId;
        const segmentId = this.mailchimpSegmentService.getMemberSegmentId(request.member, request.segmentType);
        this.logger.debug("about to replicateAndSendWithOptions with campaignName", request.campaignNameAndMember, "campaign Id", campaignId, "segmentId", segmentId);
        return this.mailchimpCampaignService.replicateAndSendWithOptions({
          campaignId,
          campaignName: request.campaignNameAndMember,
          contentSections,
          segmentId
        });
      })
      .then(() => {
        this.display.showExpenseProgressAlert(request.notify, `Sending of ${request.campaignNameAndMember} was successful`, true);
      });
  }

  notifyEmailSendComplete(notify: AlertInstance, campaignName: string) {
    this.display.showExpenseSuccessAlert(notify, `Sending of ${campaignName} was successful. Check your inbox for progress.`);
  }

  sendNotification(expenseNotificationRequest: ExpenseNotificationRequest, contentSections: MailchimpExpenseOtherContent) {
    return this.createOrSaveMailchimpSegment(expenseNotificationRequest)
      .then((segmentResponse: SaveSegmentResponse) => this.saveSegmentDataToMember(segmentResponse, expenseNotificationRequest))
      .then(() => this.sendEmailCampaign(expenseNotificationRequest, contentSections))
      .then(() => this.notifyEmailSendComplete(expenseNotificationRequest.notify, expenseNotificationRequest.campaignName));

  }

  sendNotificationsTo(request: ExpenseNotificationRequest) {
    this.logger.debug("sendNotificationsTo:", request);
    request.campaignName = `Expense ${request.eventType.description} notification (to ${request.destination})`;
    request.campaignNameAndMember = `${request.campaignName} (${request.memberFullName})`;
    request.segmentName = `Expense notification ${request.segmentNameSuffix}(${request.memberFullName})`;
    if (request.memberIds.length === 0) {
      return Promise.reject(`No members have been configured as ${request.destination} therefore notifications for this step will fail!!`);
    }
    return this.sendNotification(request, {
      sections: {
        expense_id_url: `Please click <a href="${this.urlService.baseUrl()}/admin/expenses/${request.expenseClaim.id}" target="_blank">this link</a> to see the details of the above expense claim, or to make changes to it.`,
        expense_notification_text: this.generateNotificationHTML(request)
      }
    });
  }

  sendNotificationsToAllRoles(request: ExpenseNotificationRequest) {
    return this.memberService.getById(request.expenseClaimCreatedEvent.memberId)
      .then(member => {
        this.logger.debug("sendNotification:", "memberId", request.expenseClaimCreatedEvent.memberId, "member", member);
        request.member = member;
        request.memberFullName = this.fullNameWithAliasPipe.transform(member);
        return Promise.resolve(this.display.showExpenseProgressAlert(request.notify, `Preparing to email ${request.memberFullName}`))
          .then(() => this.sendCreatorNotifications(request))
          .then(() => this.sendApproverNotifications(request))
          .then(() => this.sendTreasurerNotifications(request));
      });
  }

  createEventAndSendNotifications(request: ExpenseNotificationRequest) {
    request.notify.setBusy();
    request.expenseClaimCreatedEvent = this.display.expenseClaimCreatedEvent(request.expenseClaim);
    return Promise.resolve(this.display.createEvent(request.expenseClaim, request.eventType, request.reason))
      .then(() => this.sendNotificationsToAllRoles(request))
      .then(() => this.expenseClaimService.createOrUpdate(request.expenseClaim))
      .catch((error) => this.display.showExpenseEmailErrorAlert(request.notify, error));
  }

}
