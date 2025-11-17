import { CommonModule, DatePipe } from "@angular/common";
import { AfterViewInit, Component, inject, Input, TemplateRef } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AGMSummaryTableComponent,
  ChangeClassFn,
  GetYearLabelFn,
  SortedRowsFn,
  SortIconFn,
  SummaryRow,
  ToggleSortFn
} from "./agm-summary-table";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UIDateFormat } from "../../../models/date-format.model";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { UnpaidExpenseItem } from "../../../models/group-event.model";

export interface PayeeRow {
  id: string;
  name: string;
  totalCost: number;
  totalItems: number;
  claimCount: number;
  items: Array<{description: string; cost: number; paidDate: number | null}>;
}

export interface ExpenseYearStats {
  year: number;
  periodFrom: number;
  periodTo: number;
  expenses: {
    payees: PayeeRow[];
  };
}

@Component({
  selector: "[app-agm-expenses-tab]",
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, AGMSummaryTableComponent],
  styleUrls: ["./agm-stats.sass"],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <ng-container *ngTemplateOutlet="dateRangeControls"></ng-container>
      <div class="row mb-4">
        <div class="col-12">
          <h3>Expense Summary</h3>
          <div class="table-responsive">
            <div app-agm-summary-table
              [years]="years"
              [rows]="expenseSummaryRows"
              [summaryKey]="expenseSummaryKey"
              [sortedRowsFn]="sortedRowsFn"
              [toggleSortFn]="toggleSortFn"
              [sortIconFn]="sortIconFn"
              [changeClassFn]="changeClassFn"
              [getYearLabelFn]="getYearLabelFn"
              [showTotalForPeriod]="true"
              [currencyMetrics]="currencyMetrics">
            </div>
          </div>
        </div>
      </div>

      @for (yearStats of yearlyStats; track yearStats.year) {
        <div class="row mb-4">
          <div class="col-12">
            <h3>Expenses by Claimant {{ periodLabel(yearStats.periodFrom, yearStats.periodTo) }}</h3>
            <div class="table-responsive">
              <table class="table table-striped table-bordered">
                <thead class="table-dark">
                  <tr>
                    <th class="sortable" (click)="toggleSortFn('payees-' + yearStats.year, 'name')">
                      Claimant
                      @if (sortIconFn('payees-' + yearStats.year, 'name')) {
                        <fa-icon [icon]="sortIconFn('payees-' + yearStats.year, 'name')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('payees-' + yearStats.year, 'claimCount')">
                      Claims
                      @if (sortIconFn('payees-' + yearStats.year, 'claimCount')) {
                        <fa-icon [icon]="sortIconFn('payees-' + yearStats.year, 'claimCount')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('payees-' + yearStats.year, 'totalItems')">
                      Items
                      @if (sortIconFn('payees-' + yearStats.year, 'totalItems')) {
                        <fa-icon [icon]="sortIconFn('payees-' + yearStats.year, 'totalItems')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('payees-' + yearStats.year, 'totalCost')">
                      Total Paid
                      @if (sortIconFn('payees-' + yearStats.year, 'totalCost')) {
                        <fa-icon [icon]="sortIconFn('payees-' + yearStats.year, 'totalCost')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (payer of sortedRowsFn(yearStats.expenses.payees, 'payees-' + yearStats.year); track payer.id) {
                    <tr>
                      <td>{{ payer.name }}</td>
                      <td>{{ payer.claimCount }}</td>
                      <td>{{ payer.totalItems }}</td>
                      <td>{{ payer.totalCost | currency:"GBP":"symbol":"1.2-2" }}</td>
                      <td>
                        <ul class="mb-0">
                          @for (item of payer.items; track $index) {
                            <li>{{ item.description }} — {{ item.cost | currency:"GBP":"symbol":"1.2-2" }}</li>
                          } @empty {
                            <li>No items</li>
                          }
                        </ul>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="5" class="text-center">No paid expenses in {{ periodLabel(yearStats.periodFrom, yearStats.periodTo) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      @if (unpaidExpenses.length > 0) {
        <div class="row mb-4">
          <div class="col-12">
            <h4 class="pointer" (click)="showUnpaid = !showUnpaid">
              <fa-icon [icon]="showUnpaid ? faChevronUp : faChevronDown" class="me-2"/>
              Unpaid Expenses ({{ unpaidExpenses.length }})
            </h4>
            @if (showUnpaid) {
              <div class="table-responsive">
                <table class="table table-sm table-striped table-bordered">
                  <thead class="table-dark">
                  <tr>
                    <th class="sortable" (click)="toggleSortFn('unpaidExpenses', 'claimantName')">
                      Claimant
                      @if (sortIconFn('unpaidExpenses', 'claimantName')) {
                        <fa-icon [icon]="sortIconFn('unpaidExpenses', 'claimantName')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('unpaidExpenses', 'description')">
                      Description
                      @if (sortIconFn('unpaidExpenses', 'description')) {
                        <fa-icon [icon]="sortIconFn('unpaidExpenses', 'description')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('unpaidExpenses', 'cost')">
                      Amount
                      @if (sortIconFn('unpaidExpenses', 'cost')) {
                        <fa-icon [icon]="sortIconFn('unpaidExpenses', 'cost')" class="ms-1" size="xs"/>
                      }
                    </th>
                    <th class="sortable" (click)="toggleSortFn('unpaidExpenses', 'expenseDate')">
                      Date
                      @if (sortIconFn('unpaidExpenses', 'expenseDate')) {
                        <fa-icon [icon]="sortIconFn('unpaidExpenses', 'expenseDate')" class="ms-1" size="xs"/>
                      }
                    </th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (expense of sortedRowsFn(unpaidExpenses, 'unpaidExpenses'); track expense.id) {
                      <tr>
                        <td>{{ expense.claimantName }}</td>
                        <td>{{ expense.description }}</td>
                        <td>{{ expense.cost | currency:"GBP":"symbol":"1.2-2" }}</td>
                        <td>{{ expense.expenseDate | date: UIDateFormat.DAY_MONTH_YEAR_ABBREVIATED }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class AGMExpensesTabComponent implements AfterViewInit {
  private dateUtils = inject(DateUtilsService);
  private loggerFactory = inject(LoggerFactory);
  private logger = this.loggerFactory.createLogger("AGMExpensesTabComponent", NgxLoggerLevel.ERROR);
  protected readonly UIDateFormat = UIDateFormat;
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() years: string[] = [];
  @Input() expenseSummaryRows: SummaryRow[] = [];
  @Input() expenseSummaryKey = "expensesSummary";
  @Input() yearlyStats: ExpenseYearStats[] = [];
  @Input() unpaidExpenses: UnpaidExpenseItem[] = [];
  @Input() currencyMetrics: string[] = [];
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
  showUnpaid = false;

  ngAfterViewInit() {
    this.logger.info("ngAfterViewInit:", {
      yearlyStats: this.yearlyStats,
      expenseSummaryRows: this.expenseSummaryRows
    });
  }

  periodLabel(fromTimestamp: number, toTimestamp: number): string {
    const datePipe = new DatePipe("en-GB");
    const fromDate = this.dateUtils.asDateTime(fromTimestamp);
    const toDate = this.dateUtils.asDateTime(toTimestamp);
    const from = datePipe.transform(fromTimestamp, UIDateFormat.MONTH_YEAR_ABBREVIATED);

    if (fromDate.year === toDate.year) {
      const to = datePipe.transform(toTimestamp, UIDateFormat.MONTH_YEAR_ABBREVIATED);
      return `${from} - ${to}`;
    } else {
      return `${from} - ${toDate.year}`;
    }
  }
}
