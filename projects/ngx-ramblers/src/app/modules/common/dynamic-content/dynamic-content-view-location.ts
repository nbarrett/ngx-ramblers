import { Component, Input } from "@angular/core";
import { PageContentRow, LocationRenderingMode } from "../../../models/content-text.model";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { inject } from "@angular/core";

@Component({
  selector: "app-dynamic-content-view-location",
  template: `
    @if (row?.location && row.location.renderingMode === LocationRenderingMode.VISIBLE) {
      <div class="row mt-3 mb-3">
        <div class="col-12">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">Location Details</h5>
              <div class="row">
                <div [class]="row.location.end ? 'col-md-6' : 'col-12'">
                  <h6>{{ row.location.end ? 'Start' : '' }} Location</h6>
                  <p><strong>Description:</strong> {{ row.location.start.description }}</p>
                  @if (row.location.start.postcode) {
                    <p><strong>Postcode:</strong> {{ row.location.start.postcode }}</p>
                  }
                  @if (row.location.start.grid_reference_10) {
                    <p><strong>Grid Reference:</strong> {{ row.location.start.grid_reference_10 }}</p>
                  }
                  @if (row.location.start.latitude && row.location.start.longitude) {
                    <p><strong>Coordinates:</strong>
                      {{ numberUtils.asNumber(row.location.start.latitude, 4) }},
                      {{ numberUtils.asNumber(row.location.start.longitude, 4) }}
                    </p>
                  }
                </div>
                @if (row.location.end) {
                  <div class="col-md-6">
                    <h6>End Location</h6>
                    <p><strong>Description:</strong> {{ row.location.end.description }}</p>
                    @if (row.location.end.postcode) {
                      <p><strong>Postcode:</strong> {{ row.location.end.postcode }}</p>
                    }
                    @if (row.location.end.grid_reference_10) {
                      <p><strong>Grid Reference:</strong> {{ row.location.end.grid_reference_10 }}</p>
                    }
                    @if (row.location.end.latitude && row.location.end.longitude) {
                      <p><strong>Coordinates:</strong>
                        {{ numberUtils.asNumber(row.location.end.latitude, 4) }},
                        {{ numberUtils.asNumber(row.location.end.longitude, 4) }}
                      </p>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  imports: []
})
export class DynamicContentViewLocationComponent {
  @Input() row: PageContentRow;

  numberUtils = inject(NumberUtilsService);
  protected readonly LocationRenderingMode = LocationRenderingMode;
}
