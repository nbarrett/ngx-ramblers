import { Component, EventEmitter, inject, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import * as L from "leaflet";
import { Layer, LeafletMouseEvent } from "leaflet";
import "proj4leaflet";
import { Subscription } from "rxjs";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { VenueService } from "../../../services/venue/venue.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { VenueWithUsageStats, VenueType, Venue } from "../../../models/event-venue.model";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faMapMarkerAlt, faPlus } from "@fortawesome/free-solid-svg-icons";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";

@Component({
  selector: "app-venue-map-selector",
  standalone: true,
  imports: [LeafletModule, FormsModule, FontAwesomeModule],
  template: `
    <div class="venue-map-container">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <span class="small text-muted">Click a marker to select venue, or click map to create new venue at that location</span>
      </div>
      @if (mapReady) {
        <div class="leaflet-map"
          [style.height.px]="mapHeight"
          leaflet [leafletOptions]="options"
          [leafletLayers]="layers"
          (leafletMapReady)="onMapReady($event)"
          (leafletClick)="onMapClick($event)">
        </div>
        <div class="resize-handle" (mousedown)="onResizeStart($event)" (touchstart)="onResizeTouchStart($event)">
          <span class="grip-dots">⋯⋯⋯</span>
        </div>
      }
      @if (selectedVenue) {
        <div class="mt-2 alert alert-success py-2">
          <strong>Selected:</strong> {{ selectedVenue.name }}
          @if (selectedVenue.postcode) {
            , {{ selectedVenue.postcode }}
          }
        </div>
      }
      @if (newVenueLocation) {
        <div class="mt-2 alert alert-warning py-2">
          <strong>New venue location:</strong> {{ newVenueLocation.lat.toFixed(6) }}, {{ newVenueLocation.lng.toFixed(6) }}
          <div class="mt-2">
            <input type="text" class="form-control form-control-sm mb-2" [(ngModel)]="newVenueName" placeholder="Enter venue name">
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-primary" [disabled]="!newVenueName?.trim()" (click)="createVenueAtLocation()">
                <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Create Venue
              </button>
              <button type="button" class="btn btn-outline-secondary" (click)="cancelNewVenue()">Cancel</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .venue-map-container
      border: 1px solid #dee2e6
      border-radius: 8px
      padding: 12px
      background-color: #f8f9fa
    .leaflet-map
      border-radius: 4px
      min-height: 200px
      max-height: 800px
    .resize-handle
      display: flex
      align-items: center
      justify-content: center
      height: 12px
      cursor: ns-resize
      background: linear-gradient(to bottom, #e0e0e0, #f0f0f0, #e0e0e0)
      border: 1px solid #bbb
      border-top: none
      border-radius: 0 0 6px 6px
      color: #888
      user-select: none
      font-size: 10px
      box-shadow: inset 0 1px 2px rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.1)
      &:hover
        background: linear-gradient(to bottom, #d5d5d5, #e8e8e8, #d5d5d5)
        color: #666
      &:active
        background: linear-gradient(to bottom, #c8c8c8, #dcdcdc, #c8c8c8)
    :host ::ng-deep .venue-marker-icon
      background: transparent
      border: none
    :host ::ng-deep .venue-pin-container
      position: relative
      width: 32px
      height: 42px
    :host ::ng-deep .venue-pin-svg
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4))
    :host ::ng-deep .venue-pin-icon
      position: absolute
      top: 10px
      left: 50%
      transform: translateX(-50%)
      font-size: 12px
      color: var(--os-explorer-color, #443d90)
    :host ::ng-deep .new-venue-marker
      background: transparent
      border: none
  `]
})
export class VenueMapSelectorComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("VenueMapSelectorComponent", NgxLoggerLevel.ERROR);
  private venueService = inject(VenueService);
  private mapTiles = inject(MapTilesService);
  private walksReferenceService = inject(WalksReferenceService);
  private addressQueryService = inject(AddressQueryService);
  private zone = inject(NgZone);
  private subscriptions: Subscription[] = [];
  private map!: L.Map;
  private venueMarkers: L.Marker[] = [];
  private newVenueMarker: L.Marker | null = null;
  private venueTypes: VenueType[];

  @Input() startingPoint: { latitude: number; longitude: number } | null = null;
  @Input() initialVenue: Partial<VenueWithUsageStats> | null = null;
  @Input() disabled = false;
  @Output() venueSelected = new EventEmitter<VenueWithUsageStats>();
  @Output() newVenueCreated = new EventEmitter<Partial<Venue>>();

  mapReady = false;
  options: any;
  layers: Layer[] = [];
  selectedVenue: VenueWithUsageStats | null = null;
  newVenueLocation: L.LatLng | null = null;
  newVenueName = "";

  faMapMarkerAlt = faMapMarkerAlt;
  faPlus = faPlus;
  mapHeight = 300;
  private isResizing = false;
  private startY = 0;
  private startHeight = 0;

  async ngOnInit() {
    this.venueTypes = this.walksReferenceService.venueTypes();
    this.mapTiles.initializeProjections();
    this.configureMap();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private configureMap() {
    const hasKey = this.mapTiles.hasOsApiKey();
    const provider = hasKey ? MapProvider.OS : MapProvider.OSM;
    const style = hasKey ? DEFAULT_OS_STYLE : "";

    let center: L.LatLng;
    if (this.initialVenue?.lat && this.initialVenue?.lon) {
      center = L.latLng(this.initialVenue.lat, this.initialVenue.lon);
      this.logger.info("Centering map on initial venue:", this.initialVenue.name, center);
    } else if (this.startingPoint) {
      center = L.latLng(this.startingPoint.latitude, this.startingPoint.longitude);
    } else {
      center = L.latLng(51.5074, -0.1278);
    }

    const baseLayer = this.mapTiles.createBaseLayer(provider, style);

    this.options = {
      layers: [baseLayer],
      zoom: 13,
      center,
      crs: this.mapTiles.crsForStyle(provider, style),
      maxZoom: this.mapTiles.maxZoomForStyle(provider, style)
    };

    this.mapReady = true;
  }

  async onMapReady(map: L.Map) {
    this.map = map;
    this.logger.info("Map ready");
    await this.loadVenueMarkers();
    setTimeout(() => this.map.invalidateSize(), 100);
  }

  private async loadVenueMarkers() {
    const venues = await this.venueService.queryVenues();
    this.venueMarkers.forEach(m => this.map.removeLayer(m));
    this.venueMarkers = [];

    const venuesWithCoords = venues.filter(v => v.lat && v.lon);
    this.logger.info(`Loading ${venuesWithCoords.length} venue markers`);

    venuesWithCoords.forEach(venue => {
      const marker = this.createVenueMarker(venue);
      marker.addTo(this.map);
      this.venueMarkers.push(marker);
    });
  }

  private createVenueMarker(venue: VenueWithUsageStats): L.Marker {
    const venueType = this.venueTypes.find(vt => vt.type === venue.type) || this.venueTypes[this.venueTypes.length - 1];
    const icon = this.createVenueIcon(venueType);

    const marker = L.marker([venue.lat!, venue.lon!], { icon });

    const popupContent = `
      <div style="min-width: 150px">
        <strong>${venue.name}</strong>
        ${venue.address1 ? `<br><small>${venue.address1}</small>` : ""}
        ${venue.postcode ? `<br><small>${venue.postcode}</small>` : ""}
        <br><button class="btn btn-primary btn-sm mt-2" id="select-venue-${venue.storedVenueId || venue.name}">Select</button>
      </div>
    `;

    marker.bindPopup(popupContent);

    marker.on("popupopen", () => {
      const btnId = `select-venue-${venue.storedVenueId || venue.name}`;
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.onclick = () => {
          this.zone.run(() => this.selectVenue(venue));
        };
      }
    });

    return marker;
  }

  private createVenueIcon(venueType: VenueType): L.DivIcon {
    const faClass = this.getFontAwesomeClass(venueType);
    const iconHtml = `
      <div class="venue-pin-container">
        <svg class="venue-pin-svg" width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="var(--os-explorer-color, #443d90)" stroke="#ffffff" stroke-width="2"/>
          <circle cx="16" cy="16" r="10" fill="#ffffff"/>
        </svg>
        <i class="fas fa-${faClass} venue-pin-icon"></i>
      </div>`;

    return L.divIcon({
      className: "venue-marker-icon",
      html: iconHtml,
      iconSize: [32, 42] as any,
      iconAnchor: [16, 42] as any,
      popupAnchor: [0, -34] as any
    });
  }

  private getFontAwesomeClass(venueType: VenueType): string {
    const iconMap: Record<string, string> = {
      "pub": "beer",
      "cafe": "coffee",
      "restaurant": "utensils",
      "church": "church",
      "hall": "building",
      "car park": "car",
      "station": "train",
      "other": "question"
    };
    return iconMap[venueType.type] || "question";
  }

  private getFontAwesomeUnicode(faClass: string): string {
    const unicodeMap: Record<string, string> = {
      "beer": "f0fc",
      "coffee": "f0f4",
      "utensils": "f2e7",
      "church": "f51d",
      "building": "f1ad",
      "car": "f1b9",
      "train": "f238",
      "question": "f128",
      "plus": "2b"
    };
    return unicodeMap[faClass] || "f128";
  }

  private selectVenue(venue: VenueWithUsageStats) {
    this.selectedVenue = venue;
    this.newVenueLocation = null;
    this.newVenueName = "";
    if (this.newVenueMarker) {
      this.map.removeLayer(this.newVenueMarker);
      this.newVenueMarker = null;
    }
    this.logger.info("Venue selected:", venue);
    this.venueSelected.emit(venue);
  }

  onMapClick(event: LeafletMouseEvent) {
    if (this.disabled) return;

    this.zone.run(() => {
      this.newVenueLocation = event.latlng;
      this.selectedVenue = null;
      this.newVenueName = "";

      if (this.newVenueMarker) {
        this.map.removeLayer(this.newVenueMarker);
      }

      this.newVenueMarker = L.marker(event.latlng, {
        icon: L.divIcon({
          className: "venue-marker-icon new-venue-marker",
          html: `
            <div class="venue-pin-container">
              <svg class="venue-pin-svg" width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="#28a745" stroke="#ffffff" stroke-width="2"/>
                <circle cx="16" cy="16" r="10" fill="#ffffff"/>
              </svg>
              <i class="fas fa-plus venue-pin-icon" style="color: #28a745;"></i>
            </div>`,
          iconSize: [32, 42] as any,
          iconAnchor: [16, 42] as any
        })
      }).addTo(this.map);

      this.logger.info("New venue location:", event.latlng);
    });
  }

  async createVenueAtLocation() {
    if (!this.newVenueLocation || !this.newVenueName?.trim()) return;

    try {
      const latlng = L.latLng(this.newVenueLocation.lat, this.newVenueLocation.lng);
      const gridRefs = await this.addressQueryService.gridReferenceLookupFromLatLng(latlng);
      const gridRef = gridRefs?.[0];

      const newVenue: Partial<Venue> = {
        name: this.newVenueName.trim(),
        lat: this.newVenueLocation.lat,
        lon: this.newVenueLocation.lng,
        postcode: gridRef?.postcode || undefined
      };

      this.logger.info("Creating new venue:", newVenue);
      this.newVenueCreated.emit(newVenue);
      this.cancelNewVenue();
    } catch (error) {
      this.logger.error("Error getting postcode for location:", error);
      const newVenue: Partial<Venue> = {
        name: this.newVenueName.trim(),
        lat: this.newVenueLocation.lat,
        lon: this.newVenueLocation.lng
      };
      this.newVenueCreated.emit(newVenue);
      this.cancelNewVenue();
    }
  }

  cancelNewVenue() {
    this.newVenueLocation = null;
    this.newVenueName = "";
    if (this.newVenueMarker) {
      this.map.removeLayer(this.newVenueMarker);
      this.newVenueMarker = null;
    }
  }

  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    this.isResizing = true;
    this.startY = event.clientY;
    this.startHeight = this.mapHeight;
    document.addEventListener("mousemove", this.onResizeMove);
    document.addEventListener("mouseup", this.onResizeEnd);
  }

  onResizeTouchStart(event: TouchEvent) {
    this.isResizing = true;
    this.startY = event.touches[0].clientY;
    this.startHeight = this.mapHeight;
    document.addEventListener("touchmove", this.onResizeTouchMove);
    document.addEventListener("touchend", this.onResizeTouchEnd);
  }

  private onResizeMove = (event: MouseEvent) => {
    if (!this.isResizing) return;
    const delta = event.clientY - this.startY;
    this.zone.run(() => {
      this.mapHeight = Math.min(800, Math.max(200, this.startHeight + delta));
      this.map?.invalidateSize();
    });
  };

  private onResizeTouchMove = (event: TouchEvent) => {
    if (!this.isResizing) return;
    const delta = event.touches[0].clientY - this.startY;
    this.zone.run(() => {
      this.mapHeight = Math.min(800, Math.max(200, this.startHeight + delta));
      this.map?.invalidateSize();
    });
  };

  private onResizeEnd = () => {
    this.isResizing = false;
    document.removeEventListener("mousemove", this.onResizeMove);
    document.removeEventListener("mouseup", this.onResizeEnd);
  };

  private onResizeTouchEnd = () => {
    this.isResizing = false;
    document.removeEventListener("touchmove", this.onResizeTouchMove);
    document.removeEventListener("touchend", this.onResizeTouchEnd);
  };
}
