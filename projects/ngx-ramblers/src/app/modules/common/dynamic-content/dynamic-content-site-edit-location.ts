import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LocationRenderingMode, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { WalkLocationEditComponent } from "../../../pages/walks/walk-edit/walk-location-edit";
import { NotifierService } from "../../../services/notifier.service";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { StringUtilsService } from "../../../services/string-utils.service";

@Component({
  selector: "app-dynamic-content-site-edit-location",
  styleUrls: ["./dynamic-content.sass"],
  template: `
    @if (row?.location) {
      <div class="row mb-3">
        <div class="col-md-3">
          <label for="rendering-mode-{{rowIndex}}">Rendering Mode</label>
          <select class="form-control input-sm"
                  id="rendering-mode-{{rowIndex}}"
                  [(ngModel)]="row.location.renderingMode">
            @for (mode of renderingModes; track mode.value) {
              <option [ngValue]="mode.value">{{ stringUtils.asTitle(mode.value) }}</option>
            }
          </select>
        </div>
        <div class="col-md-3">
          <div class="form-check mt-4">
            <input class="form-check-input"
                   type="checkbox"
                   id="has-end-location-{{rowIndex}}"
                   [(ngModel)]="hasEndLocation"
                   (ngModelChange)="toggleEndLocation()">
            <label class="form-check-label" for="has-end-location-{{rowIndex}}">
              Has End Location
            </label>
          </div>
        </div>
      </div>

      <h6>Start Location</h6>
      <app-walk-location-edit
        [locationDetails]="row.location.start"
        [locationType]="'Start'"
        [notify]="notify"/>

      @if (hasEndLocation) {
        <h6 class="mt-3">End Location</h6>
        <app-walk-location-edit
          [locationDetails]="row.location.end"
          [locationType]="'End'"
          [notify]="notify"/>
      }
    }
  `,
  imports: [FormsModule, WalkLocationEditComponent]
})
export class DynamicContentSiteEditLocationComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditLocationComponent", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  stringUtils = inject(StringUtilsService);

  @Input() row: PageContentRow;
  @Input() rowIndex: number;

  renderingModes: KeyValue<string>[] = enumKeyValues(LocationRenderingMode);
  hasEndLocation = false;
  notify = this.notifierService.createAlertInstance();

  ngOnInit() {
    this.hasEndLocation = !!this.row.location?.end;
    if (!this.row.location) {
      this.logger.warn("Location row initialized without location data");
    }
  }

  toggleEndLocation() {
    if (this.hasEndLocation && !this.row.location.end) {
      this.row.location.end = {
        latitude: null,
        longitude: null,
        grid_reference_6: null,
        grid_reference_8: null,
        grid_reference_10: null,
        postcode: "",
        description: "",
        w3w: ""
      };
    } else if (!this.hasEndLocation) {
      this.row.location.end = null;
    }
  }
}
