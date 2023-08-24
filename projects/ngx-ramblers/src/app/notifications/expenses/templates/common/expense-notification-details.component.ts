import { AfterViewInit, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Member } from "../../../../models/member.model";
import { Organisation } from "../../../../models/system.model";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { ExpenseClaim } from "../../expense.model";

@Component({
  selector: "app-expense-notification-details",
  templateUrl: "./expense-notification-details.component.html"
})
export class ExpenseNotificationDetailsComponent implements OnInit, AfterViewInit, OnDestroy {

  @Input()
  public expenseClaim: ExpenseClaim;
  protected logger: Logger;
  public members: Member[];
  public group: Organisation;
  private subscriptions: Subscription[] = [];

  constructor(
    public display: ExpenseDisplayService,
    private systemConfigService: SystemConfigService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("ExpenseNotificationDetailsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:data ->", this.expenseClaim);
    this.members = this.display.members;
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
  }

  ngAfterViewInit(): void {
    this.logger.debug("ngAfterViewInit:data ->", this.expenseClaim);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
