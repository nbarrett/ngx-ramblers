import { Component, EventEmitter, HostListener, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faRotateLeft, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Member } from "../../../models/member.model";
import {
  EditableAssignmentRow,
  VolunteerAssignment,
  VolunteerAssignmentConflict,
  VolunteerAssignmentCoverage,
  VolunteerAssignmentEditorContext,
  VolunteerAssignmentEditorSave,
  VolunteerAssignmentIdentityStatus,
  VolunteerAssignmentRequest,
  VolunteerParish,
  VolunteerRoleCapacityWarning,
  VolunteerRoleType
} from "../../../models/volunteer-management.model";
import { volunteerAssignmentConflicts, volunteerRoleCapacityWarning } from "../../../functions/volunteer-management";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MemberSelector } from "../../../shared/components/member-selector";
import { DatePicker } from "../../../date-and-time/date-picker";

@Component({
  selector: "app-volunteer-assignment-editor",
  imports: [FormsModule, FontAwesomeModule, MemberSelector, DatePicker],
  template: `
    <section class="assignment-editor" aria-labelledby="assignment-editor-heading">
      <div class="assignment-editor-heading">
        <div>
          <h2 id="assignment-editor-heading">Assignments</h2>
          <p class="mb-0">{{ parish?.parishName }} @if (parish?.parishCode) {<span class="text-muted">({{ parish.parishCode }})</span>}</p>
          @if (parish?.localAuthorityName || parish?.sectorCode) {
            <p class="mb-0 small text-muted">{{ parish?.localAuthorityName }}@if (parish?.localAuthorityName && parish?.sectorCode) { · }{{ parish?.sectorCode }}</p>
          }
        </div>
      </div>

      <div class="assignment-table-scroll">
        <table class="assignment-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Volunteer</th>
              <th>Cover</th>
              <th>Effective from</th>
              <th>Effective to</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.assignment?.id ?? "new"; let isNew = $last) {
              <tr class="assignment-row" [class.new-row]="isNew" [class.removed-row]="row.removed">
                <td data-label="Role">
                  <select class="form-select" [(ngModel)]="row.roleType" [disabled]="saving || row.removed">
                    <option [ngValue]="VolunteerRoleType.LOCAL_FOOTPATH_OFFICER">Local Footpath Officer</option>
                    <option [ngValue]="VolunteerRoleType.PARISH_FOOTPATH_OBSERVER">Parish Footpath Observer</option>
                  </select>
                </td>
                <td data-label="Volunteer">
                  <app-member-selector [members]="members" placeholder="Search for a volunteer" [(selectedMember)]="row.supporter" [disabled]="saving || row.removed"/>
                </td>
                <td data-label="Cover">
                  <select class="form-select" [(ngModel)]="row.coverage" [disabled]="saving || row.removed">
                    <option [ngValue]="VolunteerAssignmentCoverage.PERMANENT">Permanent</option>
                    <option [ngValue]="VolunteerAssignmentCoverage.TEMPORARY">Temporary</option>
                  </select>
                </td>
                <td data-label="Effective from">
                  <app-date-picker [value]="row.effectiveFrom" [disabled]="saving || row.removed" [startOfDay]="true" placeholder="not recorded" (change)="row.effectiveFrom = $event?.value ?? null"/>
                </td>
                <td data-label="Effective to">
                  <app-date-picker [value]="row.effectiveTo" [disabled]="saving || row.removed" [startOfDay]="true" placeholder="no end date" (change)="row.effectiveTo = $event?.value ?? null"/>
                </td>
                <td class="actions-col">
                  @if (!isNew) {
                    <button type="button" class="btn btn-quiet btn-icon" (click)="row.removed = !row.removed" [disabled]="saving"
                            [attr.aria-label]="row.removed ? 'Restore assignment' : 'End assignment'"
                            [attr.title]="row.removed ? 'Restore this assignment' : 'End this assignment on save'">
                      <fa-icon [icon]="row.removed ? faRotateLeft : faTrash"/>
                    </button>
                  }
                </td>
              </tr>
              <tr class="notes-row" [class.new-row]="isNew" [class.removed-row]="row.removed">
                <td class="notes-cell" [attr.colspan]="6" data-label="Notes">
                  <input class="form-control" [(ngModel)]="row.notes" [disabled]="saving || row.removed" placeholder="Notes (optional)">
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (conflicts.length > 0) {
        <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>Overlapping permanent cover</strong>
            <div>{{ parish?.parishName }} has more than one permanent holder of the same role over the same period. Temporary cover can overlap, but two permanent holders usually means one should be ended.</div>
            <ul class="mb-0 mt-2">
              @for (conflict of conflicts; track conflict.assignmentId) {
                <li>{{ conflict.displayName }} — {{ conflict.roleLabel }} {{ conflictPeriod(conflict) }}</li>
              }
            </ul>
          </div>
        </div>
      }
      @for (warning of capacityWarnings; track warning.roleLabel) {
        <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
          <fa-icon [icon]="faCircleExclamation"/>
          <div>
            <strong>Role allowance reached</strong>
            <div>{{ parish?.parishName }} already has {{ warning.holderNames.length }} of the {{ warning.limit }}
              {{ warning.roleLabel }} assignment{{ warning.limit === 1 ? "" : "s" }} this role allows:
              {{ warning.holderNames.join(", ") }}. Saving adds another; consider ending an existing assignment
              or recording temporary cover instead.</div>
          </div>
        </div>
      }

      <div class="assignment-actions">
        <button type="button" class="btn btn-primary" (click)="saveAll()" [disabled]="saving || !hasChangesToSave">
          {{ saving ? "Saving…" : "Save assignments" }}
        </button>
        <button type="button" class="btn btn-quiet" (click)="close.emit()" [disabled]="saving"><fa-icon [icon]="faXmark" class="me-1"/>Cancel</button>
      </div>
    </section>
  `,
  styles: [`
    .assignment-editor
      display: grid
      gap: var(--space-4)
      padding: var(--space-5)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--ramblers-colour-sunrise)
      border-radius: var(--rsm-panel-radius)
      background: var(--rsm-panel-bg)
    .assignment-editor-heading
      display: flex
      align-items: start
      justify-content: space-between
      gap: var(--space-3)
    .assignment-editor-heading h2
      margin: 0
      font-size: 1.25rem
    .assignment-table-scroll
      overflow-x: auto
    .assignment-table
      width: 100%
      border-collapse: collapse
    .assignment-table th
      text-align: left
      font-weight: 700
      color: var(--rsm-muted)
      padding: 0 var(--space-2) var(--space-1)
      white-space: nowrap
    .assignment-table td
      padding: var(--space-1) var(--space-2)
      vertical-align: middle
    .assignment-table .form-select,
    .assignment-table .form-control,
    .assignment-table app-member-selector
      width: 100%
      display: block
    .assignment-table .actions-col
      text-align: right
      white-space: nowrap
    .assignment-table tr.removed-row td
      opacity: .5
    @media (min-width: 992px)
      .assignment-table
        min-width: 0
        table-layout: fixed
      .assignment-table th:nth-child(1)
        width: 160px
      .assignment-table th:nth-child(3)
        width: 120px
      .assignment-table th:nth-child(4),
      .assignment-table th:nth-child(5)
        width: 165px
      .assignment-table th:nth-child(6)
        width: 52px
      .assignment-table tr.notes-row td
        padding-top: 0
      .assignment-table tr.notes-row:not(.new-row) td
        border-bottom: 1px solid var(--rsm-border)
        padding-bottom: var(--space-3)
    @media (max-width: 991.98px)
      .assignment-table thead
        display: none
      .assignment-table tr
        display: block
        border: 1px solid var(--rsm-border)
        border-radius: var(--rsm-panel-radius)
        padding: var(--space-2)
        margin-bottom: var(--space-2)
      .assignment-table tr.new-row
        border-style: dashed
      .assignment-table tr.assignment-row
        margin-bottom: 0
        border-bottom: none
        border-bottom-left-radius: 0
        border-bottom-right-radius: 0
      .assignment-table tr.notes-row
        border-top: none
        border-top-left-radius: 0
        border-top-right-radius: 0
      .assignment-table td
        display: grid
        grid-template-columns: 40% 1fr
        align-items: center
        gap: var(--space-2)
        padding: var(--space-1) 0
      .assignment-table td::before
        content: attr(data-label)
        font-weight: 600
        color: var(--rsm-muted)
      .assignment-table .actions-col
        text-align: left
    .assignment-actions
      display: flex
      gap: var(--space-2)
      position: sticky
      bottom: 0
      padding-top: var(--space-3)
      background: var(--rsm-panel-bg)
    @media (max-width: 767.98px)
      .assignment-actions .btn
        width: 100%
  `]
})
export class VolunteerAssignmentEditor {
  private logger: Logger = inject(LoggerFactory).createLogger("VolunteerAssignmentEditor", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  protected readonly faXmark = faXmark;
  protected readonly faTrash = faTrash;
  protected readonly faRotateLeft = faRotateLeft;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly VolunteerRoleType = VolunteerRoleType;
  protected readonly VolunteerAssignmentCoverage = VolunteerAssignmentCoverage;

  @Input() set members(members: Member[]) {
    this._members = members ?? [];
    this.buildRows();
  }

  get members(): Member[] {
    return this._members;
  }

  @Input() set activeAssignments(assignments: VolunteerAssignment[]) {
    this._activeAssignments = assignments ?? [];
    this.buildRows();
  }

  get activeAssignments(): VolunteerAssignment[] {
    return this._activeAssignments;
  }

  @Input() saving = false;
  @Input() set context(context: VolunteerAssignmentEditorContext | null) {
    this.parish = context?.parish ?? null;
    this.buildRows();
    this.logger.debug("editing parish:", this.parish?.parishCode);
  }

  @Output() save = new EventEmitter<VolunteerAssignmentEditorSave>();
  @Output() close = new EventEmitter<void>();

  private _members: Member[] = [];
  private _activeAssignments: VolunteerAssignment[] = [];
  protected parish: VolunteerParish | null = null;
  protected rows: EditableAssignmentRow[] = [];

  private buildRows(): void {
    const existing = this.parish
      ? this.activeAssignments
        .filter(assignment => assignment.parishCode === this.parish.parishCode && assignment.roleType !== VolunteerRoleType.GROUP_COORDINATOR)
        .map(assignment => this.rowFrom(assignment))
      : [];
    this.rows = [...existing, this.blankRow()];
  }

  private rowFrom(assignment: VolunteerAssignment): EditableAssignmentRow {
    return {
      assignment,
      roleType: assignment.roleType,
      supporter: assignment.supporterId ? this._members.find(member => member.id === assignment.supporterId) ?? null : null,
      coverage: assignment.coverage ?? VolunteerAssignmentCoverage.PERMANENT,
      effectiveFrom: assignment.effectiveFrom ?? null,
      effectiveTo: assignment.effectiveTo ?? null,
      notes: assignment.notes ?? "",
      removed: false
    };
  }

  private blankRow(): EditableAssignmentRow {
    return {
      assignment: null,
      roleType: VolunteerRoleType.PARISH_FOOTPATH_OBSERVER,
      supporter: null,
      coverage: VolunteerAssignmentCoverage.PERMANENT,
      effectiveFrom: null,
      effectiveTo: null,
      notes: "",
      removed: false
    };
  }

  protected get hasChangesToSave(): boolean {
    return this.rows.some(row => (row.supporter && !row.removed) || (row.assignment?.id && row.removed));
  }

  protected get conflicts(): VolunteerAssignmentConflict[] {
    return this.parish
      ? this.rows
        .filter(row => row.supporter && !row.removed)
        .flatMap(row => volunteerAssignmentConflicts(this.activeAssignments, this.requestFrom(row), this.members))
        .filter((conflict, index, all) => all.findIndex(candidate => candidate.assignmentId === conflict.assignmentId) === index)
      : [];
  }

  protected get capacityWarnings(): VolunteerRoleCapacityWarning[] {
    return this.parish
      ? this.rows
        .filter(row => row.supporter && !row.removed)
        .map(row => volunteerRoleCapacityWarning(this.activeAssignments, this.requestFrom(row), this.members))
        .filter((warning): warning is VolunteerRoleCapacityWarning => !!warning)
        .filter((warning, index, all) => all.findIndex(candidate => candidate.roleLabel === warning.roleLabel) === index)
      : [];
  }

  protected conflictPeriod(conflict: VolunteerAssignmentConflict): string {
    const from = conflict.effectiveFrom ? this.dateUtils.displayDate(conflict.effectiveFrom) : "";
    if (from && conflict.effectiveTo) {
      return `(${from} – ${this.dateUtils.displayDate(conflict.effectiveTo)})`;
    } else if (from) {
      return `(from ${from})`;
    } else {
      return "";
    }
  }

  @HostListener("document:keydown.escape")
  protected onEscape(): void {
    if (!this.saving) {
      this.close.emit();
    }
  }

  protected saveAll(): void {
    if (this.parish) {
      this.save.emit({
        upserts: this.rows.filter(row => row.supporter && !row.removed).map(row => this.requestFrom(row)),
        endIds: this.rows.filter(row => row.assignment?.id && row.removed).map(row => row.assignment.id)
      });
    } else {
      this.logger.error("saveAll called with no parish in context");
    }
  }

  private requestFrom(row: EditableAssignmentRow): VolunteerAssignmentRequest {
    return {
      id: row.assignment?.id,
      groupCode: this.parish?.groupCode,
      parishCode: this.parish?.parishCode,
      supporterId: row.supporter?.id || null,
      unresolvedName: row.supporter?.id ? null : row.assignment?.unresolvedName ?? null,
      identityStatus: row.supporter?.id ? VolunteerAssignmentIdentityStatus.LINKED : VolunteerAssignmentIdentityStatus.UNRESOLVED,
      roleType: row.roleType,
      coverage: row.coverage,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      notes: row.notes
    };
  }
}
