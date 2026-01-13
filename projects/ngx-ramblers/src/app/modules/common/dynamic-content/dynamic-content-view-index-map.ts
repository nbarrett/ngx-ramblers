import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import * as L from "leaflet";
import "leaflet.markercluster";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { PageContent, PageContentColumn } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { UrlService } from "../../../services/url.service";
import {
  MapControls,
  MapControlsConfig,
  MapControlsState
} from "../../../shared/components/map-controls";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";
import { MapOverlay } from "../../../shared/components/map-overlay";
import { UiActionsService } from "../../../services/ui-actions.service";

@Component({
  selector: "app-dynamic-content-view-index-map",
  styles: [`
    .map-wrapper
      position: relative

    .map-controls-docked
      border-bottom: 1px solid #dee2e6
      margin-bottom: 0 !important
      position: relative
      z-index: 1000

    .map-controls-overlap
      margin-top: -15px
      border-top-left-radius: 0 !important
      border-top-right-radius: 0 !important

    :host ::ng-deep .leaflet-control-zoom a,
    :host ::ng-deep .leaflet-control-zoom a:hover,
    :host ::ng-deep .leaflet-control-zoom a:focus,
    :host ::ng-deep .leaflet-control-zoom a:active
      text-decoration: none !important
      outline: none

    :host ::ng-deep .leaflet-popup-content-wrapper
      border-radius: 8px

    :host ::ng-deep .leaflet-popup-content
      margin: 13px 19px

    :host ::ng-deep .leaflet-pane.leaflet-tooltip-pane
      z-index: 10000
      pointer-events: none

    :host ::ng-deep .leaflet-tooltip
      background-color: #000
      border: none
      border-radius: 0.25rem
      color: #fff
      font-size: 0.875rem
      font-weight: 400
      line-height: 1.5
      padding: 0.25rem 0.5rem
      opacity: 0.9
      box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15)

    :host ::ng-deep .leaflet-tooltip-top:before
      border-top-color: #000

    :host ::ng-deep .leaflet-tooltip-bottom:before
      border-bottom-color: #000

    :host ::ng-deep .leaflet-tooltip-left:before
      border-left-color: #000

    :host ::ng-deep .leaflet-tooltip-right:before
      border-right-color: #000
  `],
  template: `
    @if (showMap && options) {
      @if (showControls) {
        <div class="rounded-top img-thumbnail p-2 map-controls-docked">
          <app-map-controls
            [config]="mapControlsConfig"
            [state]="mapControlsState"
            (providerChange)="onProviderChange($event)"
            (styleChange)="onStyleChange($event)"
            (heightChange)="onHeightChange($event)">
          </app-map-controls>
        </div>
      }
      <div [class]="showControls ? 'map-controls-overlap' : 'rounded'">
        <div class="map-wrapper">
          <div class="card shadow rounded"
               [style.height.px]="mapHeight"
               leaflet
               [leafletOptions]="options"
               [leafletLayers]="leafletLayers"
               [leafletFitBounds]="fitBounds"
               (leafletMapReady)="onMapReady($event)">
          </div>
          @if (allowControlsToggle) {
            <app-map-overlay
              [showControls]="showControls"
              [allowToggle]="allowControlsToggle"
              [allowWaypointsToggle]="false"
              (toggleControls)="toggleControls()">
            </app-map-overlay>
          }
        </div>
      </div>
    }
  `,
  imports: [LeafletModule, MapControls, MapOverlay]
})
export class DynamicContentViewIndexMap implements OnInit, OnChanges {
  @Input() pageContent: PageContent;
  @Input() mapHeight = 500;
  @Input() clusteringEnabled = true;
  @Input() clusteringThreshold = 10;
  @Input() provider: MapProvider = MapProvider.OSM;
  @Input() osStyle = DEFAULT_OS_STYLE;
  @Input() mapCenter: [number, number] = [51.25, 0.75];
  @Input() mapZoom = 10;
  @Input() showControlsDefault = true;
  @Input() allowControlsToggle = true;

