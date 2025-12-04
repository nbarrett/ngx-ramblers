import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { MapStyleInfo, OS_MAP_STYLE_LIST } from "../../models/map.model";
import { KeyValue } from "../../functions/enums";
import { BadgeButtonComponent } from "../../modules/common/badge-button/badge-button";
import { faUndo } from "@fortawesome/free-solid-svg-icons";

export interface MapOverlayConfig {
  provider?: string;
  osStyle?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  mapHeight?: number;
  opacityNormal?: number;
  opacityHover?: number;
  textOpacity?: number;
  clusteringEnabled?: boolean;
  clusteringThreshold?: number;
  showControlsDefault?: boolean;
  allowControlsToggle?: boolean;
  showWaypointsDefault?: boolean;
  allowWaypointsToggle?: boolean;
  autoFitBounds?: boolean;
}

interface MapOverlayDefaults {
  provider: string;
  osStyle: string;
  mapCenter: [number, number];
  mapZoom: number;
  mapHeight: number;
  opacityNormal: number;
  opacityHover: number;
  textOpacity: number;
  clusteringEnabled: boolean;
  clusteringThreshold: number;
  showControlsDefault: boolean;
  allowControlsToggle: boolean;
  showWaypointsDefault: boolean;
  allowWaypointsToggle: boolean;
  autoFitBounds: boolean;
}

