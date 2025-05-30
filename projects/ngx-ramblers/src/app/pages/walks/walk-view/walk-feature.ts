import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { Metadata } from "../../../models/ramblers-walks-manager";
import { SvgComponent } from "../../../modules/common/svg/svg";

@Component({
  selector: "app-walk-feature",
  template: `
    <div class="row">
      <div class="col-sm-12">
        <div class="form-inline">
          <app-svg [disabled]="disabled" [height]="17" [width]="17" [icon]="'i-' + feature.code"
                   colour="rgb(155, 200, 171)"/>
          <div class="ml-3">{{ feature.description }}</div>
        </div>
      </div>
    </div>`,
  imports: [SvgComponent]
})

export class WalkEditFeatureCategoryComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkFeatureComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  display = inject(WalkDisplayService);
  @Input() public feature: Metadata;
  @Input() public disabled: boolean;

  ngOnInit() {
    this.logger.info("ngOnInit", this.feature);
  }

}
