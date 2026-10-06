import { AfterViewInit, Component, ElementRef, inject, Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
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
import { MapZoomService } from "../../../services/maps/map-zoom.service";
import { MapProvider, OUTDOOR_OS_STYLE } from "../../../models/map.model";
import { OsMapsListedRoute } from "../../../models/os-maps-export.model";
import {
  ROUTE_PREVIEW_MAX_POINTS,
  ROUTE_PREVIEW_SPACING_METRES,
  RouteFollowPoint
} from "../../../models/route-follow.model";
import { simplifiedRoutePoints } from "../../../functions/route-geometry";

const previewLineByUrl = new Map<string, L.LatLngExpression[]>();
const PREVIEW_VIEW_MARGIN = "240px 0px";

@Component({
  selector: "app-os-maps-route-preview-map",
  imports: [FontAwesomeModule, TooltipDirective],
  host: {
    "[class.fill]": "fill"
  },
  template: `
    <div class="os-maps-route-preview" [class.os-maps-route-preview-compact]="compact" [style.background-color]="'#eef1ea'">
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
      display: block
      align-self: stretch
      flex-shrink: 0
      width: 96px
      max-width: 100%

    :host.fill
      width: 100%
      height: 100%
      min-height: 0

    .os-maps-route-preview
      position: relative
      width: 100%
      min-height: 72px
      max-height: 140px
      height: 100%
      border-radius: .25rem
      overflow: hidden

    .os-maps-route-preview-compact
      min-height: 88px
      max-height: 88px

    :host.fill .os-maps-route-preview
      min-height: inherit
      max-height: none

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
  private mapZoom = inject(MapZoomService);
  private dateUtils = inject(DateUtilsService);
  private zone = inject(NgZone);
  @ViewChild("mapContainer", {static: true}) mapContainerRef!: ElementRef<HTMLDivElement>;
  @Input() route: OsMapsListedRoute | null = null;
  @Input() points: RouteFollowPoint[] = [];
  @Input() compact = false;
  fill = false;

  @Input("fill") set fillValue(value: boolean) {
    this.fill = coerceBooleanProperty(value);
  }
  faMap = faMap;
  faCircleCheck = faCircleCheck;
  hasLine = false;
  private mapRef: L.Map | null = null;
  private latLngs: L.LatLngExpression[] = [];
  private loadedRouteKey: string | null = null;
  private inView = false;
  private readonly osStyle = OUTDOOR_OS_STYLE;
  private readonly fitPaddingPercent = 0.18;
  private resizeObserver: ResizeObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private refitWait: ReturnType<typeof setTimeout> | null = null;
  private loadGeneration = {value: 0};

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.points || changes.route) && this.inView) {
      this.applyGeometry();
    } else if ((changes.fill || changes.compact) && this.mapRef) {
      this.refitRoute();
    }
  }

  private routeKey(): string | null {
    return this.route ? `${this.route.id}:${this.route.gpxFile?.awsFileName || ""}` : null;
  }

  private geometryKey(): string {
    const first = this.points[0];
    const last = this.points[this.points.length - 1];
    return [
      this.routeKey() || "",
      String(this.points.length),
      first ? `${first.latitude},${first.longitude}` : "",
      last ? `${last.latitude},${last.longitude}` : ""
    ].join(":");
  }

  importedLabel(): string {
    return this.route?.importedAt ? this.dateUtils.displayDate(this.route.importedAt) : "";
  }

  ngAfterViewInit(): void {
    this.observeVisibility();
  }

  ngOnDestroy(): void {
    this.loadGeneration.value += 1;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    this.tearDownMap();
  }

  private mapProvider(): MapProvider {
    return this.mapTiles.hasOsApiKey() ? MapProvider.OS : MapProvider.OSM;
  }

  private mapOptions(): L.MapOptions {
    const provider = this.mapProvider();
    const style = provider === MapProvider.OS ? this.osStyle : "";
    return {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      crs: this.mapTiles.crsForStyle(provider, style),
      maxZoom: this.mapTiles.maxZoomForStyle(provider, style)
    };
  }

  private observeVisibility(): void {
    const element = this.mapContainerRef.nativeElement;
    if ("IntersectionObserver" in window) {
      this.visibilityObserver = new IntersectionObserver(entries => {
        const visible = entries.some(entry => entry.isIntersecting);
        this.zone.run(() => this.setInView(visible));
      }, {rootMargin: PREVIEW_VIEW_MARGIN, threshold: 0.01});
      this.visibilityObserver.observe(element);
    } else {
      this.setInView(true);
    }
  }

  private setInView(visible: boolean): void {
    this.inView = visible;
    if (visible) {
      this.applyGeometry();
    } else {
      this.tearDownMap();
    }
  }

  private applyGeometry(): void {
    const key = this.geometryKey();
    const stored = this.route?.gpxFile?.previewPoints || [];
    const source = this.points.length >= 2 ? this.points : stored;
    if (key === this.loadedRouteKey) {
      if (this.latLngs.length >= 2) {
        this.ensureMap();
        this.drawIfReady();
      }
    } else if (source.length >= 2) {
      this.loadedRouteKey = key;
      this.latLngs = simplifiedRoutePoints(source, ROUTE_PREVIEW_SPACING_METRES, ROUTE_PREVIEW_MAX_POINTS)
        .map(point => [point.latitude, point.longitude]);
      this.hasLine = this.latLngs.length >= 2;
      this.ensureMap();
      this.drawIfReady();
    } else if (this.route?.gpxFile?.awsFileName) {
      void this.loadRoute();
    } else {
      this.loadedRouteKey = key;
      this.hasLine = false;
      this.latLngs = [];
    }
  }

  private ensureMap(): void {
    if (!this.mapRef) {
      const element = this.mapContainerRef.nativeElement as HTMLDivElement & {_leaflet_id?: number};
      if (element._leaflet_id) {
        element._leaflet_id = undefined;
      }
      this.mapRef = L.map(element, this.mapOptions());
      this.resizeObserver = new ResizeObserver(() => this.refitRoute());
      this.resizeObserver.observe(element);
    }
  }

  private tearDownMap(): void {
    if (this.refitWait) {
      clearTimeout(this.refitWait);
      this.refitWait = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mapRef?.remove();
    this.mapRef = null;
  }

  private async loadRoute(): Promise<void> {
    const key = this.geometryKey();
    const url = this.route?.gpxFile ? this.routeFollowPayload.gpxDownloadUrl(this.route.gpxFile) : null;
    const cached = url ? previewLineByUrl.get(url) : null;
    this.loadedRouteKey = key;
    if (cached && cached.length >= 2) {
      this.latLngs = cached;
      this.hasLine = true;
      this.ensureMap();
      this.drawIfReady();
    } else if (url) {
      const generation = this.loadGeneration.value + 1;
      this.loadGeneration.value = generation;
      this.hasLine = false;
      this.latLngs = [];
      try {
        const gpxContent = await firstValueFrom(this.http.get(url, {responseType: "text"}));
        if (this.loadGeneration.value === generation && this.loadedRouteKey === key) {
          const parsed = this.gpxParser.parseGpxFile(gpxContent);
          const track = parsed.tracks[0];
          if (track && track.points.length >= 2) {
            this.latLngs = simplifiedRoutePoints(track.points, ROUTE_PREVIEW_SPACING_METRES, ROUTE_PREVIEW_MAX_POINTS)
              .map(point => [point.latitude, point.longitude]);
            previewLineByUrl.set(url, this.latLngs);
            this.hasLine = true;
            if (this.inView) {
              this.ensureMap();
              this.drawIfReady();
            }
          }
        }
      } catch (error) {
        this.logger.error("loadRoute failed for route:", this.route?.id, error);
        if (this.loadedRouteKey === key) {
          this.loadedRouteKey = null;
        }
      }
    }
  }

  private drawIfReady(): void {
    if (this.mapRef && this.hasLine && this.latLngs.length >= 2) {
      const map = this.mapRef;
      const provider = this.mapProvider();
      const style = provider === MapProvider.OS ? this.osStyle : "";
      map.eachLayer(layer => map.removeLayer(layer));
      map.addLayer(this.mapTiles.createBaseLayer(provider, style));
      const polyline = L.polyline(this.latLngs, {color: this.route?.routeColor || "#2f6f4f", weight: 3});
      polyline.addTo(map);
      this.refitRoute();
    }
  }

  private refitRoute(): void {
    if (this.mapRef && this.hasLine && this.latLngs.length >= 2) {
      if (this.refitWait) {
        clearTimeout(this.refitWait);
      }
      const map = this.mapRef;
      const paddedBounds = L.latLngBounds(this.latLngs).pad(this.fitPaddingPercent);
      this.refitWait = setTimeout(() => {
        this.refitWait = null;
        this.mapZoom.invalidateAndApplyBounds(map, paddedBounds, {maxZoom: map.getMaxZoom()});
      }, 50);
    }
  }
}
