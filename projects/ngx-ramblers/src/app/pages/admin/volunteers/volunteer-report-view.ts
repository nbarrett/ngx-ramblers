import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCopy, faDownload } from "@fortawesome/free-solid-svg-icons";
import { VolunteerDirectoryColumn, VolunteerReport, VolunteerReportType } from "../../../models/volunteer-management.model";
import { volunteerReportTitle } from "../../../functions/volunteer-reports";
import { ClipboardService } from "../../../services/clipboard.service";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableGroupHeaderDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING } from "../../../models/table-filtering.model";
import { values } from "es-toolkit/compat";

@Component({
  selector: "app-volunteer-report-view",
  imports: [FormsModule, FontAwesomeModule, SortableTableComponent, SortableTableGroupHeaderDirective],
  template: `
    <div class="report-workspace">
      <div class="report-controls">
        <label class="report-selector">Report
          <select class="form-select" [ngModel]="reportType" (ngModelChange)="reportTypeChange.emit($event)" aria-label="Choose a report">
            @for (type of reportTypes; track type) {
              <option [ngValue]="type">{{ titleFor(type) }}</option>
            }
          </select>
        </label>
        <div class="report-actions">
          <button type="button" class="btn btn-quiet text-nowrap" (click)="copyReport()" [disabled]="report.rows.length === 0">
            <fa-icon [icon]="faCopy"/> Copy
          </button>
          <button type="button" class="btn btn-primary text-nowrap" (click)="download.emit()" [disabled]="report.rows.length === 0">
            <fa-icon [icon]="faDownload"/> Download CSV
          </button>
        </div>
      </div>
      <p class="report-description">{{ report.description }} <strong>{{ report.rows.length }}</strong> row{{ report.rows.length === 1 ? "" : "s" }}.</p>
      @if (reportType === VolunteerReportType.VACANCIES) {
        <div class="vacancy-options">
          <label><input type="checkbox" [checked]="includeTemporaryAsVacant" (change)="includeTemporaryAsVacantChange.emit(!includeTemporaryAsVacant)"> Count temporary cover as a vacancy</label>
          <button type="button" class="btn btn-quiet btn-sm text-nowrap" (click)="copyForWebsite()" [disabled]="report.rows.length === 0">
            <fa-icon [icon]="faCopy"/> Copy for website
          </button>
        </div>
      }
      @if (reportType === VolunteerReportType.ASSIGNMENT_DIRECTORY) {
        <div class="directory-columns">
          <span class="directory-columns-title">Contact columns</span>
          <label><input type="checkbox" [checked]="columnIncluded(VolunteerDirectoryColumn.EMAIL)" (change)="toggleColumn(VolunteerDirectoryColumn.EMAIL)"> Volunteer email</label>
          <label><input type="checkbox" [checked]="columnIncluded(VolunteerDirectoryColumn.COUNCIL_CONTACT)" (change)="toggleColumn(VolunteerDirectoryColumn.COUNCIL_CONTACT)"> Council contact</label>
        </div>
      }
      <app-sortable-table
        [columns]="columns"
        [rows]="report.rows"
        [defaultSortKey]="sortField"
        [defaultSortDirection]="sortDirection"
        [maxHeight]="'100%'"
        [groupBy]="groupBy"
        [collapsibleGroups]="!!groupBy"
        emptyMessage="Nothing to report for the current data."
        (sortChange)="sortChange.emit($event)">
        @if (groupBy) {
          <ng-template appSortableTableGroupHeader let-group>
            {{ group.key || "Not recorded" }} <span class="group-count">({{ group.rows.length }})</span>
          </ng-template>
        }
      </app-sortable-table>
    </div>
  `,
  styles: [`
    :host
      display: block
      height: 100%
    .report-workspace
      display: flex
      flex-direction: column
      gap: var(--space-3)
      height: 100%
      min-height: 0
    .report-workspace app-sortable-table
      flex: 1 1 auto
      min-height: 0
    .report-controls
      display: grid
      grid-template-columns: minmax(280px, 1fr) auto
      gap: var(--space-3)
      align-items: end
    .report-selector
      display: grid
      gap: var(--space-2)
      font-weight: 600
    .report-actions
      display: flex
      gap: var(--space-2)
      align-items: end
    .report-description
      margin: 0
      color: var(--rsm-muted)
    .vacancy-options
      display: flex
      gap: var(--space-4)
      align-items: center
      flex-wrap: wrap
    .vacancy-options label
      display: flex
      gap: var(--space-2)
      align-items: center
      margin: 0
      font-weight: 600
    .directory-columns
      display: flex
      gap: var(--space-4)
      align-items: center
      flex-wrap: wrap
    .directory-columns-title
      font-weight: 600
    .directory-columns label
      display: flex
      gap: var(--space-2)
      align-items: center
      margin: 0
    .group-count
      color: var(--rsm-muted)
      font-weight: 400
    @media (max-width: 767.98px)
      .report-controls
        grid-template-columns: 1fr
      .report-actions
        width: 100%
      .report-actions .btn
        flex: 1 1 0
  `]
})
export class VolunteerReportView {
  private clipboard = inject(ClipboardService);
  protected readonly faCopy = faCopy;
  protected readonly faDownload = faDownload;
  protected readonly reportTypes = values(VolunteerReportType);
  protected readonly VolunteerReportType = VolunteerReportType;
  protected readonly VolunteerDirectoryColumn = VolunteerDirectoryColumn;

