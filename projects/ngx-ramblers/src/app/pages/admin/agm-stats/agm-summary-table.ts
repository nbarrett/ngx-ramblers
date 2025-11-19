import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";

export interface SummaryRow {
  metric: string;
  order?: number;
  values?: Array<number | string>;
  displayValues?: Array<number | string>;
  totalForPeriod?: number;
  current: number;
  previous: number;
  changeDisplay: string;
  changeValue: number;
}

export type SortedRowsFn = <T>(rows: T[], key: string) => T[];
export type ToggleSortFn = (listKey: string, column: string) => void;
export type SortIconFn = (listKey: string, column: string) => IconDefinition | null;
export type ChangeClassFn = (current: number, previous: number) => string;
export type GetYearLabelFn = (periodLabel: string) => string;

@Component({
  selector: "[app-agm-summary-table]",
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <table class="table table-striped table-bordered">
      <thead class="table-dark">
        <tr>
          <th class="sortable" (click)="toggleSortFn(summaryKey, 'metric')">
            Metric
            @if (sortIconFn(summaryKey, 'metric')) {
              <fa-icon [icon]="sortIconFn(summaryKey, 'metric')" class="ms-1" size="xs"/>
            }
          </th>
          @for (year of years; track year) {
            <th class="sortable" (click)="toggleSortFn(summaryKey, year)">
              {{ getYearLabelFn(year) }}
              @if (sortIconFn(summaryKey, year)) {
                <fa-icon [icon]="sortIconFn(summaryKey, year)" class="ms-1" size="xs"/>
              }
            </th>
          }
          @if (showTotalForPeriod) {
            <th class="sortable" (click)="toggleSortFn(summaryKey, 'totalForPeriod')">
              Total for Period
              @if (sortIconFn(summaryKey, 'totalForPeriod')) {
                <fa-icon [icon]="sortIconFn(summaryKey, 'totalForPeriod')" class="ms-1" size="xs"/>
              }
            </th>
          }
          <th class="sortable" (click)="toggleSortFn(summaryKey, 'changeValue')">
            Change (Current vs Previous)
            @if (sortIconFn(summaryKey, 'changeValue')) {
              <fa-icon [icon]="sortIconFn(summaryKey, 'changeValue')" class="ms-1" size="xs"/>
            }
          </th>
        </tr>
      </thead>
      <tbody>
        @for (row of sortedRowsFn(rows, summaryKey); track row.metric) {
          <tr>
            <td>{{ row.metric }}</td>
            @for (value of row.displayValues || row.values; track $index) {
              <td>{{ currencyMetrics.includes(row.metric) ? (value | currency:"GBP":"symbol":"1.2-2") : value }}</td>
            }
            @if (showTotalForPeriod) {
              <td>
                <strong>{{ currencyMetrics.includes(row.metric) ? (row.totalForPeriod | currency:"GBP":"symbol":"1.2-2") : row.totalForPeriod }}</strong>
              </td>
            }
            <td [class]="changeClassFn(row.current, row.previous)">
              {{ row.changeDisplay }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `
})
export class AGMSummaryTableComponent {
  @Input() years: string[] = [];
  @Input() rows: SummaryRow[] = [];
  @Input() summaryKey = "";
  @Input() showTotalForPeriod = false;
  @Input() currencyMetrics: string[] = [];
  @Input() sortedRowsFn: SortedRowsFn;
  @Input() toggleSortFn: ToggleSortFn;
  @Input() sortIconFn: SortIconFn;
  @Input() changeClassFn: ChangeClassFn;
  @Input() getYearLabelFn: GetYearLabelFn;
}
