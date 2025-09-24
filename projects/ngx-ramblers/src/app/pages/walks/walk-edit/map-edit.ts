import { Component, EventEmitter, inject, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import * as L from "leaflet";
import { LatLng, LatLngBounds, Layer, LeafletEvent } from "leaflet";
import "proj4leaflet";
import proj4 from "proj4";
import { Subscription } from "rxjs";
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
import { LocationDetails } from "../../../models/ramblers-walks-manager";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { sortBy } from "../../../functions/arrays";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";

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
export class MapEditComponent implements OnInit, OnDestroy {
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
  @Input() notify!: AlertInstance;
  @Input() public locationType!: string;
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

  async ngOnInit() {
    this.initializeSubscriptions();
    this.logger.debug("locationDetails:", this.locationDetails);
    const projNS: any = (L as any).Proj;
    if (projNS?.setProj4) {
      projNS.setProj4(proj4);
    }
    if ((proj4 as any).defs && !(proj4 as any).defs["EPSG:27700"]) {
      (proj4 as any).defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=-446.448,125.157,-542.06,-0.1502,-0.2470,-0.8421,20.4894 +units=m +no_defs");
    }
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy fired:map:", this.map);
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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
    const provider = hasKey ? "os" : "osm";
    const style = hasKey ? "Leisure_27700" : "";
    const base = this.mapTiles.createBaseLayer(provider as any, style);
    const crs = this.mapTiles.crsForStyle(provider as any, style);
    const maxZoom = this.mapTiles.maxZoomForStyle(provider as any, style);
    const initialZoom = Math.max(1, Math.min(15, maxZoom) - 1);
    this.options = {
      layers: [base],
      zoom: initialZoom,
      center: L.latLng(latitude, longitude),
      crs,
      maxZoom
    };

    const markerIcon = this.markerStyle.markerIcon(provider as any, style);
    this.layers = [
      L.marker([latitude, longitude], { draggable: !this.readonly, icon: markerIcon as any }).on("dragend", (event) =>
        this.zone.run(() => this.onMarkerDragEnd(event))
      ),
    ];

    this.fitBounds = undefined as any;
    this.logger.info("Map configured with options:", this.options, "layers:", this.layers, "fitBounds:", this.fitBounds);
  }

  private osApiKey(): string {
    const cfg: any = this.systemConfigService.systemConfig();
    const keyFromConfig = cfg?.externalSystems?.osMaps?.apiKey || cfg?.externalSystems?.os_maps?.apiKey || cfg?.osMaps?.apiKey;
    return keyFromConfig || "";
  }

  private hasOsApiKey(): boolean {
    return !!this.osApiKey();
  }

  private osZxyUrl(layer: string, key: string): string {
    return `https://api.os.uk/maps/raster/v1/zxy/${layer}/{z}/{x}/{y}.png?key=${key || ""}`;
  }

  private createOsLayer(style: string | null): L.TileLayer {
    const key = this.osApiKey();
    const url = this.osZxyUrl(style || "Leisure_27700", key);
    if ((style || "").endsWith("27700") && (L as any).Proj?.TileLayer) {
      return new (L as any).Proj.TileLayer(url, { attribution: "© Ordnance Survey", continuousWorld: true, noWrap: true, maxZoom: 9 });
    }
    return L.tileLayer(url, { attribution: "© Ordnance Survey", maxZoom: 19, noWrap: true });
  }

  private crs27700(): any {
    const crsCtor = (L as any).Proj?.CRS;
    if (crsCtor) {
      return new crsCtor("EPSG:27700",
        "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs",
        {
          resolutions: [896, 448, 224, 112, 56, 28, 14, 7, 3.5, 1.75],
          origin: [-238375.0, 1376256.0],
          bounds: L.bounds([-238375.0, 0.0], [900000.0, 1376256.0])
        });
    }
    return L.CRS.EPSG3857;
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
        });
      });
      this.logger.info("Map ready:", map, "detectChanges called");
      try {
        const { latitude, longitude } = this.locationDetails;
        const current = map.getZoom() || 15;
        const clamped = Math.min(current, map.getMaxZoom());
        const oneOut = Math.max(1, clamped - 1);
        map.setView(L.latLng(latitude, longitude), oneOut);
      } catch {}
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
    this.notify.hide();
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
        this.notify.error({title: "Error looking up grid reference", message: error});
        return {error: error.message};
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
}
