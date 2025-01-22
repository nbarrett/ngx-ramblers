import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DescribedDimensions, SelectedDescribedDimensions, SQUARE } from "../../../models/aws-object.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { Dimensions } from "ngx-image-cropper";
import { coerceBooleanProperty } from "@angular/cdk/coercion";


@Component({
  selector: "app-aspect-ratio-selector",
  templateUrl: "./aspect-ratio-selector.html",
  standalone: false
})

export class AspectRatioSelectorComponent implements OnInit {
  private logger: Logger;
  public disabled: boolean;

  constructor(private numberUtils: NumberUtilsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("AspectRatioSelectorComponent", NgxLoggerLevel.OFF);
  }

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
    {width: 1116, height: 470, description: "Ramblers Landing page"},
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
