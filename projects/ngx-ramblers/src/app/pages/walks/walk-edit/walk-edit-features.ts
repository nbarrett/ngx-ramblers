import { Component, inject, Input, OnInit } from "@angular/core";
import { DisplayedWalk } from "../../../models/walk.model";

import { CategorisedFeatures, FEATURE_CATEGORIES, FeatureCategory } from "../../../models/walk-feature.model";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { SystemConfig } from "../../../models/system.model";
import { WalkFeatureListComponent } from "./walk-edit-feature-category";

@Component({
  selector: "[app-walk-edit-features]",
  imports: [
    WalkFeatureListComponent
  ],
  template: `
    <div class="img-thumbnail thumbnail-admin-edit">
      <div class="row ml-3">
        <div class="col-md-6">
          <app-walk-edit-feature-category [categorisedFeatures]="facilities" [displayedWalk]="displayedWalk"/>
        </div>
        <div class="col-md-6">
          <app-walk-edit-feature-category [categorisedFeatures]="accessibility" [displayedWalk]="displayedWalk"/>
        </div>
      </div>
    </div>
  `
})
export class WalkEditFeaturesComponent implements OnInit {
  stringUtils = inject(StringUtilsService);
  dateUtils = inject(DateUtilsService);

  @Input() config: SystemConfig;
  @Input() displayedWalk!: DisplayedWalk;

  featureCategories: CategorisedFeatures[] = FEATURE_CATEGORIES;
  facilities: CategorisedFeatures[] = this.featureCategories.filter(item => [FeatureCategory.FACILITIES, FeatureCategory.TRANSPORT].includes(item.category));
  accessibility: CategorisedFeatures[] = this.featureCategories.filter(item => [FeatureCategory.ACCESSIBILITY].includes(item.category));

  ngOnInit() {
    if (!this.displayedWalk.walk.features) {
      this.displayedWalk.walk.features = [];
    }
  }
}
