import { Component, EventEmitter, inject, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from "@angular/core";
import * as L from "leaflet";
import { LatLng, LatLngBounds, Layer, LeafletEvent } from "leaflet";
import "proj4leaflet";
import { firstValueFrom, Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { WalkDisplayService } from "../walk-display.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { WalksConfig } from "../../../models/walks-config.model";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { DEFAULT_OS_STYLE, LocationType, MapProvider, UK_MAP_CENTER, UK_MAP_ZOOM } from "../../../models/map.model";
import { UK_POSTCODE_PATTERN } from "../../../models/locate.model";
import { formattedUkPostcode } from "../../../functions/locate";
import { isString } from "es-toolkit/compat";
import { LocationDetails, WalkStatus } from "../../../models/ramblers-walks-manager";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { sortBy } from "../../../functions/arrays";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { GpxParserService } from "../../../services/maps/gpx-parser.service";
import { UrlService } from "../../../services/url.service";
import { HttpClient } from "@angular/common/http";
import { FileNameData } from "../../../models/aws-object.model";
import { MapMarker, PaletteColor, RouteGuideEntry } from "../../../models/content-text.model";
import { ROUTE_STEP_POPUP_OPTIONS, routeStepPopupHtml } from "../../../functions/route-step-popup";
import { MapZoomService } from "../../../services/maps/map-zoom.service";
import { isUndefined } from "es-toolkit/compat";
import { RouteFollowPoint, RouteFollowWaypoint } from "../../../models/route-follow.model";
import { escapeHtml } from "../../../functions/strings";

const COMBINED_MAP_BOUNDS_PADDING = 0.25;

@Component({
    selector: "[app-map-edit]",
    template: `
    @if (mapReady()) {
      <div class="map-edit-surface"
        leaflet [leafletOptions]="options"
        [leafletLayers]="layers"
        (leafletMapZoom)="onMapZoom($event)"
        (leafletMapReady)="onMapReady($event)"
        (leafletClick)="onMapClick($event)">
      </div>
    }`,
    styles: [`
      :host
        display: block
        position: relative
      .map-edit-surface
        width: 100%
        height: 100%
    `],
    imports: [LeafletModule]
})
export class MapEditComponent implements OnInit, OnDestroy, OnChanges {
  protected id: string;
  public readonly = false;

  @Input("readonly") set readonlyValue(value: boolean) {
    this.readonly = coerceBooleanProperty(value);
    this.logger.info("readonly:", this.readonly);
  }

  @Input() initialZoomOffset: number | null = null;
  @Input() routeGuideEntries: RouteGuideEntry[] = [];
  @Output() zoomOutLevelsChange = new EventEmitter<number>();
  private walksConfig: WalksConfig;
  private referenceZoom: number | null = null;

  @Input("locationDetails")
  set initialiseWalk(locationDetails: LocationDetails) {
    this.logger.debug("cloning walk for edit");
    this.locationDetails = locationDetails;
    this.initializeMap();
  }
  private notifyInstance: AlertInstance;
  @Input() set notify(value: AlertInstance | undefined) {
    this.notifyInstance = value ?? this.notifierService.createGlobalAlert();
  }
  get notify(): AlertInstance {
    return this.notifyInstance;
  }
  @Input() public locationType!: LocationType;
  @Input() walkStatus?: WalkStatus;
  @Input() endLocationDetails: LocationDetails | null = null;
  @Input() showCombinedMap = false;
  public clickPlacesMissingPin = false;
  @Input("clickPlacesMissingPin") set clickPlacesMissingPinValue(value: boolean) {
    this.clickPlacesMissingPin = coerceBooleanProperty(value);
  }
  public postcodeChangeOffersSelect = true;
  @Input("postcodeChangeOffersSelect") set postcodeChangeOffersSelectValue(value: boolean) {
    this.postcodeChangeOffersSelect = coerceBooleanProperty(value);
  }
  @Input() gpxFile: FileNameData;
  @Input() routeColor: string;
  @Input() routeWeight: number;
  @Input() routeOpacity: number;
  @Output() postcodeOptionsChange = new EventEmitter<{ postcode: string, distance: number }[]>();
  @Input() routeWaypoints: RouteFollowWaypoint[] = [];
  @Input() activeWaypointId: string | null = null;
  @Input() waypointsDraggable = false;
  @Output() waypointSelect = new EventEmitter<RouteFollowWaypoint>();
  @Output() waypointMove = new EventEmitter<RouteFollowWaypoint>();
  @Output() routePointsChange = new EventEmitter<RouteFollowPoint[]>();
  @Output() showPostcodeSelectChange = new EventEmitter<boolean>();
  @Output() locationChange = new EventEmitter<LocationDetails>();
  @Output() endLocationChange = new EventEmitter<LocationDetails>();
  public locationDetails: LocationDetails;
  public notifyTarget: AlertTarget = {};
  public options: any;
  protected layers: Layer[] = [];
  protected fitBounds: LatLngBounds;
  private subscriptions: Subscription[] = [];
  private map!: L.Map;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;
  private resizeFitTimer: ReturnType<typeof setTimeout> | null = null;
  private walksConfigService = inject(WalksConfigService);
  private addressQueryService = inject(AddressQueryService);
  protected dateUtils = inject(DateUtilsService);
  public display = inject(WalkDisplayService);
  public stringUtils = inject(StringUtilsService);
  protected notifierService = inject(NotifierService);
  private logger: Logger = inject(LoggerFactory).createLogger("MapEditComponent", NgxLoggerLevel.ERROR);
  private zone = inject(NgZone);
  private mapTiles = inject(MapTilesService);
  private markerStyle = inject(MapMarkerStyleService);
  private gpxParser = inject(GpxParserService);
  private httpClient = inject(HttpClient);
  private urlService = inject(UrlService);
  private mapZoom = inject(MapZoomService);
  private gpxLayers: L.Layer[] = [];
  private gpxLoadSequence = 0;
  private startMarker: L.Marker | null = null;
  private endMarker: L.Marker | null = null;
  private waypointLayers = new Map<string, L.Marker>();
  private provider: MapProvider = MapProvider.OSM;
  private providerStyle = "";

  async ngOnInit() {
    this.initializeSubscriptions();
    this.logger.debug("locationDetails:", this.locationDetails);
    this.mapTiles.initializeProjections();
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy fired:map:", this.map);
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    if (this.resizeFitTimer) {
      clearTimeout(this.resizeFitTimer);
    }
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges) {
    const gpxFileChanged = changes["gpxFile"] && !changes["gpxFile"].firstChange;
    const routeStyleChanged = ["routeColor", "routeWeight", "routeOpacity"].some(key => changes[key] && !changes[key].firstChange);
    if (gpxFileChanged || (routeStyleChanged && this.gpxFile)) {
      this.logger.info("ngOnChanges: gpxFileChanged:", gpxFileChanged, "routeStyleChanged:", routeStyleChanged, "gpxFile:", this.gpxFile?.awsFileName || null, "layers before:", this.layers.length);
      this.removeGpxRoute();
      if (this.gpxFile?.awsFileName) {
        this.loadAndRenderGpxRoute();
      } else {
        this.routePointsChange.emit([]);
      }
    }
    if (this.mapDisplayChanged(changes)) {
      this.logger.info("map display changed - showCombinedMap:", this.showCombinedMap, "endLocationDetails:", this.endLocationDetails);
      this.initializeMap();
    }
    if ((changes["routeWaypoints"] && !changes["routeWaypoints"].firstChange) || (changes["waypointsDraggable"] && !changes["waypointsDraggable"].firstChange)) {
      this.renderWaypoints();
    }
    if (changes["activeWaypointId"]) {
      this.focusActiveWaypoint();
    }
  }

  private renderWaypoints(): void {
    this.waypointLayers.forEach(layer => {
      const index = this.layers.indexOf(layer);
      if (index > -1) {
        this.layers.splice(index, 1);
      }
    });
    this.waypointLayers = new Map<string, L.Marker>();
    (this.routeWaypoints || []).forEach((waypoint, index) => {
      const label = waypoint.label || String(index + 1);
      const marker = L.marker([waypoint.latitude, waypoint.longitude], {icon: this.markerStyle.numberedMarkerIcon(label, this.provider, this.providerStyle), draggable: this.waypointsDraggable});
      marker.bindPopup(() => routeStepPopupHtml(waypoint as MapMarker, this.routeGuideEntries.find(entry => entry.marker === waypoint), this.markerStyle.numberedMarkerColour(this.provider)), ROUTE_STEP_POPUP_OPTIONS);
      marker.on("click", () => this.zone.run(() => this.waypointSelect.emit(waypoint)));
      marker.on("dragend", () => this.zone.run(() => {
        const position = marker.getLatLng();
        this.waypointMove.emit({...waypoint, latitude: position.lat, longitude: position.lng});
      }));
      this.waypointLayers.set(waypoint.id, marker);
      this.layers.push(marker);
    });
  }

  private focusActiveWaypoint(): void {
    const marker = this.activeWaypointId ? this.waypointLayers.get(this.activeWaypointId) : null;
    if (marker && this.map) {
      const zoom = Math.min(Math.max(this.map.getZoom(), 16), this.map.getMaxZoom());
      this.map.flyTo(marker.getLatLng(), zoom, {animate: true});
      setTimeout(() => marker.openPopup(), 0);
    }
  }

  private mapDisplayChanged(changes: SimpleChanges): boolean {
    const combinedMapChanged = changes["showCombinedMap"] && !changes["showCombinedMap"].firstChange;
    const endLocationChanged = changes["endLocationDetails"] && !changes["endLocationDetails"].firstChange;
    return !!(combinedMapChanged || endLocationChanged);
  }

  private effectiveZoomOffset(): number {
    return this.initialZoomOffset ?? -(this.walksConfig?.mapZoomOutLevels ?? 2);
  }

  private initializeSubscriptions() {
    this.subscriptions.push(
      this.walksConfigService.events().subscribe(config => {
        this.logger.info("WalksConfig updated:", config);
        this.walksConfig = config;
      })
    );
  }

  private async fillLatLngFromPostcode(location: LocationDetails): Promise<void> {
    if (location && (!location.latitude || !location.longitude) && location.postcode) {
      const query = location.postcode.trim();
      const response: GridReferenceLookupResponse | undefined = UK_POSTCODE_PATTERN.test(query)
        ? await this.addressQueryService.gridReferenceLookup(query)
          .catch(error => {
            this.notify.error({title: "Error looking up postcode", message: error});
            return undefined;
          })
        : await this.addressQueryService.placeNameLookup(query)
          .catch(error => {
            this.logger.error("place name lookup failed:", query, error);
            return undefined;
          });
      if (response?.latlng) {
        this.logger.info("Setting LatLng from location:", {query, lat: response.latlng.lat, lng: response.latlng.lng}, "response:", response);
        location.latitude = response.latlng.lat;
        location.longitude = response.latlng.lng;
        if (this.usablePostcode(response.postcode)) {
          location.postcode = formattedUkPostcode(response.postcode) || response.postcode.trim();
        }
        if (response.description) {
          location.description = response.description;
        }
      } else {
        this.logger.error("no response given:", query, "response:", response);
      }
    } else if (location?.latitude && location?.longitude) {
      this.logger.info("Using existing LatLng:", location);
    }
  }

  private initializeMap() {
    this.logger.info("Initializing map");
    this.setupDefaultIcon();
    void this.prepareLocationsAndConfigure();
  }

  private async prepareLocationsAndConfigure(): Promise<void> {
    await this.fillLatLngFromPostcode(this.locationDetails);
    if (this.showCombinedMap) {
      await this.fillLatLngFromPostcode(this.endLocationDetails);
    }
    if (this.hasCoords(this.locationDetails) || this.clickPlacesMissingPin) {
      this.configureMap();
    } else {
      this.logger.error("Invalid LatLng: latitude or longitude is undefined");
    }
  }

  private setupDefaultIcon() {
    const assetsUrl = "assets/images/";
    const mergeOptions = {
      iconRetinaUrl: `${assetsUrl}marker-icon-2x.png`,
      iconUrl: `${assetsUrl}marker-icon.png`,
      shadowUrl: `${assetsUrl}marker-shadow.png`,
    };
    L.Icon.Default.mergeOptions(mergeOptions);
    this.logger.info("Default icon set with options:", mergeOptions);
  }

  private configureMap() {
    const hasStart = this.hasCoords(this.locationDetails);
    const hasEnd = this.showCombinedMap && this.hasCoords(this.endLocationDetails);
    const hasKey = this.hasOsApiKey();
    const provider = hasKey ? MapProvider.OS : MapProvider.OSM;
    const style = hasKey ? DEFAULT_OS_STYLE : "";
    const base = this.mapTiles.createBaseLayer(provider, style);
    const crs = this.mapTiles.crsForStyle(provider, style);
    const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);
    const startLatLng = hasStart
      ? L.latLng(this.locationDetails.latitude, this.locationDetails.longitude)
      : L.latLng(UK_MAP_CENTER[0], UK_MAP_CENTER[1]);
    const endLatLng = hasEnd ? L.latLng(this.endLocationDetails.latitude, this.endLocationDetails.longitude) : null;
    const bounds = hasStart && hasEnd ? L.latLngBounds(startLatLng, endLatLng).pad(COMBINED_MAP_BOUNDS_PADDING) : undefined;
    const center = bounds ? bounds.getCenter() : startLatLng;
    const initialZoom = hasStart ? Math.max(1, Math.min(15, maxZoom) - 1 + this.effectiveZoomOffset()) : UK_MAP_ZOOM;

    this.options = {
      layers: [base],
      zoom: initialZoom,
      center,
      crs,
      maxZoom,
      zoomSnap: 0.5,
      zoomDelta: 0.5
    };

    this.provider = provider;
    this.providerStyle = style;
    this.layers = [];
    this.startMarker = null;
    this.endMarker = null;
    if (hasStart) {
      const markerIcon = this.markerStyle.markerIcon(provider, style, this.walkStatus);
      this.startMarker = L.marker(startLatLng, { draggable: !this.readonly, icon: markerIcon as any }).on("dragend", (event) =>
        this.zone.run(() => this.onMarkerDragEnd(event))
      );
      this.bindLocationPopup(this.startMarker, this.locationDetails, this.primaryPinRole());
      this.layers.push(this.startMarker);
    }
    if (hasEnd) {
      const endMarkerIcon = this.markerStyle.markerIcon(provider, style, this.walkStatus);
      this.endMarker = L.marker(endLatLng, {
        draggable: !this.readonly,
        icon: endMarkerIcon as any
      }).on("dragend", (event) => this.zone.run(() => this.onEndMarkerDragEnd(event)));
      this.bindLocationPopup(this.endMarker, this.endLocationDetails, this.endPinRole());
      this.layers.push(this.endMarker);
    }

    this.renderWaypoints();
    this.fitBounds = bounds as any;

    if (this.map) {
      if (bounds) {
        this.mapZoom.applyBoundsToMap(this.map, bounds, { maxZoom: 15 });
      } else {
        this.map.setView(center, this.map.getZoom());
      }
    }

    if (this.gpxFile?.awsFileName) {
      this.loadAndRenderGpxRoute();
    }

    this.logger.info("Map configured with options:", this.options, "layers:", this.layers, "fitBounds:", this.fitBounds);
  }

  private hasOsApiKey(): boolean {
    return this.mapTiles.hasOsApiKey();
  }

  private removeGpxRoute(): void {
    const removed = this.gpxLayers;
    this.gpxLayers = [];
    this.layers = this.layers.filter(layer => !removed.includes(layer));
    removed.forEach(layer => this.map?.removeLayer(layer));
    this.fitBounds = null;
    this.logger.info("removeGpxRoute: removed", removed.length, "route layers, layers now:", this.layers.length);
  }

  private async loadAndRenderGpxRoute() {
    if (!this.gpxFile?.awsFileName) return;
    const sequence = this.gpxLoadSequence + 1;
    this.gpxLoadSequence = sequence;
    this.logger.info("loadAndRenderGpxRoute: starting load", sequence, "for", this.gpxFile.awsFileName);

    try {
      const gpxUrl = this.urlService.resourceRelativePathForAWSFileName(
        `gpx-routes/${this.gpxFile.awsFileName}`
      );

      const gpxContent = await firstValueFrom(
        this.httpClient.get(gpxUrl, { responseType: "text" })
      );

      const parsed = this.gpxParser.parseGpxFile(gpxContent);

      if (sequence !== this.gpxLoadSequence) {
        this.logger.info("loadAndRenderGpxRoute: discarding stale load", sequence, "current is", this.gpxLoadSequence);
      } else if (parsed.tracks.length > 0) {
        const track = parsed.tracks[0];
        this.routePointsChange.emit(track.points);
        const latLngs = this.gpxParser.toLeafletLatLngs(track);

        if (latLngs.length >= 2) {
          const routeColor = this.routeColor || PaletteColor.ROSE;
          const coreWeight = this.routeWeight || 8;
          const haloWeight = coreWeight + 4;
          const coreOpacity = this.routeOpacity ?? 0.8;
          const haloOpacity = 0.5;

          const halo = L.polyline(latLngs, {
            color: "#ffffff",
            weight: haloWeight,
            opacity: haloOpacity
          });

          const core = L.polyline(latLngs, {
            color: routeColor,
            weight: coreWeight,
            opacity: coreOpacity
          });

          this.removeGpxRoute();
          this.gpxLayers = [halo, core];
          this.layers = [...this.layers, ...this.gpxLayers];
          this.logger.info("loadAndRenderGpxRoute: drew route for load", sequence, "layers now:", this.layers.length);

          this.fitBounds = this.mapZoom.calculateBoundsFromLayers(this.gpxLayers, { paddingPercent: 0.15 });

          if (this.map && this.fitBounds) {
            this.mapZoom.invalidateAndApplyBounds(this.map, this.fitBounds, { maxZoom: 15 });
          }
        }
      }
    } catch (error) {
      this.logger.error("Failed to load GPX route:", error);
    }
  }

  mapReady(): boolean {
    return !!(this.options && this.layers);
  }

  onMapReady(map: L.Map): void {
    if (this.map) {
      this.logger.warn("Map is already initialized. Skipping initialization.");
      return;
    } else {
      this.map = map;
      map.on("zoomend", () => {
        this.zone.run(() => {
          const zoomLevel = map.getZoom();
          this.logger.info("Map zoom level changed:", zoomLevel);
          if (!this.showCombinedMap && !this.gpxFile?.awsFileName && this.locationDetails?.latitude && this.locationDetails?.longitude) {
            map.panTo(L.latLng(this.locationDetails.latitude, this.locationDetails.longitude));
          }
          if (this.referenceZoom != null) {
            this.zoomOutLevelsChange.emit(this.referenceZoom - zoomLevel);
          }
        });
      });
      this.observeContainerResize(map);
      this.logger.info("Map ready:", map, "detectChanges called");

      setTimeout(() => {
        if (this.destroyed || this.map !== map) {
          return;
        }
        map.invalidateSize();
        if (this.fitBounds) {
          this.mapZoom.applyBoundsToMap(map, this.fitBounds, { maxZoom: 15 });
        } else if (!this.gpxFile?.awsFileName) {
          const { latitude, longitude } = this.locationDetails;
          const baseZoom = this.mapZoom.calculateSinglePointZoom(map, { defaultZoom: 15, mapMaxZoom: map.getMaxZoom() });
          this.referenceZoom = Math.min(baseZoom, map.getMaxZoom());
          const zoom = Math.max(1, this.referenceZoom + this.effectiveZoomOffset());
          map.setView(L.latLng(latitude, longitude), zoom);
        }
      }, 100);
    }

  }

  onMapClick(event: L.LeafletMouseEvent) {
    if (this.readonly) {
      this.logger.debug("map click ignored while readonly");
    } else if (this.clickPlacesMissingPin) {
      this.zone.run(() => this.placeMissingPin(event.latlng));
    } else {
      this.zone.run(() => this.updateWalkLocation(event.latlng));
    }
  }

  onMarkerDragEnd(event: L.DragEndEvent) {
    if (!this.readonly) {
      const latlng = (event.target as L.Marker).getLatLng();
      this.zone.run(() => this.updateWalkLocation(latlng));
    }
  }

  onEndMarkerDragEnd(event: L.DragEndEvent) {
    if (!this.readonly && this.endLocationDetails) {
      const latlng = (event.target as L.Marker).getLatLng();
      this.zone.run(() => this.updateEndLocation(latlng));
    }
  }

  private hasCoords(location: LocationDetails): boolean {
    return !!(location?.latitude && location?.longitude);
  }

  private usablePostcode(postcode: string): boolean {
    return isString(postcode) && postcode.trim().length > 0;
  }

  private placeMissingPin(latlng: LatLng) {
    if (!this.hasCoords(this.locationDetails)) {
      this.updateWalkLocation(latlng);
      this.addOrMoveStartMarker(latlng);
    } else if (!this.hasCoords(this.endLocationDetails)) {
      this.updateEndLocation(latlng);
      this.addOrMoveEndMarker(latlng);
    }
  }

  private addOrMoveStartMarker(latlng: LatLng) {
    if (this.startMarker) {
      this.startMarker.setLatLng(latlng);
    } else if (this.map) {
      const markerIcon = this.markerStyle.markerIcon(this.provider, this.providerStyle, this.walkStatus);
      this.startMarker = L.marker(latlng, {draggable: !this.readonly, icon: markerIcon as any})
        .on("dragend", (event) => this.zone.run(() => this.onMarkerDragEnd(event)));
      this.bindLocationPopup(this.startMarker, this.locationDetails, this.primaryPinRole());
      this.startMarker.addTo(this.map);
      this.layers = [...this.layers, this.startMarker];
    }
  }

  private addOrMoveEndMarker(latlng: LatLng) {
    if (this.endMarker) {
      this.endMarker.setLatLng(latlng);
    } else if (this.map && this.endLocationDetails) {
      const markerIcon = this.markerStyle.markerIcon(this.provider, this.providerStyle, this.walkStatus);
      this.endMarker = L.marker(latlng, {draggable: !this.readonly, icon: markerIcon as any})
        .on("dragend", (event) => this.zone.run(() => this.onEndMarkerDragEnd(event)));
      this.bindLocationPopup(this.endMarker, this.endLocationDetails, this.endPinRole());
      this.endMarker.addTo(this.map);
      this.layers = [...this.layers, this.endMarker];
    }
  }

  private async updateWalkLocation(latlng: LatLng) {
    const previousLatitude = this.locationDetails.latitude;
    const previousLongitude = this.locationDetails.longitude;
    this.notify?.hide();
    this.locationDetails.latitude = latlng.lat;
    this.locationDetails.longitude = latlng.lng;

    this.addressQueryService.gridReferenceLookupFromLatLng(latlng)
      .then((responses: GridReferenceLookupResponse[]) => {
        const sortedResponses = responses.filter(item => this.usablePostcode(item.postcode)).sort(sortBy("distance"));
        this.logger.info("gridReferenceLookupFromLatLng: Received", this.stringUtils.pluraliseWithCount(sortedResponses.length, "response"), sortedResponses);
        if (sortedResponses.length === 0) {
          this.locationDetails.latitude = previousLatitude;
          this.locationDetails.longitude = previousLongitude;
          if (this.startMarker && previousLatitude && previousLongitude) {
            this.startMarker.setLatLng(L.latLng(previousLatitude, previousLongitude));
          }
          this.notify.warning({
            title: "No postcode here",
            message: "Move the pin onto a place that has a postcode."
          });
        } else {
          const closestResponse = sortedResponses[0];
          const previousPostcode = this.locationDetails.postcode;
          this.updateLocationWith(closestResponse);
          if (this.postcodeChangeOffersSelect && this.usablePostcode(previousPostcode) && closestResponse.postcode !== previousPostcode) {
            const postcodeOptions = sortedResponses.map(item => ({postcode: item.postcode, distance: item.distance}));
            const previousStillListed = postcodeOptions.some(option => option.postcode === previousPostcode);
            this.notify.warning({
              title: "New pin location",
              message: `The ${this.locationType} postcode has changed from ${previousPostcode} to ${closestResponse.postcode}, the closest to the pin. You can choose a different nearby postcode from the ${this.locationType} Postcode dropdown.`
            });
            this.postcodeOptionsChange.emit(previousStillListed ? postcodeOptions : [...postcodeOptions, {postcode: previousPostcode, distance: null}]);
            this.showPostcodeSelectChange.emit(true);
          }
        }
      })
      .catch(error => {
        this.logger.error("gridReferenceLookupFromLatLng:error", error);
        this.notify.error({title: "Error looking up grid reference", message: error?.message || error});
        return {error: error?.message || error};
      });
  }

  private updateLocationWith(response: GridReferenceLookupResponse) {
    this.showPostcodeSelectChange.emit(false);
    if (this.usablePostcode(response.postcode)) {
      this.locationDetails.postcode = formattedUkPostcode(response.postcode) || response.postcode.trim();
    }
    this.locationDetails.grid_reference_6 = response.gridReference6;
    this.locationDetails.grid_reference_8 = response.gridReference8;
    this.locationDetails.grid_reference_10 = response.gridReference10;
    this.locationDetails.description = response.description;
    if (this.startMarker) {
      this.bindLocationPopup(this.startMarker, this.locationDetails, this.primaryPinRole());
    }
    this.locationChange.emit(this.locationDetails);
  }

  private async updateEndLocation(latlng: LatLng) {
    const previousLatitude = this.endLocationDetails.latitude;
    const previousLongitude = this.endLocationDetails.longitude;
    this.notify?.hide();
    this.endLocationDetails.latitude = latlng.lat;
    this.endLocationDetails.longitude = latlng.lng;
    this.addressQueryService.gridReferenceLookupFromLatLng(latlng)
      .then((responses: GridReferenceLookupResponse[]) => {
        const sortedResponses = responses.filter(item => this.usablePostcode(item.postcode)).sort(sortBy("distance"));
        this.logger.info("end pin gridReferenceLookupFromLatLng: Received", this.stringUtils.pluraliseWithCount(sortedResponses.length, "response"), sortedResponses);
        if (sortedResponses.length === 0) {
          this.endLocationDetails.latitude = previousLatitude;
          this.endLocationDetails.longitude = previousLongitude;
          if (this.endMarker && previousLatitude && previousLongitude) {
            this.endMarker.setLatLng(L.latLng(previousLatitude, previousLongitude));
          }
          this.notify.warning({
            title: "No postcode here",
            message: "Move the pin onto a place that has a postcode."
          });
        } else {
          const closestResponse = sortedResponses[0];
          this.endLocationDetails.postcode = this.usablePostcode(closestResponse.postcode)
            ? (formattedUkPostcode(closestResponse.postcode) || closestResponse.postcode.trim())
            : this.endLocationDetails.postcode;
          this.endLocationDetails.grid_reference_6 = closestResponse.gridReference6;
          this.endLocationDetails.grid_reference_8 = closestResponse.gridReference8;
          this.endLocationDetails.grid_reference_10 = closestResponse.gridReference10;
          this.endLocationDetails.description = closestResponse.description;
          if (this.endMarker) {
            this.bindLocationPopup(this.endMarker, this.endLocationDetails, this.endPinRole());
          }
          this.endLocationChange.emit(this.endLocationDetails);
        }
      })
      .catch(error => {
        this.logger.error("end pin gridReferenceLookupFromLatLng:error", error);
        this.notify.error({title: "Error looking up grid reference", message: error?.message || error});
      });
  }

  private primaryPinRole(): string {
    if (this.locationType === LocationType.FINISHING || this.locationType === LocationType.END) {
      return this.endPinRole();
    } else if (this.locationType === LocationType.MEETING) {
      return LocationType.MEETING;
    } else {
      return LocationType.START;
    }
  }

  private endPinRole(): string {
    return LocationType.FINISH;
  }

  private bindLocationPopup(marker: L.Marker, location: LocationDetails, role: string): void {
    marker.bindPopup(this.locationPopupHtml(role, location), {maxWidth: 280, autoPanPadding: [16, 16]});
  }

  private locationPopupHtml(role: string, location: LocationDetails): string {
    const description = location?.description?.trim();
    const postcode = location?.postcode?.trim();
    const grid = this.display.gridReferenceFrom(location);
    const descriptionHtml = description ? `<div class="small">${escapeHtml(description)}</div>` : "";
    const postcodeHtml = postcode
      ? `<div class="small"><a href="${escapeHtml(this.display.postcodeLink(postcode))}">${escapeHtml(postcode)}</a></div>`
      : "";
    const gridHtml = grid
      ? `<div class="small"><a href="${escapeHtml(this.display.gridReferenceLink(grid, this.map?.getZoom()))}">${escapeHtml(grid)}</a></div>`
      : "";
    return `<div class="map-pin-popup"><div class="small fw-bold mb-1">${escapeHtml(role)}</div>${descriptionHtml}${postcodeHtml}${gridHtml}</div>`;
  }

  onMapZoom($event: LeafletEvent) {
    this.logger.info("Map zoomed:", $event);
  }

  invalidateSize() {
    if (this.map && !this.destroyed) {
      this.logger.info("Invalidating map size and reapplying bounds");
      this.mapZoom.invalidateAndApplyBounds(this.map, this.fitBounds, { maxZoom: 15 });
    }
  }

  private observeContainerResize(map: L.Map) {
    if (isUndefined(ResizeObserver)) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.refitToRouteOnResize());
    this.resizeObserver.observe(map.getContainer());
  }

  private refitToRouteOnResize() {
    if (this.destroyed || !this.map) {
      return;
    }
    this.map.invalidateSize();
    if (this.fitBounds && this.map.getSize().x > 0) {
      if (this.resizeFitTimer) {
        clearTimeout(this.resizeFitTimer);
      }
      this.resizeFitTimer = setTimeout(() => {
        if (!this.destroyed && this.map && this.fitBounds && this.map.getSize().x > 0) {
          this.mapZoom.applyBoundsToMap(this.map, this.fitBounds, { maxZoom: 15 });
        }
      }, 150);
    }
  }
}
