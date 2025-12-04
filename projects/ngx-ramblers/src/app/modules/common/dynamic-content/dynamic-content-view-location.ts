import { Component, Input } from "@angular/core";
import { PageContentRow, LocationRenderingMode } from "../../../models/content-text.model";
import { LocationLinksComponent } from "../location-links/location-links.component";

@Component({
  selector: "app-dynamic-content-view-location",
  template: `
    @if (row?.location && row.location.renderingMode === LocationRenderingMode.VISIBLE) {
      <div class="row g-3 mt-2">
        <div [class]="row.location.end ? 'col-md-6' : 'col-12'">
          <app-location-links
            [location]="row.location.start"
            [labelPrefix]="row.location.end ? 'Start' : ''"
            [showDescription]="true"
            [mediaWidth]="90"/>
        </div>
        @if (row.location.end) {
          <div class="col-md-6">
            <app-location-links
              [location]="row.location.end"
              [labelPrefix]="'End'"
              [showDescription]="true"
              [mediaWidth]="90"/>
          </div>
        }
      </div>
    }
  `,
  imports: [LocationLinksComponent]
})
export class DynamicContentViewLocation {
  @Input() row: PageContentRow;
  protected readonly LocationRenderingMode = LocationRenderingMode;
}
