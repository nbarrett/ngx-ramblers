import { Component, ElementRef, inject, Input, NgZone, OnChanges, OnDestroy, SimpleChanges, ViewChild } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faMap } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import * as L from "leaflet";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { GpxParserService } from "../../../services/maps/gpx-parser.service";
import { RouteFollowPayloadService } from "../../../services/maps/route-follow-payload.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapZoomService } from "../../../services/maps/map-zoom.service";
import { MapProvider, DEFAULT_OS_STYLE } from "../../../models/map.model";
import { OsMapsListedRoute } from "../../../models/os-maps-export.model";
import { RouteFollowPoint } from "../../../models/route-follow.model";
import { FileNameData } from "../../../models/aws-object.model";
import { RouteFollowCacheService } from "../../../services/maps/route-follow-cache.service";
import { VisibilityObserverDirective } from "../../../notifications/common/visibility-observer.directive";
import { routeSegments } from "../../../functions/route-geometry";

const previewLineByUrl = new Map<string, Promise<RouteFollowPoint[]>>();
const PREVIEW_VIEW_MARGIN = "240px 0px";

@Component({
  selector: "app-os-maps-route-preview-map",
  imports: [FontAwesomeModule, VisibilityObserverDirective],
  host: {
    "[class.fill]": "fill"
  },
  template: `
    <div class="os-maps-route-preview" [class.os-maps-route-preview-compact]="compact" [style.background-color]="'#eef1ea'">
      <div class="os-maps-route-preview-map" #mapContainer
           [app-visibility-observer]="route?.id || cacheKey || 'route-preview'"
           [observeOnce]="false" [rootMargin]="previewViewMargin"
           (visibilityChange)="onVisibilityChange($event)"></div>
      @if (!hasLine) {
        <div class="os-maps-route-preview-fallback">
          <fa-icon [icon]="faMap" [style.color]="'#54606d'"/>
        </div>
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
      display: flex
      flex-direction: column
      width: 100%
      min-height: 0
      align-self: stretch

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
      flex: 1 1 auto
      min-height: 72px
      max-height: none
      height: auto

    :host.flush .os-maps-route-preview
      border-radius: 0

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
export class OsMapsRoutePreviewMapComponent implements OnChanges, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("OsMapsRoutePreviewMapComponent", NgxLoggerLevel.ERROR);
  private http = inject(HttpClient);
  private gpxParser = inject(GpxParserService);
  private routeFollowPayload = inject(RouteFollowPayloadService);
  private mapTiles = inject(MapTilesService);
  private mapZoom = inject(MapZoomService);
  private zone = inject(NgZone);
  private followCache = inject(RouteFollowCacheService);
  protected readonly previewViewMargin = PREVIEW_VIEW_MARGIN;
  @ViewChild("mapContainer", {static: true}) mapContainerRef!: ElementRef<HTMLDivElement>;
  @Input() route: OsMapsListedRoute | null = null;
  @Input() points: RouteFollowPoint[] = [];
  @Input() gpxFile: FileNameData | null = null;
  @Input() cacheKey: string | null = null;
  @Input() compact = false;
  fill = false;

  @Input("fill") set fillValue(value: boolean) {
    this.fill = coerceBooleanProperty(value);
  }
  faMap = faMap;
  hasLine = false;
  private mapRef: L.Map | null = null;
  private latLngs: L.LatLngExpression[] = [];
  private previewPoints: RouteFollowPoint[] = [];
  private loadedSource: string | null = null;
  private loadingSource: string | null = null;
  private loadedRouteKey: string | null = null;
  private inView = false;
  private readonly osStyle = DEFAULT_OS_STYLE;
  private readonly fitPaddingPercent = 0.18;
  private resizeObserver: ResizeObserver | null = null;
  private refitFrame: number | null = null;
  private loadGeneration = {value: 0};

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes.points || changes.route || changes.gpxFile || changes.cacheKey) && this.inView) {
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
      this.routeKey() || this.cacheKey || "",
      this.gpxFile?.awsFileName || "",
      String(this.points.length),
      first ? `${first.latitude},${first.longitude}` : "",
      last ? `${last.latitude},${last.longitude}` : ""
    ].join(":");
  }

  ngOnDestroy(): void {
    this.loadGeneration.value += 1;
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

  onVisibilityChange(visible: boolean): void {
    this.zone.run(() => this.setInView(visible));
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
    const source = this.points.length >= 2 ? this.points : this.route?.gpxFile?.previewPoints || [];
    if (key !== this.loadedRouteKey) {
      this.loadGeneration.value += 1;
      this.loadedRouteKey = key;
      this.loadedSource = null;
      this.loadingSource = null;
      this.applyPoints(source);
    }
    if (this.hasLine) {
      this.ensureMap();
      this.drawIfReady();
    }
    void this.loadRoute();
  }

  private applyPoints(points: RouteFollowPoint[]): void {
    this.previewPoints = points;
    this.latLngs = points.map(point => [point.latitude, point.longitude]);
    this.hasLine = points.length >= 2;
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
    if (this.refitFrame !== null) {
      cancelAnimationFrame(this.refitFrame);
      this.refitFrame = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mapRef?.remove();
    this.mapRef = null;
  }

  private async loadRoute(): Promise<void> {
    const key = this.geometryKey();
    const file = this.gpxFile || this.route?.gpxFile;
    const url = file ? this.routeFollowPayload.gpxDownloadUrl(file) : null;
    const source = url || this.cacheKey;
    if (source && this.loadedSource !== source && this.loadingSource !== source) {
      const generation = ++this.loadGeneration.value;
      this.loadingSource = source;
      try {
        const request = previewLineByUrl.get(source) || this.fullPoints(url);
        previewLineByUrl.set(source, request);
        const points = await request;
        if (points.length < 2) {
          previewLineByUrl.delete(source);
        }
        if (this.loadGeneration.value === generation && this.loadedRouteKey === key) {
          this.loadedSource = source;
          if (points.length >= 2) {
            this.applyPoints(points);
            if (this.inView) {
              this.ensureMap();
              this.drawIfReady();
            }
          }
        }
      } catch (error) {
        previewLineByUrl.delete(source);
        this.logger.error("loadRoute failed for route:", this.route?.id || this.cacheKey, error);
      } finally {
        if (this.loadGeneration.value === generation) {
          this.loadingSource = null;
        }
      }
    }
  }

  private fullPoints(url: string | null): Promise<RouteFollowPoint[]> {
    return url
      ? firstValueFrom(this.http.get(url, {responseType: "text"})).then(content => this.gpxParser.parseGpxFile(content).tracks.flatMap(track => track.points))
      : this.followCache.payload(this.cacheKey).then(payload => payload?.points || []);
  }

  private drawIfReady(): void {
    if (this.mapRef && this.hasLine && this.latLngs.length >= 2) {
      const map = this.mapRef;
      const provider = this.mapProvider();
      const style = provider === MapProvider.OS ? this.osStyle : "";
      map.eachLayer(layer => map.removeLayer(layer));
      map.addLayer(this.mapTiles.createBaseLayer(provider, style));
      const lines = routeSegments(this.previewPoints).map(segment => segment.map(point => L.latLng(point.latitude, point.longitude)));
      const polyline = L.polyline(lines, {color: this.route?.routeColor || "#2f6f4f", weight: 3, smoothFactor: 0.5});
      polyline.addTo(map);
      this.refitRoute();
    }
  }

  private refitRoute(): void {
    if (this.mapRef && this.hasLine && this.latLngs.length >= 2) {
      if (this.refitFrame !== null) {
        cancelAnimationFrame(this.refitFrame);
      }
      const map = this.mapRef;
      const paddedBounds = L.latLngBounds(this.latLngs).pad(this.fitPaddingPercent);
      this.refitFrame = requestAnimationFrame(() => {
        this.refitFrame = null;
        map.invalidateSize({animate: false});
        this.mapZoom.applyBoundsToMap(map, paddedBounds, {maxZoom: map.getMaxZoom()});
      });
    }
  }
}