@Component({
  selector: "app-map-overlay-controls",
  styles: [`
    .editor-slider-group
      display: flex
      align-items: center
      gap: 0.5rem

    .editor-slider
      accent-color: var(--ramblers-colour-sunrise)
      width: 100%

    :host ::ng-deep input.editor-slider::-webkit-slider-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    :host ::ng-deep input.editor-slider::-moz-range-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    .editor-slider-value
      min-width: 45px
      font-size: 0.8rem
  `],
  template: `
    <div class="row align-items-end mb-2 g-2">
      <div class="col-md-3">
        <label class="form-label" for="provider-select-{{id}}">Map Provider</label>
        <select class="form-select form-select-sm"
                id="provider-select-{{id}}"
                [(ngModel)]="config.provider"
                (ngModelChange)="onChange()">
          @for (option of providerOptions; track option.key) {
            <option [ngValue]="option.key">{{ option.value }}</option>
          }
        </select>
      </div>
      @if (config.provider === 'os') {
        <div class="col-md-3">
          <label class="form-label" for="style-select-{{id}}">OS Map Style</label>
          <select class="form-select form-select-sm"
                  id="style-select-{{id}}"
                  [(ngModel)]="config.osStyle"
                  (ngModelChange)="onChange()">
            @for (style of osStyles; track style.key) {
              <option [ngValue]="style.key">{{ style.name }}</option>
            }
          </select>
        </div>
      }
    </div>

    <div class="row align-items-end mb-2 g-2">
      <div class="col-md-2">
        <label class="form-label" for="zoom-input-{{id}}">Zoom Level</label>
        <div class="editor-slider-group">
          <input type="range"
                 id="zoom-input-{{id}}"
                 class="form-range editor-slider"
                 min="5"
                 max="18"
                 step="0.1"
                 [(ngModel)]="config.mapZoom"
                 (input)="onChange()"
                 (ngModelChange)="onChange()">
          <span class="text-muted editor-slider-value">{{ config.mapZoom | number:"1.1-1" }}</span>
        </div>
      </div>
      <div class="col-md-2">
        <label class="form-label" for="height-input-{{id}}">Map Height (px)</label>
        <div class="editor-slider-group">
          <input type="range"
                 id="height-input-{{id}}"
                 class="form-range editor-slider"
                 min="300"
                 max="900"
                 step="10"
                 [(ngModel)]="config.mapHeight"
                 (input)="onChange()"
                 (ngModelChange)="onChange()">
          <span class="text-muted editor-slider-value">{{ config.mapHeight }}</span>
        </div>
      </div>
      <div class="col-md-2">
        <label class="form-label" for="center-lat-{{id}}">Vertical</label>
        <div class="editor-slider-group">
          <input type="range"
                 id="center-lat-{{id}}"
                 class="form-range editor-slider"
                 min="49"
                 max="61"
                 step="0.01"
                 [(ngModel)]="centerLat"
                 (input)="updateMapCenter()"
                 (ngModelChange)="updateMapCenter()">
          <span class="text-muted editor-slider-value">{{ centerLat | number:"1.2-2" }}</span>
        </div>
      </div>
      <div class="col-md-2">
        <label class="form-label" for="center-lng-{{id}}">Horizontal</label>
        <div class="editor-slider-group">
          <input type="range"
                 id="center-lng-{{id}}"
                 class="form-range editor-slider"
                 min="-8"
                 max="2"
                 step="0.01"
                 [(ngModel)]="centerLng"
                 (input)="updateMapCenter()"
                 (ngModelChange)="updateMapCenter()">
          <span class="text-muted editor-slider-value">{{ centerLng | number:"1.2-2" }}</span>
        </div>
      </div>
      @if (showOpacityControls) {
        <div class="col-md-2">
          <label class="form-label" for="opacity-normal-{{id}}">Normal Opacity</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="opacity-normal-{{id}}"
                   class="form-range editor-slider"
                   min="0.1"
                   max="1"
                   step="0.1"
                   [(ngModel)]="config.opacityNormal"
                   (input)="onChange()"
                   (ngModelChange)="onChange()">
            <span class="text-muted editor-slider-value">{{ config.opacityNormal | number:"1.1-1" }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="opacity-hover-{{id}}">Hover Opacity</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="opacity-hover-{{id}}"
                   class="form-range editor-slider"
                   min="0.1"
                   max="1"
                   step="0.1"
                   [(ngModel)]="config.opacityHover"
                   (input)="onChange()"
                   (ngModelChange)="onChange()">
            <span class="text-muted editor-slider-value">{{ config.opacityHover | number:"1.1-1" }}</span>
          </div>
        </div>
        <div class="col-md-2">
          <label class="form-label" for="opacity-text-{{id}}">Text Opacity</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="opacity-text-{{id}}"
                   class="form-range editor-slider"
                   min="0.1"
                   max="1"
                   step="0.1"
                   [(ngModel)]="config.textOpacity"
                   (input)="onChange()"
                   (ngModelChange)="onChange()">
            <span class="text-muted editor-slider-value">{{ config.textOpacity | number:"1.1-1" }}</span>
          </div>
        </div>
      }
      @if (showClusteringControls) {
        <div class="col-md-2">
          <label class="form-label" for="clustering-threshold-{{id}}">Clustering Threshold</label>
          <div class="editor-slider-group">
            <input type="range"
                   id="clustering-threshold-{{id}}"
                   class="form-range editor-slider"
                   min="2"
                   max="100"
                   step="1"
                   [(ngModel)]="config.clusteringThreshold"
                   [disabled]="!config.clusteringEnabled"
                   (input)="onChange()"
                   (ngModelChange)="onChange()">
            <span class="text-muted editor-slider-value">{{ config.clusteringThreshold }}</span>
          </div>
        </div>
      }
    </div>

    <div class="row align-items-start mb-2 g-3">
      <div class="col-md-3">
        <div class="form-check">
          <input type="checkbox"
                 class="form-check-input"
                 id="map-controls-default-{{id}}"
                 [(ngModel)]="config.showControlsDefault"
                 (ngModelChange)="onChange()">
          <label class="form-check-label" for="map-controls-default-{{id}}">
            Show map options by default
          </label>
        </div>
      </div>
      <div class="col-md-3">
        <div class="form-check">
          <input type="checkbox"
                 class="form-check-input"
                 id="map-controls-toggle-{{id}}"
                 [(ngModel)]="config.allowControlsToggle"
                 (ngModelChange)="onChange()">
          <label class="form-check-label" for="map-controls-toggle-{{id}}">
            Allow visitors to toggle map options
          </label>
        </div>
      </div>
      @if (showWaypointControls) {
        <div class="col-md-3">
          <div class="form-check">
            <input type="checkbox"
                   class="form-check-input"
                   id="waypoints-default-{{id}}"
                   [(ngModel)]="config.showWaypointsDefault"
                   (ngModelChange)="onChange()">
            <label class="form-check-label" for="waypoints-default-{{id}}">
              Show waypoints by default
            </label>
          </div>
        </div>
        <div class="col-md-3">
          <div class="form-check">
            <input type="checkbox"
                   class="form-check-input"
                   id="waypoints-toggle-{{id}}"
                   [(ngModel)]="config.allowWaypointsToggle"
                   (ngModelChange)="onChange()">
            <label class="form-check-label" for="waypoints-toggle-{{id}}">
              Allow visitors to toggle waypoints
            </label>
          </div>
        </div>
      }
    </div>

    <div class="row align-items-start mb-2 g-3">
      <div class="col-md-3">
        <div class="form-check">
          <input type="checkbox"
                 class="form-check-input"
                 id="auto-fit-bounds-{{id}}"
                 [(ngModel)]="config.autoFitBounds"
                 (ngModelChange)="onChange()">
          <label class="form-check-label" for="auto-fit-bounds-{{id}}">
            Auto-fit map to routes
          </label>
        </div>
      </div>
      @if (showClusteringControls) {
        <div class="col-md-3">
          <div class="form-check">
            <input class="form-check-input"
                   type="checkbox"
                   id="clustering-enabled-{{id}}"
                   [(ngModel)]="config.clusteringEnabled"
                   (ngModelChange)="onChange()">
            <label class="form-check-label" for="clustering-enabled-{{id}}">
              Enable clustering
            </label>
          </div>
        </div>
      }
      <div class="col-md-3">
        <app-badge-button [icon]="faUndo"
                          caption="Reset to Defaults"
                          (click)="resetToDefaults()"/>
      </div>
    </div>
  `,
  imports: [CommonModule, FormsModule, BadgeButtonComponent]
})
export class MapOverlayControls implements OnInit {
  @Input() config!: MapOverlayConfig;
  @Input() id = "";
  @Input() defaults?: Partial<MapOverlayDefaults>;
  @Input() showOpacityControls = false;
  @Input() showClusteringControls = false;
  @Input() showWaypointControls = false;
  @Output() configChange = new EventEmitter<MapOverlayConfig>();

