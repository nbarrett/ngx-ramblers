import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSort, faSortDown, faSortUp, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { CloudflareWebAnalyticsBreakdownEntry } from "../../../../models/cloudflare-web-analytics.model";
import { isString } from "es-toolkit/compat";

export enum BreakdownSortColumn {
  KEY = "key",
  PAGE_VIEWS = "pageViews",
  VISITS = "visits"
}

export enum SortDirection {
  ASC = "asc",
  DESC = "desc"
}

@Component({
  selector: "app-analytics-breakdown-table",
  imports: [CommonModule, FontAwesomeModule],
  styles: [`
    .analytics-table-frame
      border: 1px solid var(--rsm-border)
      border-radius: 6px
      overflow: hidden

    .analytics-table
      width: 100%
      border-collapse: collapse
      font-size: 0.88rem

    .analytics-table thead th
      background-color: var(--rsm-table-header-bg)
      color: var(--rsm-table-header-text)
      font-weight: 600
      padding: 10px 16px
      cursor: pointer
      user-select: none
      white-space: nowrap

    .analytics-table thead th:hover
      background-color: #e9ecef

    .analytics-table thead th .sort-icon
      margin-left: 6px
      opacity: 0.55

    .analytics-table tbody td
      padding: 10px 16px
      border-top: 1px solid var(--rsm-border)

    .analytics-table tbody tr:nth-child(odd)
      background-color: var(--rsm-panel-bg)

    .analytics-table tbody tr:nth-child(even)
      background-color: var(--rsm-row-stripe)

    .analytics-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)
  `],
  template: `
    @if (!rows || rows.length === 0) {
      <div class="text-muted small">No data.</div>
    } @else {
      <div class="analytics-table-frame">
        <table class="analytics-table">
          <thead>
          <tr>
            <th (click)="sortByColumn(BreakdownSortColumn.KEY)">{{ label }}
              <fa-icon class="sort-icon" [icon]="iconFor(BreakdownSortColumn.KEY)"/>
            </th>
            <th class="text-end" (click)="sortByColumn(BreakdownSortColumn.PAGE_VIEWS)">Page views
              <fa-icon class="sort-icon" [icon]="iconFor(BreakdownSortColumn.PAGE_VIEWS)"/>
            </th>
            <th class="text-end" (click)="sortByColumn(BreakdownSortColumn.VISITS)">Visits
              <fa-icon class="sort-icon" [icon]="iconFor(BreakdownSortColumn.VISITS)"/>
            </th>
          </tr>
          </thead>
          <tbody>
            @for (row of sortedRows; track row.key) {
              <tr>
                <td class="text-break">{{ row.key }}</td>
                <td class="text-end">{{ row.pageViews | number }}</td>
                <td class="text-end">{{ row.visits | number }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class AnalyticsBreakdownTable {
  @Input() rows: CloudflareWebAnalyticsBreakdownEntry[] = [];
  @Input() label = "";

  protected readonly BreakdownSortColumn = BreakdownSortColumn;
  protected sortColumn: BreakdownSortColumn = BreakdownSortColumn.PAGE_VIEWS;
  protected sortDirection: SortDirection = SortDirection.DESC;

  get sortedRows(): CloudflareWebAnalyticsBreakdownEntry[] {
    const direction = this.sortDirection === SortDirection.ASC ? 1 : -1;
    const column = this.sortColumn as keyof CloudflareWebAnalyticsBreakdownEntry;
    return [...(this.rows || [])].sort((left, right) => {
      const leftValue = left[column];
      const rightValue = right[column];
      if (isString(leftValue) && isString(rightValue)) {
        return leftValue.localeCompare(rightValue) * direction;
      }
      return ((leftValue as number) - (rightValue as number)) * direction;
    });
  }

  sortByColumn(column: BreakdownSortColumn): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;
    } else {
      this.sortColumn = column;
      this.sortDirection = column === BreakdownSortColumn.KEY ? SortDirection.ASC : SortDirection.DESC;
    }
  }

  iconFor(column: BreakdownSortColumn): IconDefinition {
    if (this.sortColumn !== column) {
      return faSort;
    }
    return this.sortDirection === SortDirection.ASC ? faSortUp : faSortDown;
  }
}
