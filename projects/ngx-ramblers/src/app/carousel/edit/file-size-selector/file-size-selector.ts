import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import range from "lodash-es/range";


@Component({
  selector: "app-file-size-selector",
  template: `
    <label [for]="id">{{ label || 'File Size' }}</label>
    <select class="form-control input-sm"
            [(ngModel)]="fileSize"
            [disabled]="disabled"
            (ngModelChange)="changeFileSize($event)"
            [id]="id">
      @for (fileSize of fileSizes; track fileSize) {
        <option [ngValue]="fileSize">{{ formatFileSize(fileSize) }}</option>
      }
    </select>`,
  imports: [FormsModule]
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

  public fileSizes: number[] = range(0, 1000 * 1024, 50 * 1024).concat(range(1000 * 1024, 7000 * 1024, 1000 * 1024));
  public id = this.numberUtils.generateUid();

  ngOnInit(): void {
    this.logger.info("constructed with fileSize:", this.fileSize, "fileSizes:", this.fileSizes);
  }

  formatFileSize(fileSize: number): string {
    return fileSize === 0 ? "No Resizing" : this.numberUtils.humanFileSize(fileSize);
  }

  changeFileSize(fileSize: number) {
    this.logger.debug("emitting fileSizeChanged with value:", fileSize);
    this.fileSizeChanged.emit(fileSize);
  }

}
