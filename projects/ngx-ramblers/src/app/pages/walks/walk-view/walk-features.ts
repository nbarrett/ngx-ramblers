import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { Metadata } from "../../../models/ramblers-walks-manager";
import { WalkFeatureComponent } from "./walk-feature";

@Component({
    selector: "app-walk-features",
    template: `
    <div class="event-panel rounded event-panel-inner">
      <h1>Features</h1>
      @for (feature of features; track feature) {
        <app-walk-feature [metadata]="feature"></app-walk-feature>
      }
    </div>`,
    imports: [WalkFeatureComponent]
})

export class WalkFeaturesComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkFeaturesComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  display = inject(WalkDisplayService);

  @Input() public features: Metadata[];

  ngOnInit() {
    this.logger.info("ngOnInit:features:", this.features);
  }
}
