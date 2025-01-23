import { AfterViewInit, Component, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Member } from "../../../../models/member.model";
import { Organisation } from "../../../../models/system.model";
import { ExpenseDisplayService } from "../../../../services/expenses/expense-display.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { ExpenseClaim } from "../../expense.model";
import { UrlService } from "../../../../services/url.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { DisplayDatePipe } from "../../../../pipes/display-date.pipe";
import { MoneyPipe } from "../../../../pipes/money.pipe";

@Component({
    selector: "app-expense-notification-details",
    template: `
    <table style="cellpadding:10; border:1px solid lightgrey;border-collapse:collapse;width: 100%;border-spacing: 5px;">
      <thead>
      <tr>
        <th style="width:30%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Expense Date</th>
        <th style="width:50%; border:1px solid lightgrey; font-weight: bold; padding: 6px">Item Description</th>
        <th style="width:20%; border:1px solid lightgrey; font-weight: bold; padding: 6px; text-align:right">Cost</th>
      </tr>
      </thead>
      <tbody>
        @for (expenseItem of expenseClaim.expenseItems; track expenseItem) {
          <tr>
            <td style="border:1px solid lightgrey; padding: 6px">{{ expenseItem.expenseDate | displayDate }}</td>
            <td style="border:1px solid lightgrey; padding: 6px">
              <div>{{ display.prefixedExpenseItemDescription(expenseItem) }}</div>
              @if (expenseItem.receipt) {
                <div> receipt: <a target="_blank"
                                  [href]="display.receiptUrl(expenseItem)">{{ display.receiptTitle(expenseItem) }}</a>
                </div>
              }
            </td>
            <td style="border:1px solid lightgrey; padding: 6px;text-align:right">{{ expenseItem.cost | asMoney }}</td>
          </tr>
        }
      <tr>
        <td colspan="2" style="border:1px solid lightgrey; font-weight: bold; padding: 6px">{{ stringUtilsService.pluraliseWithCount(expenseClaim.expenseItems.length, 'item') }}</td>
        <td
          style="border:1px solid lightgrey; font-weight: bold; padding: 6px; text-align:right">{{ expenseClaim.cost | asMoney }}
        </td>
      </tr>
      </tbody>
    </table>`,
    imports: [DisplayDatePipe, MoneyPipe]
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
    public urlService: UrlService,
    public stringUtilsService: StringUtilsService,
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
