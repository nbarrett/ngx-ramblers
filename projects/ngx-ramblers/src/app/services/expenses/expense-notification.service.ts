import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
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
import { MemberService } from "../member/member.service";
import { AlertInstance } from "../notifier.service";
import { ExpenseClaimService } from "./expense-claim.service";
import { ExpenseDisplayService } from "./expense-display.service";
import { NotificationComponent } from "../../notifications/common/notification.component";
import {
  ExpenseNotificationDetailsComponent
} from "../../notifications/expenses/templates/common/expense-notification-details.component";
import { MailMessagingService } from "../mail/mail-messaging.service";
import { MailService } from "../mail/mail.service";

@Injectable({
  providedIn: "root"
})

export class ExpenseNotificationService {

  private mailMessagingService: MailMessagingService = inject(MailMessagingService);
  private mailService: MailService = inject(MailService);
  private logger: Logger = inject(LoggerFactory).createLogger("ExpenseNotificationService", NgxLoggerLevel.OFF);
  protected memberService: MemberService = inject(MemberService);
  private expenseClaimService: ExpenseClaimService = inject(ExpenseClaimService);
  private fullNameWithAliasPipe: FullNameWithAliasPipe = inject(FullNameWithAliasPipe);
  public display: ExpenseDisplayService = inject(ExpenseDisplayService);

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
      request.notificationType = "directMail";
      request.notificationTypeSuffix = "";
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
      request.notificationType = "expenseApprover";
      request.notificationTypeSuffix = "approval ";
      request.destination = "approvers";
      return this.sendNotificationsTo(request);
    }
    return Promise.resolve(false);
  }

  sendTreasurerNotifications(request: ExpenseNotificationRequest): Promise<any> {
    request.component = this.expenseEventNotificationMappingsFor(request.eventType).notifyTreasurer;
    if (request.eventType.notifyTreasurer) {
      request.memberIds = this.memberService.allMemberIdsWithPrivilege("treasuryAdmin", request.members);
      request.notificationType = "expenseTreasurer";
      request.notificationTypeSuffix = "payment ";
      request.destination = "treasurer";
      return this.sendNotificationsTo(request);
    }
    return Promise.resolve(false);
  }

  sendEmailMessage(request: ExpenseNotificationRequest) {
    this.display.showExpenseProgressAlert(request.notify, `Sending ${request.qualifiedSubjectAndMember}`);
    return this.mailService.sendTransactionalMessage(this.mailMessagingService.createEmailRequest({
      member: request.member,
      notificationConfig: request.notificationConfig,
      notificationDirective: request.notificationDirective,
      bodyContent: this.generateNotificationHTML(request),
      emailSubject: request.qualifiedSubject
    })).then(() => {
      this.display.showExpenseProgressAlert(request.notify, `Sending of ${request.qualifiedSubjectAndMember} was successful`, true);
      });
  }

  notifyEmailSendComplete(notify: AlertInstance, qualifiedSubject: string) {
    this.display.showExpenseSuccessAlert(notify, `Sending of ${qualifiedSubject} was successful. Check your inbox for progress.`);
  }

  sendNotification(expenseNotificationRequest: ExpenseNotificationRequest) {
    return this.sendEmailMessage(expenseNotificationRequest)
      .then(() => this.notifyEmailSendComplete(expenseNotificationRequest.notify, expenseNotificationRequest.qualifiedSubject));

  }

  sendNotificationsTo(request: ExpenseNotificationRequest) {
    this.logger.debug("sendNotificationsTo:", request);
    request.qualifiedSubject = `Expense ${request.eventType.description} notification (to ${request.destination})`;
    request.qualifiedSubjectAndMember = `${request.qualifiedSubject} (${request.memberFullName})`;
    if (request.memberIds.length === 0) {
      return Promise.reject(`No members have been configured as ${request.destination} therefore notifications for this step will fail!!`);
    }
    return this.sendNotification(request);
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
