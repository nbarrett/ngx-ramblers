import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { WalkDisplayService } from "../walk-display.service";
import { WalkEditFeatureCategoryComponent } from "./walk-feature";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { FeaturesService } from "../../../services/features.service";

@Component({
    selector: "app-walk-features",
    template: `
      <div class="event-panel rounded event-panel-inner">
        <h1>Features</h1>
        @for (feature of featuresService.combinedFeatures(extendedGroupEvent.groupEvent); track feature.code) {
          <app-walk-feature [feature]="feature"/>
        }
      </div>`,
    imports: [WalkEditFeatureCategoryComponent]
})

export class WalkFeaturesComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkFeaturesComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  featuresService = inject(FeaturesService);
  display = inject(WalkDisplayService);

  @Input() public extendedGroupEvent: ExtendedGroupEvent;

  ngOnInit() {
    this.logger.info("ngOnInit:features:", this.extendedGroupEvent);
  }
}
