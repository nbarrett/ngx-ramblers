import { Component, DoCheck, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { DEFAULT_OS_STYLE, MapProvider, MapStyleInfo, MAP_PROVIDER_OPTIONS, mapProviderFromLabel, OS_MAP_STYLE_LIST } from "../../models/map.model";
import { BadgeButtonComponent } from "../../modules/common/badge-button/badge-button";
import { faUndo } from "@fortawesome/free-solid-svg-icons";
import { isUndefined } from "es-toolkit/compat";

interface MapSliderControl {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: () => number;
  onInput: (value: number) => void;
  format?: (value: number) => string;
}

export interface MapOverlayConfig {
  provider?: MapProvider | string;
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
  provider: MapProvider;
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
            <option [ngValue]="option.value">{{ option.key }}</option>
          }
        </select>
      </div>
      @if (config.provider === MapProvider.OS) {
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
      @for (slider of sliderControls; track slider.key) {
        <div [ngClass]="sliderColumnClass">
          <label class="form-label" [for]="sliderId(slider.key)">{{ slider.label }}</label>
          <div class="editor-slider-group">
            <input type="range"
                   class="form-range editor-slider"
                   [id]="sliderId(slider.key)"
                   [min]="slider.min"
                   [max]="slider.max"
                   [step]="slider.step"
                   [(ngModel)]="sliderValues[slider.key]"
                   (ngModelChange)="onSliderChange(slider, $event)">
            <span class="text-muted editor-slider-value">
              {{ slider.format ? slider.format(sliderValues[slider.key]) : sliderValues[slider.key] }}
            </span>
          </div>
        </div>
      }
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
        <div [ngClass]="sliderColumnClass">
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

    <div class="row align-items-center mb-2 g-3">
      <div class="col-md-3 col-6">
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
      <div class="col-md-3 col-6">
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
        <div class="col-md-3 col-6">
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
        <div class="col-md-3 col-6">
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

    <div class="row align-items-center mb-2 g-3">
      <div class="col-md-3 col-6">
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
        <div class="col-md-3 col-6">
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
      <div class="col-md-3 col-6">
        <app-badge-button [icon]="faUndo"
                          caption="Reset to Defaults"
                          (click)="resetToDefaults()"/>
      </div>
    </div>
  `,
  imports: [CommonModule, FormsModule, BadgeButtonComponent]
})
export class MapOverlayControls implements OnInit, DoCheck {
  @Input() config!: MapOverlayConfig;
  @Input() id = "";
  @Input() defaults?: Partial<MapOverlayDefaults>;
  @Input() showOpacityControls = false;
  @Input() showClusteringControls = false;
  @Input() showWaypointControls = false;
  @Output() configChange = new EventEmitter<MapOverlayConfig>();

  providerOptions = MAP_PROVIDER_OPTIONS;
  osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;
  centerLat = 51.25;
  centerLng = 0.75;
  protected readonly faUndo = faUndo;
  protected readonly MapProvider = MapProvider;
  private lastCenter: [number, number] | undefined;
  sliderValues: Record<string, number> = {};
  sliderControls: MapSliderControl[] = [
    {
      key: "zoom",
      label: "Zoom Level",
      min: 0,
      max: 18,
      step: 0.1,
      value: () => this.config?.mapZoom ?? this.defaultConfig.mapZoom,
      onInput: value => this.updateZoomSlider(value),
      format: value => value.toFixed(1)
    },
    {
      key: "height",
      label: "Map Height (px)",
      min: 300,
      max: 900,
      step: 10,
      value: () => this.config?.mapHeight ?? this.defaultConfig.mapHeight,
      onInput: value => this.updateHeightSlider(value)
    },
    {
      key: "vertical",
      label: "Vertical",
      min: 49,
      max: 61,
      step: 0.01,
      value: () => this.centerLat,
      onInput: value => this.updateCenterLat(value),
      format: value => value.toFixed(2)
    },
    {
      key: "horizontal",
      label: "Horizontal",
      min: -8,
      max: 2,
      step: 0.01,
      value: () => this.centerLng,
      onInput: value => this.updateCenterLng(value),
      format: value => value.toFixed(2)
    }
  ];
  get sliderColumnClass(): string {
    return this.showClusteringControls
      ? "col-xl-2 col-lg-3 col-md-4 col-sm-6 col-12"
      : "col-lg-3 col-md-6 col-sm-6 col-12";
  }

  private defaultConfig: MapOverlayDefaults = {
    provider: MapProvider.OSM,
    osStyle: DEFAULT_OS_STYLE,
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
    this.normalizeProviderValue();
    this.ensureDefaults();
    this.syncCenterFromConfig();
    this.syncSliderValues();
  }

  ngDoCheck() {
    this.normalizeProviderValue();
    this.syncCenterFromConfig();
    this.syncSliderValues();
  }

  private ensureDefaults() {
    if (this.config.provider === "OpenStreetMap") {
      this.config.provider = MapProvider.OSM;
    } else if (this.config.provider === "OS Maps") {
      this.config.provider = MapProvider.OS;
    }
    if (!this.config.provider) this.config.provider = this.defaultConfig.provider;
    if (!this.config.osStyle) this.config.osStyle = this.defaultConfig.osStyle;
    if (!this.config.mapCenter) this.config.mapCenter = [...this.defaultConfig.mapCenter] as [number, number];
    if (!this.config.mapZoom) this.config.mapZoom = this.defaultConfig.mapZoom;
    if (!this.config.mapHeight) this.config.mapHeight = this.defaultConfig.mapHeight;
    if (this.showOpacityControls) {
      if (!this.config.opacityNormal) this.config.opacityNormal = this.defaultConfig.opacityNormal;
      if (!this.config.opacityHover) this.config.opacityHover = this.defaultConfig.opacityHover;
      if (!this.config.textOpacity) this.config.textOpacity = this.defaultConfig.textOpacity;
    }
    if (this.showClusteringControls) {
      if (isUndefined(this.config.clusteringEnabled)) this.config.clusteringEnabled = this.defaultConfig.clusteringEnabled;
      if (!this.config.clusteringThreshold) this.config.clusteringThreshold = this.defaultConfig.clusteringThreshold;
    }
    if (isUndefined(this.config.autoFitBounds)) this.config.autoFitBounds = this.defaultConfig.autoFitBounds;
  }

  updateMapCenter() {
    if (this.config && Number.isFinite(this.centerLat) && Number.isFinite(this.centerLng)) {
      this.config.mapCenter = [this.centerLat, this.centerLng];
      this.lastCenter = [...this.config.mapCenter] as [number, number];
      this.disableAutoFit();
      this.onChange();
    }
  }

  onZoomChange() {
    this.disableAutoFit();
    this.onChange();
  }

  resetToDefaults() {
    this.config.provider = this.defaultConfig.provider;
    this.config.osStyle = this.defaultConfig.osStyle;
    this.config.mapCenter = [...this.defaultConfig.mapCenter] as [number, number];
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

    this.config.autoFitBounds = this.defaultConfig.autoFitBounds;
    this.centerLat = this.config.mapCenter[0];
    this.centerLng = this.config.mapCenter[1];
    this.lastCenter = [...this.config.mapCenter] as [number, number];
    this.onChange();
  }

  calculateResetColumnClass(): string {
    let usedCols = 2;
    if (this.showOpacityControls) usedCols += 6;
    if (this.showClusteringControls) usedCols += 4;
    const remainingCols = 12 - usedCols;
    return `col-md-${remainingCols}`;
  }

  private syncCenterFromConfig() {
    if (this.config?.mapCenter) {
      if (!this.lastCenter || !this.centersEqual(this.config.mapCenter, this.lastCenter)) {
        this.centerLat = this.config.mapCenter[0];
        this.centerLng = this.config.mapCenter[1];
        this.lastCenter = [...this.config.mapCenter] as [number, number];
      }
    }
  }

  private centersEqual(current: [number, number], previous: [number, number]): boolean {
    return current[0] === previous[0] && current[1] === previous[1];
  }

  onChange() {
    this.normalizeProviderValue();
    this.configChange.emit(this.config);
  }

  private disableAutoFit() {
    if (this.config) {
      this.config.autoFitBounds = false;
    }
  }

  sliderId(key: string): string {
    return `${key}-input-${this.id}`;
  }

  onSliderChange(slider: MapSliderControl, value: number) {
    const bounded = this.boundSliderValue(slider, value);
    this.sliderValues[slider.key] = bounded;
    slider.onInput(bounded);
  }

  private syncSliderValues() {
    this.sliderControls.forEach(control => {
      const nextValue = this.boundSliderValue(control, control.value());
      if (this.sliderValues[control.key] !== nextValue) {
        this.sliderValues[control.key] = nextValue;
      }
    });
  }

  private boundSliderValue(slider: MapSliderControl, value: number): number {
    const boundedMin = Math.min(slider.min, slider.max);
    const boundedMax = Math.max(slider.min, slider.max);
    if (value < boundedMin) {
      return boundedMin;
    }
    if (value > boundedMax) {
      return boundedMax;
    }
    return value;
  }

  private updateZoomSlider(value: number) {
    if (this.config) {
      this.config.mapZoom = value;
    }
    this.onZoomChange();
  }

  private updateHeightSlider(value: number) {
    if (this.config) {
      this.config.mapHeight = value;
    }
    this.onChange();
  }

  private updateCenterLat(value: number) {
    this.centerLat = value;
    this.updateMapCenter();
  }

  private updateCenterLng(value: number) {
    this.centerLng = value;
    this.updateMapCenter();
  }

  private normalizeProviderValue() {
    const mappedValue = mapProviderFromLabel(this.config.provider as string);
    if (mappedValue) {
      this.config.provider = mappedValue;
    }
  }
}