  @Input() report: VolunteerReport;
  @Input() reportType: VolunteerReportType = VolunteerReportType.VACANCIES;
  @Input() directoryColumns: VolunteerDirectoryColumn[] = [];
  @Input() includeTemporaryAsVacant = false;
  @Input() sortField: string = null;
  @Input() sortDirection: string = ASCENDING;

  @Output() reportTypeChange = new EventEmitter<VolunteerReportType>();
  @Output() directoryColumnsChange = new EventEmitter<VolunteerDirectoryColumn[]>();
  @Output() includeTemporaryAsVacantChange = new EventEmitter<boolean>();
  @Output() sortChange = new EventEmitter<SortableTableSortState>();
  @Output() download = new EventEmitter<void>();

  protected copyReport(): void {
    const header = this.report.columns.map(column => column.label);
    const rows = this.report.rows.map(row => this.report.columns.map(column => row[column.key] ?? ""));
    this.clipboard.copyToClipboard([header, ...rows].map(row => row.join("\t")).join("\n"));
  }

  protected copyForWebsite(): void {
    const grouped = this.report.rows.reduce((groups: Map<string, string[]>, row) => {
      const groupName = String(row.rightsOfWayGroup ?? "") || "Not recorded";
      const line = `${row.parishName} — ${row.role}${row.status === "Temporary cover only" ? " (temporary cover)" : ""}`;
      groups.set(groupName, [...(groups.get(groupName) ?? []), line]);
      return groups;
    }, new Map<string, string[]>());
    const text = Array.from(grouped.entries()).map(([groupName, lines]) => [groupName, ...lines].join("\n")).join("\n\n");
    this.clipboard.copyToClipboard(text);
  }

  protected columnIncluded(column: VolunteerDirectoryColumn): boolean {
    return this.directoryColumns.includes(column);
  }

  protected toggleColumn(column: VolunteerDirectoryColumn): void {
    this.directoryColumnsChange.emit(this.columnIncluded(column)
      ? this.directoryColumns.filter(candidate => candidate !== column)
      : [...this.directoryColumns, column]);
  }

  private groupByCache: {key: string; grouper: (row: Record<string, string | number>) => string} | null = null;

  protected get groupBy(): ((row: Record<string, string | number>) => string) | null {
    const groupByKey = this.report?.groupByKey;
    if (!groupByKey) {
      return null;
    } else if (this.groupByCache?.key === groupByKey) {
      return this.groupByCache.grouper;
    } else {
      this.groupByCache = {key: groupByKey, grouper: row => String(row[groupByKey] ?? "")};
      return this.groupByCache.grouper;
    }
  }

  protected get columns(): SortableTableColumn[] {
    return (this.report?.columns ?? []).map(column => ({
      key: column.key,
      label: column.label,
      sortKey: column.key,
      cellClass: column.key === "parishCode" || column.key === "status" ? "nowrap" : undefined,
      cellGetter: (row: Record<string, string | number>) => row[column.key]
    }));
  }

  protected titleFor(reportType: VolunteerReportType): string {
    return volunteerReportTitle(reportType);
  }
}
