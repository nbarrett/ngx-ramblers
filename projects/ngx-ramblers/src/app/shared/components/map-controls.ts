import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { MapProvider, MapStyleInfo, MAP_PROVIDER_LABELS, OS_MAP_STYLE_LIST, OUTDOOR_OS_STYLE } from "../../models/map.model";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { isUndefined } from "es-toolkit/compat";
import { asNumber } from "../../functions/numbers";

export interface MapControlsConfig {
  showProvider?: boolean;
  showStyle?: boolean;
  showHeight?: boolean;
  showSmoothScroll?: boolean;
  showAutoShowAll?: boolean;
  minHeight?: number;
  maxHeight?: number;
  heightStep?: number;
}

export interface MapControlsState {
  provider: MapProvider;
  osStyle: string;
  mapHeight?: number;
  smoothScroll?: boolean;
  autoShowAll?: boolean;
}

@Component({
  selector: "app-map-controls",
    imports: [FormsModule, FontAwesomeModule, TooltipDirective],
  styles: [`
    .map-controls-gap
      gap: 0.5rem
      row-gap: 0.25rem

    .map-control-item
      gap: 0.25rem
      flex-shrink: 0

    .map-control-label
      font-size: 0.75rem
      margin-right: 10px

    .map-control-value
      min-width: 32px
      font-size: 0.7rem

    .map-control-range
      width: 70px
      accent-color: var(--ramblers-colour-sunrise)

    :host ::ng-deep input.map-control-range::-webkit-slider-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    :host ::ng-deep input.map-control-range::-moz-range-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    .map-control-select
      width: auto
      min-width: 100px

    @media (max-width: 576px)
      .map-controls-gap
        gap: 0.25rem
        row-gap: 0.125rem

      .map-control-range
        width: 60px

      .map-control-select
        min-width: 85px
        font-size: 0.8rem

      .map-control-value
        min-width: 28px
  `],
  template: `
    <div class="d-flex flex-wrap align-items-center map-controls-gap">
      @if (config.showProvider) {
        <div class="d-flex align-items-center map-control-item">
          <span class="small mx-2 text-nowrap">Provider</span>
          <select class="form-select form-select-sm map-control-select"
                  [ngModel]="state.provider"
                  (ngModelChange)="onProviderChange($event)">
            <option [ngValue]="MapProvider.OSM">{{ providerLabels[MapProvider.OSM] }}</option>
            <option [ngValue]="MapProvider.OS" [disabled]="!hasOsApiKey">
              {{ hasOsApiKey ? providerLabels[MapProvider.OS] : providerLabels[MapProvider.OS] + " (API key required)" }}
            </option>
          </select>
        </div>
      }

      @if (config.showStyle && state.provider === MapProvider.OS) {
        <div class="d-flex align-items-center map-control-item">
          <span class="small mx-2 text-nowrap">Style</span>
          <select class="form-select form-select-sm map-control-select"
                  [ngModel]="state.osStyle"
                  (ngModelChange)="onStyleChange($event)">
            @for (style of osStyles; track style.key) {
              <option [value]="style.key" [title]="style.description">{{ style.name }}</option>
            }
          </select>
          <fa-icon class="ms-2 colour-mintcake"
                   [icon]="faCircleInfo"
                   [tooltip]="selectedStyleInfo()?.description"
                   placement="auto">
          </fa-icon>
        </div>
      }

      @if (config.showHeight && !isUndefined(state.mapHeight)) {
        <div class="d-flex align-items-center map-control-item">
          <span class="small mx-2 text-nowrap">Height</span>
          <input type="range" class="form-range map-control-range"
                 [min]="config.minHeight || 300"
                 [max]="config.maxHeight || 900"
                 [step]="config.heightStep || 10"
                 [ngModel]="state.mapHeight"
                 (input)="onHeightInput($event)"
                 [title]="'Map height: ' + state.mapHeight + 'px'">
          <span class="ms-1 text-muted small map-control-value">{{ state.mapHeight }}px</span>
        </div>
      }

      @if (config.showSmoothScroll && !isUndefined(state.smoothScroll)) {
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="smooth-scroll-toggle"
                 [ngModel]="state.smoothScroll"
                 (ngModelChange)="onSmoothScrollChange($event)"
                 title="Auto scroll on view">
          <label class="form-check-label small text-nowrap map-control-label" for="smooth-scroll-toggle">
            Auto scroll on view
          </label>
        </div>
      }

      @if (config.showAutoShowAll && !isUndefined(state.autoShowAll)) {
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" id="auto-show-toggle"
                 [ngModel]="state.autoShowAll"
                 (ngModelChange)="onAutoShowAllChange($event)"
                 title="Auto-show walk details popups">
          <label class="form-check-label small text-nowrap map-control-label" for="auto-show-toggle">
            Auto-show popups
          </label>
        </div>
      }
      <ng-content/>
    </div>
  `
})
export class MapControls implements OnInit {
  @Input() config: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: false,
    showSmoothScroll: false,
    showAutoShowAll: false,
    minHeight: 300,
    maxHeight: 900,
    heightStep: 10
  };

  @Input() state: MapControlsState = {
    provider: MapProvider.OSM,
    osStyle: OUTDOOR_OS_STYLE
  };

  @Output() stateChange = new EventEmitter<MapControlsState>();
  @Output() providerChange = new EventEmitter<MapProvider>();
  @Output() styleChange = new EventEmitter<string>();
  @Output() heightChange = new EventEmitter<number>();
  @Output() smoothScrollChange = new EventEmitter<boolean>();
  @Output() autoShowAllChange = new EventEmitter<boolean>();

  public osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;
  public hasOsApiKey = false;
  protected readonly faCircleInfo = faCircleInfo;
  protected readonly isUndefined = isUndefined;
  protected readonly MapProvider = MapProvider;
  protected readonly providerLabels = MAP_PROVIDER_LABELS;

  private mapTiles = inject(MapTilesService);

  ngOnInit() {
    this.hasOsApiKey = this.mapTiles.hasOsApiKey();
  }

  onProviderChange(value: MapProvider) {
    this.state = { ...this.state, provider: value };
    this.stateChange.emit(this.state);
    this.providerChange.emit(value);
  }

  onStyleChange(value: string) {
    this.state = { ...this.state, osStyle: value };
    this.stateChange.emit(this.state);
    this.styleChange.emit(value);
  }

  onHeightInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = asNumber(input.value);
    const height = Math.min(this.config.maxHeight || 900, Math.max(this.config.minHeight || 300, isNaN(value) ? (this.state.mapHeight || 520) : value));
    this.state = { ...this.state, mapHeight: height };
    this.stateChange.emit(this.state);
    this.heightChange.emit(height);
  }

  onSmoothScrollChange(value: boolean) {
    this.state = { ...this.state, smoothScroll: value };
    this.stateChange.emit(this.state);
    this.smoothScrollChange.emit(value);
  }

  onAutoShowAllChange(value: boolean) {
    this.state = { ...this.state, autoShowAll: value };
    this.stateChange.emit(this.state);
    this.autoShowAllChange.emit(value);
  }

  selectedStyleInfo(): MapStyleInfo | undefined {
    return this.osStyles.find(s => s.key === this.state.osStyle);
  }
}
