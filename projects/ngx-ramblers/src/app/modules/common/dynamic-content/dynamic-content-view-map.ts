import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from "@angular/core";
import * as L from "leaflet";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { MapData, MapMarker, MapRoute, PageContent, PageContentRow } from "../../../models/content-text.model";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { GpxParserService, GpxTrack, GpxWaypoint } from "../../../services/maps/gpx-parser.service";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { UrlService } from "../../../services/url.service";
import { ServerFileNameData } from "../../../models/aws-object.model";
import { MapControls, MapControlsConfig, MapControlsState } from "../../../shared/components/map-controls";
import { MapOverlay } from "../../../shared/components/map-overlay";
import { MapProvider } from "../../../models/map.model";
import { isUndefined } from "es-toolkit/compat";
import { MarkdownComponent } from "ngx-markdown";
import { PageContentActionsService } from "../../../services/page-content-actions.service";

interface MapRouteViewModel extends MapRoute {
  gpxFileUrl?: string;
}

interface RouteGpxData {
  track: GpxTrack;
  waypoints: GpxWaypoint[];
}

@Component({
  selector: "app-dynamic-content-view-map",
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

    .map-text
      margin-bottom: 1rem

    .route-legend
      background: white
      border-radius: 0.5rem
      padding: 1rem
      margin-bottom: 1rem
      box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)

    .route-legend-item
      display: flex
      align-items: center
      margin-bottom: 0.5rem

    .route-legend-item:last-child
      margin-bottom: 0

    .route-color-box
      width: 30px
      height: 3px
      margin-right: 0.5rem
      border-radius: 2px

    .route-name
      font-size: 0.875rem

    :host ::ng-deep .leaflet-control-attribution
      font-size: 0.75rem

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

    :host ::ng-deep .route-arrow-icon
      pointer-events: none
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))

    :host ::ng-deep .route-arrow
      display: inline-flex
      align-items: center
      justify-content: center
      transform-origin: center center

    :host ::ng-deep .route-arrow svg
      display: block

    :host ::ng-deep .route-arrow path,
    :host ::ng-deep .route-arrow polygon
      fill: #fff
      stroke: #fff

    :host ::ng-deep .waypoint-marker
      background: transparent
      border: none

    :host ::ng-deep .waypoint-marker .marker-pin
      width: 26px
      height: 26px
      border-radius: 50% 50% 50% 0
      background: #204f3d
      border: 3px solid #fff
      transform: rotate(-45deg)
      display: flex
      align-items: center
      justify-content: center
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.35)

    :host ::ng-deep .waypoint-marker .marker-dot
      width: 8px
      height: 8px
      border-radius: 50%
      background: #fff
  `],
  template: `
    @if (row?.map) {
      <div [class]="actions.rowClasses(row)">
        @if (row.map.text) {
          <div class="map-text" markdown>{{ row.map.text }}</div>
        }

      @if (visibleRoutes.length > 1) {
        <div class="route-legend">
          <h6>Routes</h6>
          @for (route of visibleRoutes; track route.id) {
            <div class="route-legend-item">
              <div class="route-color-box" [style.backgroundColor]="route.color"></div>
              <span class="route-name">{{ route.name }}</span>
            </div>
          }
        </div>
      }
      @if (!hasVisibleRoutes && !loadingRoutes) {
        <div class="alert alert-info">
          No visible routes to display
        </div>
      } @else {
        <div class="map-section">
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
              @if (loadingRoutes || !options) {
                <div class="card shadow d-flex align-items-center justify-content-center rounded"
                     [style.height.px]="mapHeight">
                  <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading…</span>
                  </div>
                </div>
              } @else if (showMap) {
                <div class="card shadow rounded"
                     [style.height.px]="mapHeight"
                     leaflet
                     [leafletOptions]="options"
                     [leafletLayers]="leafletLayers"
                     [leafletFitBounds]="fitBounds"
                     (leafletMapReady)="onMapReady($event)">
                </div>
                <app-map-overlay
                  [showControls]="showControls"
                  [allowToggle]="allowControlsToggle"
                  [showWaypoints]="showWaypoints"
                  [allowWaypointsToggle]="allowWaypointsToggle"
                  (toggleControls)="toggleControls()"
                  (toggleWaypoints)="toggleWaypoints()">
                  <div slot="bottom-overlay" class="map-overlay bottom-right">
                    <div class="overlay-content">
                        <span class="badge bg-primary text-white border rounded-pill small fw-bold">
                          {{ routeCountText }}
                        </span>
                    </div>
                  </div>
                </app-map-overlay>
              }
            </div>
          </div>
        </div>
      }
      </div>
    }
  `,
  imports: [LeafletModule, MapControls, MapOverlay, MarkdownComponent]
})
export class DynamicContentViewMap implements OnInit, OnChanges, OnDestroy {
  @Input() row!: PageContentRow;
  @Input() refreshKey?: number;
  @Input() editing = false;
  @Input() pageContent?: PageContent;
  @Output() mapConfigChange = new EventEmitter<Partial<MapData>>();

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewMap", NgxLoggerLevel.INFO);
  private mapTiles = inject(MapTilesService);
  private mapMarkerStyle = inject(MapMarkerStyleService);
  private gpxParser = inject(GpxParserService);
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  private mapTilesService = inject(MapTilesService);
  public actions = inject(PageContentActionsService);
  public options: L.MapOptions | undefined;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  public showMap = false;
  public visibleRoutes: MapRouteViewModel[] = [];
  public hasVisibleRoutes = false;
  public loadingRoutes = false;
  public showControls = true;
  public allowControlsToggle = true;
  public showWaypoints = true;
  public allowWaypointsToggle = true;
  public mapHeight = 500;
  public routeCountText = "";
  private routeData: Map<string, RouteGpxData> = new Map();

  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false
  };

  public mapControlsState: MapControlsState = {
    provider: "osm",
    osStyle: "Leisure_27700",
    mapHeight: 500
  };

  private componentReady = false;
  private mapViewChangeHandler = () => this.captureMapView();

  async ngOnInit() {
    this.mapTiles.initializeProjections();
    this.componentReady = true;
    await this.refreshFromInput();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.componentReady) {
      if ((changes["row"] && !changes["row"].firstChange)
        || (changes["refreshKey"] && !changes["refreshKey"].firstChange)) {
        this.logger.info(changes, "refreshFromInput called");
        await this.refreshFromInput();
      } else {
        this.logger.info("componentReady:true:changes:", changes, "changes not of right type - refreshFromInput not called");
      }
    } else {
      this.logger.info("componentReady:false:changes:", changes, "refreshFromInput not called");
    }
  }

  ngOnDestroy() {
    this.detachMapListeners();
  }

  private async refreshFromInput() {
    this.resetState();
    this.initializeRoutes();
    await this.initialiseMap();
  }

  private resetState() {
    this.detachMapListeners();
    this.options = undefined;
    this.leafletLayers = [];
    this.fitBounds = undefined;
    this.mapRef = undefined;
    this.showMap = false;
    this.visibleRoutes = [];
    this.hasVisibleRoutes = false;
    this.loadingRoutes = true;
    this.mapHeight = 500;
    this.routeCountText = "";
    this.showControls = true;
    this.allowControlsToggle = true;
    this.routeData.clear();
    this.logger.info("resetState: Complete - loadingRoutes:", this.loadingRoutes, "options:", this.options);
  }

  private initializeRoutes() {
    this.mapTilesService.syncMarkersFromLocation(this.pageContent, this.row);
    const routes = this.row.map?.routes || [];
    const markers = this.row.map?.markers || [];
    const validMarkers = markers.filter(m => m.latitude != null && m.longitude != null);
    this.visibleRoutes = routes
      .filter(route => route.visible !== false)
      .map(route => ({...route, gpxFileUrl: this.routeUrl(route)}));
    this.hasVisibleRoutes = this.visibleRoutes.length > 0 || validMarkers.length > 0;
    this.routeCountText = this.visibleRoutes.length === 1 ? "1 route" : `${this.visibleRoutes.length} routes`;
    this.mapHeight = this.row.map?.mapHeight || 500;
    const provider = (this.row.map?.provider || "osm") as MapProvider;
    const osStyle = this.row.map?.osStyle || "Leisure_27700";
    this.allowControlsToggle = this.row.map?.allowControlsToggle !== false;
    const showDefault = this.row.map?.showControlsDefault;
    this.showControls = isUndefined(showDefault) ? true : showDefault;
    this.allowWaypointsToggle = this.row.map?.allowWaypointsToggle !== false;
    const showWaypointsDefault = this.row.map?.showWaypointsDefault;
    this.showWaypoints = isUndefined(showWaypointsDefault) ? true : showWaypointsDefault;
    this.mapControlsState = {
      provider,
      osStyle,
      mapHeight: this.mapHeight
    };
  }

  private async initialiseMap() {
    if (!this.row.map) {
      this.logger.info("initialiseMap: No map data");
    } else if (!this.hasVisibleRoutes) {
      this.logger.info("initialiseMap: No visible routes or markers");
      this.showMap = false;
    } else {
      this.logger.info("initialiseMap: Start - loadingRoutes=true, options=undefined");
      this.loadingRoutes = true;
      this.options = undefined;
      this.logger.info("initialiseMap: About to load routes (spinner should show)");
      await this.loadRoutes();
      this.logger.info("initialiseMap: Routes loaded, creating map options");
      const provider = this.mapControlsState.provider;
      const style = this.mapControlsState.osStyle;
      const base = this.mapTiles.createBaseLayer(provider, style);
      const crs = this.mapTiles.crsForStyle(provider, style);
      const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);
      const hasSavedPosition = this.row.map.mapCenter && this.row.map.mapZoom;
      const willAutoFit = !isUndefined(this.fitBounds);
      const useDefaultPosition = !hasSavedPosition || willAutoFit;
      this.options = {
        layers: [base],
        zoom: useDefaultPosition ? 10 : this.row.map.mapZoom,
        center: useDefaultPosition
          ? L.latLng(51.25, 0.75)
          : L.latLng(this.row.map.mapCenter[0], this.row.map.mapCenter[1]),
        crs,
        maxZoom,
        zoomSnap: 0.1,
        zoomDelta: 0.5
      };
      this.logger.info("initialiseMap: Complete - useDefaultPosition:", useDefaultPosition, "willAutoFit:", willAutoFit, "options set, map should appear");
    }
  }

  private async loadRoutes() {
    this.logger.info("loadRoutes: Start - hasVisibleRoutes:", this.hasVisibleRoutes);
    if (!this.hasVisibleRoutes) {
      this.showMap = false;
      this.leafletLayers = [];
      this.loadingRoutes = false;
      this.logger.info("loadRoutes: No visible routes, setting loadingRoutes=false");
      return;
    }

    const desiredRouteIds = new Set(this.visibleRoutes.map(route => route.id));
    for (const routeId of Array.from(this.routeData.keys())) {
      if (!desiredRouteIds.has(routeId)) {
        this.routeData.delete(routeId);
      }
    }

    const routeLayers: L.Layer[] = [];

    this.logger.info("loadRoutes: Loading", this.visibleRoutes.length, "routes (spinner should still be showing)");
    for (const route of this.visibleRoutes) {
      const gpxData = await this.routeDataForRoute(route);
      if (gpxData?.track) {
        const routeLayer = this.createRouteLayer(gpxData.track, gpxData.waypoints, route);
        if (routeLayer) {
          routeLayers.push(routeLayer);
        }
      }
    }

    this.logger.info("loadRoutes: All routes loaded, setting loadingRoutes=false");
    this.loadingRoutes = false;

    const markers = this.row.map?.markers || [];
    const markerLayers = this.createStandaloneMarkers(markers);
    const allLayers = [...routeLayers, ...markerLayers];
    const hasContent = allLayers.length > 0;

    if (hasContent) {
      this.leafletLayers = allLayers;
      const hasSavedPosition = this.row.map?.mapCenter && this.row.map?.mapZoom;
      const shouldAutoFit = this.row.map?.autoFitBounds !== false;
      this.logger.info("loadRoutes: Auto-fit check - shouldAutoFit:", shouldAutoFit, "hasSavedPosition:", hasSavedPosition, "autoFitBounds setting:", this.row.map?.autoFitBounds);
      if (shouldAutoFit || !hasSavedPosition) {
        this.calculateFitBounds();
        this.logger.info("loadRoutes: Calculated fitBounds:", this.fitBounds ? `${this.fitBounds.getSouthWest()} to ${this.fitBounds.getNorthEast()}` : "none");
      }
      this.showMap = true;
      this.logger.info("loadRoutes: Map ready to display (routes:", routeLayers.length, "markers:", markerLayers.length, ") - showMap=true");
      this.updateMapSize();
    } else {
      this.showMap = false;
      this.logger.info("loadRoutes: No layers or markers, hiding map");
    }
  }

  private async routeDataForRoute(route: MapRouteViewModel): Promise<RouteGpxData | undefined> {
    if (this.routeData.has(route.id)) {
      return this.routeData.get(route.id);
    }

    if (!route.gpxFileUrl) {
      this.logger.warn("Route has no GPX file URL:", route);
      return undefined;
    }

    try {
      const gpxContent = await firstValueFrom(
        this.http.get(route.gpxFileUrl, {responseType: "text"})
      );
      const parsedGpx = this.gpxParser.parseGpxFile(gpxContent);

      if (parsedGpx.tracks.length > 0) {
        const mergedTrack: GpxTrack = this.mergeGpxTracks(parsedGpx.tracks);
        const gpxData: RouteGpxData = {
          track: mergedTrack,
          waypoints: parsedGpx.waypoints || []
        };
        this.routeData.set(route.id, gpxData);
        return gpxData;
      }
    } catch (error) {
      this.logger.error("Failed to load GPX file:", route.gpxFileUrl, error);
    }

    return undefined;
  }

  private mergeGpxTracks(tracks: GpxTrack[]): GpxTrack {
    if (tracks.length === 1) {
      return tracks[0];
    }

    const allPoints = tracks.flatMap(t => t.points);
    const descriptions = tracks.map(t => t.description).filter(Boolean);
    const elevations = tracks
      .flatMap(t => [t.minElevation, t.maxElevation])
      .filter((e): e is number => !isUndefined(e));

    return {
      name: tracks[0].name,
      description: descriptions.length > 0 ? descriptions.join(" | ") : undefined,
      points: allPoints,
      totalDistance: tracks.reduce((sum, t) => sum + (t.totalDistance || 0), 0),
      minElevation: elevations.length > 0 ? Math.min(...elevations) : undefined,
      maxElevation: elevations.length > 0 ? Math.max(...elevations) : undefined,
      totalAscent: tracks.reduce((sum, t) => sum + (t.totalAscent || 0), 0),
      totalDescent: tracks.reduce((sum, t) => sum + (t.totalDescent || 0), 0)
    };
  }

  private createRouteLayer(track: GpxTrack, waypoints: GpxWaypoint[], route: MapRouteViewModel): L.Layer | null {
    const latLngs = this.gpxParser.toLeafletLatLngs(track);
    if (latLngs.length < 2) {
      return null;
    }

    const color = route.color || "#b11256";
    const weight = route.weight || 8;
    const opacity = route.opacity ?? 1.0;
    const haloWeight = weight + 4;
    const haloOpacity = 0.6;

    const halo = L.polyline(latLngs, {
      color: "#ffffff",
      weight: haloWeight,
      opacity: haloOpacity,
      lineCap: "round",
      lineJoin: "round"
    });

    const core = L.polyline(latLngs, {
      color,
      weight,
      opacity,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 1
    });

    const popupContent = this.createPopupContent(track, route);
    core.bindPopup(popupContent);

    const routeGroup = L.layerGroup([halo, core]);
    this.createEndpointMarkers(latLngs, color, weight).forEach(marker => routeGroup.addLayer(marker));
    this.createArrowMarkers(latLngs, track, weight).forEach(marker => routeGroup.addLayer(marker));
    this.createWaypointMarkers(track, waypoints, route).forEach(marker => routeGroup.addLayer(marker));

    return routeGroup;
  }

  private createPopupContent(track: GpxTrack, route: MapRouteViewModel): string {
    const name = route.name || track.name;
    let content = `<div><strong>${name}</strong></div>`;

    if (track.description) {
      content += `<div class="mt-1"><small>${track.description}</small></div>`;
    }

    if (track.totalDistance) {
      const distanceKm = (track.totalDistance / 1000).toFixed(2);
      content += `<div class="mt-1"><small>Distance: ${distanceKm} km</small></div>`;
    }

    if (!isUndefined(track.totalAscent) && !isUndefined(track.totalDescent)) {
      content += `<div><small>Ascent: ${track.totalAscent.toFixed(0)}m | Descent: ${track.totalDescent.toFixed(0)}m</small></div>`;
    }

    if (!isUndefined(track.minElevation) && !isUndefined(track.maxElevation)) {
      content += `<div><small>Elevation: ${track.minElevation.toFixed(0)}m - ${track.maxElevation.toFixed(0)}m</small></div>`;
    }

    return content;
  }

  private calculateFitBounds() {
    const allLatLngs: L.LatLng[] = [];
    this.logger.info("calculateFitBounds: Processing", this.leafletLayers.length, "layers");
    this.leafletLayers.forEach((layer, index) => {
      if (!layer) {
        this.logger.warn(`calculateFitBounds: Layer ${index} is undefined, skipping`);
        return;
      }
      const layerLatLngs = this.latLngsFromLayer(layer);
      this.logger.info(`calculateFitBounds: Layer ${index} (${layer.constructor.name}) contributed ${layerLatLngs.length} points`);
      allLatLngs.push(...layerLatLngs);
    });

    this.logger.info("calculateFitBounds: Total points collected:", allLatLngs.length);
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      this.fitBounds = bounds.pad(0.15);
      this.logger.info("calculateFitBounds: Bounds set to:", this.fitBounds.getSouthWest(), "to", this.fitBounds.getNorthEast(), "(with 15% padding)");
    }
  }

  onMapReady(map: L.Map) {
    this.mapRef = map;
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    if (this.editing) {
      this.attachMapListeners();
      this.captureMapView();
    }
  }

  toggleControls() {
    if (!this.allowControlsToggle) {
      return;
    }
    this.showControls = !this.showControls;
    if (this.editing && this.row.map) {
      this.row.map.showControlsDefault = this.showControls;
      this.mapConfigChange.emit({showControlsDefault: this.showControls});
    }
    setTimeout(() => this.updateMapSize(), 200);
  }

  toggleWaypoints() {
    if (!this.allowWaypointsToggle) {
      return;
    }
    this.showWaypoints = !this.showWaypoints;
    if (this.editing && this.row.map) {
      this.row.map.showWaypointsDefault = this.showWaypoints;
      this.mapConfigChange.emit({showWaypointsDefault: this.showWaypoints});
    }
    this.updateLayersForWaypoints();
  }

  private updateLayersForWaypoints() {
    const routeLayers: L.Layer[] = [];

    for (const route of this.visibleRoutes) {
      const gpxData = this.routeData.get(route.id);
      if (gpxData?.track) {
        const routeLayer = this.createRouteLayer(gpxData.track, gpxData.waypoints, route);
        if (routeLayer) {
          routeLayers.push(routeLayer);
        }
      }
    }

    this.leafletLayers = routeLayers;
  }

  onProviderChange(provider: MapProvider) {
    this.mapControlsState = {...this.mapControlsState, provider};
    this.updateRowMap({provider});
    this.initialiseMap();
  }

  onStyleChange(style: string) {
    this.mapControlsState = {...this.mapControlsState, osStyle: style};
    this.updateRowMap({osStyle: style});
    this.initialiseMap();
  }

  onHeightChange(height: number) {
    this.mapHeight = height;
    this.mapControlsState = {...this.mapControlsState, mapHeight: height};
    this.updateRowMap({mapHeight: height});
    this.updateMapSize();
  }

  private updateMapSize() {
    if (this.mapRef) {
      setTimeout(() => {
        this.mapRef?.invalidateSize();
      }, 100);
    }
  }

  private routeUrl(route: MapRoute): string | undefined {
    const filePath = this.filePath(route.gpxFile as Partial<ServerFileNameData> | undefined);
    if (!filePath) {
      return undefined;
    } else if (this.urlService.isRemoteUrl(filePath)) {
      return filePath;
    } else {
      return this.urlService.resourceRelativePathForAWSFileName(filePath) || undefined;
    }
  }

  private filePath(fileData: Partial<ServerFileNameData> | undefined): string | undefined {
    if (!fileData || !fileData.awsFileName) {
      return undefined;
    } else if (fileData.rootFolder && !fileData.awsFileName.startsWith(`${fileData.rootFolder}/`)) {
      return `${fileData.rootFolder}/${fileData.awsFileName}`;
    } else {
      return fileData.awsFileName;
    }
  }

  private attachMapListeners() {
    if (!this.mapRef) {
      return;
    } else {
      this.mapRef.on("moveend", this.mapViewChangeHandler);
      this.mapRef.on("zoomend", this.mapViewChangeHandler);
    }
  }

  private detachMapListeners() {
    if (!this.mapRef) {
      return;
    } else {
      this.mapRef.off("moveend", this.mapViewChangeHandler);
      this.mapRef.off("zoomend", this.mapViewChangeHandler);
    }
  }

  private captureMapView() {
    if (!this.editing || !this.mapRef || !this.row?.map) {
      return;
    } else {
      const center = this.mapRef.getCenter();
      const zoom = this.mapRef.getZoom();
      this.updateRowMap({
        mapCenter: [center.lat, center.lng],
        mapZoom: zoom
      });
    }
  }

  private updateRowMap(partial: Partial<MapData>) {
    if (!this.row?.map) {
      return;
    }
    let changed = false;
    const currentMap = this.row.map as Record<string, any>;
    (Object.keys(partial) as (keyof MapData)[]).forEach(key => {
      const nextValue = partial[key];
      if (isUndefined(nextValue)) {
        return;
      }
      const previous = currentMap[key as string];
      if (!this.valuesEqual(previous, nextValue)) {
        currentMap[key as string] = nextValue;
        changed = true;
      }
    });
    if (changed) {
      this.mapConfigChange.emit(this.row.map);
    }
  }

  private valuesEqual(current: any, next: any): boolean {
    if (Array.isArray(current) && Array.isArray(next)) {
      if (current.length !== next.length) {
        return false;
      }
      return current.every((value, index) => value === next[index]);
    }
    return current === next;
  }

  private createEndpointMarkers(latLngs: [number, number][], color: string, weight: number): L.CircleMarker[] {
    if (latLngs.length === 0) {
      return [];
    }
    const radius = Math.max(weight + 2, 6);
    const start = L.circleMarker(latLngs[0], {
      radius,
      color: "#ffffff",
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    });
    const end = L.circleMarker(latLngs[latLngs.length - 1], {
      radius: radius + 1,
      color: "#ffffff",
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    });
    return [start, end];
  }

  private createStandaloneMarkers(markers: MapMarker[]): L.Layer[] {
    const provider = (this.row.map?.provider || "osm") as "osm" | "os";
    const osStyle = this.row.map?.osStyle || "Leisure_27700";
    const icon = this.mapMarkerStyle.markerIcon(provider, osStyle);
    return markers.map(marker => {
      const latlng: [number, number] = [marker.latitude, marker.longitude];
      const leafletMarker = L.marker(latlng, {icon});
      if (marker.label) {
        leafletMarker.bindPopup(`<div><strong>${this.escapeHtml(marker.label)}</strong></div>`);
      }
      return leafletMarker;
    });
  }

  private createArrowMarkers(latLngs: [number, number][], track: GpxTrack, weight: number): L.Marker[] {
    if (latLngs.length < 2) {
      return [];
    }

    const spacing = this.arrowSpacing(track);
    const markers: L.Marker[] = [];
    if (spacing <= 0) {
      return markers;
    }

    let distanceSinceLast = 0;
    for (let i = 1; i < latLngs.length; i++) {
      const start = L.latLng(latLngs[i - 1]);
      const end = L.latLng(latLngs[i]);
      const segmentDistance = start.distanceTo(end);
      if (segmentDistance === 0) {
        continue;
      }
      distanceSinceLast += segmentDistance;
      while (distanceSinceLast >= spacing) {
        const overshoot = distanceSinceLast - spacing;
        const ratio = (segmentDistance - overshoot) / segmentDistance;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lng = start.lng + (end.lng - start.lng) * ratio;
        const bearing = this.bearingBetween(start, end);
        markers.push(this.createArrowMarker([lat, lng], bearing, weight));
        distanceSinceLast -= spacing;
      }
    }

    if (markers.length === 0) {
      const midIndex = Math.floor(latLngs.length / 2);
      const direction = this.bearingBetween(L.latLng(latLngs[0]), L.latLng(latLngs[latLngs.length - 1]));
      markers.push(this.createArrowMarker(latLngs[midIndex], direction, weight));
    }

    return markers;
  }

  private createWaypointMarkers(track: GpxTrack, waypoints: GpxWaypoint[], route: MapRouteViewModel): L.Marker[] {
    const markers: L.Marker[] = [];

    if (!this.showWaypoints || waypoints.length === 0) {
      return markers;
    }

    const provider = (this.row.map?.provider || "osm") as "osm" | "os";
    const osStyle = this.row.map?.osStyle || "Leisure_27700";
    const icon = this.mapMarkerStyle.markerIcon(provider, osStyle);

    let unnamedIndex = 1;
    waypoints.forEach(waypoint => {
      const label = waypoint.name || `${route.name || "Waypoint"} ${unnamedIndex++}`;
      const popup = this.createWaypointPopupContent(label, waypoint.description);
      const marker = L.marker([waypoint.latitude, waypoint.longitude], {icon});
      marker.bindPopup(popup);
      markers.push(marker);
    });

    return markers;
  }

  private createWaypointPopupContent(name: string, description?: string): string {
    const title = this.escapeHtml(name);
    const details = description
      ? `<div class="mt-1"><small>${this.escapeHtml(description)}</small></div>`
      : `<div class="mt-1 text-muted"><small>This waypoint has no description</small></div>`;
    return `<div><strong>${title}</strong></div>${details}`;
  }

  private escapeHtml(value?: string): string {
    if (!value) {
      return "";
    }
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private arrowSpacing(track: GpxTrack): number {
    const distance = track.totalDistance || 0;
    if (distance <= 0) {
      return 2000;
    }
    const spacing = distance / 6;
    return Math.min(Math.max(spacing, 2000), 8000);
  }

  private createArrowMarker(position: [number, number], bearing: number, weight: number): L.Marker {
    const size = Math.max(14, Math.min(weight * 4, 28));
    const height = Math.round(size / 2.4);
    const strokeWidth = Math.max(1.5, weight / 3);
    const html = `
        <div class="route-arrow" style="transform: rotate(${bearing - 90}deg);">
          <svg viewBox="0 0 24 8" width="${size}" height="${height}">
            <path d="M2 4 L16 4" stroke-width="${strokeWidth}" stroke-linecap="round"></path>
            <polygon points="16,0 24,4 16,8"></polygon>
          </svg>
        </div>`;
    return L.marker(position, {
      icon: L.divIcon({
        className: "route-arrow-icon",
        html,
        iconSize: [size, height],
        iconAnchor: [size / 2, height / 2]
      }),
      interactive: false
    });
  }

  private bearingBetween(start: L.LatLng, end: L.LatLng): number {
    const startLat = start.lat * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const dLng = (end.lng - start.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  private latLngsFromLayer(layer: L.Layer): L.LatLng[] {
    if (layer instanceof L.Polyline) {
      return this.flattenLatLngs(layer.getLatLngs());
    } else if (layer instanceof L.CircleMarker) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.Marker) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.LayerGroup) {
      const nested: L.LatLng[] = [];
      layer.getLayers().forEach(child => nested.push(...this.latLngsFromLayer(child)));
      return nested;
    } else {
      return [];
    }
  }

  private flattenLatLngs(latLngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][]): L.LatLng[] {
    const flat: L.LatLng[] = [];
    latLngs.forEach(entry => {
      if (Array.isArray(entry)) {
        flat.push(...this.flattenLatLngs(entry as any));
      } else {
        flat.push(entry as L.LatLng);
      }
    });
    return flat;
  }
}
