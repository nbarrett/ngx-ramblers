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
  selector: "app-expense-submit-modal",
  templateUrl: "./expense-submit-modal.component.html",
})
export class ExpenseSubmitModalComponent implements OnInit {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;

  public members: Member[];
  public resubmit: boolean;
  public expenseClaim: ExpenseClaim;
  private notificationDirective: NotificationDirective;
  public supplyBankDetailsChoice: string;
  public notificationConfig: NotificationConfig;

  constructor(public bsModalRef: BsModalRef,
              private mailMessagingService: MailMessagingService,
              private notifierService: NotifierService,
              private expenseNotificationService: ExpenseNotificationService,
              public display: ExpenseDisplayService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ExpenseSubmitModalComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.mailMessagingService.events().subscribe((mailMessagingConfig: MailMessagingConfig) => {
      this.notificationConfig = this.mailMessagingService.queryNotificationConfig(this.notify, mailMessagingConfig, "expenseNotificationConfigId");
      this.logger.info("mailMessagingConfig:", mailMessagingConfig, "notificationConfig:", this.notificationConfig);
    });
    const bankDetailsExist: boolean = !!this.expenseClaim.bankDetails;
    if (bankDetailsExist) {
      this.supplyBankDetailsChoice = (bankDetailsExist).toString();
    }
    this.logger.info("constructed: expenseClaim:", this.expenseClaim, "resubmit:", this.resubmit, "bankDetails", this.supplyBankDetailsChoice);
  }

  cancelSubmitExpenseClaim() {
    this.bsModalRef.hide();
  }

  confirmSubmitExpenseClaim() {
    if (this.resubmit) {
      this.expenseClaim.expenseEvents = [this.display.eventForEventType(this.expenseClaim, this.display.eventTypes.created)];
    }
    this.expenseNotificationService.createEventAndSendNotifications({
      notificationConfig: this.notificationConfig,
      notify: this.notify,
      notificationDirective: this.notificationDirective,
      expenseClaim: this.expenseClaim,
      members: this.members,
      eventType: this.display.eventTypes.submitted
    }).then(() => {
      this.bsModalRef.hide();
    });
    return true;
  }

  supplyBankDetails(supplyOption: boolean) {
    this.notify.hide();
    if (supplyOption && !this.expenseClaim.bankDetails) {
      this.expenseClaim.bankDetails = {};
    }

    if (!supplyOption && this.expenseClaim.bankDetails) {
      this.expenseClaim.bankDetails = undefined;
    }
  }
}