  providerOptions: KeyValue<string>[] = [
    { key: "osm", value: "OpenStreetMap" },
    { key: "os", value: "OS Maps" }
  ];
  osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;
  centerLat = 51.25;
  centerLng = 0.75;
  protected readonly faUndo = faUndo;

  private defaultConfig: MapOverlayDefaults = {
    provider: "osm",
    osStyle: "Leisure_27700",
    mapCenter: [51.25, 0.75],
    mapZoom: 10,
    mapHeight: 500,
    opacityNormal: 0.5,
    opacityHover: 0.2,
    textOpacity: 0.9,
    clusteringEnabled: true,
    clusteringThreshold: 10,
    showControlsDefault: true,
    allowControlsToggle: true,
    showWaypointsDefault: true,
    allowWaypointsToggle: true,
    autoFitBounds: true
  };

  ngOnInit() {
    if (this.defaults) {
      this.defaultConfig = { ...this.defaultConfig, ...this.defaults };
    }

    if (this.config?.mapCenter) {
      this.centerLat = this.config.mapCenter[0];
      this.centerLng = this.config.mapCenter[1];
    }

    this.ensureDefaults();
  }

  private ensureDefaults() {
    if (!this.config.provider) this.config.provider = this.defaultConfig.provider;
    if (!this.config.osStyle) this.config.osStyle = this.defaultConfig.osStyle;
    if (!this.config.mapCenter) this.config.mapCenter = this.defaultConfig.mapCenter;
    if (!this.config.mapZoom) this.config.mapZoom = this.defaultConfig.mapZoom;
    if (!this.config.mapHeight) this.config.mapHeight = this.defaultConfig.mapHeight;
    if (this.showOpacityControls) {
      if (!this.config.opacityNormal) this.config.opacityNormal = this.defaultConfig.opacityNormal;
      if (!this.config.opacityHover) this.config.opacityHover = this.defaultConfig.opacityHover;
      if (!this.config.textOpacity) this.config.textOpacity = this.defaultConfig.textOpacity;
    }
    if (this.showClusteringControls) {
      if (this.config.clusteringEnabled === undefined) this.config.clusteringEnabled = this.defaultConfig.clusteringEnabled;
      if (!this.config.clusteringThreshold) this.config.clusteringThreshold = this.defaultConfig.clusteringThreshold;
    }
  }

  updateMapCenter() {
    if (this.config && Number.isFinite(this.centerLat) && Number.isFinite(this.centerLng)) {
      this.config.mapCenter = [this.centerLat, this.centerLng];
      this.onChange();
    }
  }

  resetToDefaults() {
    this.config.provider = this.defaultConfig.provider;
    this.config.osStyle = this.defaultConfig.osStyle;
    this.config.mapCenter = [...this.defaultConfig.mapCenter];
    this.config.mapZoom = this.defaultConfig.mapZoom;
    this.config.mapHeight = this.defaultConfig.mapHeight;

    if (this.showOpacityControls) {
      this.config.opacityNormal = this.defaultConfig.opacityNormal;
      this.config.opacityHover = this.defaultConfig.opacityHover;
      this.config.textOpacity = this.defaultConfig.textOpacity;
    }

    if (this.showClusteringControls) {
      this.config.clusteringEnabled = this.defaultConfig.clusteringEnabled;
      this.config.clusteringThreshold = this.defaultConfig.clusteringThreshold;
    }

    this.centerLat = this.config.mapCenter[0];
    this.centerLng = this.config.mapCenter[1];
    this.onChange();
  }

  calculateResetColumnClass(): string {
    let usedCols = 2;
    if (this.showOpacityControls) usedCols += 6;
    if (this.showClusteringControls) usedCols += 4;
    const remainingCols = 12 - usedCols;
    return `col-md-${remainingCols}`;
  }

  onChange() {
    this.configChange.emit(this.config);
  }
}
