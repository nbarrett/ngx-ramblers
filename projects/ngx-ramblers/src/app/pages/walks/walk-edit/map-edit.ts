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
import { MailMessagingService } from "../../../services/mail/mail-messaging.service";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";
import { LocationDetails, WalkStatus } from "../../../models/ramblers-walks-manager";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { sortBy } from "../../../functions/arrays";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { GpxParserService } from "../../../services/maps/gpx-parser.service";
import { UrlService } from "../../../services/url.service";
import { HttpClient } from "@angular/common/http";
import { FileNameData } from "../../../models/aws-object.model";
import { PaletteColor } from "../../../models/content-text.model";
import { MapZoomService } from "../../../services/maps/map-zoom.service";

@Component({
    selector: "[app-map-edit]",
    template: `
    @if (mapReady()) {
      <div [class]="class"
        leaflet [leafletOptions]="options"
        [leafletLayers]="layers"
        (leafletMapZoom)="onMapZoom($event)"
        (leafletMapReady)="onMapReady($event)"
        (leafletClick)="onMapClick($event)">
      </div>
    }`,
    styles: [`
      :host ::ng-deep .leaflet-bottom
        bottom: 9px
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

  @Input("locationDetails")
  set initialiseWalk(locationDetails: LocationDetails) {
    this.logger.debug("cloning walk for edit");
    this.locationDetails = locationDetails;
    this.setDefaultLatLng().then(() => this.initializeMap());
  }
  @Input() class!: string;
  private notifyInstance: AlertInstance;
  @Input() set notify(value: AlertInstance | undefined) {
    this.notifyInstance = value ?? this.notifierService.createGlobalAlert();
  }
  get notify(): AlertInstance {
    return this.notifyInstance;
  }
  @Input() public locationType!: string;
  @Input() walkStatus?: WalkStatus;
  @Input() endLocationDetails: LocationDetails | null = null;
  @Input() showCombinedMap = false;
  @Input() gpxFile: FileNameData;
  @Output() postcodeOptionsChange = new EventEmitter<{ postcode: string, distance: number }[]>();
  @Output() showPostcodeSelectChange = new EventEmitter<boolean>();
  public locationDetails: LocationDetails;
  public notifyTarget: AlertTarget = {};
  public options: any;
  protected layers: Layer[] = [];
  protected fitBounds: LatLngBounds;
  private subscriptions: Subscription[] = [];
  private map!: L.Map;
  private walksConfigService = inject(WalksConfigService);
  private mailMessagingService = inject(MailMessagingService);
  private addressQueryService = inject(AddressQueryService);
  protected dateUtils = inject(DateUtilsService);
  public display = inject(WalkDisplayService);
  public stringUtils = inject(StringUtilsService);
  protected notifierService = inject(NotifierService);
  private logger: Logger = inject(LoggerFactory).createLogger("MapEditComponent", NgxLoggerLevel.ERROR);
  private zone = inject(NgZone);
  private systemConfigService = inject(SystemConfigService);
  private mapTiles = inject(MapTilesService);
  private markerStyle = inject(MapMarkerStyleService);
  private gpxParser = inject(GpxParserService);
  private httpClient = inject(HttpClient);
  private urlService = inject(UrlService);
  private mapZoom = inject(MapZoomService);
  private gpxLayers: L.Layer[] = [];

  async ngOnInit() {
    this.initializeSubscriptions();
    this.logger.debug("locationDetails:", this.locationDetails);
    this.mapTiles.initializeProjections();
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy fired:map:", this.map);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["gpxFile"] && !changes["gpxFile"].firstChange) {
      this.gpxLayers.forEach(layer => {
        const index = this.layers.indexOf(layer);
        if (index > -1) this.layers.splice(index, 1);
      });
      this.gpxLayers = [];

      if (this.gpxFile) {
        this.loadAndRenderGpxRoute();
      }
    }
  }

  private initializeSubscriptions() {
    this.subscriptions.push(
      this.mailMessagingService.events().subscribe(config => {
        this.logger.debug("MailMessagingConfig updated:", config);
      }),
      this.walksConfigService.events().subscribe(config => {
        this.logger.info("WalksConfig updated:", config);
      })
    );
  }

  private async setDefaultLatLng(): Promise<void> {
    if (!this.locationDetails?.latitude || !this.locationDetails?.longitude) {
      const postcode = this.locationDetails?.postcode;
      if (postcode) {
        const response: GridReferenceLookupResponse | undefined = await this.addressQueryService.gridReferenceLookup(postcode)
          .catch(error => {
            this.notify.error({title: "Error looking up postcode", message: error});
            return undefined;
          });
        if (response) {
          const lat = response.latlng.lat;
          const lng = response.latlng.lng;
          this.logger.info("Setting LatLng from postcode:", {postcode, lat, lng}, "response:", response);
          this.locationDetails.latitude = lat;
          this.locationDetails.longitude = lng;
        } else {
          this.logger.error("no response given:", postcode, "response:", response);
        }
      }
    } else {
      this.logger.info("Using existing LatLng:", this.locationDetails);
    }
  }

  private initializeMap() {
    this.logger.info("Initializing map");
    this.setupDefaultIcon();
    if (this?.locationDetails?.latitude && this?.locationDetails?.longitude) {
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
    const {latitude, longitude} = this.locationDetails;
    const hasKey = this.hasOsApiKey();
    const provider = hasKey ? MapProvider.OS : MapProvider.OSM;
    const style = hasKey ? DEFAULT_OS_STYLE : "";
    const base = this.mapTiles.createBaseLayer(provider, style);
    const crs = this.mapTiles.crsForStyle(provider, style);
    const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);
    const initialZoom = Math.max(1, Math.min(15, maxZoom) - 1);

    let center = L.latLng(latitude, longitude);
    let bounds: L.LatLngBounds | undefined;

    if (this.showCombinedMap && this.endLocationDetails?.latitude && this.endLocationDetails?.longitude) {
      const startLatLng = L.latLng(latitude, longitude);
      const endLatLng = L.latLng(this.endLocationDetails.latitude, this.endLocationDetails.longitude);
      bounds = L.latLngBounds(startLatLng, endLatLng);
      center = bounds.getCenter();
    }

    this.options = {
      layers: [base],
      zoom: initialZoom,
      center,
      crs,
      maxZoom,
      zoomSnap: 0.5,
      zoomDelta: 0.5
    };

    const markerIcon = this.markerStyle.markerIcon(provider, style, this.walkStatus);
    this.layers = [
      L.marker([latitude, longitude], { draggable: !this.readonly, icon: markerIcon as any }).on("dragend", (event) =>
        this.zone.run(() => this.onMarkerDragEnd(event))
      ),
    ];

    if (this.showCombinedMap && this.endLocationDetails?.latitude && this.endLocationDetails?.longitude) {
      const endMarkerIcon = this.markerStyle.markerIcon(provider, style, this.walkStatus);
      this.layers.push(
        L.marker([this.endLocationDetails.latitude, this.endLocationDetails.longitude], {
          draggable: false,
          icon: endMarkerIcon as any
        })
      );
    }

    this.fitBounds = bounds as any;

    if (this.gpxFile?.awsFileName) {
      this.loadAndRenderGpxRoute();
    }

    this.logger.info("Map configured with options:", this.options, "layers:", this.layers, "fitBounds:", this.fitBounds);
  }

  private hasOsApiKey(): boolean {
    return this.mapTiles.hasOsApiKey();
  }

  private async loadAndRenderGpxRoute() {
    if (!this.gpxFile?.awsFileName) return;

    try {
      const gpxUrl = this.urlService.resourceRelativePathForAWSFileName(
        `gpx-routes/${this.gpxFile.awsFileName}`
      );

      const gpxContent = await firstValueFrom(
        this.httpClient.get(gpxUrl, { responseType: "text" })
      );

      const parsed = this.gpxParser.parseGpxFile(gpxContent);

      if (parsed.tracks.length > 0) {
        const track = parsed.tracks[0];
        const latLngs = this.gpxParser.toLeafletLatLngs(track);

        if (latLngs.length >= 2) {
          const routeColor = PaletteColor.ROSE;
          const coreWeight = 8;
          const haloWeight = 12;
          const coreOpacity = 0.8;
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

          this.gpxLayers = [halo, core];
          this.layers.push(...this.gpxLayers);

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
        });
      });
      this.logger.info("Map ready:", map, "detectChanges called");

      setTimeout(() => {
        map.invalidateSize();
        if (this.fitBounds) {
          this.mapZoom.applyBoundsToMap(map, this.fitBounds, { maxZoom: 15 });
        } else if (!this.gpxFile?.awsFileName) {
          const { latitude, longitude } = this.locationDetails;
          const zoom = this.mapZoom.calculateSinglePointZoom(map, { defaultZoom: 15, mapMaxZoom: map.getMaxZoom() });
          map.setView(L.latLng(latitude, longitude), zoom);
        }
      }, 100);
    }

  }

  onMapClick(event: L.LeafletMouseEvent) {
    if (!this.readonly) {
      this.zone.run(() => this.updateWalkLocation(event.latlng));
    }
  }

  onMarkerDragEnd(event: L.DragEndEvent) {
    if (!this.readonly) {
      const latlng = (event.target as L.Marker).getLatLng();
      this.zone.run(() => this.updateWalkLocation(latlng));
    }
  }

  private async updateWalkLocation(latlng: LatLng) {
    this.notify?.hide();
    this.locationDetails.latitude = latlng.lat;
    this.locationDetails.longitude = latlng.lng;

    this.addressQueryService.gridReferenceLookupFromLatLng(latlng)
      .then((responses: GridReferenceLookupResponse[]) => {
        const sortedResponses = responses.sort(sortBy("distance"));
        this.logger.info("gridReferenceLookupFromLatLng: Received", this.stringUtils.pluraliseWithCount(sortedResponses.length, "response"), sortedResponses);
        if (responses.length === 0) {
          this.notify.warning({
            title: "No grid reference found",
            message: "Try moving the pin to a different location."
          });
        } else {
          const closestResponse = sortedResponses[0];
          const closestResponseMatchingPostcode = sortedResponses.find(item => item.postcode === this.locationDetails.postcode);

          const showAlert = !closestResponseMatchingPostcode || closestResponseMatchingPostcode.postcode !== closestResponse.postcode;
          if (showAlert) {
            const postcodeOptions = sortedResponses.map(item => ({
              postcode: item.postcode,
              distance: item.distance
            }));
            const overrideOption = `You can optionally choose a different postcode from the ${this.locationType} Postcode dropdown.`;
            if (!closestResponseMatchingPostcode) {
              this.notify.warning({
                title: "New pin location",
                message: `The new pin location does not have the same postcode as the ${this.locationType} postcode ${this.locationDetails.postcode}. ${overrideOption}`
              });
              this.updateLocationWith({...closestResponse, postcode: this.locationDetails.postcode});
              postcodeOptions.splice(0, 0, {postcode: this.locationDetails.postcode, distance: null});
            } else {
              this.notify.warning({
                title: "New pin location",
                message: `The new pin location matches the ${this.locationType} postcode ${this.locationDetails.postcode}, but other postcodes are closer to the pin. ${overrideOption}`
              });
              this.updateLocationWith(closestResponseMatchingPostcode);
            }
            this.postcodeOptionsChange.emit(postcodeOptions);
            this.showPostcodeSelectChange.emit(true);
          } else {
            this.updateLocationWith(closestResponseMatchingPostcode);
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
    this.locationDetails.postcode = response.postcode;
    this.locationDetails.grid_reference_6 = response.gridReference6;
    this.locationDetails.grid_reference_8 = response.gridReference8;
    this.locationDetails.grid_reference_10 = response.gridReference10;
    this.locationDetails.description = response.description;
  }

  onMapZoom($event: LeafletEvent) {
    this.logger.info("Map zoomed:", $event);
  }

  invalidateSize() {
    if (this.map) {
      this.logger.info("Invalidating map size and reapplying bounds");
      this.mapZoom.invalidateAndApplyBounds(this.map, this.fitBounds, { maxZoom: 15 });
    }
  }
}
