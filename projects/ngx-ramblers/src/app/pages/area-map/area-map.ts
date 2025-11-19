import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import * as L from "leaflet";
import { FormsModule } from "@angular/forms";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { GroupAreasService } from "../../services/group-areas.service";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { MapControlsComponent, MapControlsConfig, MapControlsState } from "../../shared/components/map-controls.component";
import { MapOverlayComponent } from "../../shared/components/map-overlay.component";
import { MapControlsStateService } from "../../shared/services/map-controls-state.service";
import { MapRecreationService } from "../../shared/services/map-recreation.service";
import { MapProvider } from "../../models/map.model";
import { UiActionsService } from "../../services/ui-actions.service";
import { StoredValue } from "../../models/ui-actions";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { AreaMapClickAction, AreaMapData, PageContent, PageContentRow } from "../../models/content-text.model";
import { AreaMapCmsService } from "../../services/area-map-cms.service";
import { Subscription } from "rxjs";
import { isArray, isFunction, isNumber, isString } from "es-toolkit/compat";
import { NgSelectComponent } from "@ng-select/ng-select";
import { SystemConfigService } from "../../services/system/system-config.service";
import { BroadcastService } from "../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";

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
              <div class="d-flex align-items-center map-control-item flex-grow-1" style="min-width: 250px;">
                <span class="small mx-1 text-nowrap">Groups</span>
                <ng-select
                  [items]="availableGroups"
                  [multiple]="true"
                  [closeOnSelect]="false"
                  [searchable]="true"
                  [clearable]="true"
                  placeholder="All groups"
                  [(ngModel)]="selectedGroups"
                  (change)="onGroupSelectionChange()"
                  class="flex-grow-1">
                </ng-select>
              </div>
            </div>
          </app-map-controls>
        </div>
      }
    }
    <div class="map-wrapper">
      @if (showMap) {
        <div class="map-container"
             [style.height.px]="mapHeight"
             leaflet
             [leafletOptions]="options"
             [leafletLayers]="layers"
             [leafletFitBounds]="fitBounds"
             (leafletMapReady)="onMapReady($event)">
        </div>
      }
      @if (standalone) {
        <app-map-overlay
          [showControls]="showControls"
          (toggleControls)="toggleControls()">
        </app-map-overlay>
      }
    </div>
  `,
  imports: [FormsModule, LeafletModule, MapControlsComponent, MapOverlayComponent, NgSelectComponent]
})
export class AreaMapComponent implements OnInit, OnDestroy {
  private _row?: PageContentRow;
  private _pageContent?: PageContent;
  @Input() region?: string;

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
  public provider: MapProvider = "osm";
  public osStyle = "Outdoor_27700";
  public opacityNormal = 0.5;
  public opacityHover = 0.8;
  public textOpacity = 0.9;
  public showControls = true;
  public selectedGroups: string[] = [];
  public availableGroups: string[] = [];
  public clickAction: AreaMapClickAction = AreaMapClickAction.GROUP_WEBSITE;
  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false,
    minHeight: 300,
    maxHeight: 900,
    heightStep: 10
  };
  public mapControlsState: MapControlsState = {
    provider: "osm",
    osStyle: "Outdoor_27700",
    mapHeight: 480
  };
  private mapRef: L.Map | undefined;
  private areaColors: Record<string, string> = {};
  private isInitialized = false;
  private cmsSettingsSubscription?: Subscription;
  private labelPlacements: L.Bounds[] = [];
  private hoverTimeout: any = null;

  private logger: Logger = inject(LoggerFactory).createLogger("AreaMapComponent", NgxLoggerLevel.ERROR);
  private areas = inject(GroupAreasService);
  private tiles = inject(MapTilesService);
  private mapControlsStateService = inject(MapControlsStateService);
  private mapRecreation = inject(MapRecreationService);
  private uiActions = inject(UiActionsService);
  private cmsService = inject(AreaMapCmsService);
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

  ngOnDestroy() {
    this.cmsSettingsSubscription?.unsubscribe();
    this.clearHoverTimeout();
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
      provider: "osm",
      osStyle: "Outdoor_27700",
      areaColors: {}
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
      provider: "osm",
      osStyle: "outdoor",
      mapHeight: 480
    });
    this.logger.info("Initial map state:", initialState);
    this.provider = initialState.provider;
    this.osStyle = initialState.osStyle;
    this.mapHeight = initialState.mapHeight || 480;
    this.mapControlsState = initialState;
    this.showControls = this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true);
    this.clickAction = this.uiActions.initialValueFor(StoredValue.AREA_MAP_CLICK_ACTION, AreaMapClickAction.GROUP_WEBSITE) as AreaMapClickAction;
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
      if (value === "os" && !this.osStyle) {
        this.osStyle = "Outdoor_27700";
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

  onClickActionChange() {
    this.uiActions.saveValueFor(StoredValue.AREA_MAP_CLICK_ACTION, this.clickAction);
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

    try {
      if (map.getContainer()) {
        const zoom = map.getZoom();
        const center = map.getCenter();
        if (zoom !== undefined && center && !isNaN(center.lat) && !isNaN(center.lng)) {
          this.logger.info("Map ready - actual zoom level applied:", zoom);
          this.logger.info("Map ready - actual center applied:", { lat: center.lat, lng: center.lng });
        } else {
          this.logger.warn("Map ready but has invalid zoom/center:", { zoom, center });
        }
      } else {
        this.logger.warn("Map ready but container not available");
      }
    } catch (error) {
      this.logger.warn("Could not get map center/zoom in onMapReady:", error);
      setTimeout(() => {
        try {
          if (this.mapRef && this.mapRef.getContainer()) {
            const zoom = this.mapRef.getZoom();
            const center = this.mapRef.getCenter();
            if (zoom !== undefined && center && !isNaN(center.lat) && !isNaN(center.lng)) {
              this.logger.info("Map ready (delayed) - zoom:", zoom);
              this.logger.info("Map ready (delayed) - center:", {
                lat: center.lat,
                lng: center.lng
              });
            } else {
              this.logger.warn("Map ready (delayed) but has invalid zoom/center:", { zoom, center });
            }
          } else {
            this.logger.warn("Map ready (delayed) but map is not properly initialized");
          }
        } catch (delayedError) {
          this.logger.warn("Could not get map info even after delay:", delayedError);
        }
      }, 100);
    }

    this.logger.info("Setting up zoom event listener");
    map.on("zoomend", () => this.handleZoomEnd());

    this.logger.info("Setting up map move event listener");
    map.on("moveend", () => this.handleMoveEnd());

    setTimeout(() => {
      if (!this.mapRef || !this.mapRef.getContainer()) {
        return;
      }
      try {
        this.mapRef.invalidateSize(true);
      } catch (e) {
        this.logger.debug("Map not fully initialized yet, will retry on next render:", e);
      }
    }, 100);
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

  private getOrCreateColorForArea(areaName: string): string {
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

    for (let step = 0; step <= maxSteps; step++) {
      for (const direction of directions) {
        const offset = direction.multiplyBy(stepDistance * step);
        const candidatePoint = originPoint.add(offset);
        const bounds = candidateBounds(candidatePoint);
        if (!collides(bounds)) {
          this.labelPlacements.push(bounds);
          return this.mapRef.layerPointToLatLng(candidatePoint);
        }
      }
    }

    this.labelPlacements.push(candidateBounds(originPoint));
    return initial;
  }

  private rebuildMapWithGeoJSON() {
    this.logger.info("rebuildMapWithGeoJSON: fetching data from backend");

    this.labelPlacements = [];

    const baseLayer = this.tiles.createBaseLayer(this.provider, this.osStyle);

    let center: L.LatLng;
    if (this.preserveNextView && this.savedCenter) {
      center = this.savedCenter;
    } else if (this.cmsSettings?.mapCenter && isArray(this.cmsSettings.mapCenter)) {
      center = L.latLng(this.cmsSettings.mapCenter[0], this.cmsSettings.mapCenter[1]);
    } else {
      const savedCenter = this.standalone ? this.uiActions.initialObjectValueFor<{
        lat: number,
        lng: number
      }>(StoredValue.AREA_MAP_CENTER, null) : null;
      if (savedCenter && isNumber(savedCenter.lat) && isNumber(savedCenter.lng)) {
        center = L.latLng(savedCenter.lat, savedCenter.lng);
      } else {
        center = L.latLng(51.25, 0.75);
      }
    }

    let zoom = 9;

    if (this.preserveNextView && this.savedZoom) {
      zoom = Math.min(18, Math.max(2, this.savedZoom));
    } else if (this.cmsSettings?.mapZoom && isNumber(this.cmsSettings.mapZoom)) {
      zoom = Math.min(18, Math.max(2, this.cmsSettings.mapZoom));
    } else {
      const savedZoom = this.standalone ? this.uiActions.initialValueFor(StoredValue.AREA_MAP_ZOOM, null) as any : null;
      if (savedZoom !== null) {
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
          return;
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

        const overlays: L.Layer[] = sortedAreas.map((area, index) => {
          const borderColor = area.color || this.getOrCreateColorForArea(area.name);
          const fillColor = borderColor.replace(/(\d+)%\)$/, (match, lightness) =>
            `${Math.min(90, parseInt(lightness) + 30)}%)`
          );

          const polygon = L.geoJSON(area.geoJsonFeature, {
            style: {
              color: borderColor,
              weight: 2,
              fillColor: fillColor,
              fillOpacity: this.opacityNormal
            }
          });

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
                  this.showLeafletPopup(lastMouseEvent, area, polygon);
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
              if (marker) marker.getElement()?.style.setProperty("display", "block");
            });

            return L.layerGroup([polygon, marker]);
          } else {
            polygon.on("mouseover", () => polygon.setStyle({fillOpacity: this.opacityHover}));
            polygon.on("mouseout", () => polygon.setStyle({fillOpacity: this.opacityNormal}));
            return L.layerGroup([polygon]);
          }
        });

        this.layers = overlays;

        const bounds = overlays.reduce((b, layer: any) => {
          try {
            if (layer && isFunction(layer.getBounds)) {
              return b.extend(layer.getBounds());
            }
          } catch (error) {
            this.logger.warn("Error getting bounds for layer:", error);
          }
          return b;
        }, L.latLngBounds([] as any));

        if (!this.preserveNextView && bounds.isValid()) {
          this.fitBounds = bounds.pad(0.05);
        }

        this.logger.info("Successfully loaded GeoJSON areas");
      },
      error: (error) => {
        this.logger.error("Failed to fetch GeoJSON areas:", error);
        this.layers = [];
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

  private showLeafletPopup(e: L.LeafletMouseEvent, area: { name: string; url: string; groupCode?: string }, layer: L.Layer) {
    const content = `
      <div style="text-align: center;">
        <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${area.name}</div>
        ${area.url ? `<button type="button" class="badge bg-primary border-0 me-1" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.location.href='${area.url}', 100);">visit group</button>` : ""}
        ${area.groupCode ? `<button type="button" class="badge bg-primary border-0" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.location.href='/walks?${StoredValue.SEARCH}=${encodeURIComponent(area.groupCode)}', 100);">view walks</button>` : ""}
      </div>
    `;

    const popup = L.popup({
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      className: "area-action-leaflet-popup"
    })
      .setLatLng(e.latlng)
      .setContent(content)
      .openOn(this.mapRef!);

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
