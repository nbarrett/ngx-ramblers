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
    styles: [`
      :host
        display: block

      .event-panel-inner
        margin-bottom: 0

      h1
        font-size: 16px
        font-weight: bold

      .feature-grid
        display: grid
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr))
        gap: 4px 16px
    `],
    template: `
      <div [class.event-panel]="shaded" [class.event-panel-inner]="shaded" [class.rounded]="shaded">
        <h1>Features</h1>
        <div class="feature-grid">
          @for (feature of featuresService.combinedFeatures(extendedGroupEvent.groupEvent); track feature.code) {
            <app-walk-feature [feature]="feature"/>
          }
        </div>
      </div>`,
    imports: [WalkEditFeatureCategoryComponent]
})

export class WalkFeaturesComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkFeaturesComponent", NgxLoggerLevel.ERROR);
  googleMapsService = inject(GoogleMapsService);
  featuresService = inject(FeaturesService);
  display = inject(WalkDisplayService);

  @Input() public extendedGroupEvent: ExtendedGroupEvent;
  @Input() public shaded = true;

  ngOnInit() {
    this.logger.info("ngOnInit:features:", this.extendedGroupEvent);
  }
}
