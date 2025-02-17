import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DescribedDimensions, SelectedDescribedDimensions } from "../../../models/aws-object.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { Dimensions } from "ngx-image-cropper";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FormsModule } from "@angular/forms";
import { RAMBLERS_LANDING_PAGE, SQUARE } from "../../../models/images.model";


@Component({
    selector: "app-aspect-ratio-selector",
  template: `
    <label [for]="id">{{ label || 'Aspect Ratio' }}</label>
    <select class="form-control input-sm"
            [(ngModel)]="dimension"
            [disabled]="disabled"
            (ngModelChange)="changeAspectRatioSettings($event)"
            [id]="id">
      @for (aspectRatio of dimensions; track aspectRatio) {
        <option [ngValue]="aspectRatio">{{ formatAspectRatio(aspectRatio) }}</option>
      }
    </select>`,
    imports: [FormsModule]
})

export class AspectRatioSelectorComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("AspectRatioSelectorComponent", NgxLoggerLevel.ERROR);
  private numberUtils = inject(NumberUtilsService);
  public disabled: boolean;
  @Input()
  public dimensionsDescription: string;
  @Input()
  public label: string;

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }
  @Output() dimensionsChanged: EventEmitter<DescribedDimensions> = new EventEmitter();
  @Output() initialised: EventEmitter<SelectedDescribedDimensions> = new EventEmitter();

  public dimension: DescribedDimensions;
  public dimensions: DescribedDimensions[] = [
    {width: 1, height: 1, description: SQUARE},
    {width: 3, height: 2, description: "Classic 35mm still"},
    {width: 4, height: 3, description: "Default"},
    {width: 1.6180, height: 1, description: "The golden ratio"},
    {width: 5, height: 7, description: "Portrait"},
    {width: 16, height: 10, description: "A common computer screen ratio"},
    {width: 16, height: 9, description: "HD video standard"},
    {width: 940, height: 300, description: "Home page"},
    {width: 1116, height: 470, description: RAMBLERS_LANDING_PAGE},
  ];
  id: any;

  ngOnInit(): void {
    this.id = this.numberUtils.generateUid();
    this.dimension = this.dimensions.find(item => item.description === (this.dimensionsDescription || SQUARE));
    this.initialised.emit({describedDimensions: this.dimension, preselected: !!this.dimensionsDescription});
    this.logger.debug("constructed with dimensionsDescription", this.dimensionsDescription, "dimension:", this.dimension);
  }

  formatAspectRatio(dimensions: DescribedDimensions): string {
    return this.aspectRatioMaintained(dimensions) ? "Free selection" : `${dimensions.width} x ${dimensions.height} ${dimensions.description ?
      " (" + dimensions.description + ")" : ""}`;
  }

  private aspectRatioMaintained(dimensions: Dimensions): boolean {
    return dimensions.width === 1 && dimensions.height === 1;
  }

  changeAspectRatioSettings(describedDimensions: DescribedDimensions) {
    this.logger.debug("emitting dimensionsChanged with value:", describedDimensions);
    this.dimensionsChanged.emit(describedDimensions);
  }

}
