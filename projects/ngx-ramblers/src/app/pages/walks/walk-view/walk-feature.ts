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
          <app-svg [height]="17" [width]="17" [icon]="'i-' + metadata.code" colour="rgb(155, 200, 171)"/>
          <div class="ml-3">{{ metadata.description }}</div>
        </div>
      </div>
    </div>`,
    imports: [SvgComponent]
})

export class WalkFeatureComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkFeatureComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  display = inject(WalkDisplayService);
  @Input() public metadata: Metadata;

  ngOnInit() {
    this.logger.info("ngOnInit", this.metadata);
  }

}
