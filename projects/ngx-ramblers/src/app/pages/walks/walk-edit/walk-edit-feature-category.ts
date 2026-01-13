import { Component, inject, Input, OnInit } from "@angular/core";
import { CategorisedFeatures, FEATURE_CATEGORIES, FeatureCategory } from "../../../models/walk-feature.model";
import { WalkEditFeatureCategoryComponent } from "../walk-view/walk-feature";
import { DisplayedWalk } from "../../../models/walk.model";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { sortBy } from "../../../functions/arrays";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Metadata } from "../../../models/ramblers-walks-manager";

@Component({
  selector: "app-walk-edit-feature-category",
  imports: [
    WalkEditFeatureCategoryComponent
  ],
  template: `
    @for (categorisedFeature of categorisedFeatures; track categorisedFeature.category) {
      <fieldset>
        <legend>
          <span class="h5">{{ categorisedFeature.category }}</span>
        </legend>
        @for (feature of categorisedFeature.features; track feature.code) {
          <div class="form-check">
            <input type="checkbox"
                   id="feature-{{ feature.code }}"
                   [disabled]="inputDisabled"
                   [checked]="ramblersWalksAndEventsService.featureSelected(feature.code, displayedWalk?.walk)"
                   (change)="toggleFeature(feature.code)"
                   class="form-check-input">
            <label for="feature-{{ feature.code }}" class="form-check-label">
              <app-walk-feature [feature]="feature"
                                [disabled]="inputDisabled || !ramblersWalksAndEventsService.featureSelected(feature.code, displayedWalk?.walk)"/>
            </label>
          </div>
        }
      </fieldset>
    }
  `
})
export class WalkFeatureListComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("WalkFeatureListComponent", NgxLoggerLevel.ERROR);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  allFeatures = this.ramblersWalksAndEventsService.allFeatures();
  featureCategories: CategorisedFeatures[] = FEATURE_CATEGORIES;
  protected categorisedFeatures: CategorisedFeatures[] = [];
  @Input() displayedWalk!: DisplayedWalk;
  @Input() featureCategory!: FeatureCategory;
  @Input() inputDisabled = false;
  private featureKey: string;

  async ngOnInit() {
    this.featureKey = this.featureCategory.toLowerCase();
    this.categorisedFeatures = this.featureCategories.filter(item => item.category === this.featureCategory);
    this.logger.info("ngOnInit for featureKey", this.featureKey, "with categorised features:", this.categorisedFeatures);
  }

  toggleFeature(featureCode: string): void {
    if (this.inputDisabled) {
      return;
    }
    const features: Metadata[] = this.displayedWalk?.walk?.groupEvent[this.featureKey];
    if (!features) {
      this.logger.info("initialising features for featureKey:", this.featureKey);
      this.displayedWalk.walk.groupEvent[this.featureKey] = [];
    }
    const index = features.findIndex(feature => feature.code === featureCode);
    if (index > -1) {
      features.splice(index, 1);
    } else {
      const feature = this.allFeatures.find(f => f.code === featureCode);
      if (feature) {
        features.push(feature);
      }
    }
    this.displayedWalk.walk.groupEvent[this.featureKey] = features.sort(sortBy("code"));
    this.logger.info("toggleFeature", featureCode, index > -1 ? "off" : "on", "in", this.featureKey, features);
  }

}
