import { HttpErrorResponse } from "@angular/common/http";
import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faFileImport, faSpinner, faTrash, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { FileUploader, FileUploadModule } from "ng2-file-upload";
import { StepperModule } from "primeng/stepper";
import { forkJoin, Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { Member } from "../../../models/member.model";
import {
  VolunteerExportAudit,
  VolunteerImportAudit,
  VolunteerImportApiResponse,
  VolunteerImportDecision,
  VolunteerImportResult,
  VolunteerImportStage,
  VolunteerImportStep,
  VolunteerImportStepDefinition,
  VolunteerImportUploadResult
} from "../../../models/volunteer-import.model";
import { VolunteerDeleteGroupResponse } from "../../../models/volunteer-management.model";
import { VolunteerManagementService } from "../../../services/volunteer-management.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableColumn } from "../../../modules/common/sortable-table/sortable-table.model";
import { memberFullName } from "../../../functions/member-names";
import { DESCENDING } from "../../../models/table-filtering.model";

interface VolunteerHistoryRow extends Record<string, string | number> {
  performedAt: number;
  when: string;
  action: string;
  detail: string;
  by: string;
}

@Component({
  selector: "app-volunteer-import-view",
  imports: [FormsModule, FontAwesomeModule, FileUploadModule, StepperModule, SortableTableComponent],
  template: `
    <div class="import-workspace">
      <p-stepper [(value)]="stepperActiveIndex" [linear]="true">
        @for (step of steps; let idx = $index; track step.key) {
          <p-step-item [value]="idx">
            <p-step [disabled]="navigationLocked() || !canAccessStep(step.key)">
              <div class="walk-step-header">
                <span class="walk-step-number">{{ idx + 1 }}</span>
                <div class="walk-step-text">
                  <div class="walk-step-label">{{ step.label }}</div>
                  <div class="walk-step-hint">{{ stepHint(step.key) }}</div>
                </div>
              </div>
            </p-step>
            <p-step-panel>
              <ng-template pTemplate="content">
                @if (step.key === VolunteerImportStep.CLEAR) {
                  <p class="guidance">Remove every parish and assignment currently held for this group, ready to import from a
                    clean slate. Contacts and the people in the supporter feed are not touched. This cannot be undone. Skip this
                    step if you are adding to existing data.</p>
                  @if (!confirmingClear && !clearResult) {
                    <div class="actions">
                      <button type="button" class="btn btn-primary" (click)="confirmingClear = true" [disabled]="busy || !groupCode">
                        <fa-icon [icon]="faTrash" class="me-2"/>Clear all volunteer data for {{ groupCode }}
                      </button>
                    </div>
                  }
                  @if (confirmingClear) {
                    <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
                      <fa-icon [icon]="faTriangleExclamation"/>
                      <div>
                        <strong>Clear all volunteer data for {{ groupCode }}?</strong>
                        <div>This permanently deletes every parish and assignment held for this group. Contacts and supporters are kept.</div>
                        <div class="confirm-actions">
                          <button type="button" class="btn btn-primary" (click)="clearGroupData()" [disabled]="busy">
                            {{ busy ? "Clearing…" : "Confirm clear" }}
                          </button>
                          <button type="button" class="btn btn-quiet" (click)="confirmingClear = false" [disabled]="busy">Cancel</button>
                        </div>
                      </div>
                    </div>
                  }
                  @if (clearResult) {
                    <div class="alert alert-success d-flex align-items-start gap-3" role="status">
                      <fa-icon [icon]="faCircleCheck"/>
                      <div>
                        <strong>Volunteer data cleared</strong>
                        <div>{{ clearResult.parishes }} parishes and {{ clearResult.assignments }} assignments deleted for {{ groupCode }}.</div>
                      </div>
                    </div>
                  }
                  <div class="stepper-nav">
                    <button type="button" class="btn btn-primary" (click)="goToStep(stepIndex(VolunteerImportStep.UPLOAD))" [disabled]="navigationLocked()">
                      {{ clearResult ? "Next: upload" : "Skip and upload" }}
                    </button>
                  </div>
                } @else if (step.key === VolunteerImportStep.UPLOAD) {
                  <p class="guidance">Upload the volunteer structure workbook: one Excel file with a <strong>Parishes</strong> sheet,
                    an <strong>Assignments</strong> sheet and a <strong>Contacts</strong> sheet. The people themselves come from the
                    supporter feed, so make sure you have synced supporters first. The workbook is read the moment you choose it, and
                    nothing is written at this stage.</p>
                  <div class="d-flex flex-wrap align-items-center gap-2">
                    <button type="button" class="btn btn-primary flex-shrink-0" [disabled]="busy || !groupCode"
                            (click)="fileElement.click()">
                      <fa-icon [icon]="faFileImport" class="me-2"/>
                      {{ busy && stage === VolunteerImportStage.CHOOSE_FILES ? "Reading…" : "Browse for workbook" }}
                    </button>
                    <input #fileElement class="d-none" type="file" accept=".xlsx"
                           ng2FileSelect [uploader]="fileUploader">
                    <div ng2FileDrop [class.file-over]="hasFileOver" (fileOver)="hasFileOver = $event"
                         [uploader]="fileUploader" class="drop-zone flex-grow-1 mb-0">
                      Or drop the workbook here
                    </div>
                  </div>
                  @if (workbookFileName && !uploadResult) {
                    <p class="form-text mt-2 mb-0"><strong>{{ workbookFileName }}</strong>
                      @if (busy && stage === VolunteerImportStage.CHOOSE_FILES) { — reading… }
                    </p>
                  }
                  @if (uploadResult) {
                    <div class="thumbnail-heading-frame-compact parse-frame">
                      <div class="thumbnail-heading">{{ uploadResult.parse.fileName }}</div>
                      <p>{{ uploadResult.parse.parishes }} parishes, {{ uploadResult.parse.assignments }} assignments,
                        {{ uploadResult.parse.volunteers }} distinct volunteers, {{ uploadResult.parse.contacts }} contacts
                        ({{ uploadResult.parse.contactsWithEmail }} with an email)</p>
                    </div>
                    @if (uploadResult.parse.missingSheets.length) {
                      <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
                        <fa-icon [icon]="faTriangleExclamation"/>
                        <div>
                          <strong>Some sheets were not found</strong>
                          <div>The workbook is missing: {{ uploadResult.parse.missingSheets.join(", ") }}. Anything from those
                            sheets will be skipped. Sheet names must be Parishes, Assignments and Contacts.</div>
                        </div>
                      </div>
                    }
                  }
                  <div class="stepper-nav">
                    <button type="button" class="btn btn-quiet" (click)="goToStep(stepIndex(VolunteerImportStep.CLEAR))" [disabled]="navigationLocked()">Back</button>
                    <button type="button" class="btn btn-quiet" (click)="goToStep(stepIndex(VolunteerImportStep.CHECK))" [disabled]="navigationLocked() || !canAccessStep(VolunteerImportStep.CHECK)">Check first (optional)</button>
                    <button type="button" class="btn btn-primary" (click)="goToStep(stepIndex(VolunteerImportStep.APPLY))" [disabled]="navigationLocked() || !canAccessStep(VolunteerImportStep.APPLY)">Apply import</button>
                  </div>
                } @else if (step.key === VolunteerImportStep.CHECK) {
                  <p class="guidance">The check reads the current data and reports what an import would do, without writing anything.
                    Volunteers are matched to supporters by email address.</p>
                  <div class="actions">
                    <button type="button" class="btn btn-primary" (click)="runDryRun()" [disabled]="busy">
                      {{ busy && stage === VolunteerImportStage.PARSED ? "Checking…" : (dryRunResult ? "Re-check (dry run)" : "Check import (dry run)") }}
                    </button>
                  </div>
                  @if (dryRunResult) {
                    <div class="summary-list" aria-label="Dry run summary">
                      <div class="summary-item"><span>{{ dryRunResult.summary.parishesToCreate }}</span><small>parishes to create</small></div>
                      <div class="summary-item"><span>{{ dryRunResult.summary.parishesToUpdate }}</span><small>parishes to update</small></div>
                      <div class="summary-item"><span>{{ dryRunResult.summary.volunteersMatched }}</span><small>volunteers matched</small></div>
                      <div class="summary-item warning"><span>{{ dryRunResult.summary.volunteersNeedingReview }}</span><small>volunteers needing review</small></div>
                      <div class="summary-item"><span>{{ dryRunResult.summary.assignmentsToImport }}</span><small>assignments to import</small></div>
                      <div class="summary-item warning"><span>{{ dryRunResult.summary.assignmentsToImportUnresolved }}</span><small>assignments importing unresolved</small></div>
                      <div class="summary-item"><span>{{ dryRunResult.summary.assignmentsSkipped }}</span><small>assignments skipped</small></div>
                      <div class="summary-item"><span>{{ dryRunResult.summary.contactsToImport }}</span><small>contacts to import</small></div>
                    </div>
                    @if (dryRunResult.reviewQueue.length) {
                      <h3>Review queue <span class="muted">({{ dryRunResult.reviewQueue.length }})</span></h3>
                      <p class="guidance">These records need a decision or a supporter match. Assignments import against the recorded
                        name and can be linked to a supporter later from the Volunteers tab.</p>
                      <app-sortable-table
                        [columns]="reviewColumns"
                        [rows]="reviewRows"
                        defaultSortKey="kind"
                        [maxHeight]="'420px'"
                        emptyMessage="Nothing needs review."/>
                    }
                  }
                  <div class="stepper-nav">
                    <button type="button" class="btn btn-quiet" (click)="goToStep(stepIndex(VolunteerImportStep.UPLOAD))" [disabled]="navigationLocked()">Back</button>
                    <button type="button" class="btn btn-primary" (click)="goToStep(stepIndex(VolunteerImportStep.APPLY))" [disabled]="navigationLocked() || !canAccessStep(VolunteerImportStep.APPLY)">Next: apply</button>
                  </div>
                } @else if (step.key === VolunteerImportStep.APPLY) {
                  @if (uploadResult && !applyResult) {
                    <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
                      <fa-icon [icon]="faTriangleExclamation"/>
                      <div>
                        <strong>Apply this import?</strong>
                        <div>This will write {{ plannedParishes }} parishes, {{ plannedAssignments }} assignments and
                          {{ plannedContacts }} contacts to {{ groupCode }}. Repeating an import updates the same
                          records rather than duplicating them.@if (!dryRunResult) { You can run an optional dry run first from the Check step.}</div>
                      </div>
                    </div>
                    @if (busy) {
                      <p class="guidance">Writing {{ plannedParishes }} parishes, {{ plannedAssignments }} assignments and
                        {{ plannedContacts }} contacts. This can take a moment for a large import — please keep this tab open.</p>
                    }
                  }
                  @if (applyResult) {
                    @if (applyResult.errors.length) {
                      <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
                        <fa-icon [icon]="faTriangleExclamation"/>
                        <div>
                          <strong>{{ applyResult.errors.length }} records could not be written</strong>
                          @for (error of applyResult.errors; track error) {
                            <div>{{ error }}</div>
                          }
                        </div>
                      </div>
                    } @else {
                      <div class="alert alert-success d-flex align-items-start gap-3" role="status">
                        <fa-icon [icon]="faCircleCheck"/>
                        <div>
                          <strong>Import complete</strong>
                          <div>{{ applyResult.parishesWritten }} parishes, {{ applyResult.assignmentsWritten }} assignments and
                            {{ applyResult.contactsWritten }} contacts written to {{ groupCode }}.</div>
                        </div>
                      </div>
                    }
                  }
                  <div class="stepper-nav">
                    <button type="button" class="btn btn-quiet" (click)="goToStep(stepIndex(VolunteerImportStep.CHECK))" [disabled]="navigationLocked()">Back</button>
                    @if (uploadResult && !applyResult) {
                      <button type="button" class="btn btn-primary" (click)="applyImport()" [disabled]="busy">
                        <fa-icon [icon]="busy ? faSpinner : faFileImport" [animation]="busy ? 'spin' : null" class="me-2"/>
                        {{ busy ? "Applying…" : "Apply import" }}
                      </button>
                    }
                  </div>
                }
              </ng-template>
            </p-step-panel>
          </p-step-item>
        }
      </p-stepper>

      @if (errorMessage) {
        <div class="alert alert-warning d-flex align-items-start gap-3" role="alert">
          <fa-icon [icon]="faTriangleExclamation"/>
          <div><strong>The import could not continue</strong><div>{{ errorMessage }}</div></div>
        </div>
      }

      @if (historyRows.length) {
        <div class="thumbnail-heading-frame">
          <div class="thumbnail-heading">Previous imports and exports</div>
          <app-sortable-table
            [columns]="historyColumns"
            [rows]="historyRows"
            defaultSortKey="performedAt"
            [defaultSortDirection]="DESCENDING"
            [maxHeight]="'320px'"
            emptyMessage="No imports or exports have been recorded."/>
        </div>
      }
    </div>
  `,
  styles: [`
    :host
      display: block
    .import-workspace
      display: flex
      flex-direction: column
      gap: var(--space-4)
    h3
      font-size: 1rem
      margin: var(--space-3) 0 0
    .guidance
      margin: 0 0 var(--space-3)
      color: var(--rsm-muted)
    .muted
      color: var(--rsm-muted)
      font-weight: 400
    .drop-zone
      display: flex
      align-items: center
      justify-content: center
      min-height: 44px
      padding: var(--space-2) var(--space-3)
      border: 1px dashed var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
      color: var(--rsm-muted)
      text-align: center
    .drop-zone.file-over
      border-color: #f9b104
      background: rgba(249, 177, 4, 0.08)
    .actions
      display: flex
      gap: var(--space-3)
      flex-wrap: wrap
      margin-bottom: var(--space-3)
    .parse-frame
      margin-top: var(--space-3)
    .parse-frame p
      margin: 0
      color: var(--rsm-muted)
    .summary-list
      display: grid
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))
      gap: var(--space-3)
      margin-bottom: var(--space-3)
    .summary-item
      padding: var(--space-3)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid #9bc8ab
      border-radius: var(--rsm-panel-radius)
    .summary-item.warning
      border-left-color: #f9b104
    .summary-item span
      display: block
      font-size: 1.5rem
      font-weight: 700
      line-height: 1.2
    .summary-item small
      color: var(--rsm-muted)
      font-weight: 600
    .confirm-actions
      display: flex
      gap: var(--space-3)
      margin-top: var(--space-3)
    @media (max-width: 767.98px)
      .actions .btn,
      .confirm-actions .btn
        width: 100%
      .actions,
      .confirm-actions
        flex-direction: column
  `]
})
export class VolunteerImportView implements OnInit, OnDestroy {
  private service = inject(VolunteerManagementService);
  private authService = inject(AuthService);
  private dateUtils = inject(DateUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("VolunteerImportView", NgxLoggerLevel.ERROR);
  protected readonly VolunteerImportStage = VolunteerImportStage;
  protected readonly VolunteerImportStep = VolunteerImportStep;
  protected readonly DESCENDING = DESCENDING;
  protected readonly faFileImport = faFileImport;
  protected readonly faTrash = faTrash;
  protected readonly faSpinner = faSpinner;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faTriangleExclamation = faTriangleExclamation;

  @Input() groupCode = "";
  @Input() members: Member[] = [];
  @Output() applied = new EventEmitter<void>();

  stage = VolunteerImportStage.CHOOSE_FILES;
  stepperActiveIndex = 0;
  busy = false;
  errorMessage = "";
  hasFileOver = false;
  workbookFileName = "";
  uploadResult: VolunteerImportUploadResult | null = null;
  dryRunResult: VolunteerImportResult | null = null;
  applyResult: VolunteerImportResult | null = null;
  confirmingClear = false;
  clearResult: VolunteerDeleteGroupResponse | null = null;
  importAudits: VolunteerImportAudit[] = [];
  exportAudits: VolunteerExportAudit[] = [];
  private subscriptions: Subscription[] = [];

  protected readonly steps: VolunteerImportStepDefinition[] = [
    {key: VolunteerImportStep.CLEAR, label: "Clear existing data"},
    {key: VolunteerImportStep.UPLOAD, label: "Upload the volunteer workbook"},
    {key: VolunteerImportStep.CHECK, label: "Check (dry run)"},
    {key: VolunteerImportStep.APPLY, label: "Apply and finish"}
  ];

  public fileUploader: FileUploader = new FileUploader({
    url: "/api/database/volunteer-management/import/upload",
    itemAlias: "workbook",
    disableMultipart: false,
    autoUpload: true,
    authTokenHeader: "Authorization",
    authToken: `Bearer ${this.authService.authToken()}`,
    formatDataFunctionIsAsync: false,
  });

  protected readonly reviewColumns: SortableTableColumn[] = [
    {key: "kind", label: "Kind", sortKey: "kind", cellGetter: (row: Record<string, string>) => row.kind},
    {key: "description", label: "Record", sortKey: "description", cellGetter: (row: Record<string, string>) => row.description},
    {key: "action", label: "Action", sortKey: "action", cellGetter: (row: Record<string, string>) => row.action},
    {key: "confidence", label: "Confidence", sortKey: "confidence", cellGetter: (row: Record<string, string>) => row.confidence},
    {key: "reason", label: "Why", sortKey: "reason", cellGetter: (row: Record<string, string>) => row.reason}
  ];

  protected readonly historyColumns: SortableTableColumn[] = [
    {key: "when", label: "When", sortKey: "performedAt", cellGetter: (row: VolunteerHistoryRow) => row.when},
    {key: "action", label: "Action", sortKey: "action", cellGetter: (row: VolunteerHistoryRow) => row.action},
    {key: "detail", label: "Detail", sortKey: "detail", cellGetter: (row: VolunteerHistoryRow) => row.detail},
    {key: "by", label: "By", sortKey: "by", cellGetter: (row: VolunteerHistoryRow) => row.by}
  ];

  ngOnInit(): void {
    this.loadHistory();
    this.fileUploader.onAfterAddingFile = fileItem => {
      this.fileUploader.queue = [fileItem];
      this.fileUploader.options.additionalParameter = {groupCode: this.groupCode};
      this.workbookFileName = fileItem.file.name;
      this.resetResults();
      this.busy = true;
      this.errorMessage = "";
    };
    this.subscriptions.push(this.fileUploader.response.subscribe((response: string | HttpErrorResponse) => {
      if (response instanceof HttpErrorResponse) {
        this.failWith("read the workbook", response);
      } else if (response === "Unauthorized") {
        this.failWith("read the workbook", {message: "Unauthorized - try logging out and back in, then retry."});
      } else {
        const apiResponse: VolunteerImportApiResponse = JSON.parse(response);
        this.uploadResult = apiResponse.response as VolunteerImportUploadResult;
        this.stage = VolunteerImportStage.PARSED;
        this.busy = false;
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  stepIndex(key: VolunteerImportStep): number {
    return this.steps.findIndex(step => step.key === key);
  }

  canAccessStep(key: VolunteerImportStep): boolean {
    switch (key) {
      case VolunteerImportStep.CLEAR:
      case VolunteerImportStep.UPLOAD:
        return true;
      case VolunteerImportStep.CHECK:
      case VolunteerImportStep.APPLY:
        return !!this.uploadResult;
      default:
        return false;
    }
  }

  get plannedParishes(): number {
    return this.dryRunResult ? this.dryRunResult.summary.parishesToCreate + this.dryRunResult.summary.parishesToUpdate : (this.uploadResult?.parse.parishes ?? 0);
  }

  get plannedAssignments(): number {
    return this.dryRunResult ? this.dryRunResult.summary.assignmentsToImport + this.dryRunResult.summary.assignmentsToImportUnresolved : (this.uploadResult?.parse.assignments ?? 0);
  }

  get plannedContacts(): number {
    return this.dryRunResult ? this.dryRunResult.summary.contactsToImport : (this.uploadResult?.parse.contacts ?? 0);
  }

  goToStep(index: number): void {
    const step = this.steps[index];
    if (!this.navigationLocked() && step && this.canAccessStep(step.key)) {
      this.stepperActiveIndex = index;
    }
  }

  navigationLocked(): boolean {
    return this.busy;
  }

  stepHint(key: VolunteerImportStep): string {
    switch (key) {
      case VolunteerImportStep.CLEAR:
        return this.clearResult ? `${this.clearResult.parishes} parishes, ${this.clearResult.assignments} assignments cleared` : "Optional — clear existing data first";
      case VolunteerImportStep.UPLOAD:
        return this.uploadResult ? `${this.uploadResult.parse.parishes} parishes, ${this.uploadResult.parse.assignments} assignments read` : "Select or drop the workbook (.xlsx)";
      case VolunteerImportStep.CHECK:
        return this.dryRunResult ? `${this.dryRunResult.reviewQueue.length} to review` : "Run a dry run to preview";
      case VolunteerImportStep.APPLY:
        return this.applyResult ? "Imported" : "Write the data";
      default:
        return "";
    }
  }

  get reviewRows(): Record<string, string>[] {
    return (this.dryRunResult?.reviewQueue ?? []).map((decision: VolunteerImportDecision) => ({
      kind: decision.kind,
      description: decision.description,
      action: decision.action,
      confidence: decision.confidence,
      reason: [decision.reason, decision.matchedTo ? `Matched to ${decision.matchedTo}` : ""].filter(part => part).join(". ")
    }));
  }

  get historyRows(): VolunteerHistoryRow[] {
    const imports: VolunteerHistoryRow[] = this.importAudits.map(audit => ({
      performedAt: audit.createdAt,
      when: this.dateUtils.displayDateAndTime(audit.createdAt),
      action: "Import",
      detail: `${audit.fileNames.join(", ") || "workbook"}: ${audit.parishesWritten} parishes, ${audit.assignmentsWritten} assignments, ${audit.contactsWritten} contacts${audit.errors.length ? `, ${audit.errors.length} errors` : ""}`,
      by: this.memberName(audit.createdBy)
    }));
    const exports: VolunteerHistoryRow[] = this.exportAudits.map(audit => ({
      performedAt: audit.createdAt,
      when: this.dateUtils.displayDateAndTime(audit.createdAt),
      action: "Export",
      detail: `${audit.fileName} (${audit.rowCount} rows)`,
      by: this.memberName(audit.createdBy)
    }));
    return [...imports, ...exports].sort((first, second) => second.performedAt - first.performedAt);
  }

  runDryRun(): void {
    this.busy = true;
    this.errorMessage = "";
    this.applyResult = null;
    this.service.dryRunImport(this.uploadResult.payload).subscribe({
      next: dryRunResult => {
        this.dryRunResult = dryRunResult;
        this.stage = VolunteerImportStage.DRY_RUN;
        this.busy = false;
      },
      error: error => this.failWith("check the import", error)
    });
  }

  applyImport(): void {
    this.busy = true;
    this.errorMessage = "";
    const fileNames = [this.workbookFileName].filter(fileName => fileName);
    this.service.applyImport({...this.uploadResult.payload, fileNames}).subscribe({
      next: applyResult => {
        this.applyResult = applyResult;
        this.stage = VolunteerImportStage.APPLIED;
        this.busy = false;
        this.loadHistory();
        this.applied.emit();
      },
      error: error => this.failWith("apply the import", error)
    });
  }

  clearGroupData(): void {
    this.busy = true;
    this.errorMessage = "";
    this.clearResult = null;
    this.service.deleteGroupData(this.groupCode).subscribe({
      next: clearResult => {
        this.clearResult = clearResult;
        this.confirmingClear = false;
        this.busy = false;
        this.applied.emit();
      },
      error: error => this.failWith("clear the volunteer data", error)
    });
  }

  private loadHistory(): void {
    if (this.groupCode) {
      forkJoin({
        imports: this.service.importAudits(this.groupCode),
        exports: this.service.exportAudits(this.groupCode)
      }).subscribe({
        next: audits => {
          this.importAudits = audits.imports;
          this.exportAudits = audits.exports;
        },
        error: error => this.logger.error("Failed to load import history", error)
      });
    }
  }

  private memberName(memberId: string): string {
    const member = this.members.find(candidate => candidate.id === memberId);
    return member ? memberFullName(member) : memberId;
  }

  private resetResults(): void {
    this.uploadResult = null;
    this.dryRunResult = null;
    this.applyResult = null;
    this.stage = VolunteerImportStage.CHOOSE_FILES;
  }

  private failWith(activity: string, error: any): void {
    this.logger.error(`Failed to ${activity}`, error);
    this.errorMessage = error?.error?.error || error?.message || `Failed to ${activity}`;
    this.busy = false;
  }
}
