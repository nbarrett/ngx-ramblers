import { Component, inject, Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import * as L from "leaflet";
import { LatLng, LatLngBounds, Layer, LeafletEvent } from "leaflet";
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

@Component({
  selector: "app-map-edit",
  template: `
    <div class="map-thumbnail-image-dialog" *ngIf="mapReady()"
         leaflet [leafletOptions]="options"
         [leafletLayers]="layers"
         [leafletFitBounds]="fitBounds"
         (leafletMapZoom)="onMapZoom($event)"
         (leafletMapReady)="onMapReady($event)"
         (leafletClick)="onMapClick($event)">
    </div>`,
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
  @Input() notify!: AlertInstance;
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

  async ngOnInit() {
    this.initializeSubscriptions();
    this.logger.debug("locationDetails:", this.locationDetails);
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
    this.options = {
      layers: [
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 16,
          attribution: "© OpenStreetMap contributors",
        }),
      ],
      zoom: 15,
      center: L.latLng(latitude, longitude),
    };

    this.layers = [
      L.marker([latitude, longitude], {draggable: !this.readonly}).on("dragend", (event) =>
        this.zone.run(() => this.onMarkerDragEnd(event))
      ),
    ];

    this.fitBounds = L.latLngBounds([L.latLng(latitude, longitude)]);
    this.logger.info("Map configured with options:", this.options, "layers:", this.layers, "fitBounds:", this.fitBounds);
  }

  mapReady(): boolean {
    return !!(this.options && this.layers && this.fitBounds);
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
      .then((response: GridReferenceLookupResponse) => {
        this.logger.info("Received reverseGeocode response:", response);
        if (response?.gridReference10 && response?.postcode) {
          const gridReference6 = response.gridReference6;
          const gridReference8 = response.gridReference8;
          const gridReference10 = response.gridReference10;
          const postcode = response.postcode;
          const description = response.description;
          this.logger.info("Location updated:", {
            postcode,
            gridReference6,
            gridReference8,
            gridReference10,
            description
          });
          this.locationDetails.postcode = postcode;
          this.locationDetails.grid_reference_6 = gridReference6;
          this.locationDetails.grid_reference_8 = gridReference8;
          this.locationDetails.grid_reference_10 = gridReference10;
          this.locationDetails.description = description;
        } else {
          this.notify.warning({
            title: "No grid reference found",
            message: "Try moving the pin to a different location."
          });
        }
      })
      .catch(error => {
        this.notify.error({title: "Error looking up grid reference", message: error});
        return {error: error.message};
      });
  }
  onMapZoom($event: LeafletEvent) {
    this.logger.info("Map zoomed:", $event);
  }
}
