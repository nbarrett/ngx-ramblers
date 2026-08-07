import { Component, inject, Input } from "@angular/core";
import { startCase } from "es-toolkit/compat";
import { memberFullName } from "../../../functions/member-names";
import { AUDIT_FIELDS } from "../../../models/ramblers-insight-hub";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MemberService } from "../../../services/member/member.service";
import { VisibilityToggleButton } from "../../../shared/components/visibility-toggle-button";
import { Member, MemberAuditFieldChange, MemberUpdateAudit, WriteDataType } from "../../../models/member.model";

interface MemberAuditRow {
  id: string;
  updateTime: number;
  action: string;
  by: string;
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
      grid-template-columns: 28px 180px 140px 100px 1fr
      gap: 12px
      padding: 10px 16px
      background: var(--rsm-table-header-bg)
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
      grid-template-columns: 28px 180px 140px 100px 1fr
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

    .history-by
      color: #495057
      word-break: break-word

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
      background: var(--rsm-table-header-bg)
      color: var(--rsm-table-header-text)
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
          <div>By</div>
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
              <div class="history-by">{{ row.by }}</div>
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
                        <td>{{ formatChangeValue(change.fieldName, change.from) }}</td>
                        <td>{{ formatChangeValue(change.fieldName, change.to) }}</td>
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
  private memberService = inject(MemberService);
  private dateUtils = inject(DateUtilsService);
  private readonly dateFieldNames = new Set(
    AUDIT_FIELDS.filter(field => field.type === WriteDataType.DATE).map(field => field.fieldName as string)
  );
  private _audits: MemberUpdateAudit[] = [];
  private _members: Member[] = [];
  public rows: MemberAuditRow[] = [];
  private expandedIds = new Set<string>();

  @Input() set audits(value: MemberUpdateAudit[]) {
    this._audits = value || [];
    this.rows = this.buildRows();
  }

  @Input() set members(value: Member[]) {
    this._members = value || [];
    this.rows = this.buildRows();
  }

  humanise(fieldName: string): string {
    return startCase(fieldName);
  }

  formatChangeValue(fieldName: string, value: string): string {
    const raw = value || "(none)";
    const asMillis = Number(raw);
    const isDateField = this.dateFieldNames.has(fieldName)
      || fieldName.endsWith("Date")
      || fieldName.endsWith("LastUpdated");
    const looksLikeMillis = raw !== "(none)" && !Number.isNaN(asMillis) && asMillis > 1e11;
    return isDateField && looksLikeMillis
      ? this.dateUtils.displayDate(asMillis)
      : raw;
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
          by: this.actorLabel(audit),
          changes,
          summary: this.summaryFor(changes)
        };
      });
  }

  private actorLabel(audit: MemberUpdateAudit): string {
    const who = audit.updatedBy?.trim();
    const person = who && who !== "system"
      ? memberFullName(this.memberService.toMember(who, this._members), "Unknown member")
      : who === "system"
        ? "System"
        : null;
    const bulkLoad = !!audit.uploadSessionId;
    return person && bulkLoad
      ? `${person} · Bulk load`
      : person
        ?? (bulkLoad ? "Bulk load" : "Not recorded");
  }

  private summaryFor(changes: MemberAuditFieldChange[]): string {
    return changes.length === 0
      ? "No changes or differences"
      : `${changes.length === 1 ? "1 field" : `${changes.length} fields`}: ${changes.map(change => this.humanise(change.fieldName)).join(", ")}`;
  }
}
