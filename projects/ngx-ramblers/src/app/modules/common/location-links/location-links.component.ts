import { Component, Input, inject } from "@angular/core";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { RelatedLinkComponent } from "../related-links/related-link";
import { CopyIconComponent } from "../copy-icon/copy-icon";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NumberUtilsService } from "../../../services/number-utils.service";

@Component({
  selector: "app-location-links",
  standalone: true,
  imports: [RelatedLinkComponent, CopyIconComponent, TooltipDirective],
  template: `
    @if (location) {
      @if (showDescription && location?.description) {
        <div app-related-link [mediaWidth]="mediaWidth">
          <div title>
            {{ elementName("Description") }}
          </div>
          <div content>
            {{ location.description }}
          </div>
        </div>
      }
      @if (location?.postcode) {
        <div app-related-link [mediaWidth]="mediaWidth">
          <div title>
            <app-copy-icon [value]="location.postcode"
                           [elementName]="elementName('Postcode')"/>
            {{ elementName("Postcode") }}
          </div>
          <div content>
            <a [href]="googleMapsService.urlForPostcode(location.postcode)"
               target="_blank" rel="noopener"
               tooltip="View postcode {{ location.postcode }} on Google Maps">
              {{ location.postcode }}
              <small class="text-muted ms-1">(Maps)</small>
            </a>
          </div>
        </div>
      }
      @if (gridReferenceValue()) {
        <div app-related-link [mediaWidth]="mediaWidth">
          <div title>
            <app-copy-icon [value]="gridReferenceValue()"
                           [elementName]="elementName('Grid Ref')"/>
            {{ elementName("Grid Ref") }}
          </div>
          <div content>
            <a [href]="gridReferenceLink()"
               target="_blank" rel="noopener"
               tooltip="View grid reference {{ gridReferenceValue() }} on GridReferenceFinder">
              {{ gridReferenceValue() }}
              <small class="text-muted ms-1">(Map)</small>
            </a>
          </div>
        </div>
      }
      @if (location?.latitude && location?.longitude) {
        <div app-related-link [mediaWidth]="mediaWidth">
          <div title>
            <app-copy-icon [value]="coordinateValue()"
                           [elementName]="elementName('Coordinates')"/>
            {{ elementName("Coordinates") }}
          </div>
          <div content>
            {{ coordinateValue() }}
          </div>
        </div>
      }
    }
  `
})
export class LocationLinksComponent {

  @Input() location: LocationDetails | null = null;
  @Input() mediaWidth = 70;
  @Input() labelPrefix = "";
  @Input() showDescription = true;

  private display = inject(WalkDisplayService);
  googleMapsService = inject(GoogleMapsService);
  private numberUtils = inject(NumberUtilsService);

  elementName(name: string): string {
    return this.labelPrefix ? `${this.labelPrefix} ${name}` : name;
  }

  gridReferenceValue(): string | null {
    return this.location ? this.display.gridReferenceFrom(this.location) : null;
  }

  gridReferenceLink(): string | null {
    const gridReference = this.gridReferenceValue();
    return gridReference ? this.display.gridReferenceLink(gridReference) : null;
  }

  coordinateValue(): string {
    return `${this.numberUtils.asNumber(this.location.latitude, 4)}, ${this.numberUtils.asNumber(this.location.longitude, 4)}`;
  }
}
