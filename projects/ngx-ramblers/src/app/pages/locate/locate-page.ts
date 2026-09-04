import { Component, inject, NgZone, OnDestroy, OnInit } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { MaximisableMapComponent, MaximisableMapState } from "../../modules/common/maximisable-map/maximisable-map";
import { Subscription } from "rxjs";
import { GoogleMapsService } from "../../services/google-maps.service";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import * as L from "leaflet";
import { NgxLoggerLevel } from "ngx-logger";
import { locateParentPath, locationLabel, osMapsUrl, wazeEmbedUrl } from "../../functions/locate";
import { asNumber } from "../../functions/numbers";
import { GridReferenceLookupResponse } from "../../models/address-model";
import { DirectionsApp, GOOGLE_MAPS_PROVIDER_LABEL, LOCATE_OVERVIEW_CENTRE, LOCATE_OVERVIEW_ZOOM, LOCATE_POINT_ZOOM, LocatePoint } from "../../models/locate.model";
import { WalkDetailsMapProvider } from "../../models/walks-config.model";
import { KeyValue } from "../../functions/enums";
import { DEFAULT_OS_STYLE, MapProvider, osStyleForKey } from "../../models/map.model";
import { values } from "es-toolkit/compat";
import { LocationDetails } from "../../models/ramblers-walks-manager";
import { StoredValue } from "../../models/ui-actions";
import { LocationLinksComponent } from "../../modules/common/location-links/location-links.component";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { GridReferenceService } from "../../services/maps/grid-reference.service";
import { MapMarkerStyleService } from "../../services/maps/map-marker-style.service";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { PageService } from "../../services/page.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { UrlService } from "../../services/url.service";
import { AddressQueryService } from "../../services/walks/address-query.service";
import { DirectionsPill } from "../../shared/components/directions-pill";
import { LocationAutocompleteComponent } from "../../shared/components/location-autocomplete";
import { MapControls, MapControlsConfig, MapControlsState } from "../../shared/components/map-controls";
import { ResizerComponent } from "../../modules/common/resizer/resizer";
import { WalkDisplayService } from "../walks/walk-display.service";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { LOCATE_MAP_HEIGHT_DEFAULT, LOCATE_MAP_HEIGHT_MAX, LOCATE_MAP_HEIGHT_MIN } from "../../models/locate.model";

