import { Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import * as L from "leaflet";
import { FormsModule } from "@angular/forms";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { GroupAreasService } from "../../services/group-areas.service";
import { GroupAreaConfig, SharedDistrictInfo } from "../../models/group-area.model";
import { SharedDistrictStyle } from "../../models/system.model";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { MapControls, MapControlsConfig, MapControlsState } from "../../shared/components/map-controls";
import { MapOverlay } from "../../shared/components/map-overlay";
import { MapControlsStateService } from "../../shared/services/map-controls-state.service";
import { MapRecreationService } from "../../shared/services/map-recreation.service";
import { MapProvider, OUTDOOR_OS_STYLE } from "../../models/map.model";
import { UiActionsService } from "../../services/ui-actions.service";
import { StoredValue } from "../../models/ui-actions";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { AreaMapClickAction, AreaMapData, LegendPosition, PageContent, PageContentRow } from "../../models/content-text.model";
import { Subscription } from "rxjs";
import { isArray, isFunction, isNull, isNumber, isString, isUndefined, keys } from "es-toolkit/compat";
import { range } from "es-toolkit";
import { NgSelectComponent } from "@ng-select/ng-select";
import { SystemConfigService } from "../../services/system/system-config.service";
import { BroadcastService } from "../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { asNumber } from "../../functions/numbers";
import { HeightResizerComponent } from "../../modules/common/height-resizer/height-resizer";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-area-map",
  styles: [`
    .map-container
      width: 100%
      height: 480px
      border-radius: 0.5rem
      overflow: hidden
    :host ::ng-deep .leaflet-control-attribution
      font-size: 0.75rem
    :host ::ng-deep .group-name-label span
      -webkit-font-smoothing: subpixel-antialiased !important
      -moz-osx-font-smoothing: auto !important
      text-rendering: geometricPrecision !important
      transform: translate(-50%, -50%) !important
      position: relative !important

    .map-wrapper
      position: relative

    .map-controls
      border-bottom: 1px solid #dee2e6
      margin-bottom: 0 !important
      gap: 1rem

    .map-control-item
      gap: 0.25rem
      flex-shrink: 0

    .map-control-range
      width: 80px
      accent-color: var(--ramblers-colour-sunrise)

    .map-control-value
      min-width: 45px
      font-size: 0.8rem

    :host ::ng-deep .groups-select .ng-select-container
      flex-wrap: wrap

    :host ::ng-deep .groups-select .ng-value-container
      flex-wrap: wrap
      max-width: 100%

    :host ::ng-deep .groups-select .ng-value
      margin-bottom: 2px

    :host ::ng-deep .bootstrap-tooltip
      background: rgba(60, 60, 60, 0.9) !important
      border-radius: 3px !important
      padding: 4px 6px !important
      font-size: 11px !important
      line-height: 1.2 !important
      color: white !important
      font-weight: 500 !important
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important
      white-space: nowrap !important
      max-width: none !important

    :host ::ng-deep .bootstrap-tooltip *
      white-space: nowrap !important

    :host ::ng-deep .bootstrap-tooltip .tooltip-arrow
      border-top-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .bootstrap-tooltip.bs-tooltip-bottom .tooltip-arrow
      border-bottom-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .bootstrap-tooltip.bs-tooltip-left .tooltip-arrow
      border-left-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .bootstrap-tooltip.bs-tooltip-right .tooltip-arrow
      border-right-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-content-wrapper
      border-radius: 6px
      padding: 6px

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-content
      margin: 0
      min-width: 0
      line-height: 1

    :host ::ng-deep .area-action-leaflet-popup .badge
      cursor: pointer
      padding: 4px 8px
      font-size: 11px
      font-weight: 500

    :host ::ng-deep .group-name-label
      width: auto !important
      white-space: nowrap !important

    :host ::ng-deep .group-name-label span
      white-space: nowrap !important
      max-width: none !important
      margin: 2px

    :host ::ng-deep .area-action-leaflet-popup .badge:hover
      opacity: 0.85

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-tip
      background: white

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-close-button
      color: #000
      font-size: 18px
      padding: 0
      top: -8px
      right: -8px
      width: 20px
      height: 20px
      line-height: 20px
      text-align: center
      background: white
      border-radius: 50%
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-close-button:hover
      background: #f8f9fa

    .map-loading
      display: flex
      flex-direction: column
      align-items: center
      gap: 12px
      color: #6c757d
      font-weight: 600
      font-size: 1.1rem
      letter-spacing: 0.01em

    .map-loading-icon
      font-size: 2.8rem
      color: var(--ramblers-colour-sunrise, #e2a100)
      display: inline-flex

    .map-loading-text
      animation: pulse 2.2s ease-in-out infinite

    @keyframes pulse
      0%
        opacity: 0.75
      50%
        opacity: 0.95
      100%
        opacity: 0.75

    .map-legend
      position: absolute
      background: rgba(255, 255, 255, 0.95)
      border-radius: 6px
      padding: 8px 12px
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)
      z-index: 1000
      max-height: 60%
      overflow-y: auto
      font-size: 12px

    .map-legend.top-left
      top: 10px
      left: 10px

    .map-legend.top-right
      top: 10px
      right: 10px

    .map-legend.bottom-left
      bottom: 30px
      left: 10px

    .map-legend.bottom-right
      bottom: 30px
      right: 10px

    .map-legend-title
      font-weight: 600
      margin-bottom: 6px
      font-size: 13px
      border-bottom: 1px solid #dee2e6
      padding-bottom: 4px

    .map-legend-item
      display: flex
      align-items: center
      gap: 8px
      padding: 3px 0
      cursor: pointer
      border-radius: 4px
      transition: background-color 0.15s ease

    .map-legend-item:hover
      background-color: rgba(0, 0, 0, 0.05)

    .map-legend-color
      width: 16px
      height: 16px
      border-radius: 3px
      flex-shrink: 0
      border: 1px solid rgba(0, 0, 0, 0.2)

    .map-legend-label
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
      max-width: 180px

    .map-legend-below
      display: flex
      flex-wrap: wrap
      background: rgba(255, 255, 255, 0.95)
      border-radius: 6px
      padding: 8px 12px
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)
      margin-top: 8px
      font-size: 12px
      gap: 4px 16px

    .map-legend-below .map-legend-title
      width: 100%
      margin-bottom: 4px

    .map-legend-below .map-legend-item
      display: flex
      align-items: center
      gap: 6px
      padding: 2px 0
  `],
  template: `
    @if (standalone) {
      @if (showControls) {
        <div class="rounded-top img-thumbnail p-2 map-controls">
          <app-map-controls
            [config]="mapControlsConfig"
            [state]="mapControlsState"
            (providerChange)="onProviderChange($event)"
            (styleChange)="onStyleChange($event)"
            (heightChange)="onHeightChange($event)">
            <div class="d-flex align-items-center flex-wrap" style="gap: 0.5rem;">
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Opacity</span>
                <input type="range" class="form-range map-control-range" min="0.1" max="1.0" step="0.1"
                       [(ngModel)]="opacityNormal" (input)="onOpacityChange()">
                <span class="ms-1 text-muted small map-control-value">{{ opacityNormal }}</span>
              </div>
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Hover</span>
                <input type="range" class="form-range map-control-range" min="0.1" max="1.0" step="0.1"
                       [(ngModel)]="opacityHover" (input)="onOpacityChange()">
                <span class="ms-1 text-muted small map-control-value">{{ opacityHover }}</span>
              </div>
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Text</span>
                <input type="range" class="form-range map-control-range" min="0.1" max="1.0" step="0.1"
                       [(ngModel)]="textOpacity" (input)="onOpacityChange()">
                <span class="ms-1 text-muted small map-control-value">{{ textOpacity }}</span>
              </div>
              @if (!preview) {
                <div class="d-flex align-items-start map-control-item flex-grow-1" style="min-width: 250px;">
                  <span class="small mx-1 text-nowrap mt-1">Groups</span>
                  <ng-select
                    [items]="availableGroups"
                    [multiple]="true"
                    [closeOnSelect]="false"
                    [searchable]="true"
                    [clearable]="true"
                    placeholder="All groups"
                    [(ngModel)]="selectedGroups"
                    (change)="onGroupSelectionChange()"
                    class="flex-grow-1 groups-select">
                  </ng-select>
                </div>
              }
            </div>
          </app-map-controls>
        </div>
      }
    }
    <div class="map-wrapper">
      @if (dataLoading) {
        <div class="map-container card shadow d-flex align-items-center justify-content-center rounded"
             [style.height.px]="mapHeight">
          <div class="map-loading">
            <fa-icon class="map-loading-icon" [icon]="faSpinner" [spin]="true" [pulse]="true"></fa-icon>
            <div class="map-loading-text">Loading area map data…</div>
          </div>
        </div>
      } @else if (showMap && options) {
        <div class="map-container"
             [style.height.px]="mapHeight"
             leaflet
             [leafletOptions]="options"
             [leafletLayers]="layers"
             [leafletFitBounds]="fitBounds"
             (leafletMapReady)="onMapReady($event)">
        </div>
        @if (showLegend && legendItems.length > 0 && legendPosition !== LegendPosition.BELOW_MAP) {
          <div class="map-legend" [class]="legendPosition">
            <div class="map-legend-title">Groups</div>
            @for (item of legendItems; track item.name) {
              <div class="map-legend-item"
                   (mouseenter)="onLegendItemHover($event, item.name, true)"
                   (mouseleave)="onLegendItemHover($event, item.name, false)">
                <div class="map-legend-color" [style.background]="item.color"></div>
                <div class="map-legend-label" [title]="item.name">{{ item.name }}</div>
              </div>
            }
          </div>
        }
        <app-height-resizer compact
                            [height]="mapHeight"
                            [minHeight]="200"
                            [maxHeight]="1200"
                            (heightChange)="onResizerHeightChange($event)"/>
      }
      @if (standalone) {
        <app-map-overlay
          [showControls]="showControls"
          [allowWaypointsToggle]="false"
          (toggleControls)="toggleControls()">
        </app-map-overlay>
      }
    </div>
    @if (showLegend && legendItems.length > 0 && legendPosition === LegendPosition.BELOW_MAP) {
      <div class="map-legend-below">
        <div class="map-legend-title">Groups</div>
        @for (item of legendItems; track item.name) {
          <div class="map-legend-item"
               (mouseenter)="onLegendItemHover($event, item.name, true)"
               (mouseleave)="onLegendItemHover($event, item.name, false)">
            <div class="map-legend-color" [style.background]="item.color"></div>
            <div class="map-legend-label">{{ item.name }}</div>
          </div>
        }
      </div>
    }
  `,
  imports: [FormsModule, LeafletModule, MapControls, MapOverlay, NgSelectComponent, HeightResizerComponent, FontAwesomeModule]
})
export class AreaMap implements OnInit, OnDestroy, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("AreaMap", NgxLoggerLevel.ERROR);
  private _row?: PageContentRow;
  private _pageContent?: PageContent;
  @Input() region?: string;
  @Input() preview = false;
  @Input() previewSharedDistrictStyle?: SharedDistrictStyle;
  public dataLoading = true;
  protected readonly faSpinner = faSpinner;
  protected readonly LegendPosition = LegendPosition;

  @Input() set row(value: PageContentRow | undefined) {
    this._row = value;
    if (this.isInitialized) {
      this.initializeComponent();
    }
  }

  get row(): PageContentRow | undefined {
    return this._row;
  }

  @Input() set pageContent(value: PageContent | undefined) {
    this._pageContent = value;
    if (this.isInitialized) {
      this.initializeComponent();
    }
  }

  get pageContent(): PageContent | undefined {
    return this._pageContent;
  }

  public options: any;
  public layers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  public showMap = true;
  public mapHeight = 480;
  public mapKey = 0;
  public provider: MapProvider = MapProvider.OSM;
  public osStyle = OUTDOOR_OS_STYLE;
  public opacityNormal = 0.5;
  public opacityHover = 0.8;
  public textOpacity = 0.9;
  public showControls = true;
  public selectedGroups: string[] = [];
  public availableGroups: string[] = [];
  public clickAction: AreaMapClickAction = AreaMapClickAction.GROUP_WEBSITE;
  public showLegend = false;
  public legendPosition: LegendPosition = LegendPosition.TOP_RIGHT;
  public legendItems: { name: string; color: string }[] = [];
  private areaLayerMap: Map<string, L.GeoJSON> = new Map();
  private areaDataMap: Map<string, GroupAreaConfig> = new Map();
  private legendHoverTimeout: any = null;
  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false,
    minHeight: 300,
    maxHeight: 1200,
    heightStep: 10
  };
  public mapControlsState: MapControlsState = {
    provider: MapProvider.OSM,
    osStyle: OUTDOOR_OS_STYLE,
    mapHeight: 480
  };
  private mapRef: L.Map | undefined;
  private areaColors: Record<string, string> = {};
  private isInitialized = false;
  private cmsSettingsSubscription?: Subscription;
  private labelPlacements: L.Bounds[] = [];
  private hoverTimeout: any = null;
  private sharedDistricts: Record<string, SharedDistrictInfo> = {};
  private sharedDistrictStyle: SharedDistrictStyle = SharedDistrictStyle.FIRST_GROUP;
  private mainAreaGroupCodes: string[] = [];
  private stripePatternContainer: HTMLElement | null = null;
  private stripePatternCounter = 0;
  private areas = inject(GroupAreasService);
  private tiles = inject(MapTilesService);
  private mapControlsStateService = inject(MapControlsStateService);
  private mapRecreation = inject(MapRecreationService);
  private uiActions = inject(UiActionsService);
  private systemConfigService = inject(SystemConfigService);
  private broadcastService = inject(BroadcastService);
  private cmsSettings?: AreaMapData;

  private savedCenter: L.LatLng | null = null;
  private savedZoom = 9;
  private preserveNextView = false;

  get standalone(): boolean {
    return !this.row;
  }
  ngOnInit() {
    this.logger.info("AreaMapComponent ngOnInit started");
    this.isInitialized = true;
    this.initializeComponent();
    this.logger.info("AreaMapComponent ngOnInit completed");
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["previewSharedDistrictStyle"] && !changes["previewSharedDistrictStyle"].firstChange && this.isInitialized) {
      this.logger.info("previewSharedDistrictStyle changed:", changes["previewSharedDistrictStyle"].currentValue);
      this.sharedDistrictStyle = changes["previewSharedDistrictStyle"].currentValue || SharedDistrictStyle.FIRST_GROUP;
      this.preserveCurrentView();
      this.rebuildMap();
    }
  }

  private preserveCurrentView() {
    if (this.mapRef) {
      try {
        this.savedCenter = this.mapRef.getCenter();
        this.savedZoom = this.mapRef.getZoom();
        this.preserveNextView = true;
        this.logger.info("Preserved current view:", { center: this.savedCenter, zoom: this.savedZoom });
      } catch (e) {
        this.logger.warn("Could not preserve current view:", e);
      }
    }
  }

  ngOnDestroy() {
    this.cmsSettingsSubscription?.unsubscribe();
    this.clearHoverTimeout();
    this.clearLegendHoverTimeout();
    if (this.stripePatternContainer) {
      this.stripePatternContainer.remove();
      this.stripePatternContainer = null;
    }
  }

  private initializeComponent() {
    if (this.row && this.pageContent) {
      this.logger.info("Initializing CMS mode with full context");
      this.initializeCmsMode();
    } else if (this.row && !this.pageContent) {
      this.logger.info("Initializing CMS preview mode (no persistence)");
      this.initializeCmsMode();
    } else {
      this.initializeStandaloneMode();
    }

    this.logger.info("Calling rebuildMap from initializeComponent");
    this.rebuildMap();
  }

  private initializeCmsMode() {
    this.logger.info("Initializing CMS mode");

    if (this.row && !this.row.areaMap) {
      this.row.areaMap = this.defaultAreaMapData();
    }

    if (this.row?.areaMap) {
      this.cmsSettings = this.row.areaMap;
    }

    this.region = this.cmsSettings?.region;
    this.mapHeight = this.cmsSettings?.mapHeight || 480;
    this.provider = (this.cmsSettings?.provider as MapProvider) || this.provider;
    this.osStyle = this.cmsSettings?.osStyle || this.osStyle;
    this.showControls = false;
    this.opacityNormal = this.cmsSettings?.opacityNormal || 0.5;
    this.opacityHover = this.cmsSettings?.opacityHover || 0.8;
    this.textOpacity = this.cmsSettings?.textOpacity || 0.9;
    this.selectedGroups = this.cmsSettings?.selectedGroups || [];
    this.clickAction = this.uiActions.initialValueFor(StoredValue.AREA_MAP_CLICK_ACTION, AreaMapClickAction.GROUP_WEBSITE) as AreaMapClickAction;
    this.areaColors = this.cmsSettings?.areaColors || {};
    this.showLegend = this.cmsSettings?.showLegend ?? false;
    this.legendPosition = this.cmsSettings?.legendPosition || LegendPosition.TOP_RIGHT;
    if (this.cmsSettings?.sharedDistrictStyle) {
      this.sharedDistrictStyle = this.cmsSettings.sharedDistrictStyle;
    }

    this.logger.info("CMS settings for map position:", {
      mapCenter: this.cmsSettings?.mapCenter,
      mapZoom: this.cmsSettings?.mapZoom
    });

    if (this.cmsSettings?.mapCenter && this.cmsSettings?.mapZoom) {
      this.savedCenter = L.latLng(this.cmsSettings.mapCenter[0], this.cmsSettings.mapCenter[1]);
      this.savedZoom = this.cmsSettings.mapZoom;
      this.preserveNextView = true;
      this.logger.info("Restored CMS map position:", {
        savedCenter: this.savedCenter,
        savedZoom: this.savedZoom
      });
    } else {
      this.logger.info("No CMS map position to restore");
    }

    this.mapControlsState = {
      provider: this.provider,
      osStyle: this.osStyle,
      mapHeight: this.mapHeight
    };

    if (!this.cmsSettingsSubscription) {
      this.cmsSettingsSubscription = this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_CHANGED, (event: NamedEvent<any>) => {
        if (event.data === this.row && this.row?.areaMap) {
          const selectedGroupsChanged = JSON.stringify(this.row.areaMap.selectedGroups) !== JSON.stringify(this.selectedGroups);
          const opacityNormalChanged = this.row.areaMap.opacityNormal !== this.opacityNormal;
          const opacityHoverChanged = this.row.areaMap.opacityHover !== this.opacityHover;
          const textOpacityChanged = this.row.areaMap.textOpacity !== this.textOpacity;
          const heightChanged = this.row.areaMap.mapHeight !== this.mapHeight;
          const zoomChanged = this.row.areaMap.mapZoom !== this.savedZoom;
          const centerChanged = this.row.areaMap.mapCenter &&
            (!this.savedCenter ||
             this.row.areaMap.mapCenter[0] !== this.savedCenter.lat ||
             this.row.areaMap.mapCenter[1] !== this.savedCenter.lng);
          const providerChanged = this.row.areaMap.provider !== this.provider;
          const osStyleChanged = this.row.areaMap.osStyle !== this.osStyle;

          if (selectedGroupsChanged) {
            this.selectedGroups = this.row.areaMap.selectedGroups || [];
          }

          if (opacityNormalChanged) {
            this.opacityNormal = this.row.areaMap.opacityNormal;
          }

          if (opacityHoverChanged) {
            this.opacityHover = this.row.areaMap.opacityHover;
          }

          if (textOpacityChanged) {
            this.textOpacity = this.row.areaMap.textOpacity;
          }

          if (heightChanged) {
            this.mapHeight = this.row.areaMap.mapHeight;
            setTimeout(() => this.mapRef?.invalidateSize(true), 0);
          }

          if (providerChanged) {
            this.provider = this.row.areaMap.provider as MapProvider;
            this.mapControlsState.provider = this.provider;
          }

          if (osStyleChanged) {
            this.osStyle = this.row.areaMap.osStyle || this.osStyle;
            this.mapControlsState.osStyle = this.osStyle;
          }

          if (zoomChanged && this.mapRef) {
            this.savedZoom = this.row.areaMap.mapZoom;
            this.mapRef.off("zoomend");
            this.mapRef.setZoom(this.row.areaMap.mapZoom);
            setTimeout(() => {
              if (this.mapRef) {
                this.mapRef.invalidateSize();
                this.mapRef.on("zoomend", () => this.handleZoomEnd());
              }
            }, 50);
          }

          if (centerChanged && this.mapRef && this.row.areaMap.mapCenter) {
            this.savedCenter = L.latLng(this.row.areaMap.mapCenter[0], this.row.areaMap.mapCenter[1]);
            this.mapRef.off("moveend");
            this.mapRef.setView(this.savedCenter, this.mapRef.getZoom(), { animate: false });
            setTimeout(() => {
              if (this.mapRef) {
                this.mapRef.on("moveend", () => this.handleMoveEnd());
              }
            }, 0);
          }

          if (selectedGroupsChanged || opacityNormalChanged || opacityHoverChanged || textOpacityChanged) {
            if (this.mapRef) {
              this.updateMap();
            }
          }
        }
      });
    }
  }

  private defaultAreaMapData(): AreaMapData {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    return {
      region: regionName,
      title: "Areas",
      mapCenter: [51.25, 0.75],
      mapZoom: 10,
      mapHeight: 480,
      showControls: true,
      selectedGroups: [],
      clickAction: "group-website" as any,
      opacityNormal: 0.5,
      opacityHover: 0.8,
      textOpacity: 0.9,
      provider: MapProvider.OSM,
      osStyle: OUTDOOR_OS_STYLE,
      areaColors: {},
      showLegend: false,
      legendPosition: LegendPosition.TOP_RIGHT,
      sharedDistrictStyle: systemConfig?.area?.sharedDistrictStyle
    };
  }

  private broadcastCmsChange() {
    if (this.row) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.row));
    }
  }

  private initializeStandaloneMode() {
    this.logger.info("Initializing standalone mode");
    const initialState = this.mapControlsStateService.queryInitialState({
      provider: MapProvider.OSM,
      osStyle: OUTDOOR_OS_STYLE,
      mapHeight: 480
    });
    this.logger.info("Initial map state:", initialState);
    this.provider = initialState.provider;
    this.osStyle = initialState.osStyle;
    this.mapHeight = this.preview ? 560 : (initialState.mapHeight || 480);
    this.mapControlsState = initialState;
    this.showControls = this.preview ? false : this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true);
    this.clickAction = this.uiActions.initialValueFor(StoredValue.AREA_MAP_CLICK_ACTION, AreaMapClickAction.GROUP_WEBSITE) as AreaMapClickAction;
    if (this.preview) {
      this.selectedGroups = [];
    }
    this.loadOpacityFromStorage();
    this.loadAreaColorsFromStorage();
  }

  onProviderChange(value: MapProvider) {
    if (this.standalone) {
      this.provider = value;
      this.mapControlsState.provider = value;
      this.mapControlsStateService.saveProvider(value);
      this.recreateMap(true);
    } else if (this.row?.areaMap) {
      this.provider = value;
      this.row.areaMap.provider = value;
      if (value === MapProvider.OS && !this.osStyle) {
        this.osStyle = OUTDOOR_OS_STYLE;
        this.row.areaMap.osStyle = this.osStyle;
      }
      this.broadcastCmsChange();
      this.recreateMap(true);
    }
  }

  onStyleChange(value: string) {
    if (this.standalone) {
      this.osStyle = value;
      this.mapControlsState.osStyle = value;
      this.mapControlsStateService.saveOsStyle(value);
      this.recreateMap(true);
    } else if (this.row?.areaMap) {
      this.osStyle = value;
      this.row.areaMap.osStyle = value;
      this.broadcastCmsChange();
      this.recreateMap(true);
    }
  }

  onHeightChange(value: number) {
    if (this.standalone) {
      this.mapHeight = value;
      this.mapControlsState.mapHeight = value;
      this.mapControlsStateService.saveHeight(value);
    } else if (this.row?.areaMap) {
      this.mapHeight = value;
      this.row.areaMap.mapHeight = value;
      this.broadcastCmsChange();
    }
    setTimeout(() => {
      this.mapRef?.invalidateSize(true);
    }, 0);
  }

  onResizerHeightChange(value: number) {
    this.mapHeight = value;
    if (this.standalone && !this.preview) {
      this.mapControlsState.mapHeight = value;
      this.mapControlsStateService.saveHeight(value);
    } else if (this.row?.areaMap) {
      this.row.areaMap.mapHeight = value;
      this.broadcastCmsChange();
    }
    setTimeout(() => {
      this.mapRef?.invalidateSize(true);
    }, 0);
  }

  onOpacityChange() {
    if (this.standalone) {
      this.saveOpacityToStorage();
    }
    this.updateMap();
  }

  onGroupSelectionChange() {
    if (this.row?.areaMap) {
      this.row.areaMap.selectedGroups = this.selectedGroups;
    }
    this.updateMap();
  }

  toggleControls() {
    if (!this.standalone) {
      return;
    }
    this.showControls = !this.showControls;
    this.mapControlsStateService.saveShowControls(this.showControls);
  }

  onMapReady(map: L.Map) {
    this.mapRef = map;
    this.logger.info("Map ready, preview:", this.preview, "fitBounds:", !!this.fitBounds);

    map.on("zoomend", () => this.handleZoomEnd());
    map.on("moveend", () => this.handleMoveEnd());

    if (this.preview) {
      this.applyFitBoundsWhenReady();
    }
  }

  private applyFitBoundsWhenReady(attempt = 0) {
    const maxAttempts = 10;
    const delay = 50;

    setTimeout(() => {
      if (!this.mapRef) {
        if (attempt < maxAttempts) {
          this.applyFitBoundsWhenReady(attempt + 1);
        }
        return;
      }

      const container = this.mapRef.getContainer();
      const hasSize = container && container.offsetWidth > 0 && container.offsetHeight > 0;

      if (!hasSize && attempt < maxAttempts) {
        this.applyFitBoundsWhenReady(attempt + 1);
        return;
      }

      this.mapRef.invalidateSize(true);

      if (this.fitBounds && this.fitBounds.isValid()) {
        this.logger.info(`Applying fitBounds on attempt ${attempt}:`, this.fitBounds.toBBoxString());
        this.mapRef.fitBounds(this.fitBounds, { animate: false, padding: [20, 20] });
      } else if (attempt < maxAttempts) {
        this.applyFitBoundsWhenReady(attempt + 1);
      } else {
        this.logger.warn("Could not apply fitBounds after max attempts");
      }
    }, delay);
  }

  private recreateMap(preserveView = false) {
    const context = {
      mapRef: this.mapRef,
      savedCenter: this.savedCenter,
      savedZoom: this.savedZoom,
      preserveNextView: this.preserveNextView,
      showMap: this.showMap,
      logger: this.logger,
      leafletLayers: this.layers,
      fitBounds: this.fitBounds,
      options: this.options
    };

    this.mapRecreation.recreateMap(
      context,
      {
        onRebuildMap: () => {
          this.mapKey++;
        },
        onSetShowMap: (show: boolean) => this.showMap = show,
        onAfterShowMap: () => {
          this.rebuildMap();
        }
      },
      preserveView
    );

    this.mapRef = context.mapRef;
    this.savedCenter = context.savedCenter;
    this.savedZoom = context.savedZoom;
    this.preserveNextView = context.preserveNextView;
    this.showMap = context.showMap;
    this.layers = context.leafletLayers || [];
    this.fitBounds = context.fitBounds;
    this.options = context.options;
  }

  private rebuildMap() {
    this.logger.info("rebuildMap: provider:", this.provider, "osStyle:", this.osStyle);
    this.rebuildMapWithGeoJSON();
  }

  private updateMap() {
    this.logger.info("updateMap called - rebuilding map");
    this.rebuildMap();
  }

  private loadOpacityFromStorage() {
    const normalOpacity = this.uiActions.initialValueFor(StoredValue.GROUP_AREA_OPACITY_NORMAL, 0.5);
    const hoverOpacity = this.uiActions.initialValueFor(StoredValue.GROUP_AREA_OPACITY_HOVER, 0.8);
    const textOpacity = this.uiActions.initialValueFor(StoredValue.GROUP_AREA_TEXT_OPACITY, 0.9);
    this.opacityNormal = isNumber(normalOpacity) ? normalOpacity : parseFloat(normalOpacity as string) || 0.5;
    this.opacityHover = isNumber(hoverOpacity) ? hoverOpacity : parseFloat(hoverOpacity as string) || 0.8;
    this.textOpacity = isNumber(textOpacity) ? textOpacity : parseFloat(textOpacity as string) || 0.9;
  }

  private saveOpacityToStorage() {
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_OPACITY_NORMAL, this.opacityNormal);
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_OPACITY_HOVER, this.opacityHover);
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_TEXT_OPACITY, this.textOpacity);
  }

  private loadAreaColorsFromStorage() {
    this.areaColors = this.uiActions.initialObjectValueFor<Record<string, string>>(StoredValue.GROUP_AREA_COLORS, {});
  }

  private saveAreaColorsToStorage() {
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_COLORS, this.areaColors);
  }

  private createStripePatternSvg(colors: string[], patternId: string): string {
    const stripeWidth = 8;
    const numColors = colors.length;
    const patternHeight = stripeWidth * numColors;

    const stripes = colors.map((color, index) =>
      `<rect x="0" y="${index * stripeWidth}" width="${patternHeight * 2}" height="${stripeWidth}" fill="${color}"/>`
    ).join("");

    return `
      <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${patternHeight}" height="${patternHeight}" patternTransform="rotate(45)">
        ${stripes}
      </pattern>
    `;
  }

  private ensureStripePatternContainer(): HTMLElement {
    if (!this.stripePatternContainer) {
      this.stripePatternContainer = document.createElement("div");
      this.stripePatternContainer.id = "area-map-stripe-patterns";
      this.stripePatternContainer.innerHTML = `<svg style="position: absolute; width: 0; height: 0;"><defs></defs></svg>`;
      document.body.appendChild(this.stripePatternContainer);
    }
    return this.stripePatternContainer;
  }

  private createStripePattern(colors: string[]): string {
    const patternId = `stripe-pattern-${this.stripePatternCounter++}`;
    const container = this.ensureStripePatternContainer();
    const defs = container.querySelector("defs");
    if (defs) {
      defs.insertAdjacentHTML("beforeend", this.createStripePatternSvg(colors, patternId));
    }
    return `url(#${patternId})`;
  }

  private createGradientPatternSvg(colors: string[], patternId: string): string {
    const stops = colors.map((color, index) => {
      const offset = (index / (colors.length - 1)) * 100;
      return `<stop offset="${offset}%" stop-color="${color}"/>`;
    }).join("");

    return `
      <linearGradient id="${patternId}" x1="0%" y1="0%" x2="100%" y2="100%">
        ${stops}
      </linearGradient>
    `;
  }

  private createGradientPattern(colors: string[]): string {
    const patternId = `gradient-pattern-${this.stripePatternCounter++}`;
    const container = this.ensureStripePatternContainer();
    const defs = container.querySelector("defs");
    if (defs) {
      defs.insertAdjacentHTML("beforeend", this.createGradientPatternSvg(colors, patternId));
    }
    return `url(#${patternId})`;
  }

  private clearStripePatterns() {
    if (this.stripePatternContainer) {
      const defs = this.stripePatternContainer.querySelector("defs");
      if (defs) {
        defs.innerHTML = "";
      }
    }
    this.stripePatternCounter = 0;
  }

  private resolveAreaColor(areaName: string): string {
    if (!this.areaColors[areaName]) {
      const hue = Math.floor(Math.random() * 360);
      const saturation = 60 + Math.floor(Math.random() * 30);
      const lightness = 45 + Math.floor(Math.random() * 20);
      this.areaColors[areaName] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      if (this.standalone) {
        this.saveAreaColorsToStorage();
      }
    }
    return this.areaColors[areaName];
  }

  private estimateLabelSize(text: string) {
    const averageCharWidth = 7;
    const minWidth = 90;
    const maxWidth = 220;
    const width = Math.max(minWidth, Math.min(maxWidth, text.length * averageCharWidth + 16));
    const height = 22;
    return { width, height };
  }

  private resolveLabelPosition(initial: L.LatLng, text: string): L.LatLng {
    if (!this.mapRef) {
      const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const latOffset = ((hash % 7) - 3) * 0.005;
      const lngOffset = (((hash * 13) % 7) - 3) * 0.005;
      return L.latLng(initial.lat + latOffset, initial.lng + lngOffset);
    }

    const { width, height } = this.estimateLabelSize(text);
    const originPoint = this.mapRef.latLngToLayerPoint(initial);
    const stepDistance = 18;
    const maxSteps = 12;
    const directions = [
      L.point(0, 0),
      L.point(1, 0),
      L.point(-1, 0),
      L.point(0, 1),
      L.point(0, -1),
      L.point(1, 1),
      L.point(-1, 1),
      L.point(1, -1),
      L.point(-1, -1)
    ];

    const candidateBounds = (point: L.Point) => {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      return L.bounds(
        L.point(point.x - halfWidth, point.y - halfHeight),
        L.point(point.x + halfWidth, point.y + halfHeight)
      );
    };

    const collides = (bounds: L.Bounds) => this.labelPlacements.some(existing => existing.intersects(bounds));

    const candidatePlacement = range(0, maxSteps)
      .map(step => directions
        .map(direction => {
          const offset = direction.multiplyBy(stepDistance * step);
          const candidatePoint = originPoint.add(offset);
          const bounds = candidateBounds(candidatePoint);
          return {bounds, candidatePoint};
        })
        .find(candidate => !collides(candidate.bounds)))
      .find((placement): placement is {bounds: L.Bounds; candidatePoint: L.Point} => !!placement);

    if (candidatePlacement) {
      this.labelPlacements.push(candidatePlacement.bounds);
      return this.mapRef.layerPointToLatLng(candidatePlacement.candidatePoint);
    }

    this.labelPlacements.push(candidateBounds(originPoint));
    return initial;
  }

  private rebuildMapWithGeoJSON() {
    this.logger.info("rebuildMapWithGeoJSON: fetching data from backend");
    this.dataLoading = true;

    this.labelPlacements = [];
    this.clearStripePatterns();
    this.areaLayerMap.clear();
    this.areaDataMap.clear();

    const baseLayer = this.tiles.createBaseLayer(this.provider, this.osStyle);

    let center: L.LatLng;
    if (this.preserveNextView && this.savedCenter) {
      center = this.savedCenter;
    } else if (this.cmsSettings?.mapCenter && isArray(this.cmsSettings.mapCenter)) {
      center = L.latLng(this.cmsSettings.mapCenter[0], this.cmsSettings.mapCenter[1]);
    } else if (this.preview) {
      center = L.latLng(52.5, -1.5);
    } else {
      const savedCenter = this.standalone ? this.uiActions.initialObjectValueFor<{
        lat: number,
        lng: number
      }>(StoredValue.AREA_MAP_CENTER, null) : null;
      if (savedCenter && isNumber(savedCenter.lat) && isNumber(savedCenter.lng)) {
        center = L.latLng(savedCenter.lat, savedCenter.lng);
      } else {
        center = L.latLng(52.5, -1.5);
      }
    }

    let zoom = this.preview ? 6 : 9;

    if (this.preserveNextView && this.savedZoom) {
      zoom = Math.min(18, Math.max(2, this.savedZoom));
    } else if (this.cmsSettings?.mapZoom && isNumber(this.cmsSettings.mapZoom)) {
      zoom = Math.min(18, Math.max(2, this.cmsSettings.mapZoom));
    } else if (!this.preview) {
      const savedZoom = this.standalone ? this.uiActions.initialValueFor(StoredValue.AREA_MAP_ZOOM, null) as any : null;
      if (!isNull(savedZoom)) {
        let parsedZoom = 9;
        if (isNumber(savedZoom) && !isNaN(savedZoom) && isFinite(savedZoom)) {
          parsedZoom = savedZoom;
        } else if (isString(savedZoom)) {
          const parsed = parseFloat(savedZoom);
          if (!isNaN(parsed) && isFinite(parsed)) {
            parsedZoom = parsed;
          }
        }

        if (parsedZoom >= 2 && parsedZoom <= 18) {
          zoom = parsedZoom;
        } else {
          if (this.row?.areaMap) {
            this.row.areaMap.mapZoom = 9;
            this.broadcastCmsChange();
          } else {
            this.uiActions.saveValueFor(StoredValue.AREA_MAP_ZOOM, 9);
          }
          zoom = 9;
        }
      }
    }

    this.options = {
      center,
      zoom,
      maxZoom: this.tiles.maxZoomForStyle(this.provider, this.osStyle),
      crs: this.tiles.crsForStyle(this.provider, this.osStyle),
      zoomDelta: 0.25,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 120,
      layers: [baseLayer]
    };

    this.preserveNextView = false;

    this.areas.getRegionWithBoundsAsync(this.region, {
      north: 51.55,
      south: 50.90,
      west: -0.10,
      east: 1.60
    }).subscribe({
      next: (cfg) => {
        if (!cfg || !cfg.areas || cfg.areas.length === 0) {
          this.logger.warn("No GeoJSON areas received from backend");
          this.layers = [];
          this.dataLoading = false;
          return;
        }

        this.sharedDistricts = cfg.sharedDistricts || {};
        if (this.preview && this.previewSharedDistrictStyle) {
          this.sharedDistrictStyle = this.previewSharedDistrictStyle;
        } else if (this.cmsSettings?.sharedDistrictStyle) {
          this.sharedDistrictStyle = this.cmsSettings.sharedDistrictStyle;
        } else {
          this.sharedDistrictStyle = cfg.sharedDistrictStyle || SharedDistrictStyle.FIRST_GROUP;
        }
        this.mainAreaGroupCodes = cfg.mainAreaGroupCodes || [];
        this.logger.info("Shared districts:", keys(this.sharedDistricts), "style:", this.sharedDistrictStyle, "preview:", this.preview, "previewStyle:", this.previewSharedDistrictStyle);

        if (!this.preserveNextView && !this.savedCenter && cfg.center && this.mapRef) {
          const configCenter = L.latLng(cfg.center[0], cfg.center[1]);
          const configZoom = cfg.zoom || 10;
          this.mapRef.setView(configCenter, configZoom, { animate: false });
          this.logger.info("Applied region config center:", configCenter, "zoom:", configZoom);
        }

        const validAreas = cfg.areas.filter(area => {
          const feature = area.geoJsonFeature;
          if (feature.type === "FeatureCollection") {
            return feature.features && feature.features.length > 0;
          }
          return feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length > 0;
        });

        this.availableGroups = validAreas.map(area => area.name).sort();

        const areasToDisplay = this.selectedGroups.length > 0
          ? validAreas.filter(area => this.selectedGroups.includes(area.name))
          : validAreas;

        this.logger.info(`Creating overlays for ${areasToDisplay.length} areas`);

        const sortedAreas = [...areasToDisplay].sort((a, b) => a.name.localeCompare(b.name));

        sortedAreas.slice(0, 3).forEach((area, index) => {
          const geoJson = area.geoJsonFeature as any;
          const coordSample = geoJson?.geometry?.coordinates?.[0]?.[0]?.slice(0, 2) ||
            geoJson?.features?.[0]?.geometry?.coordinates?.[0]?.[0]?.slice(0, 2);
          this.logger.info(`Area ${index} "${area.name}" GeoJSON structure:`, {
            type: geoJson?.type,
            geometryType: geoJson?.geometry?.type,
            featureCount: geoJson?.features?.length,
            hasCoordinates: !!(geoJson?.geometry?.coordinates?.length || geoJson?.features?.[0]?.geometry?.coordinates?.length),
            coordSample
          });
        });

        const sharedDistrictPatterns: Record<string, string> = {};
        if (this.sharedDistrictStyle === SharedDistrictStyle.STRIPES || this.sharedDistrictStyle === SharedDistrictStyle.GRADIENT) {
          Object.entries(this.sharedDistricts).forEach(([district, info]) => {
            const colors = info.groups.map(g => g.color);
            sharedDistrictPatterns[district] = this.sharedDistrictStyle === SharedDistrictStyle.STRIPES
              ? this.createStripePattern(colors)
              : this.createGradientPattern(colors);
          });
        }

        const overlays: L.Layer[] = sortedAreas.map((area, index) => {
          const borderColor = area.color || this.resolveAreaColor(area.name);
          const fillColor = borderColor.replace(/(\d+)%\)$/, (match, lightness) =>
            `${Math.min(90, asNumber(lightness) + 30)}%)`
          );

          const geoJson = area.geoJsonFeature as any;
          const hasCoords = geoJson?.geometry?.coordinates?.length > 0 ||
            (geoJson?.type === "FeatureCollection" && geoJson?.features?.length > 0);
          if (!hasCoords) {
            this.logger.warn("Area has no coordinates:", area.name, geoJson);
          }

          const polygon = L.geoJSON(area.geoJsonFeature, {
            style: (feature) => {
              const districtName = feature?.properties?.LAD23NM;
              const isShared = districtName && this.sharedDistricts[districtName];
              const baseStyle: any = {
                color: borderColor,
                weight: isShared && this.sharedDistrictStyle === SharedDistrictStyle.DASHED_BORDER ? 3 : 2,
                fillColor,
                fillOpacity: this.opacityNormal,
                dashArray: isShared && this.sharedDistrictStyle === SharedDistrictStyle.DASHED_BORDER ? "8, 4" : undefined
              };
              return baseStyle;
            },
            onEachFeature: (feature, layer) => {
              const districtName = feature?.properties?.LAD23NM;
              const usePattern = this.sharedDistrictStyle === SharedDistrictStyle.STRIPES || this.sharedDistrictStyle === SharedDistrictStyle.GRADIENT;
              if (districtName && sharedDistrictPatterns[districtName] && usePattern) {
                (layer as any)._sharedDistrictPattern = sharedDistrictPatterns[districtName];
              }
            }
          });

          const usePattern = this.sharedDistrictStyle === SharedDistrictStyle.STRIPES || this.sharedDistrictStyle === SharedDistrictStyle.GRADIENT;
          if (usePattern) {
            polygon.on("add", () => {
              polygon.eachLayer((layer: any) => {
                if (layer._sharedDistrictPattern && layer._path) {
                  layer._path.setAttribute("fill", layer._sharedDistrictPattern);
                }
              });
            });
          }

          polygon.bindTooltip(area.name, {
            sticky: true,
            direction: "top",
            className: "bootstrap-tooltip",
            opacity: 0.9
          });

          let popupShown = false;
          let lastMouseEvent: L.LeafletMouseEvent | null = null;

          polygon.on("mousemove", (e) => {
            lastMouseEvent = e;
            if (!this.hoverTimeout && !popupShown) {
              this.hoverTimeout = setTimeout(() => {
                polygon.unbindTooltip();
                if (lastMouseEvent) {
                  this.showAreaPopup(lastMouseEvent.latlng, area);
                }
                popupShown = true;
              }, 800);
            }
          });

          polygon.on("mouseout", () => {
            this.clearHoverTimeout();
            popupShown = false;
            lastMouseEvent = null;
          });

          polygon.on("popupclose", () => {
            popupShown = false;
            polygon.bindTooltip(area.name, {
              sticky: true,
              direction: "top",
              className: "bootstrap-tooltip",
              opacity: 0.9
            });
          });

          let marker: L.Marker | null = null;

          let centroid: L.LatLng | null = null;
          try {
            centroid = polygon.getBounds().getCenter();
          } catch (error) {
            this.logger.warn("Could not calculate centroid for:", area.name);
            centroid = null;
          }

          if (centroid) {
            const labelPosition = this.resolveLabelPosition(centroid, area.name);

            marker = L.marker(labelPosition, {
              icon: L.divIcon({
                className: "group-name-label",
                html: `<span style="
                  background: rgba(60, 60, 60, ${this.textOpacity});
                  padding: 4px 6px;
                  font-size: 11px;
                  font-weight: 500;
                  color: white;
                  border-radius: 3px;
                  pointer-events: none;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: inline-block;
                  white-space: nowrap;
                  line-height: 1.2;
                  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
                  max-width: none;
                ">${area.name}</span>`,
                iconSize: undefined,
                iconAnchor: [0, 0]
              }),
              zIndexOffset: 1000 + index
            });

            polygon.on("mouseover", () => {
              polygon.setStyle({fillOpacity: this.opacityHover});
              if (marker) marker.getElement()?.style.setProperty("display", "none");
            });
            polygon.on("mouseout", () => {
              polygon.setStyle({fillOpacity: this.opacityNormal});
              this.reapplyPatterns(polygon);
              if (marker) marker.getElement()?.style.setProperty("display", "block");
            });

            this.areaLayerMap.set(area.name, polygon);
            this.areaDataMap.set(area.name, area);
            return L.layerGroup([polygon, marker]);
          } else {
            polygon.on("mouseover", () => polygon.setStyle({fillOpacity: this.opacityHover}));
            polygon.on("mouseout", () => {
              polygon.setStyle({fillOpacity: this.opacityNormal});
              this.reapplyPatterns(polygon);
            });
            this.areaLayerMap.set(area.name, polygon);
            this.areaDataMap.set(area.name, area);
            return L.layerGroup([polygon]);
          }
        });

        this.layers = overlays;

        this.legendItems = sortedAreas.map(area => ({
          name: area.name,
          color: area.color || this.areaColors[area.name] || "#888888"
        }));

        const bounds = L.latLngBounds([]);
        let validBoundsCount = 0;
        let totalLayersChecked = 0;
        overlays.forEach((layerGroup: any, groupIndex: number) => {
          layerGroup.eachLayer((layer: any) => {
            totalLayersChecked++;
            if (layer && isFunction(layer.getBounds)) {
              try {
                const layerBounds = layer.getBounds();
                const isValid = layerBounds && layerBounds.isValid();
                this.logger.debug(`Layer ${groupIndex}.${totalLayersChecked} bounds:`, {
                  hasGetBounds: true,
                  boundsValid: isValid,
                  bounds: isValid ? layerBounds.toBBoxString() : "invalid",
                  layerType: layer.constructor?.name || "unknown"
                });
                if (isValid) {
                  bounds.extend(layerBounds);
                  validBoundsCount++;
                }
              } catch (e) {
                this.logger.warn(`Layer ${groupIndex}.${totalLayersChecked} getBounds() threw error:`, e);
              }
            } else if (layer instanceof L.GeoJSON) {
              layer.eachLayer((subLayer: any) => {
                if (subLayer && isFunction(subLayer.getBounds)) {
                  try {
                    const subBounds = subLayer.getBounds();
                    if (subBounds && subBounds.isValid()) {
                      bounds.extend(subBounds);
                      validBoundsCount++;
                      this.logger.debug(`GeoJSON sublayer bounds valid:`, subBounds.toBBoxString());
                    }
                  } catch (e) {
                    this.logger.warn(`GeoJSON sublayer getBounds() threw error:`, e);
                  }
                }
              });
            }
          });
        });

        this.logger.info("Areas loaded:", cfg.areas?.length, "layers:", overlays.length, "layersChecked:", totalLayersChecked, "valid bounds:", validBoundsCount, "total bounds valid:", bounds.isValid(), "preview:", this.preview);
        if (!this.preserveNextView && bounds.isValid()) {
          this.fitBounds = bounds.pad(0.05);
          this.logger.info("fitBounds set to:", this.fitBounds?.toBBoxString());
        } else if (this.preview && !bounds.isValid()) {
          this.logger.warn("Preview mode: bounds invalid, using region center fallback");
          if (cfg.center && cfg.zoom) {
            this.logger.info("Using region config center:", cfg.center, "zoom:", cfg.zoom);
            if (this.mapRef) {
              this.mapRef.setView(L.latLng(cfg.center[0], cfg.center[1]), cfg.zoom, { animate: false });
            } else {
              this.options.center = L.latLng(cfg.center[0], cfg.center[1]);
              this.options.zoom = cfg.zoom;
            }
          }
        }

        this.logger.info("Successfully loaded GeoJSON areas");
        this.dataLoading = false;
      },
      error: (error) => {
        this.logger.error("Failed to fetch GeoJSON areas:", error);
        this.layers = [];
        this.dataLoading = false;
      }
    });
  }

  private handleZoomEnd() {
    if (this.mapRef && this.standalone) {
      const currentZoom = this.mapRef.getZoom();
      this.logger.info("Zoom changed to:", currentZoom);
      if (currentZoom && isFinite(currentZoom) && currentZoom >= 2 && currentZoom <= 18) {
        this.logger.info("Saving zoom level to storage:", currentZoom);
        this.uiActions.saveValueFor(StoredValue.AREA_MAP_ZOOM, currentZoom);
      } else {
        this.logger.warn("Not saving invalid zoom level:", currentZoom);
      }
    } else if (!this.standalone && this.mapRef && this.row?.areaMap) {
      const currentZoom = this.mapRef.getZoom();
      if (currentZoom && isFinite(currentZoom) && currentZoom >= 2 && currentZoom <= 18) {
        this.logger.info("CMS mode: updating editor zoom to:", currentZoom);
        this.row.areaMap.mapZoom = currentZoom;
        this.broadcastCmsChange();
      }
    } else {
      this.logger.warn("Zoom changed but mapRef is null");
    }
  }

  private clearHoverTimeout() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  onLegendItemHover(event: MouseEvent, areaName: string, isHovering: boolean) {
    const polygon = this.areaLayerMap.get(areaName);
    const areaData = this.areaDataMap.get(areaName);
    if (polygon) {
      if (isHovering) {
        polygon.setStyle({ fillOpacity: 1.0, weight: 4 });
        polygon.bringToFront();
        if (areaData && !this.legendHoverTimeout) {
          this.legendHoverTimeout = setTimeout(() => {
            const centroid = polygon.getBounds().getCenter();
            this.showAreaPopup(centroid, areaData);
          }, 800);
        }
      } else {
        this.clearLegendHoverTimeout();
        polygon.setStyle({ fillOpacity: this.opacityNormal, weight: 2 });
        this.reapplyPatterns(polygon);
      }
    }
  }

  private clearLegendHoverTimeout() {
    if (this.legendHoverTimeout) {
      clearTimeout(this.legendHoverTimeout);
      this.legendHoverTimeout = null;
    }
  }

  private reapplyPatterns(polygon: L.GeoJSON) {
    const usePattern = this.sharedDistrictStyle === SharedDistrictStyle.STRIPES || this.sharedDistrictStyle === SharedDistrictStyle.GRADIENT;
    if (usePattern) {
      polygon.eachLayer((layer: any) => {
        if (layer._sharedDistrictPattern && layer._path) {
          layer._path.setAttribute("fill", layer._sharedDistrictPattern);
        }
      });
    }
  }

  private showAreaPopup(position: L.LatLng, area: { name: string; url: string; externalUrl?: string; groupCode?: string }) {
    const isMainAreaGroup = area.groupCode && this.mainAreaGroupCodes.includes(area.groupCode);
    const hasOwnWebsite = area.externalUrl && !area.externalUrl.includes("ramblers.org.uk");
    const content = `
      <div style="text-align: center;">
        <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${area.name}</div>
        ${hasOwnWebsite ? `<button type="button" class="badge bg-success border-0 me-1" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.open('${area.externalUrl}', '_blank'), 100);">group website</button>` : ""}
        ${area.url ? `<button type="button" class="badge bg-primary border-0 me-1" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.location.href='${area.url}', 100);">ramblers page</button>` : ""}
        ${isMainAreaGroup ? `<button type="button" class="badge bg-primary border-0" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.location.href='/walks?${StoredValue.SEARCH}=${encodeURIComponent(area.groupCode)}', 100);">view walks</button>` : ""}
      </div>
    `;

    if (!this.mapRef) {
      return;
    }

    const popup = L.popup({
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      className: "area-action-leaflet-popup"
    })
      .setLatLng(position)
      .setContent(content)
      .openOn(this.mapRef);

    const escHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        this.mapRef?.closePopup();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);

    popup.on("remove", () => {
      document.removeEventListener("keydown", escHandler);
    });
  }

  private handleMoveEnd() {
    if (this.mapRef && this.standalone) {
      const center = this.mapRef.getCenter();
      const centerObj = { lat: center.lat, lng: center.lng };
      this.logger.info("Map center changed to:", centerObj);
      this.uiActions.saveValueFor(StoredValue.AREA_MAP_CENTER, centerObj);
    } else if (!this.standalone && this.mapRef && this.row) {
      const center = this.mapRef.getCenter();
      this.logger.info("CMS mode: updating editor center to:", center.lat, center.lng);
      if (this.row.areaMap) {
        this.row.areaMap.mapCenter = [center.lat, center.lng];
        this.broadcastCmsChange();
      }
    } else {
      this.logger.warn("Map moved but mapRef is null");
    }
  }
}