  public options: any;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  public showMap = true;
  public showControls = true;
  private clusterGroupRef: any;
  private allMarkers: L.Marker[] = [];

  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false
  };

  public mapControlsState: MapControlsState = {
    provider: MapProvider.OSM,
    osStyle: DEFAULT_OS_STYLE,
    mapHeight: 500,
    smoothScroll: false,
    autoShowAll: false
  };

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewIndexMap", NgxLoggerLevel.ERROR);
  private mapTiles = inject(MapTilesService);
  private markerStyle = inject(MapMarkerStyleService);
  private urlService = inject(UrlService);
  private uiActions = inject(UiActionsService);

  ngOnInit() {
    this.mapTiles.initializeProjections();
    this.mapControlsState.provider = this.provider;
    this.mapControlsState.osStyle = this.osStyle;
    this.mapControlsState.mapHeight = this.mapHeight;
    this.showControls = this.uiActions.booleanOf(this.showControlsDefault, true);
    this.allowControlsToggle = this.uiActions.booleanOf(this.allowControlsToggle, true);
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["pageContent"] && !changes["pageContent"].firstChange) {
      this.updateMarkers();
    }
    if (changes["provider"] && !changes["provider"].firstChange) {
      this.mapControlsState.provider = this.provider;
      this.recreateMap();
    }
    if (changes["osStyle"] && !changes["osStyle"].firstChange) {
      this.mapControlsState.osStyle = this.osStyle;
      this.recreateMap();
    }
    if (changes["mapHeight"] && !changes["mapHeight"].firstChange) {
      this.mapControlsState.mapHeight = this.mapHeight;
      this.updateMapSize();
    }
    if ((changes["clusteringEnabled"] || changes["clusteringThreshold"]) && !changes["clusteringEnabled"]?.firstChange) {
      this.updateMarkers();
    }
    if (changes["mapZoom"] && !changes["mapZoom"].firstChange && this.mapRef) {
      this.mapRef.setZoom(this.mapZoom);
    }
    if (changes["mapCenter"] && !changes["mapCenter"].firstChange && this.mapRef) {
      this.mapRef.setView(L.latLng(this.mapCenter[0], this.mapCenter[1]), this.mapRef.getZoom());
    }
    if (changes["showControlsDefault"] && !changes["showControlsDefault"].firstChange) {
      this.showControls = this.uiActions.booleanOf(this.showControlsDefault, true);
    }
    if (changes["allowControlsToggle"] && !changes["allowControlsToggle"].firstChange) {
      this.allowControlsToggle = this.uiActions.booleanOf(this.allowControlsToggle, true);
    }
  }

  private initializeMap() {
    const provider = this.mapControlsState.provider;
    const style = this.mapControlsState.osStyle;
    const base = this.mapTiles.createBaseLayer(provider, style);
    const crs = this.mapTiles.crsForStyle(provider, style);
    const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);

    this.options = {
      layers: [base],
      zoom: this.mapZoom,
      center: L.latLng(this.mapCenter[0], this.mapCenter[1]),
      crs,
      maxZoom,
      zoomSnap: 0.1,
      zoomDelta: 0.5
    };
    this.updateMarkers();
  }

  onMapReady(map: L.Map) {
    this.mapRef = map;
    this.logger.info("Map ready, invalidating size");
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }

  private updateMapSize() {
    if (this.mapRef) {
      setTimeout(() => {
        this.mapRef.invalidateSize();
      }, 100);
    }
  }

  private updateMarkers() {
    if (!this.pageContent?.rows?.[0]?.columns) {
      this.logger.info("No columns to display on map");
      return;
    }

    this.allMarkers = [];
    const columns = this.pageContent.rows[0].columns;
    const validColumns = columns.filter(col => this.hasValidLocation(col));

    this.logger.info("Creating markers for", validColumns.length, "locations");

    validColumns.forEach(column => {
      const marker = this.createMarker(column);
      if (marker) {
        this.allMarkers.push(marker);
      }
    });

    if (this.allMarkers.length > 0) {
      this.applyMarkersToMap();
      this.fitMapToBounds();
    } else {
      this.logger.info("No valid markers to display");
      this.leafletLayers = [];
    }
  }

  private hasValidLocation(column: PageContentColumn): boolean {
    return !!(column.location?.latitude && column.location?.longitude);
  }

  private createMarker(column: PageContentColumn): L.Marker | null {
    if (!column.location?.latitude || !column.location?.longitude) {
      return null;
    }

    const provider = this.mapControlsState.provider;
    const style = this.mapControlsState.osStyle;
    const markerIcon = this.markerStyle.markerIcon(provider, style);

    const marker = L.marker([column.location.latitude, column.location.longitude], {
      icon: markerIcon as any
    });

    const tooltipText = `Navigate to ${column.title || "Untitled"}`;
    marker.bindTooltip(tooltipText, {
      direction: "top",
      offset: [0, -25],
      permanent: false,
      sticky: false,
      interactive: false,
      opacity: 0.9
    });

    if (column.href) {
      marker.on("click", () => {
        this.urlService.navigateTo([column.href]);
      });
    }

    return marker;
  }


  private applyMarkersToMap() {
    if (this.shouldCluster()) {
      this.logger.info("Applying clustering to", this.allMarkers.length, "markers");
      const provider = this.mapControlsState.provider;
      const style = this.mapControlsState.osStyle;
      const clusterIconFn = this.markerStyle.clusterIconCreate(provider, style);

      this.clusterGroupRef = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        animate: true,
        iconCreateFunction: clusterIconFn
      });
      this.allMarkers.forEach(marker => this.clusterGroupRef.addLayer(marker));
      this.leafletLayers = [this.clusterGroupRef];
    } else {
      this.logger.info("No clustering, displaying", this.allMarkers.length, "individual markers");
      this.leafletLayers = [...this.allMarkers];
    }
  }

  private shouldCluster(): boolean {
    return this.clusteringEnabled && this.allMarkers.length >= this.clusteringThreshold;
  }

  private fitMapToBounds() {
    if (this.allMarkers.length === 0) {
      return;
    }

    const latLngs = this.allMarkers.map(marker => marker.getLatLng());
    this.fitBounds = L.latLngBounds(latLngs);
    this.logger.info("Fitting map to bounds with", latLngs.length, "points");
  }

  onProviderChange(provider: MapProvider) {
    this.mapControlsState.provider = provider;
    this.recreateMap();
  }

  onStyleChange(style: string) {
    this.mapControlsState.osStyle = style;
    this.recreateMap();
  }

  onHeightChange(height: number) {
    this.mapControlsState.mapHeight = height;
    this.mapHeight = height;
    this.updateMapSize();
  }

  private recreateMap() {
    this.showMap = false;
    setTimeout(() => {
      this.initializeMap();
      this.showMap = true;
    }, 50);
  }

  toggleControls() {
    this.showControls = !this.showControls;
  }

}
