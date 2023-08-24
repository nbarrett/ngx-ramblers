import { Component, OnInit } from "@angular/core";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { NgxLoggerLevel } from "ngx-logger";
import { AlertTarget } from "../../../../models/alert-target.model";
import { ExpenseClaim } from "../../../../notifications/expenses/expense.model";
import { Member } from "../../../../models/member.model";
import { ExpenseNotificationDirective } from "../../../../notifications/expenses/expense-notification.directive";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { ExpenseNotificationService } from "../../../../services/expenses/expense-notification.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";

@Component({
  selector: "app-expense-paid-modal",
  templateUrl: "./expense-return-modal.component.html",
})
export class ExpenseReturnModalComponent implements OnInit {
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private logger: Logger;

  public members: Member[];
  public expenseClaim: ExpenseClaim;
  private notificationDirective: ExpenseNotificationDirective;
  public returnReason: string;

  constructor(public bsModalRef: BsModalRef,
              private notifierService: NotifierService,
              private modalService: BsModalService,
              private notifications: ExpenseNotificationService,
              public display: ExpenseDisplayService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(ExpenseReturnModalComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("constructed: expenseClaim:", this.expenseClaim);
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
  }

  cancelReturnExpenseClaim() {
    this.bsModalRef.hide();
  }

  confirmReturnExpenseClaim(reason?: string) {
    return this.notifications.createEventAndSendNotifications({
      notify: this.notify,
      notificationDirective: this.notificationDirective,
      expenseClaim: this.expenseClaim,
      members: this.members,
      eventType: this.display.eventTypes.returned,
      reason,
    }).then(() => this.bsModalRef.hide());
  }

}
