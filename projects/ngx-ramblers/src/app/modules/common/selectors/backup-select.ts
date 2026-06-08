import { CommonModule } from "@angular/common";
import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { BackupListItem, BackupLocation, BackupSessionStatus } from "../../../models/backup-session.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { backupEnvironment, backupSource } from "../../../functions/backup-list-items";

@Component({
  selector: "app-backup-select",
  imports: [CommonModule, FormsModule, NgLabelTemplateDirective, NgOptionTemplateDirective, NgSelectComponent],
  styles: [`
    .status-pill
      display: inline-block
      padding: 0.25rem 0.5rem
      border-radius: 0.25rem
      font-weight: 600
      background: var(--ramblers-colour-granite, #f1f3f5)

    .status-pill.completed
      background: rgba(25, 135, 84, 0.12)
      color: #146c43

    .status-pill.failed,
    .status-pill.missing-manifest
      background: rgba(220, 53, 69, 0.12)
      color: #b02a37

    .status-pill.in-progress,
    .status-pill.pending
      background: rgba(255, 193, 7, 0.18)
      color: #664d03

    .backup-option,
    .backup-label
      display: flex
      align-items: center
      justify-content: space-between
      gap: 0.75rem
      width: 100%

    .backup-option
      padding: 0.35rem 0

    .backup-option-main
      display: flex
      flex-direction: column
      gap: 0.25rem
      min-width: 0

    .backup-option-title
      display: flex
      align-items: center
      gap: 0.5rem
      flex-wrap: wrap
      font-weight: 600

    .backup-option-detail
      color: var(--bs-secondary-color)
      font-size: 0.875rem

    .backup-environment-pill
      display: inline-block
      padding: 0.2rem 0.45rem
      border: 1px solid var(--bs-border-color)
      border-radius: 0.35rem
      background: var(--bs-body-bg)
      font-weight: 600

    .backup-summary
      min-height: 2.5rem
  `],
  template: `
    @if (label) {
      <label class="form-label">{{ label }}</label>
    }
    <ng-select
      [(ngModel)]="selected"
      (ngModelChange)="selectedChange.emit($event)"
      [items]="items"
      [multiple]="false"
      [searchable]="true"
      [searchFn]="backupSearch"
      [clearable]="true"
      [appendTo]="'body'"
      [dropdownPosition]="'bottom'"
      bindLabel="name"
      [placeholder]="placeholder || 'Select backup...'"
      [name]="name"
      appearance="outline">
      <ng-template ng-label-tmp let-item="item">
        <div class="backup-label" [title]="item.path || item.name">
          <span>{{ backupDisplayName(item) }}</span>
          <span class="status-pill" [ngClass]="statusClass(backupOutcome(item))">{{ backupOutcomeLabel(item) }}</span>
        </div>
      </ng-template>
      <ng-template ng-option-tmp let-item="item">
        <div class="backup-option" [title]="item.path || item.name">
          <div class="backup-option-main">
            <div class="backup-option-title">
              <span class="backup-environment-pill">{{ environmentOf(item) || "environment" }}</span>
              <span>{{ dateOf(item) }}</span>
            </div>
            <div class="backup-option-detail">{{ backupSourceDescription(item) }}</div>
          </div>
          <span class="status-pill" [ngClass]="statusClass(backupOutcome(item))">{{ backupOutcomeLabel(item) }}</span>
        </div>
      </ng-template>
    </ng-select>
    @if (showSummary) {
      <small class="form-text text-muted backup-summary">
        @if (selected) {
          {{ selectedBackupDescription(selected) }}
        } @else {
          {{ emptySummary || "Leave unselected to create a fresh source backup before restoring." }}
        }
      </small>
    }
  `
})
export class BackupSelectComponent {
  @Input() items: BackupListItem[] = [];
  @Input() selected: BackupListItem | null = null;
  @Input() label?: string;
  @Input() placeholder?: string;
  @Input() name = "backupSelect";
  @Input() showSummary = true;
  @Input() source: BackupLocation | null = null;
  @Input() emptySummary?: string;
  @Output() selectedChange = new EventEmitter<BackupListItem | null>();

  private dateUtils = inject(DateUtilsService);

  backupDisplayName(item: BackupListItem): string {
    const environment = this.environmentOf(item) || "Selected environment";
    const date = this.dateOf(item) || "undated backup";
    return `${environment} backup from ${date}`;
  }

  selectedBackupDescription(item: BackupListItem): string {
    return `${this.backupOutcomeLabel(item)} · ${this.backupSourceDescription(item)}`;
  }

  backupSourceDescription(item: BackupListItem): string {
    if (this.sourceOf(item) === BackupLocation.S3) {
      return "S3 database backup";
    } else if (item.database) {
      return `Local database backup for ${item.database}`;
    } else {
      return "Local database backup";
    }
  }

  sourceOf(item: BackupListItem): BackupLocation {
    return backupSource(item, this.source || BackupLocation.LOCAL);
  }

  backupOutcome(item: BackupListItem): string {
    return item.outcome || item.status || BackupSessionStatus.COMPLETED;
  }

  backupOutcomeLabel(item: BackupListItem): string {
    const outcome = this.backupOutcome(item);
    if (outcome === BackupSessionStatus.IN_PROGRESS) {
      return "in progress";
    } else {
      return outcome;
    }
  }

  statusClass(status: string): string {
    return status.replace(/_/g, "-").replace(/\s+/g, "-");
  }

  environmentOf(item: BackupListItem): string {
    return backupEnvironment(item);
  }

  dateOf(item: BackupListItem): string {
    return item.timestamp ? this.dateUtils.displayDateAndTime(item.timestamp) : "";
  }

  backupSearch = (term: string, item: BackupListItem): boolean => {
    const query = (term || "").toLowerCase();
    if (!query) {
      return true;
    } else {
      return [
        item.name || "",
        item.path || "",
        this.environmentOf(item),
        this.dateOf(item),
        this.backupOutcomeLabel(item),
        this.backupSourceDescription(item)
      ].join(" ").toLowerCase().includes(query);
    }
  };
}
