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
      <div class="row ms-3">
        <div class="col-md-6">
          <app-walk-edit-feature-category [featureCategory]="FeatureCategory.FACILITIES" [displayedWalk]="displayedWalk"/>
          <app-walk-edit-feature-category [featureCategory]="FeatureCategory.TRANSPORT" [displayedWalk]="displayedWalk"/>
        </div>
        <div class="col-md-6">
          <app-walk-edit-feature-category [featureCategory]="FeatureCategory.ACCESSIBILITY" [displayedWalk]="displayedWalk"/>
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
  transport: CategorisedFeatures[] = this.featureCategories.filter(item => [FeatureCategory.TRANSPORT].includes(item.category));
  facilities: CategorisedFeatures[] = this.featureCategories.filter(item => [FeatureCategory.FACILITIES].includes(item.category));
  accessibility: CategorisedFeatures[] = this.featureCategories.filter(item => [FeatureCategory.ACCESSIBILITY].includes(item.category));

  protected readonly FeatureCategory = FeatureCategory;

  ngOnInit() {
    if (!this.displayedWalk?.walk.groupEvent.accessibility) {
      this.displayedWalk.walk.groupEvent.accessibility = [];
    }
  }
}
