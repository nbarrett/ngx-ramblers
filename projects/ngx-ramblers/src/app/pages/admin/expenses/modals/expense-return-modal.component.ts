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
import { MailMessagingConfig, NotificationConfig } from "../../../../models/mail.model";

@Component({
  selector: "app-expense-paid-modal",
  templateUrl: "./expense-return-modal.component.html",
  standalone: false
})
export class ExpenseReturnModalComponent implements OnInit {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;
  public notificationConfig: NotificationConfig;
  public members: Member[];
  public expenseClaim: ExpenseClaim;
  private notificationDirective: NotificationDirective;
  public returnReason: string;

  constructor(public bsModalRef: BsModalRef,
              private notifierService: NotifierService,
              private mailMessagingService: MailMessagingService,
              private expenseNotificationService: ExpenseNotificationService,
              public display: ExpenseDisplayService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ExpenseReturnModalComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed: expenseClaim:", this.expenseClaim);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.mailMessagingService.events().subscribe((mailMessagingConfig: MailMessagingConfig) => {
      this.notificationConfig = this.mailMessagingService.queryNotificationConfig(this.notify, mailMessagingConfig, "expenseNotificationConfigId");
      this.logger.info("mailMessagingConfig:", mailMessagingConfig, "notificationConfig:", this.notificationConfig);
    });

  }

  disabled(): boolean {
    return !this.notificationConfig || this.notifyTarget.busy;
  };

  cancelReturnExpenseClaim() {
    this.bsModalRef.hide();
  }

  confirmReturnExpenseClaim(reason?: string) {
    return this.expenseNotificationService.createEventAndSendNotifications({
      notify: this.notify,
      notificationConfig: this.notificationConfig,
      notificationDirective: this.notificationDirective,
      expenseClaim: this.expenseClaim,
      members: this.members,
      eventType: this.display.eventTypes.returned,
      reason,
    }).then(() => this.bsModalRef.hide());
  }

}
