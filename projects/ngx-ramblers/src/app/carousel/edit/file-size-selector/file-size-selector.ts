import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { range } from "es-toolkit";
import { NgSelectComponent } from "@ng-select/ng-select";

interface FileSizeOption {
  value: number;
  label: string;
}

@Component({
  selector: "app-file-size-selector",
  template: `
    <label [for]="id">{{ label || "File Size" }}</label>
    <ng-select [id]="id"
               [items]="fileSizeOptions"
               bindLabel="label"
               bindValue="value"
               [(ngModel)]="fileSize"
               [disabled]="disabled"
               [clearable]="false"
               dropdownPosition="bottom"
               (ngModelChange)="changeFileSize($event)"/>`,
  imports: [FormsModule, NgSelectComponent]
})

export class FileSizeSelectorComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("FileSizeSelectorComponent", NgxLoggerLevel.ERROR);
  public numberUtils: NumberUtilsService = inject(NumberUtilsService);
  public disabled: boolean;
  @Input()
  public label: string;
  @Input()
  public fileSize: number;

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Output() fileSizeChanged: EventEmitter<number> = new EventEmitter();

  public fileSizeOptions: FileSizeOption[];
  public id = this.numberUtils.generateUid();

  ngOnInit(): void {
    const fileSizes = range(0, 1000 * 1024, 50 * 1024).concat(range(1000 * 1024, 7000 * 1024, 1000 * 1024));
    this.fileSizeOptions = fileSizes.map(size => ({
      value: size,
      label: size === 0 ? "No Resizing" : this.numberUtils.humanFileSize(size)
    }));
    this.logger.info("constructed with fileSize:", this.fileSize, "fileSizeOptions:", this.fileSizeOptions);
  }

  changeFileSize(fileSize: number) {
    this.logger.info("emitting fileSizeChanged with value:", fileSize);
    this.fileSizeChanged.emit(fileSize);
  }

}