@Component({
  selector: "app-locate-page",
  imports: [FontAwesomeModule, LeafletModule, RouterLink, NgTemplateOutlet, LocationAutocompleteComponent, LocationLinksComponent, DirectionsPill, MapControls, ResizerComponent, MaximisableMapComponent],
  styles: [`
    .locate-map-stack
      width: 100%
    .locate-map-full
      display: flex
      flex-direction: column
      min-height: 0
    .locate-map-full .locate-map
      flex: 1 1 auto
      border-radius: 8px
    .locate-map
      border-radius: 8px 8px 0 0
      overflow: hidden
    .locate-directions
      display: block
      width: 100%
      border: 0
    .locate-search
      flex: 1 1 320px
      min-width: 0
  `],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Locate</div>
      <p class="text-muted small mb-2">Type a grid reference, postcode or place name, or click anywhere on the map, to see where it is and read off its grid reference, postcode and coordinates.</p>
      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
        @if (parentPath) {
          <a class="btn btn-quiet" [routerLink]="parentPath"><fa-icon [icon]="faBack" class="me-2"/>Back</a>
        }
        <div class="locate-search">
          <app-location-autocomplete placeholder="Grid reference, postcode or place name" [minTermLength]="2" [value]="searchLabel" (locationChange)="onLocationChange($event)"/>
        </div>
        @if (!mapFullScreen) {
          <ng-container *ngTemplateOutlet="mapControlsTemplate"/>
        }
      </div>
      <ng-template #mapControlsTemplate>
        <app-map-controls [config]="controlsConfig" [state]="controlsState" [extraProviders]="extraProviders" (stateChange)="onControlsChange($event)"/>
      </ng-template>
      <ng-template #directionsTemplate>
        @if (location) {
          <app-directions-pill [latitude]="location.latitude" [longitude]="location.longitude"
                               [inlineApps]="inlineApps" [shownApp]="shownApp"
                               (show)="toggleApp($event)"/>
        }
      </ng-template>
      @if (frameUrl || options) {
        <app-maximisable-map class="d-block mb-3" title="Locate" [allowExpanded]="false" [syncToUrl]="true"
                             offsetTop="8px" offsetRight="8px" (sizeChange)="onMapSizeChange($event)">
          <div slot="bar-actions" class="d-flex flex-wrap align-items-center gap-2">
            @if (mapFullScreen) {
              <ng-container *ngTemplateOutlet="mapControlsTemplate"/>
              <ng-container *ngTemplateOutlet="directionsTemplate"/>
            }
          </div>
          <div class="locate-map-stack maximisable-map-fill" [class.locate-map-full]="mapFullScreen">
            @if (frameUrl) {
              <iframe class="locate-map locate-directions" [style.height.px]="mapFullScreen ? null : mapHeight" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" [src]="frameUrl"></iframe>
            } @else {
              <div class="locate-map"
                   [style.height.px]="mapFullScreen ? null : mapHeight"
                   leaflet
                   [leafletOptions]="options"
                   [leafletLayers]="layers"
                   (leafletMapReady)="onMapReady($event)"
                   (leafletClick)="onMapClick($event)"></div>
            }
            @if (!mapFullScreen) {
              <app-resizer orientation="vertical" variant="tab" compact
                           [size]="mapHeight" [minSize]="minMapHeight" [maxSize]="maxMapHeight"
                           (sizeChange)="onMapHeightChange($event)"/>
            }
          </div>
        </app-maximisable-map>
      }
      @if (location) {
        <div class="mb-3">
          <app-location-links [location]="location" [inline]="true" [showDescription]="!!location.description"/>
        </div>
        <div class="d-flex flex-wrap align-items-center gap-3">
          @if (!mapFullScreen) {
            <ng-container *ngTemplateOutlet="directionsTemplate"/>
          }
          <a class="small d-inline-flex align-items-center" [href]="osMapsLink" target="_blank" rel="noopener" title="Opens in a new tab">
            <img class="related-links-image me-2" src="/assets/images/local/ordnance-survey.png" alt=""/>Open location in OS Maps <fa-icon [icon]="faExternal" class="ms-1"/>
          </a>
        </div>
        @if (frameMessage) {
          <p class="text-muted small mt-2 mb-0">{{ frameMessage }}</p>
        }
      } @else {
        <p class="text-muted small mb-0">Nothing chosen yet. Search above or click the map.</p>
      }
    </div>`
})
export class LocatePageComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("LocatePageComponent", NgxLoggerLevel.ERROR);
  private pageService = inject(PageService);
  private route = inject(ActivatedRoute);
  private uiActions = inject(UiActionsService);
  private urlService = inject(UrlService);
  private mapTiles = inject(MapTilesService);
  private markerStyle = inject(MapMarkerStyleService);
  private gridReferences = inject(GridReferenceService);
  private addressQuery = inject(AddressQueryService);
  private zone = inject(NgZone);
  protected display = inject(WalkDisplayService);
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private zoom = LOCATE_OVERVIEW_ZOOM;
  protected readonly faExternal = faArrowUpRightFromSquare;
  protected readonly faBack = faArrowLeft;
  controlsConfig: MapControlsConfig = {showProvider: true, showStyle: true};
  private subscriptions: Subscription[] = [];

  get extraProviders(): KeyValue<string>[] {
    return this.display.googleDirectionsAvailable() ? [{key: GOOGLE_MAPS_PROVIDER_LABEL, value: WalkDetailsMapProvider.GOOGLE_MAPS}] : [];
  }
  controlsState: MapControlsState = {provider: MapProvider.OSM, osStyle: DEFAULT_OS_STYLE};
  parentPath = "";
  mapFullScreen = false;
  mapHeight = asNumber(this.uiActions.initialValueFor(StoredValue.LOCATE_MAP_HEIGHT)) || LOCATE_MAP_HEIGHT_DEFAULT;
  readonly minMapHeight = LOCATE_MAP_HEIGHT_MIN;
  readonly maxMapHeight = LOCATE_MAP_HEIGHT_MAX;
  private sanitiser = inject(DomSanitizer);
  private googleMaps = inject(GoogleMapsService);
  frameUrl: SafeResourceUrl | null = null;
  frameMessage = "";
  shownApp: DirectionsApp | null = null;
  private lastView: {centre: L.LatLng; zoom: number} = {centre: L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]), zoom: LOCATE_OVERVIEW_ZOOM};
  options: L.MapOptions | null = null;
  layers: L.Layer[] = [];
  point: LocatePoint | null = null;
  location: LocationDetails | null = null;

  ngOnInit(): void {
    this.pageService.setTitle("Locate");
    this.mapTiles.initializeProjections();
    this.parentPath = locateParentPath(this.urlService.relativeUrl()) || "/";
    const hasKey = this.mapTiles.hasOsApiKey();
    this.controlsState = {provider: hasKey ? MapProvider.OS : MapProvider.OSM, osStyle: hasKey ? DEFAULT_OS_STYLE : ""};
    const params = this.route.snapshot.queryParamMap;
    const requestedProvider = [...values(MapProvider), WalkDetailsMapProvider.GOOGLE_MAPS].find(provider => provider === params.get(StoredValue.MAP_PROVIDER)) as MapProvider | undefined;
    this.subscriptions.push(this.googleMaps.events().subscribe(() => {
      if (this.googleMapView && !this.frameUrl) {
        this.buildMap(this.point ? L.latLng(this.point.latitude, this.point.longitude) : this.lastView.centre, this.lastView.zoom);
      }
    }));
    const requestedStyle = params.get(StoredValue.MAP_OS_STYLE);
    this.controlsState = {
      provider: requestedProvider || this.controlsState.provider,
      osStyle: requestedStyle && osStyleForKey(requestedStyle) ? requestedStyle : this.controlsState.osStyle
    };
    const initial = this.pointFromQuery();
    this.zoom = asNumber(params.get(StoredValue.MAP_ZOOM)) || (initial ? this.pointZoom(initial.latitude) : this.overviewZoom());
    if (initial) {
      this.applyPoint(initial);
    } else {
      this.locateFromPostcodeQuery();
    }
    this.buildMap(initial ? L.latLng(initial.latitude, initial.longitude) : L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]), this.zoom);
    const requestedApp = this.uiActions.queryValueForAlias(params.get(StoredValue.DIRECTIONS), values(DirectionsApp)) as DirectionsApp | null;
    if (requestedApp && initial) {
      setTimeout(() => this.toggleApp(requestedApp));
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onMapReady(map: L.Map): void {
    this.map = map;
    map.on("zoomend", () => this.zone.run(() => this.syncZoomToUrl()));
    if (this.point) {
      this.placeMarker(this.point);
    }
  }

  private syncZoomToUrl(): void {
    if (this.map) {
      this.zoom = this.map.getZoom();
      const centre = this.map.getCenter();
      void this.uiActions.updateQueryParameters({[StoredValue.MAP_ZOOM]: this.zoom === this.pointZoom(centre.lat) ? null : this.zoom});
    }
  }

  private syncControlsToUrl(): void {
    const hasKey = this.mapTiles.hasOsApiKey();
    const defaultProvider = hasKey ? MapProvider.OS : MapProvider.OSM;
    void this.uiActions.updateQueryParameters({
      [StoredValue.MAP_PROVIDER]: this.controlsState.provider === defaultProvider ? null : this.controlsState.provider,
      [StoredValue.MAP_OS_STYLE]: this.controlsState.provider === MapProvider.OS && this.controlsState.osStyle !== DEFAULT_OS_STYLE ? this.controlsState.osStyle : null
    });
  }

  onMapClick(event: L.LeafletMouseEvent): void {
    this.zone.run(() => this.choose(event.latlng.lat, event.latlng.lng, false));
  }

  get searchLabel(): string | null {
    return this.location ? locationLabel(this.location.postcode, this.location.description) || null : null;
  }

  onLocationChange(response: GridReferenceLookupResponse): void {
    if (response?.latlng) {
      this.choose(response.latlng.lat, response.latlng.lng, true, response);
    }
  }

  onControlsChange(state: MapControlsState): void {
    this.frameUrl = null;
    this.shownApp = null;
    this.frameMessage = "";
    void this.uiActions.updateQueryParameters({[StoredValue.DIRECTIONS]: null});
    const centre = this.map?.getCenter() || (this.point ? L.latLng(this.point.latitude, this.point.longitude) : L.latLng(LOCATE_OVERVIEW_CENTRE[0], LOCATE_OVERVIEW_CENTRE[1]));
    const zoom = this.map && this.point
      ? this.mapTiles.matchingZoom(this.leafletProvider(), this.controlsState.osStyle, this.map.getZoom(), String(state.provider) === WalkDetailsMapProvider.GOOGLE_MAPS ? MapProvider.OSM : state.provider, state.osStyle, centre.lat)
      : this.zoom;
    this.controlsState = {...this.controlsState, provider: state.provider, osStyle: state.osStyle};
    this.syncControlsToUrl();
    this.options = null;
    this.map = null;
    this.marker = null;
    setTimeout(() => this.buildMap(centre, zoom));
  }

  onMapSizeChange(state: MaximisableMapState): void {
    this.mapFullScreen = state.fullScreen;
    [50, 300].forEach(delay => setTimeout(() => this.map?.invalidateSize(), delay));
  }

  onMapHeightChange(height: number): void {
    this.mapHeight = height;
    this.uiActions.saveValueFor(StoredValue.LOCATE_MAP_HEIGHT, height);
    setTimeout(() => this.map?.invalidateSize(), 60);
  }

  get inlineApps(): DirectionsApp[] {
    return [...(this.display.googleDirectionsAvailable() ? [DirectionsApp.GOOGLE_MAPS] : []), DirectionsApp.WAZE];
  }

  toggleApp(app: DirectionsApp): void {
    if (this.shownApp === app) {
      this.hideFrame();
    } else if (app === DirectionsApp.WAZE && this.point) {
      const zoom = this.mapTiles.matchingZoom(this.leafletProvider(), this.controlsState.osStyle, this.map?.getZoom() ?? this.zoom, MapProvider.OSM, "", this.point.latitude);
      this.showFrame(app, this.sanitiser.bypassSecurityTrustResourceUrl(wazeEmbedUrl(this.point.latitude, this.point.longitude, zoom)));
    } else if (app === DirectionsApp.GOOGLE_MAPS && this.point && navigator.geolocation) {
      this.frameMessage = "Finding where you are…";
      navigator.geolocation.getCurrentPosition(
        position => this.zone.run(() => this.showGoogleDirectionsFrom(`${position.coords.latitude},${position.coords.longitude}`)),
        () => this.zone.run(() => {
          this.frameMessage = "Your location is not available, so directions start from the nearest postcode.";
          this.showGoogleDirectionsFrom(this.location?.postcode || "");
        }),
        {enableHighAccuracy: false, timeout: 8000, maximumAge: 60000}
      );
    } else if (app === DirectionsApp.GOOGLE_MAPS) {
      this.frameMessage = "This browser cannot share your location.";
    }
  }

  private showGoogleDirectionsFrom(origin: string): void {
    if (this.point && origin) {
      const url = this.display.googleDirectionsEmbedUrl(origin, `${this.point.latitude},${this.point.longitude}`);
      if (url) {
        this.showFrame(DirectionsApp.GOOGLE_MAPS, url);
      } else {
        this.frameMessage = "Google directions are not set up on this site.";
      }
    }
  }

  private showFrame(app: DirectionsApp, url: SafeResourceUrl): void {
    this.lastView = this.map ? {centre: this.map.getCenter(), zoom: this.map.getZoom()} : this.lastView;
    this.map = null;
    this.marker = null;
    this.shownApp = app;
    this.frameUrl = url;
    this.frameMessage = this.frameMessage === "Finding where you are…" ? "" : this.frameMessage;
    void this.uiActions.updateQueryParameters({[StoredValue.DIRECTIONS]: this.uiActions.queryValueAliasFor(app)});
  }

  private hideFrame(syncUrl = true): boolean {
    const showing = !!this.frameUrl || this.googleMapView;
    if (showing) {
      this.frameUrl = null;
      this.shownApp = null;
      this.frameMessage = "";
      if (syncUrl) {
        void this.uiActions.updateQueryParameters({[StoredValue.DIRECTIONS]: null});
      }
      const centre = this.point ? L.latLng(this.point.latitude, this.point.longitude) : this.lastView.centre;
      setTimeout(() => this.buildMap(centre, this.lastView.zoom));
    }
    return showing;
  }

  private leafletProvider(): MapProvider {
    return this.googleMapView ? MapProvider.OSM : this.controlsState.provider;
  }

  private pointZoom(latitude: number): number {
    return this.mapTiles.matchingZoom(MapProvider.OS, DEFAULT_OS_STYLE, LOCATE_POINT_ZOOM, this.leafletProvider(), this.controlsState.osStyle, latitude);
  }

  private overviewZoom(): number {
    return this.mapTiles.matchingZoom(MapProvider.OSM, "", LOCATE_OVERVIEW_ZOOM, this.leafletProvider(), this.controlsState.osStyle, LOCATE_OVERVIEW_CENTRE[0]);
  }

  get osMapsLink(): string {
    return this.point ? osMapsUrl(this.point.latitude, this.point.longitude) : "";
  }

  private buildMap(centre: L.LatLng, zoom: number): void {
    const {provider, osStyle} = this.controlsState;
    this.lastView = {centre, zoom};
    if (this.googleMapView) {
      this.options = null;
      this.layers = [];
      this.frameUrl = this.display.googlePlaceEmbedUrl(`${centre.lat.toFixed(6)},${centre.lng.toFixed(6)}`, this.mapTiles.matchingZoom(MapProvider.OS, DEFAULT_OS_STYLE, LOCATE_POINT_ZOOM, MapProvider.OSM, "", centre.lat));
    } else {
      this.layers = [this.mapTiles.createBaseLayer(provider, osStyle)];
      this.options = {
        center: centre,
        zoom: Math.min(zoom, this.mapTiles.maxZoomForStyle(provider, osStyle)),
        crs: this.mapTiles.crsForStyle(provider, osStyle),
        maxZoom: this.mapTiles.maxZoomForStyle(provider, osStyle)
      };
    }
  }

  get googleMapView(): boolean {
    return String(this.controlsState.provider) === WalkDetailsMapProvider.GOOGLE_MAPS;
  }

  private pointFromQuery(): LocatePoint | null {
    const params = this.route.snapshot.queryParamMap;
    const gridRef = params.get(StoredValue.GRID_REF);
    const lat = asNumber(params.get(StoredValue.LAT));
    const lon = asNumber(params.get(StoredValue.LON));
    if (gridRef) {
      return this.gridReferences.fromGridReference(gridRef);
    } else if (lat && lon) {
      return this.gridReferences.fromLatLng(lat, lon);
    } else {
      return null;
    }
  }

  private async locateFromPostcodeQuery(): Promise<void> {
    const postcode = this.route.snapshot.queryParamMap.get(StoredValue.POSTCODE);
    if (postcode) {
      const response = await this.addressQuery.gridReferenceLookup(postcode);
      if (response?.latlng) {
        this.choose(response.latlng.lat, response.latlng.lng, true, response);
      }
    }
  }

  private choose(latitude: number, longitude: number, centre: boolean, known?: GridReferenceLookupResponse): void {
    const point = this.gridReferences.fromLatLng(latitude, longitude);
    if (point) {
      this.applyPoint(point, known);
      const frameHidden = this.hideFrame(false);
      this.placeMarker(point);
      const zoom = centre ? Math.max(this.currentZoom(), this.pointZoom(latitude)) : this.currentZoom();
      if (centre) {
        if (this.map) {
          this.map.setView([latitude, longitude], zoom, {animate: true});
        } else {
          this.lastView = {centre: L.latLng(latitude, longitude), zoom};
        }
      }
      void this.uiActions.updateQueryParameters({
        [StoredValue.GRID_REF]: point.gridReference10,
        [StoredValue.POSTCODE]: null,
        [StoredValue.LAT]: null,
        [StoredValue.LON]: null,
        ...(frameHidden ? {[StoredValue.DIRECTIONS]: null, [StoredValue.MAP_ZOOM]: zoom === this.pointZoom(latitude) ? null : zoom} : {})
      });
    }
  }

  private applyPoint(point: LocatePoint, known?: GridReferenceLookupResponse): void {
    this.point = point;
    this.location = {
      latitude: point.latitude,
      longitude: point.longitude,
      grid_reference_6: point.gridReference6,
      grid_reference_8: point.gridReference8,
      grid_reference_10: point.gridReference10,
      postcode: known?.postcode || "",
      description: known?.description || "",
      w3w: ""
    };
    if (!known) {
      void this.describeNearest(point);
    }
  }

  private async describeNearest(point: LocatePoint): Promise<void> {
    try {
      const nearest = (await this.addressQuery.gridReferenceLookupFromLatLng(L.latLng(point.latitude, point.longitude)))?.[0];
      if (nearest && this.point === point && this.location) {
        this.location = {...this.location, postcode: nearest.postcode || "", description: nearest.description || ""};
      }
    } catch (error) {
      this.logger.warn("describeNearest:failed", error);
    }
  }

  private placeMarker(point: LocatePoint): void {
    if (this.map) {
      const latlng = L.latLng(point.latitude, point.longitude);
      if (this.marker) {
        this.marker.setLatLng(latlng);
      } else {
        this.marker = L.marker(latlng, {icon: this.markerStyle.markerIcon(this.leafletProvider(), this.controlsState.osStyle), draggable: true}).addTo(this.map);
        this.marker.on("dragend", () => {
          const moved = this.marker?.getLatLng();
          if (moved) {
            this.zone.run(() => this.choose(moved.lat, moved.lng, false));
          }
        });
      }
    }
  }
}
