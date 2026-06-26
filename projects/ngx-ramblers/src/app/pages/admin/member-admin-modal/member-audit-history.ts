import { Component, Input } from "@angular/core";
import { startCase } from "es-toolkit/compat";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { VisibilityToggleButton } from "../../../shared/components/visibility-toggle-button";
import { MemberAuditFieldChange, MemberUpdateAudit } from "../../../models/member.model";

interface MemberAuditRow {
  id: string;
  updateTime: number;
  action: string;
  changes: MemberAuditFieldChange[];
  summary: string;
}

@Component({
  selector: "app-member-audit-history",
  imports: [DisplayDateAndTimePipe, VisibilityToggleButton],
  styles: [`
    .history-accordion
      border: 1px solid #dee2e6
      border-radius: 6px
      overflow: hidden

    .history-item
      border-bottom: 1px solid #dee2e6

    .history-item:last-child
      border-bottom: none

    .history-column-header
      display: grid
      grid-template-columns: 28px 200px 120px 1fr
      gap: 12px
      padding: 10px 16px
      background-color: var(--rsm-table-header-bg)
      border-bottom: 1px solid var(--rsm-border)
      font-size: 0.88rem
      color: var(--rsm-table-header-text)
      font-weight: 600

    .history-item:nth-child(odd)
      background-color: var(--rsm-panel-bg)

    .history-item:nth-child(even)
      background-color: var(--rsm-row-stripe)

    .history-item.expanded
      background-color: rgba(155, 200, 171, 0.15)
      border-left: 3px solid var(--ramblers-colour-mintcake, rgb(155, 200, 171))

    .history-header
      display: grid
      grid-template-columns: 28px 200px 120px 1fr
      gap: 12px
      padding: 12px 16px
      align-items: start
      transition: background-color 0.15s ease

    .history-header.clickable
      cursor: pointer

    .history-header.clickable:hover
      background-color: #e9ecef

    .history-item.expanded .history-header.clickable:hover
      background-color: rgba(155, 200, 171, 0.25)

    .history-toggle
      display: flex
      justify-content: center
      align-items: center
      padding-top: 2px

    .history-date
      font-weight: 500
      color: #495057

    .history-action
      color: #495057
      text-transform: capitalize

    .history-notes
      color: #212529

    .history-details
      padding: 16px

    .history-changes-table
      width: 100%
      border-collapse: separate
      border-spacing: 0
      background: white
      border-radius: 8px
      overflow: hidden
      border: 1px solid rgba(155, 200, 171, 0.4)
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)

    .history-changes-table th,
    .history-changes-table td
      padding: 10px 14px
      vertical-align: top
      border-bottom: 1px solid #e9ecef

    .history-changes-table th
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
      color: #495057
      font-weight: 600
      text-align: left

    .history-changes-table tbody tr:last-child td
      border-bottom: none

    .history-changes-table tbody tr:nth-child(even)
      background-color: #fafafa

    .history-changes-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)

    .history-resolution
      color: #6c757d
      font-size: 0.85rem

    .history-empty
      color: #6c757d
      font-style: italic
      padding: 12px 0
  `],
  template: `
    @if (rows.length > 0) {
      <div class="history-accordion">
        <div class="history-column-header">
          <div></div>
          <div>Update Time</div>
          <div>Action</div>
          <div>Changes</div>
        </div>
        @for (row of rows; track row.id) {
          <div class="history-item" [class.expanded]="detailsOpen(row.id)">
            <div class="history-header" [class.clickable]="row.changes.length > 0"
                 (click)="row.changes.length > 0 && toggleDetails(row.id)">
              <div class="history-toggle">
                @if (row.changes.length > 0) {
                  <app-visibility-toggle-button [expanded]="detailsOpen(row.id)"/>
                }
              </div>
              <div class="history-date">{{ row.updateTime | displayDateAndTime }}</div>
              <div class="history-action">{{ row.action }}</div>
              <div class="history-notes">{{ row.summary }}</div>
            </div>
            @if (detailsOpen(row.id)) {
              <div class="history-details">
                <table class="history-changes-table">
                  <thead>
                  <tr>
                    <th style="width: 25%">Field</th>
                    <th style="width: 30%">From</th>
                    <th style="width: 30%">To</th>
                    <th style="width: 15%">Resolution</th>
                  </tr>
                  </thead>
                  <tbody>
                    @for (change of row.changes; track change.fieldName + "-" + change.to) {
                      <tr>
                        <td>{{ humanise(change.fieldName) }}</td>
                        <td>{{ change.from }}</td>
                        <td>{{ change.to }}</td>
                        <td class="history-resolution">{{ change.resolution }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <div class="history-empty">No member audit entries</div>
    }
  `
})
export class MemberAuditHistoryComponent {
  private _audits: MemberUpdateAudit[] = [];
  public rows: MemberAuditRow[] = [];
  private expandedIds = new Set<string>();

  @Input() set audits(value: MemberUpdateAudit[]) {
    this._audits = value || [];
    this.rows = this.buildRows();
  }

  humanise(fieldName: string): string {
    return startCase(fieldName);
  }

  toggleDetails(id: string) {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  detailsOpen(id: string): boolean {
    return this.expandedIds.has(id);
  }

  private buildRows(): MemberAuditRow[] {
    return [...this._audits]
      .sort((left, right) => (right.updateTime || 0) - (left.updateTime || 0))
      .map((audit, index) => {
        const changes = audit.fieldChanges || [];
        return {
          id: audit.id || `${audit.uploadSessionId}-${audit.rowNumber}-${index}`,
          updateTime: audit.updateTime,
          action: audit.memberAction,
          changes,
          summary: this.summaryFor(changes)
        };
      });
  }

  private summaryFor(changes: MemberAuditFieldChange[]): string {
    if (changes.length === 0) {
      return "No changes or differences";
    }
    return `${changes.length === 1 ? "1 field" : `${changes.length} fields`}: ${changes.map(change => this.humanise(change.fieldName)).join(", ")}`;
  }
}
