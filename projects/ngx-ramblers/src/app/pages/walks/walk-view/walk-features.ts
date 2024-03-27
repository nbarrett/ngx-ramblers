import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { Metadata } from "../../../models/ramblers-walks-manager";

@Component({
  selector: "app-walk-features",
  template: `
    <div class="event-panel rounded event-panel-inner">
      <h1>Features</h1>
      <app-walk-feature *ngFor="let feature of features" [metadata]="feature"></app-walk-feature>
    </div>`
})

export class WalkFeaturesComponent implements OnInit {
  private logger: Logger;
  @Input() public features: Metadata[];

  constructor(
    public googleMapsService: GoogleMapsService,
    public display: WalkDisplayService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkDetailsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:features:", this.features);
  }
}
