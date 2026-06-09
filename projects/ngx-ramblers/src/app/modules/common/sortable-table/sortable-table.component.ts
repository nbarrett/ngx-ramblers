import { AfterContentInit, Component, ContentChild, ContentChildren, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, TemplateRef } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronRight, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { sortBy } from "../../../functions/arrays";
import { SortableTableAlignment, SortableTableColumn, SortableTableGroup, SortableTableSortState } from "./sortable-table.model";
import {
  SortableTableCellDirective,
  SortableTableExpandedRowDirective,
  SortableTableGroupHeaderDirective
} from "./sortable-table-cell.directive";

@Component({
  selector: "app-sortable-table",
  standalone: true,
  imports: [NgTemplateOutlet, FontAwesomeModule],
  template: `
    <div class="sortable-table-card" [class.scrollable]="!!maxHeight" [style.max-height]="maxHeight">
      <table class="sortable-table">
        <thead>
          <tr>
            @for (column of columns; track column.key) {
              <th [class]="headerClassFor(column)"
                  [class.sortable]="!!column.sortKey"
                  (click)="column.sortKey && toggleSort(column.sortKey)">
                {{ column.label }}
                @if (sortKey && column.sortKey === sortKey) {
                  <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (sortedRows.length === 0) {
            <tr>
              <td [attr.colspan]="columns.length" class="text-center text-muted py-3">{{ emptyMessage }}</td>
            </tr>
          }
          @for (group of groupedRows; track group.key) {
            @if (groupBy && groupHeaderTemplate) {
              <tr class="sortable-table-group-row" [class.collapsible]="collapsibleGroups"
                  (click)="collapsibleGroups && toggleGroupCollapsed(group.key)">
                <td [attr.colspan]="columns.length">
                  @if (collapsibleGroups) {
                    <fa-icon [icon]="groupCollapsed(group.key) ? faChevronRight : faChevronDown" class="me-2" size="xs"/>
                  }
                  <ng-container *ngTemplateOutlet="groupHeaderTemplate.template; context: { $implicit: group, group: group }"></ng-container>
                </td>
              </tr>
            }
            @if (!groupCollapsed(group.key)) {
            @for (row of group.rows; track trackRow($index, row)) {
              <tr>
                @for (column of columns; track column.key) {
                  <td [class]="cellClassFor(column)">
                    @if (templateFor(column.key); as cellTemplate) {
                      <ng-container *ngTemplateOutlet="cellTemplate; context: { $implicit: row, row: row }"></ng-container>
                    } @else {
                      {{ column.cellGetter ? column.cellGetter(row) : "" }}
                    }
                  </td>
                }
              </tr>
              @if (expandedRowTemplate && expandedWhen(row)) {
                <tr class="sortable-table-expanded-row">
                  <td [attr.colspan]="columns.length">
                    <ng-container *ngTemplateOutlet="expandedRowTemplate.template; context: { $implicit: row, row: row }"></ng-container>
                  </td>
                </tr>
              }
            }
            }
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host
      display: block

    .sortable-table-card
      border: 1px solid rgba(155, 200, 171, 0.4)
      border-radius: 8px
      overflow: hidden
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
      background: white

    .sortable-table-card.scrollable
      overflow: auto

    .sortable-table-card.scrollable thead th
      position: sticky
      top: 0
      z-index: 2
      background: linear-gradient(to bottom, rgb(225, 239, 230), rgb(240, 247, 242))

    .sortable-table
      width: 100%
      border-collapse: separate
      border-spacing: 0
      margin-bottom: 0

    .sortable-table th
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
      color: #495057
      font-weight: 600
      text-align: left
      padding: 12px 16px
      border-bottom: 2px solid rgba(155, 200, 171, 0.4)
      font-size: 0.85rem

    .sortable-table th.sortable
      cursor: pointer
      user-select: none

    .sortable-table th.sortable:hover
      background: rgba(155, 200, 171, 0.4)

    .sortable-table th.text-center
      text-align: center

    .sortable-table th.text-right
      text-align: right

    .sortable-table tbody tr td
      padding: 12px 16px
      vertical-align: middle
      border-bottom: 1px solid #e9ecef
      font-size: 0.9rem
      transition: background-color 0.15s ease
      word-break: break-word

    .sortable-table tbody tr:last-child td
      border-bottom: none

    .sortable-table tbody tr:nth-child(odd)
      background-color: #ffffff

    .sortable-table tbody tr:nth-child(even)
      background-color: #f8f9fa

    .sortable-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)

    .sortable-table tbody tr.sortable-table-group-row td
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.25), rgba(155, 200, 171, 0.12))
      font-weight: 600
      border-bottom: 2px solid rgba(155, 200, 171, 0.4)

    .sortable-table tbody tr.sortable-table-group-row.collapsible td
      cursor: pointer
      user-select: none

    .sortable-table tbody tr.sortable-table-group-row.collapsible:hover td
      background: rgba(155, 200, 171, 0.35)

    .sortable-table tbody tr.sortable-table-expanded-row:hover,
    .sortable-table tbody tr.sortable-table-expanded-row
      background-color: #ffffff

    .sortable-table tbody td.text-center
      text-align: center

    .sortable-table tbody td.text-right
      text-align: right
  `]
})
export class SortableTableComponent implements OnChanges, AfterContentInit {

