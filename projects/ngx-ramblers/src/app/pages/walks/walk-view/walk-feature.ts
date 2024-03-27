import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { Metadata } from "../../../models/ramblers-walks-manager";

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
    </div>`
})

export class WalkFeatureComponent implements OnInit {
  private logger: Logger;
  @Input() public metadata: Metadata;

  constructor(
    public googleMapsService: GoogleMapsService,
    public display: WalkDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkFeatureComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit", this.metadata);
  }

}
