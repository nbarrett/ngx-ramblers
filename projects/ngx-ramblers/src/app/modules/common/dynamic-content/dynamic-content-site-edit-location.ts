import { Component, inject, Input, OnInit, QueryList, ViewChildren } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LocationRenderingMode, PageContentRow } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { FormsModule } from "@angular/forms";
import { WalkLocationEditComponent } from "../../../pages/walks/walk-edit/walk-location-edit";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { enumKeyValues, KeyValue } from "../../../functions/enums";
import { StringUtilsService } from "../../../services/string-utils.service";
import { INITIALISED_LOCATION } from "../../../models/walk.model";
import { cloneDeep } from "es-toolkit/compat";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";

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

      <div class="row">
        <div [class]="hasEndLocation ? 'col-md-6' : 'col-md-12'">
          <app-walk-location-edit
            [locationDetails]="row.location.start"
            [locationType]="'Start'"
            [notify]="notify"/>
        </div>
        @if (hasEndLocation) {
          <div class="col-md-6 mt-4 mt-md-0">
            <app-walk-location-edit
              [locationDetails]="row.location.end"
              [locationType]="'End'"
              [notify]="notify"/>
          </div>
        }
      </div>

      @if (showAlertMessage()) {
        <div class="row">
          <div class="col-12 mt-3">
            <div class="alert {{notifyTarget.alertClass}}">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              @if (notifyTarget.alertTitle) {
                <strong class="ms-2">{{ notifyTarget.alertTitle }}:</strong>
              }
              <span class="ms-1">{{ notifyTarget.alertMessage }}</span>
            </div>
          </div>
        </div>
      }
    }
  `,
  imports: [FormsModule, WalkLocationEditComponent, FontAwesomeModule]
})
export class DynamicContentSiteEditLocation implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentSiteEditLocation", NgxLoggerLevel.INFO);
  stringUtils = inject(StringUtilsService);

  @Input() row: PageContentRow;
  @Input() rowIndex: number;
  private notifierService = inject(NotifierService);
  notifyTarget: AlertTarget = {};
  notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  @ViewChildren(WalkLocationEditComponent) locationComponents: QueryList<WalkLocationEditComponent>;

  renderingModes: KeyValue<string>[] = enumKeyValues(LocationRenderingMode);
  hasEndLocation = false;

  ngOnInit() {
    this.ensureLocationDefaults();
    this.hasEndLocation = !!this.row.location?.end;
  }

  toggleEndLocation() {
    if (this.hasEndLocation && !this.row.location.end) {
      this.row.location.end = cloneDeep(INITIALISED_LOCATION);
    } else if (!this.hasEndLocation) {
      this.row.location.end = null;
    }
    setTimeout(() => {
      this.locationComponents?.forEach(component => {
        component.invalidateMapSize();
      });
    }, 100);
  }

  showAlertMessage(): boolean {
    return this.notifyTarget.busy || this.notifyTarget.showAlert;
  }

  private ensureLocationDefaults() {
    if (!this.row.location) {
      this.logger.info("Location row initialized without location data");
      this.row.location = {
        renderingMode: LocationRenderingMode.HIDDEN,
        start: cloneDeep(INITIALISED_LOCATION)
      };
    }
    if (!this.row.location.start) {
      this.row.location.start = cloneDeep(INITIALISED_LOCATION);
    }
    if (this.row.location.end && !this.hasEndLocation) {
      this.hasEndLocation = true;
    }
  }
}