  @Input() columns: SortableTableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() maxHeight: string | null = null;
  @Input() defaultSortKey: string | null = null;
  @Input() defaultSortDirection: string = ASCENDING;
  @Input() emptyMessage: string = "No data to display";
  @Input() trackBy: (index: number, row: any) => any = (index) => index;
  @Input() groupBy: ((row: any) => string) | null = null;
  @Input() collapsibleGroups = false;
  @Input() expandedWhen: (row: any) => boolean = () => false;
  @Output() sortChange = new EventEmitter<SortableTableSortState>();

  @ContentChildren(SortableTableCellDirective) protected cellTemplates!: QueryList<SortableTableCellDirective>;
  @ContentChild(SortableTableGroupHeaderDirective) protected groupHeaderTemplate: SortableTableGroupHeaderDirective | null = null;
  @ContentChild(SortableTableExpandedRowDirective) protected expandedRowTemplate: SortableTableExpandedRowDirective | null = null;

  protected sortKey: string | null = null;
  protected sortDirection: string = ASCENDING;
  protected sortedRows: any[] = [];
  protected groupedRows: SortableTableGroup[] = [];

  protected readonly ASCENDING = ASCENDING;
  protected readonly DESCENDING = DESCENDING;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected collapsedGroupKeys = new Set<string>();

  protected toggleGroupCollapsed(key: string): void {
    if (this.collapsedGroupKeys.has(key)) {
      this.collapsedGroupKeys.delete(key);
    } else {
      this.collapsedGroupKeys.add(key);
    }
  }

  protected groupCollapsed(key: string): boolean {
    return this.collapsibleGroups && this.collapsedGroupKeys.has(key);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["defaultSortKey"] && this.sortKey === null) {
      this.sortKey = this.defaultSortKey;
      this.sortDirection = this.defaultSortDirection;
    }
    if (changes["rows"] || changes["columns"]) {
      this.applySort();
    }
  }

  ngAfterContentInit(): void {
    if (this.sortKey === null && this.defaultSortKey) {
      this.sortKey = this.defaultSortKey;
      this.sortDirection = this.defaultSortDirection;
    }
    this.applySort();
  }

  protected toggleSort(sortKey: string): void {
    if (this.sortKey === sortKey) {
      this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    } else {
      this.sortKey = sortKey;
      this.sortDirection = ASCENDING;
    }
    this.applySort();
    this.sortChange.emit({ key: this.sortKey, direction: this.sortDirection });
  }

  protected templateFor(key: string): TemplateRef<any> | null {
    const match = this.cellTemplates?.find(entry => entry.key === key);
    return match?.template ?? null;
  }

  protected trackRow(index: number, row: any): any {
    return this.trackBy ? this.trackBy(index, row) : index;
  }

  protected headerClassFor(column: SortableTableColumn): string {
    const parts: string[] = [];
    if (column.headerClass) parts.push(column.headerClass);
    if (column.align === SortableTableAlignment.CENTER) parts.push("text-center");
    if (column.align === SortableTableAlignment.RIGHT) parts.push("text-right");
    return parts.join(" ");
  }

  protected cellClassFor(column: SortableTableColumn): string {
    const parts: string[] = [];
    if (column.cellClass) parts.push(column.cellClass);
    if (column.align === SortableTableAlignment.CENTER) parts.push("text-center");
    if (column.align === SortableTableAlignment.RIGHT) parts.push("text-right");
    return parts.join(" ");
  }

  private applySort(): void {
    const source = this.rows || [];
    if (!this.sortKey) {
      this.sortedRows = [...source];
    } else {
      const prefix = this.sortDirection === DESCENDING ? "-" : "";
      this.sortedRows = [...source].sort(sortBy(`${prefix}${this.sortKey}`));
    }
    this.groupedRows = this.applyGrouping(this.sortedRows);
  }

  private applyGrouping(rows: any[]): SortableTableGroup[] {
    const groupBy = this.groupBy;
    if (!groupBy) {
      return [{ key: "", rows }];
    }
    return rows.reduce((groups: SortableTableGroup[], row) => {
      const key = groupBy(row);
      const existing = groups.find(group => group.key === key);
      if (existing) {
        existing.rows.push(row);
      } else {
        groups.push({ key, rows: [row] });
      }
      return groups;
    }, []);
  }
}
