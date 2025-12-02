import { Component, inject, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import * as L from "leaflet";
import "leaflet.markercluster";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { PageContent, PageContentColumn } from "../../../models/content-text.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { UrlService } from "../../../services/url.service";

@Component({
  selector: "app-dynamic-content-view-album-index-map",
  styles: [`
    .map-wrapper
      position: relative

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
  `],
  template: `
    @if (showMap && options) {
      <div class="map-wrapper mt-3">
        <div class="card shadow rounded"
             [style.height.px]="mapHeight"
             leaflet
             [leafletOptions]="options"
             [leafletLayers]="leafletLayers"
             [leafletFitBounds]="fitBounds"
             (leafletMapReady)="onMapReady($event)">
        </div>
      </div>
    }
  `,
  imports: [LeafletModule]
})
export class DynamicContentViewAlbumIndexMapComponent implements OnInit, OnChanges {
  @Input() pageContent: PageContent;
  @Input() mapHeight = 500;
  @Input() clusteringEnabled = true;
  @Input() clusteringThreshold = 10;

  public options: any;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  public showMap = true;
  private clusterGroupRef: any;
  private allMarkers: L.Marker[] = [];

  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewAlbumIndexMapComponent", NgxLoggerLevel.ERROR);
  private mapTiles = inject(MapTilesService);
  private urlService = inject(UrlService);

  ngOnInit() {
    this.mapTiles.initializeProjections();
    this.initializeMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["pageContent"] && !changes["pageContent"].firstChange) {
      this.updateMarkers();
    }
    if (changes["mapHeight"] && !changes["mapHeight"].firstChange) {
      this.updateMapSize();
    }
    if ((changes["clusteringEnabled"] || changes["clusteringThreshold"]) && !changes["clusteringEnabled"]?.firstChange) {
      this.updateMarkers();
    }
  }

  private initializeMap() {
    this.options = {
      layers: [
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
        })
      ],
      zoom: 10,
      center: L.latLng(51.505, -0.09)
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

    const marker = L.marker([column.location.latitude, column.location.longitude], {
      icon: L.icon({
        iconUrl: "assets/images/markers/marker-icon-2x.png",
        shadowUrl: "assets/images/markers/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    });

    const popupContent = this.createPopupContent(column);
    marker.bindPopup(popupContent);

    marker.on("click", () => {
      if (column.href) {
        this.urlService.navigateTo([column.href]);
      }
    });

    return marker;
  }

  private createPopupContent(column: PageContentColumn): string {
    let content = `<div style="min-width: 200px;">`;

    if (column.imageSource) {
      content += `<img src="${column.imageSource}" alt="${column.title}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">`;
    }

    content += `<h6 style="margin-bottom: 8px; font-weight: bold;">${column.title || "Untitled"}</h6>`;

    if (column.contentText) {
      content += `<p style="margin-bottom: 8px; font-size: 0.9em;">${column.contentText}</p>`;
    }

    if (column.href) {
      content += `<a href="${column.href}" style="color: #007bff; text-decoration: none; font-size: 0.9em;">View details →</a>`;
    }

    content += `</div>`;
    return content;
  }

  private applyMarkersToMap() {
    if (this.shouldCluster()) {
      this.logger.info("Applying clustering to", this.allMarkers.length, "markers");
      this.clusterGroupRef = (L as any).markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        animate: true
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
}
