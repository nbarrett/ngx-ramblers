import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MapProvider, MapStyleInfo, mapProviderFromLabel, MAP_PROVIDER_OPTIONS, OS_MAP_STYLE_LIST } from "../../models/map.model";

export interface MapConfigData {
  provider?: MapProvider | string;
  osStyle?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  mapHeight?: number;
}

@Component({
  selector: "app-map-config-controls",
  template: `
    <div class="row mb-3 align-items-end">
      <div class="col-md-3">
        <label class="form-label" for="provider-select-{{id}}">Map Provider</label>
        <select class="form-select"
                id="provider-select-{{id}}"
                [(ngModel)]="config.provider"
                (ngModelChange)="onConfigChange()">
          @for (option of providerOptions; track option.key) {
            <option [ngValue]="option.value">{{ option.key }}</option>
          }
        </select>
      </div>
      @if (config.provider === MapProvider.OS) {
        <div class="col-md-3">
          <label class="form-label" for="style-select-{{id}}">OS Map Style</label>
          <select class="form-select"
                  id="style-select-{{id}}"
                  [(ngModel)]="config.osStyle"
                  (ngModelChange)="onConfigChange()">
            @for (style of osStyles; track style.key) {
              <option [value]="style.key">{{ style.name }}</option>
            }
          </select>
        </div>
      }
      <div class="col-md-3">
        <label for="map-height-{{id}}">Map Height (px)</label>
        <input type="number"
               class="form-control"
               id="map-height-{{id}}"
               [(ngModel)]="config.mapHeight"
               (ngModelChange)="onConfigChange()"
               min="300"
               max="900"
               step="10">
      </div>
      <div class="col-md-3">
        <label for="map-zoom-{{id}}">Zoom Level</label>
        <input type="number"
               class="form-control"
               id="map-zoom-{{id}}"
               [(ngModel)]="config.mapZoom"
               (ngModelChange)="onConfigChange()"
               min="5"
               max="18"
               step="0.1">
      </div>
    </div>
    <div class="row mb-3 align-items-end">
      <div class="col-md-3">
        <label for="center-lat-{{id}}">Center Latitude</label>
        <input type="number"
               class="form-control"
               id="center-lat-{{id}}"
               [(ngModel)]="centerLat"
               (ngModelChange)="updateMapCenter()"
               min="49"
               max="61"
               step="0.01">
      </div>
      <div class="col-md-3">
        <label for="center-lng-{{id}}">Center Longitude</label>
        <input type="number"
               class="form-control"
               id="center-lng-{{id}}"
               [(ngModel)]="centerLng"
               (ngModelChange)="updateMapCenter()"
               min="-8"
               max="2"
               step="0.01">
      </div>
      <ng-content></ng-content>
    </div>
  `,
  imports: [FormsModule]
})
export class MapConfigControls implements OnInit {
  @Input() config!: MapConfigData;
  @Input() id = "";
  @Output() configChange = new EventEmitter<MapConfigData>();

  osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;
  providerOptions = MAP_PROVIDER_OPTIONS;
  centerLat = 51.25;
  centerLng = 0.75;
  protected readonly MapProvider = MapProvider;

  ngOnInit() {
    this.normalizeProviderValue();
    if (this.config?.mapCenter) {
      this.centerLat = this.config.mapCenter[0];
      this.centerLng = this.config.mapCenter[1];
    }
  }

  updateMapCenter() {
    if (this.config && Number.isFinite(this.centerLat) && Number.isFinite(this.centerLng)) {
      this.config.mapCenter = [this.centerLat, this.centerLng];
      this.onConfigChange();
    }
  }

  onConfigChange() {
    this.normalizeProviderValue();
    this.configChange.emit(this.config);
  }

  private normalizeProviderValue() {
    const mappedValue = mapProviderFromLabel(this.config?.provider as string);
    if (mappedValue) {
      this.config.provider = mappedValue;
    }
  }
}
