import { Component, OnInit } from "@angular/core";
import { BsModalRef } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { ExpenseClaim } from "../../../../notifications/expenses/expense.model";
import { Member } from "../../../../models/member.model";
import { NotificationDirective } from "../../../../notifications/common/notification.directive";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { ExpenseNotificationService } from "../../../../services/expenses/expense-notification.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { MailMessagingService } from "../../../../services/mail/mail-messaging.service";
import { NotificationConfig } from "../../../../models/mail.model";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { MemberIdToFullNamePipe } from "../../../../pipes/member-id-to-full-name.pipe";

@Component({
    selector: "app-expense-paid-modal",
    templateUrl: "./expense-paid-modal.component.html",
    imports: [FontAwesomeModule, NgClass, MemberIdToFullNamePipe]
})
export class ExpensePaidModalComponent implements OnInit {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public members: Member[];
  public expenseClaim: ExpenseClaim;
  private notificationDirective: NotificationDirective;
  private notificationConfig: NotificationConfig;

  constructor(public bsModalRef: BsModalRef,
              private notifierService: NotifierService,
              private mailMessagingService: MailMessagingService,
              private expenseNotificationService: ExpenseNotificationService,
              public display: ExpenseDisplayService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ExpensePaidModalComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed: expenseClaim:", this.expenseClaim);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.mailMessagingService.events().subscribe(mailMessagingConfig => this.notificationConfig = this.mailMessagingService.queryNotificationConfig(this.notify, mailMessagingConfig, "expenseNotificationConfigId"));
  }

  cancelPaidExpenseClaim() {
    this.bsModalRef.hide();
  }

  confirmPaidExpenseClaim() {
    this.expenseNotificationService.createEventAndSendNotifications({
      notify: this.notify,
      notificationConfig: this.notificationConfig,
      notificationDirective: this.notificationDirective,
      expenseClaim: this.expenseClaim,
      members: this.members,
      eventType: this.display.eventTypes.paid,
    }).then(() => {
      this.bsModalRef.hide();
    });
  }

}
