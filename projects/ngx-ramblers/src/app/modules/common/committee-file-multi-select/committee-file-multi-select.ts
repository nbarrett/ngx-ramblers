import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgSelectComponent } from "@ng-select/ng-select";
import { NgxLoggerLevel } from "ngx-logger";
import { CommitteeFile } from "../../../models/committee.model";
import { CommitteeFileService } from "../../../services/committee/committee-file.service";
import { CommitteeDisplayService } from "../../../pages/committee/committee-display.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { sortBy } from "../../../functions/arrays";

export interface CommitteeFileOption {
  id: string;
  label: string;
}

@Component({
  selector: "app-committee-file-multi-select",
  imports: [FormsModule, NgSelectComponent],
  styles: [`
    :host ::ng-deep .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value
      white-space: normal

    :host ::ng-deep .ng-select.ng-select-multiple .ng-select-container .ng-value-container .ng-value .ng-value-label
      white-space: normal
      overflow-wrap: anywhere
  `],
  template: `
    <ng-select [id]="inputId ?? null"
               [items]="displayFiles"
               [multiple]="true"
               [searchable]="true"
               [clearable]="true"
               [closeOnSelect]="false"
               dropdownPosition="bottom"
               bindLabel="label"
               bindValue="id"
               [placeholder]="placeholder"
               [disabled]="disabled"
               [ngModel]="value"
               (ngModelChange)="onChange($event)"/>
  `
})
export class CommitteeFileMultiSelectComponent implements OnInit, OnChanges {

  private logger: Logger = inject(LoggerFactory).createLogger("CommitteeFileMultiSelectComponent", NgxLoggerLevel.ERROR);
  private committeeFileService = inject(CommitteeFileService);
  private display = inject(CommitteeDisplayService);

  @Input() value: string[] | null = [];
  @Input() inputId?: string;
  @Input() placeholder = "Select committee files...";
  @Input() disabled = false;
  @Input() allowedFileIds: string[] | null = null;
  @Output() valueChange = new EventEmitter<string[]>();
  @Output() filesLoaded = new EventEmitter<CommitteeFile[]>();

  availableFiles: CommitteeFileOption[] = [];
  displayFiles: CommitteeFileOption[] = [];

  async ngOnInit(): Promise<void> {
    try {
      const files = await this.committeeFileService.all();
      const sorted = files.sort(sortBy("-eventDate"));
      this.availableFiles = sorted.map(file => ({
        id: file.id,
        label: `${file.fileType} - ${this.display.fileTitle(file)}`
      }));
      this.applyAllowedFilter();
      this.filesLoaded.emit(sorted);
      this.logger.info("availableFiles:", this.availableFiles.length);
    } catch (error) {
      this.logger.error("loadFiles failed", error);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["allowedFileIds"]) {
      this.applyAllowedFilter();
    }
  }

  private applyAllowedFilter(): void {
    if (!this.allowedFileIds) {
      this.displayFiles = this.availableFiles;
      return;
    }
    const allow = new Set(this.allowedFileIds);
    this.displayFiles = this.availableFiles.filter(option => allow.has(option.id));
  }

  onChange(ids: string[]): void {
    this.value = ids ?? [];
    this.valueChange.emit(this.value);
  }
}
