import { Component, inject, Input } from "@angular/core";
import { CategorisedFeatures } from "../../../models/walk-feature.model";
import { WalkEditFeatureCategoryComponent } from "../walk-view/walk-feature";
import { DisplayedWalk } from "../../../models/walk.model";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { sortBy } from "../../../functions/arrays";

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
          <div class="custom-checkbox custom-control">
            <input type="checkbox"
                   id="feature-{{ feature.code }}"
                   [checked]="ramblersWalksAndEventsService.featureSelected(feature.code, displayedWalk.walk)"
                   (change)="toggleFeature(feature.code)"
                   class="form-checkbox custom-control-input">
            <label for="feature-{{ feature.code }}" class="custom-control-label">
              <app-walk-feature [metadata]="feature"
                                [disabled]="!ramblersWalksAndEventsService.featureSelected(feature.code, displayedWalk.walk)"/>
            </label>
          </div>
        }
      </fieldset>
    }
  `
})
export class WalkFeatureListComponent {
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  allFeatures = this.ramblersWalksAndEventsService.allFeatures();
  @Input() categorisedFeatures: CategorisedFeatures[] = [];
  @Input() displayedWalk!: DisplayedWalk;

  toggleFeature(featureCode: string): void {
    const index = this.displayedWalk.walk.features.findIndex(feature => feature.code === featureCode);
    if (index > -1) {
      this.displayedWalk.walk.features.splice(index, 1);
    } else {
      const feature = this.allFeatures.find(f => f.code === featureCode);
      if (feature) {
        this.displayedWalk.walk.features.push(feature);
      }
    }
    this.displayedWalk.walk.features = this.displayedWalk.walk.features.sort(sortBy("code"));
  }

}
