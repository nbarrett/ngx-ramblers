import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgOptionComponent, NgSelectComponent } from "@ng-select/ng-select";
import { uploadSessionLabel } from "../../../functions/upload-session";
import { FileUploadSummary, Status } from "../../../models/ramblers-upload-audit.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StatusIconComponent } from "../../../pages/admin/status-icon";

@Component({
  selector: "app-upload-session-selector",
  imports: [FormsModule, NgSelectComponent, NgOptionComponent, StatusIconComponent],
  template: `
    <div class="row g-2 g-md-3 align-items-md-center">
      <div class="col-12 col-md-auto">
        <label [for]="controlName" class="form-label mb-0 text-nowrap">{{ label }}</label>
      </div>
      <div class="col-12 col-md" style="min-width: 0;">
        @if (sessions?.length > 0) {
          <ng-select [disabled]="disabled"
                     [clearable]="false"
                     [name]="controlName"
                     [ngModel]="selected"
                     (ngModelChange)="selectedChange.emit($event)"
                     class="filename-select"
                     dropdownPosition="bottom"
                     [virtualScroll]="false">
            @for (session of sessions; track session.fileName) {
              <ng-option [value]="session">
                <div class="d-flex align-items-center">
                  <app-status-icon noLabel [status]="session.status"/>
                  <span class="ms-2 text-truncate" [title]="session.fileName">{{ sessionLabel(session) }}</span>
                </div>
              </ng-option>
            }
          </ng-select>
        } @else {
          <div class="d-flex align-items-center">
            <app-status-icon noLabel [status]="Status.ACTIVE"/>
            <span class="ms-2">{{ emptyMessage }}</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .filename-select
      width: 100%
      min-width: 200px
      --ng-option-height: 40px

    .filename-select .ng-dropdown-panel
      max-height: 70vh !important
      max-width: 100% !important
      width: 100% !important

    .filename-select .ng-dropdown-panel .ng-option
      height: var(--ng-option-height)
      line-height: var(--ng-option-height)

    ::ng-deep .filename-select .ng-dropdown-panel
      max-height: 70vh !important
      max-width: 100% !important
      width: 100% !important

    ::ng-deep .filename-select .ng-dropdown-panel .ng-option
      height: var(--ng-option-height)
      line-height: var(--ng-option-height)

    ::ng-deep ng-select.filename-select .ng-dropdown-panel
      max-height: 70vh !important
      max-width: 100% !important
      width: 100% !important

    ::ng-deep ng-select.filename-select .ng-dropdown-panel .ng-option
      height: var(--ng-option-height)
      line-height: var(--ng-option-height)

    @media (max-width: 576px)
      .filename-select .ng-dropdown-panel,
      ::ng-deep .filename-select .ng-dropdown-panel,
      ::ng-deep ng-select.filename-select .ng-dropdown-panel
        width: 100% !important
        max-width: 100% !important
  `]
})
export class UploadSessionSelectorComponent {
  private dateUtils = inject(DateUtilsService);
  @Input() sessions: FileUploadSummary[] = [];
  @Input() selected: FileUploadSummary;
  @Input() disabled = false;
  @Input() label = "Upload Session:";
  @Input() controlName = "fileName";
  @Input() emptyMessage = "Finding sessions...";
  @Input() durations: { [fileName: string]: string } = {};
  @Output() selectedChange = new EventEmitter<FileUploadSummary>();
  protected readonly Status = Status;

  sessionLabel(session: FileUploadSummary): string {
    return uploadSessionLabel(session, this.dateUtils, this.durations?.[session?.fileName]);
  }
}
