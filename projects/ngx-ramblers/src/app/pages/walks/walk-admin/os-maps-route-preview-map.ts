import { AfterViewInit, Component, ElementRef, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck, faMap } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import * as L from "leaflet";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GpxParserService } from "../../../services/maps/gpx-parser.service";
import { RouteFollowPayloadService } from "../../../services/maps/route-follow-payload.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapProvider } from "../../../models/map.model";
import { OsMapsListedRoute } from "../../../models/os-maps-export.model";

@Component({
  selector: "app-os-maps-route-preview-map",
  imports: [FontAwesomeModule, TooltipDirective],
  template: `
    <div class="os-maps-route-preview" [style.background-color]="'#eef1ea'">
      <div class="os-maps-route-preview-map" #mapContainer></div>
      @if (!hasLine) {
        <div class="os-maps-route-preview-fallback">
          <fa-icon [icon]="faMap" [style.color]="'#54606d'"/>
        </div>
      }
      @if (route?.importedAt) {
        <span class="os-maps-route-preview-badge"
              [tooltip]="'Imported ' + importedLabel()" container="body">
          <fa-icon [icon]="faCircleCheck"/>
        </span>
      }
    </div>
  `,
  styles: [`
    :host
      display: flex
      align-self: stretch
      flex-shrink: 0

    .os-maps-route-preview
      position: relative
      width: 96px
      min-height: 72px
      max-height: 140px
      height: 100%
      border-radius: .25rem
      overflow: hidden
      flex-shrink: 0

    .os-maps-route-preview-badge
      position: absolute
      top: 4px
      left: 4px
      width: 20px
      height: 20px
      border-radius: 50%
      display: flex
      align-items: center
      justify-content: center
      background-color: #2f6f4f
      color: #ffffff
      font-size: .7rem
      box-shadow: 0 1px 2px rgba(0, 0, 0, .35)

    .os-maps-route-preview-map
      width: 100%
      height: 100%
      pointer-events: none

    .os-maps-route-preview-fallback
      position: absolute
      inset: 0
      width: 100%
      height: 100%
      display: flex
      align-items: center
      justify-content: center
      background-color: #eef1ea
  `]
})
export class OsMapsRoutePreviewMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("OsMapsRoutePreviewMapComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private gpxParser = inject(GpxParserService);
  private routeFollowPayload = inject(RouteFollowPayloadService);
  private mapTiles = inject(MapTilesService);
  private dateUtils = inject(DateUtilsService);
  @ViewChild("mapContainer", {static: true}) mapContainerRef!: ElementRef<HTMLDivElement>;
  @Input() route: OsMapsListedRoute;
  faMap = faMap;
  faCircleCheck = faCircleCheck;
  hasLine = false;
  options: L.MapOptions = {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    touchZoom: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false
  };
  private mapRef: L.Map | null = null;
  private latLngs: L.LatLngExpression[] = [];
  private loadedRouteKey: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    const key = this.routeKey();
    if (changes.route && key !== this.loadedRouteKey) {
      void this.loadRoute();
    }
  }

  private routeKey(): string | null {
    return this.route ? `${this.route.id}:${this.route.gpxFile?.awsFileName || ""}` : null;
  }

  importedLabel(): string {
    return this.route?.importedAt ? this.dateUtils.displayDate(this.route.importedAt) : "";
  }

  ngAfterViewInit(): void {
    const element = this.mapContainerRef.nativeElement as HTMLDivElement & {_leaflet_id?: number};
    if (element._leaflet_id) {
      element._leaflet_id = undefined;
    }
    this.mapRef = L.map(element, this.options);
    this.drawIfReady();
  }

  ngOnDestroy(): void {
    this.mapRef?.remove();
    this.mapRef = null;
  }

  private async loadRoute(): Promise<void> {
    this.loadedRouteKey = this.routeKey();
    this.hasLine = false;
    this.latLngs = [];
    const url = this.route?.gpxFile ? this.routeFollowPayload.gpxDownloadUrl(this.route.gpxFile) : null;
    if (url) {
      try {
        const gpxContent = await firstValueFrom(this.http.get(url, {responseType: "text"}));
        const parsed = this.gpxParser.parseGpxFile(gpxContent);
        const track = parsed.tracks[0];
        if (track && track.points.length >= 2) {
          this.latLngs = this.gpxParser.toLeafletLatLngs(track);
          this.hasLine = true;
          this.drawIfReady();
        }
      } catch (error) {
        this.logger.error("loadRoute failed for route:", this.route?.id, error);
      }
    }
  }

  private drawIfReady(): void {
    if (this.mapRef && this.hasLine && this.latLngs.length >= 2) {
      const map = this.mapRef;
      map.eachLayer(layer => map.removeLayer(layer));
      map.addLayer(this.mapTiles.createBaseLayer(MapProvider.OSM, ""));
      const polyline = L.polyline(this.latLngs, {color: this.route.routeColor || "#2f6f4f", weight: 3});
      polyline.addTo(map);
      map.fitBounds(polyline.getBounds(), {padding: [3, 3]});
      setTimeout(() => map.invalidateSize(), 0);
    }
  }
}
