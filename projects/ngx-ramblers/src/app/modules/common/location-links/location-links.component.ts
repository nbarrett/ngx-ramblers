import { Component, HostBinding, Input, inject } from "@angular/core";
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { RelatedLinkComponent } from "../related-links/related-link";
import { CopyIconComponent } from "../copy-icon/copy-icon";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { GridReferenceDigits } from "../../../models/walks-config.model";

@Component({
  selector: "app-location-links",
  imports: [RelatedLinkComponent, CopyIconComponent, TooltipDirective],
  styles: [`
    :host.stacked
      display: grid
      grid-template-columns: repeat(2, minmax(0, 1fr))
      gap: var(--space-2)
      font-size: .9rem
      overflow-wrap: anywhere
    :host.inline
      display: flex
      flex-wrap: wrap
      align-items: center
      column-gap: 1.5rem
      row-gap: 0.25rem
  `],
  template: `
    @if (location) {
      @if (showDescription && location?.description) {
        <div app-related-link [stacked]="stacked" [mediaWidth]="inline ? 0 : mediaWidth">
          <div title>
            {{ elementName("Description") }}
          </div>
          <div content>
            {{ location.description }}
          </div>
        </div>
      }
      @if (location?.postcode || postcodePending || showPostcodePlaceholder) {
        <div app-related-link [stacked]="stacked" [mediaWidth]="inline ? 0 : mediaWidth">
          <div title>
            <app-copy-icon [value]="location.postcode" [disabled]="postcodePending || !location.postcode"
                           [elementName]="elementName('Postcode')"/>
            {{ elementName(postcodeIsNearest ? "Nearest postcode" : "Postcode") }}
          </div>
          <div content>
            @if (postcodePending) {
              <span class="text-muted">Updating…</span>
            } @else if (!location.postcode) {
              <span class="text-muted">Unavailable</span>
            } @else {
            <a [href]="display.postcodeLink(location.postcode, location)"
               tooltip="Show postcode {{ location.postcode }} on the map">
              {{ location.postcode }}
              <small class="text-muted ms-1">(Map)</small>
            </a>
            }
          </div>
        </div>
      }
      @if (showGridReferenceVariants) {
        @for (reference of gridReferences(); track reference.label) {
          <div app-related-link [stacked]="stacked" [mediaWidth]="inline ? 0 : mediaWidth">
            <div title><app-copy-icon [value]="reference.value" [elementName]="reference.label"/>{{ reference.label }}</div>
            <div content>{{ reference.value }}</div>
          </div>
        }
      } @else if (gridReferenceValue()) {
        <div app-related-link [stacked]="stacked" [mediaWidth]="inline ? 0 : mediaWidth">
          <div title>
            <app-copy-icon [value]="gridReferenceValue()"
                           [elementName]="elementName('Grid Ref')"/>
            {{ elementName("Grid Ref") }}
          </div>
          <div content>
            <a [href]="gridReferenceLink()"
               tooltip="Show grid reference {{ gridReferenceValue() }} on the map">
              {{ gridReferenceValue() }}
              <small class="text-muted ms-1">(Map)</small>
            </a>
          </div>
        </div>
      }
      @if (showNationalGridCoordinates && nationalGridCoordinates) {
        <div app-related-link [stacked]="stacked" [mediaWidth]="inline ? 0 : mediaWidth">
          <div title><app-copy-icon [value]="nationalGridCoordinates" elementName="Eastings / northings"/>Eastings / northings</div>
          <div content>{{ nationalGridCoordinates }}</div>
        </div>
      }
      @if (location?.latitude != null && location?.longitude != null) {
        <div app-related-link [stacked]="stacked" [mediaWidth]="inline ? 0 : mediaWidth">
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
  @HostBinding("class.stacked") @Input() stacked = false;
  @Input() showGridReferenceVariants = false;
  @Input() showNationalGridCoordinates = false;
  @Input() nationalGridCoordinates = "";
  @Input() coordinatePrecision = 4;
  @Input() postcodeIsNearest = false;
  @Input() postcodePending = false;
  @Input() showPostcodePlaceholder = false;
  @HostBinding("class.inline") @Input() inline = false;

  private display = inject(WalkDisplayService);
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

  gridReferences(): {label: string; value: string}[] {
    return [
      {label: "6-figure · 100 m", value: this.display.formatGrid(this.location?.grid_reference_6 || "", GridReferenceDigits.SIX)},
      {label: "8-figure · 10 m", value: this.display.formatGrid(this.location?.grid_reference_8 || "", GridReferenceDigits.EIGHT)},
      {label: "10-figure · 1 m", value: this.display.formatGrid(this.location?.grid_reference_10 || "", GridReferenceDigits.TEN)}
    ].filter(reference => !!reference.value);
  }

  coordinateValue(): string {
    return `${this.numberUtils.asNumber(this.location.latitude, this.coordinatePrecision)}, ${this.numberUtils.asNumber(this.location.longitude, this.coordinatePrecision)}`;
  }
}
