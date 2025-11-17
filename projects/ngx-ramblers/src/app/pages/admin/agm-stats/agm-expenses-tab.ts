import { CommonModule, DatePipe } from "@angular/common";
import { Component, inject, Input, TemplateRef } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { AGMSummaryTableComponent, ChangeClassFn, GetYearLabelFn, SortedRowsFn, SortIconFn, SummaryRow, ToggleSortFn } from "./agm-summary-table";
import { DateUtilsService } from "../../../services/date-utils.service";

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
    </div>
  `
})
export class AGMExpensesTabComponent {
  private dateUtils = inject(DateUtilsService);
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  @Input() dateRangeControls: TemplateRef<any>;
  @Input() years: string[] = [];
  @Input() expenseSummaryRows: SummaryRow[] = [];
  @Input() expenseSummaryKey = "expensesSummary";
  @Input() yearlyStats: ExpenseYearStats[] = [];
  @Input() currencyMetrics: string[] = [];
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;

  periodLabel(fromTimestamp: number, toTimestamp: number): string {
    const datePipe = new DatePipe("en-GB");
    const fromDate = this.dateUtils.asDateTime(fromTimestamp);
    const toDate = this.dateUtils.asDateTime(toTimestamp);
    const from = datePipe.transform(fromTimestamp, "MMM yyyy");

    if (fromDate.year === toDate.year) {
      const to = datePipe.transform(toTimestamp, "MMM yyyy");
      return `${from} - ${to}`;
    } else {
      return `${from} - ${toDate.year}`;
    }
  }
}
