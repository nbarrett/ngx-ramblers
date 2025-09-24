import {
  Component,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from "@angular/core";
import * as L from "leaflet";
import "leaflet.markercluster";
import "proj4leaflet";
import proj4 from "proj4";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { FormsModule } from "@angular/forms";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { MapProvider, MapStyleInfo, OS_MAP_STYLE_LIST } from "../../../models/map.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../../services/date-utils.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapPopupService } from "../../../services/maps/map-popup.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { UrlService } from "../../../services/url.service";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-walks-map-view",
  styles: [`
    .map-controls-docked
      border-bottom: 1px solid #dee2e6
      margin-bottom: 0 !important
      position: relative
      z-index: 1000

    .map-controls-overlap
      margin-top: -15px
      border-top-left-radius: 0 !important
      border-top-right-radius: 0 !important

    .map-controls-gap
      gap: 0.5rem
      row-gap: 0.25rem

    .map-control-item
      gap: 0.25rem
      flex-shrink: 0

    .map-control-label
      font-size: 0.75rem
      margin-right: 10px

    .map-control-value
      min-width: 32px
      font-size: 0.7rem

    .map-control-range
      width: 70px
      accent-color: var(--ramblers-colour-sunrise)

    :host ::ng-deep input.map-control-range::-webkit-slider-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    :host ::ng-deep input.map-control-range::-moz-range-thumb
      background-color: var(--ramblers-colour-sunrise)
      border: 2px solid var(--ramblers-colour-sunrise)
      box-shadow: none

    :host ::ng-deep .leaflet-control-zoom a,
    :host ::ng-deep .leaflet-control-zoom a:hover,
    :host ::ng-deep .leaflet-control-zoom a:focus,
    :host ::ng-deep .leaflet-control-zoom a:active
      text-decoration: none !important
      outline: none

    .map-control-select
      width: auto
      min-width: 100px

    @media (max-width: 576px)
      .map-controls-gap
        gap: 0.25rem
        row-gap: 0.125rem

      .map-control-range
        width: 60px

      .map-control-select
        min-width: 85px
        font-size: 0.8rem

      .map-control-value
        min-width: 28px

    :host ::ng-deep .leaflet-top .leaflet-control
      margin-top: 19px

    .map-wrapper
      position: relative

    .map-overlay
      position: absolute
      z-index: 600
      pointer-events: auto

    .map-controls-docked
      z-index: 700

    :host ::ng-deep .leaflet-popup.popup-below .leaflet-popup-tip
      transform: rotate(180deg)
      margin-top: -1px
      margin-bottom: 0

  `],
  template: `
    @if (filteredWalks?.length || loading) {
      @if (showControls) {
        <div class="rounded-top img-thumbnail p-2 map-controls-docked">
          <div class="d-flex flex-wrap align-items-center map-controls-gap">
            <div class="d-flex align-items-center map-control-item">
              <span class="small mx-2 text-nowrap">Provider</span>
              <select class="form-select form-select-sm map-control-select" [(ngModel)]="provider"
                      (ngModelChange)="onProviderChange($event)">
                <option value="osm">OpenStreetMap</option>
                <option value="os" [disabled]="!hasOsApiKey">{{ hasOsApiKey ? 'OS Maps' : 'OS Maps (API key required)' }}</option>
              </select>
            </div>
            @if (provider === 'os') {
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-2 text-nowrap">Style</span>
                <select class="form-select form-select-sm map-control-select" [(ngModel)]="osStyle"
                        (ngModelChange)="onStyleChange($event)">
                  @for (style of osStyles; track style.key) {
                    <option [value]="style.key" [title]="style.description">{{ style.name }}</option>
                  }
                </select>
                <fa-icon class="ms-2 colour-mintcake" [icon]="faCircleInfo" tooltip="{{ selectedStyleInfo()?.description }}" placement="auto"></fa-icon>
              </div>
            }
            <div class="d-flex align-items-center map-control-item">
              <span class="small mx-2 text-nowrap">Height</span>
              <input type="range" class="form-range map-control-range" min="300" max="900" step="10"
                     [ngModel]="mapHeight" (input)="onHeightInput($event)" [title]="'Map height: ' + mapHeight + 'px'">
              <span class="ms-1 text-muted small map-control-value">{{ mapHeight }}px</span>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="scroll-toggle" [(ngModel)]="smoothScroll"
                     (ngModelChange)="onSmoothScrollChange($event)" title="Auto scroll on view">
              <label class="form-check-label small text-nowrap map-control-label" for="scroll-toggle">Auto scroll on view</label>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="autoshow-toggle" [(ngModel)]="autoShowAll"
                     (ngModelChange)="onAutoShowAllChange($event)" title="Auto-show walk details popups">
              <label class="form-check-label small text-nowrap map-control-label" for="autoshow-toggle">Auto-show popups</label>
            </div>
          </div>
        </div>
      }
      <div [class]="showControls ? 'map-controls-overlap' : 'rounded'">
        <div class="map-wrapper">
          @if (loading || !options) {
            <div class="map-walks-list-view card shadow d-flex align-items-center justify-content-center rounded"
                 [style.height.px]="mapHeight">
              <div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Loading…</span></div>
            </div>
          } @else if (showMap && options) {
            <div class="map-walks-list-view card shadow rounded"
                 [style.height.px]="mapHeight"
                 leaflet
                 [leafletOptions]="options"
                 [leafletLayers]="leafletLayers"
                 [leafletFitBounds]="fitBounds"
                 (leafletMapReady)="onMapReady($event)"></div>
            <div class="map-overlay top-right" [style.top]="showControls ? '20px' : '8px'">
              <div class="overlay-content">
                <div class="d-flex flex-column gap-2">
                  <button type="button" class="badge bg-warning text-dark border-0" (click)="toggleControls()">
                    <fa-icon [icon]="showControls ? faEyeSlash : faEye"></fa-icon>
                    <span class="ms-1">{{ showControls ? 'Hide map options' : 'Show map options' }}</span>
                  </button>
                  @if (openPopupCount > 1) {
                    <button type="button" class="badge bg-warning text-dark border-0" (click)="closeAllPopups()">
                      <fa-icon [icon]="faEyeSlash"></fa-icon>
                      <span class="ms-1">Close all popups</span>
                    </button>
                  }
                </div>
              </div>
            </div>
            <div class="map-overlay bottom-right">
              <div class="overlay-content">
                <span class="badge bg-primary text-white border rounded-pill small fw-bold">
                  {{ walkCountText }}
                </span>
              </div>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="mt-3"></div>
    }
  `,
  imports: [LeafletModule, FormsModule, FontAwesomeModule, TooltipDirective]
})
export class WalksMapViewComponent implements OnInit, OnChanges {
  @Input() filteredWalks: DisplayedWalk[] = [];
  @Input() loading = false;
  @Output() selected = new EventEmitter<DisplayedWalk>();
  @Output() autoShowAllChange = new EventEmitter<boolean>();

  public provider: MapProvider = "osm";
  public osStyle = "Leisure_27700";
  public osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;

  public options: any;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  public showMap = true;
  public hasMarkers = false;
  public mapHeight = 520;
  private resizing = false;
  private startY = 0;
  private startHeight = 520;
  public showControls = true;
  public autoShowAll = false;
  private clusterGroupRef: any;
  private allMarkers: L.Marker[] = [];
  public openPopupCount = 0;
  private lastValidCoords = 0;
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;
  protected readonly faCircleInfo = faCircleInfo;
  public smoothScroll = true;
  private openPopupRefs: Array<{ popup: L.Popup, marker: L.Marker }> = [];
  private customPopupPositioningEnabled = false;
  private escAttached = false;
  private savedCenter: L.LatLng | null = null;
  private savedZoom: number | null = null;
  private preserveNextView = false;
  private preserveSameCrs = false;

  private logger: Logger = inject(LoggerFactory).createLogger("WalksMapViewComponent", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private systemConfigService = inject(SystemConfigService);
  private uiActions = inject(UiActionsService);
  private zone = inject(NgZone);
  private distanceValidationService = inject(DistanceValidationService);
  private mediaQueryService = inject(MediaQueryService);
  private mapTiles = inject(MapTilesService);
  private popupService = inject(MapPopupService);
  private markerStyle = inject(MapMarkerStyleService);
  private urlService = inject(UrlService);

  ngOnInit() {
    const projNS: any = (L as any).Proj;
    if (projNS?.setProj4) {
      projNS.setProj4(proj4);
    }
    if ((proj4 as any).defs && !(proj4 as any).defs["EPSG:27700"]) {
      (proj4 as any).defs("EPSG:27700", "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=-446.448,125.157,-542.06,-0.1502,-0.2470,-0.8421,20.4894 +units=m +no_defs");
    }
    const storedProvider = this.uiActions.initialValueFor(StoredValue.MAP_PROVIDER, null) as MapProvider;
    const storedStyle = this.uiActions.initialValueFor(StoredValue.MAP_OS_STYLE, null) as string;
    const storedSmooth = this.uiActions.initialBooleanValueFor(StoredValue.MAP_SMOOTH_SCROLL, true);
    const storedHeight = this.uiActions.initialValueFor(StoredValue.MAP_HEIGHT, this.mapHeight) as any;
    const storedShow = this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true);
    const storedAuto = this.uiActions.initialBooleanValueFor(StoredValue.MAP_AUTO_SHOW_ALL, false);

    const hasKey = this.hasOsApiKey;
    if (storedProvider === "os" || storedProvider === "osm") {
      this.provider = storedProvider;
    } else {
      this.provider = hasKey ? "os" : "osm";
    }

    if (this.provider === "os" && !this.hasOsApiKey) {
      this.logger.info("ngOnInit: OS Maps selected but no API key available, switching to OpenStreetMap");
      this.provider = "osm";
      this.uiActions.saveValueFor(StoredValue.MAP_PROVIDER, "osm");
    }

    const allowedStyles = this.osStyles.map(s => s.key);
    this.osStyle = (storedStyle && allowedStyles.includes(storedStyle)) ? storedStyle : (hasKey ? "Leisure_27700" : this.osStyle);
    this.smoothScroll = storedSmooth;
    this.showControls = storedShow;
    this.autoShowAll = storedAuto;
    const parsed = parseInt(storedHeight as string, 10);
    if (!isNaN(parsed)) {
      this.mapHeight = Math.min(900, Math.max(300, parsed));
    }
    this.logger.info("ngOnInit:filteredWalks:", this.filteredWalks?.length, "provider:", this.provider, "osStyle:", this.osStyle);
    this.rebuildMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.filteredWalks) {
      const prev = changes.filteredWalks.previousValue?.length || 0;
      const curr = changes.filteredWalks.currentValue?.length || 0;
      this.logger.info("ngOnChanges:filteredWalks changed:", prev, "->", curr);
      this.rebuildMap();
    }
  }

  rebuildMap() {
    this.logger.info("rebuildMap:provider:", this.provider, "osStyle:", this.osStyle);
    this.setupDefaultIcon();
    const base = this.mapTiles.createBaseLayer(this.provider, this.osStyle);
    const markers = this.createMarkers();
    this.logger.info("rebuildMap:markers:", markers.length);
    this.hasMarkers = markers.length > 0;
    const cluster = this.createCluster(markers);
    this.clusterGroupRef = cluster;
    this.leafletLayers = [base, cluster || L.layerGroup(markers)];
    const bounds = this.boundsFromMarkers(markers);
    this.fitBounds = bounds || undefined;
    this.logger.info("rebuildMap:bounds:", bounds ? bounds.toBBoxString() : null);
    const initialZoom = this.savedZoom ?? 8;
    this.options = this.hasMarkers ? {
      crs: this.mapTiles.crsForStyle(this.provider, this.osStyle),
      center: bounds ? bounds.getCenter() : L.latLng(53.8, -1.5),
      zoom: Math.min(initialZoom, this.maxZoomForCurrentStyle()),
      maxZoom: this.mapTiles.maxZoomForStyle(this.provider, this.osStyle),
      minZoom: 1
    } : null;
    if (this.mapRef) {
      setTimeout(() => {
        this.mapRef?.invalidateSize(true);
        if (bounds && !this.preserveNextView) {
          this.mapRef?.fitBounds(this.normalizeBounds(bounds));
        }
      }, 0);
    }
  }

  private createBaseLayer(): L.TileLayer { return this.mapTiles.createBaseLayer(this.provider, this.osStyle); }

  private osZxyUrl(layer: string, key: string): string { return ""; }

  private osmUrl(): string { return ""; }

  private osApiKey(): string { return ""; }

  get hasOsApiKey(): boolean { return this.mapTiles.hasOsApiKey(); }

  get walkCountText(): string {
    const total = this.filteredWalks?.length || 0;
    const withCoords = this.lastValidCoords;
    const missing = total - withCoords;

    if (total === 0) return "0 walks";
    if (missing === 0) return `${total} ${total === 1 ? "walk" : "walks"}`;

    return `${withCoords} ${withCoords === 1 ? "walk" : "walks"}${missing > 0 ? ` (${missing} missing location)` : ""}`;
  }

  private crsForCurrentStyle(): any {
    if (this.provider === "os" && this.osStyle.endsWith("27700")) {
      this.logger.info("crsForCurrentStyle:EPSG:27700");
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
    this.logger.info("crsForCurrentStyle:EPSG:3857");
    return L.CRS.EPSG3857;
  }

  private createMarkers(): L.Marker[] {
    const items = this.filteredWalks || [];
    const points: L.Marker[] = [];
    let validCoords = 0;
    let invalidCoords = 0;
    const clusters: { lat: number; lng: number; walks: DisplayedWalk[]; postcodes: Set<string> }[] = [];
    const thresholdMeters = 60;
    this.logger.info("createMarkers: processing", items.length, "walks");
    for (const dw of items) {
      const lat = dw?.walk?.groupEvent?.start_location?.latitude;
      const lng = dw?.walk?.groupEvent?.start_location?.longitude;
      if (typeof lat === "number" && typeof lng === "number" && lat !== 0 && lng !== 0 && Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001) {
        validCoords++;
        const pc = (dw?.walk?.groupEvent?.start_location?.postcode || "").toString().toUpperCase().replace(/\s+/g, "");
        let placed = false;
        for (const c of clusters) {
          const d = L.latLng(lat, lng).distanceTo(L.latLng(c.lat, c.lng));
          const samePostcode = pc && c.postcodes.has(pc);
          if (d <= thresholdMeters || samePostcode) {
            c.walks.push(dw);
            if (pc) c.postcodes.add(pc);
            placed = true;
            break;
          }
        }
        if (!placed) {
          const set = new Set<string>();
          if (pc) set.add(pc);
          clusters.push({lat, lng, walks: [dw], postcodes: set});
        }
      } else {
        invalidCoords++;
      }
    }

    clusters.forEach((cluster) => {
      const lat = cluster.walks.reduce((a, b) => a + (b?.walk?.groupEvent?.start_location?.latitude || 0), 0) / cluster.walks.length;
      const lng = cluster.walks.reduce((a, b) => a + (b?.walk?.groupEvent?.start_location?.longitude || 0), 0) / cluster.walks.length;
      const icon = this.markerStyle.markerIcon(this.provider, this.osStyle);
      const marker = L.marker([lat, lng], {icon});
      const ordered = cluster.walks.slice().sort((a, b) => {
        const at = (a?.walk?.groupEvent?.title || "").toLowerCase().trim();
        const bt = (b?.walk?.groupEvent?.title || "").toLowerCase().trim();
        if (at !== bt) return at.localeCompare(bt);
        const ad = a?.walk?.groupEvent?.start_date_time;
        const bd = b?.walk?.groupEvent?.start_date_time;
        const am = ad ? this.dateUtils.asDateTime(ad).toMillis() : 0;
        const bm = bd ? this.dateUtils.asDateTime(bd).toMillis() : 0;
        return bm - am;
      });
      const popup = ordered.length === 1 ? this.popupHtml(ordered[0], `view-${ordered[0]?.walk?.groupEvent?.id}`) : this.multiPopupHtml(ordered);
      const clickTargets: Array<{ id: string, walk: DisplayedWalk }> = ordered.length === 1
        ? [{ id: `view-${ordered[0]?.walk?.groupEvent?.id}`, walk: ordered[0] }]
        : ordered.map((dw, index) => ({ id: `view-${dw?.walk?.groupEvent?.id}-${index}`, walk: dw }));
      this.popupService.bindPopup(
        marker,
        popup,
        clickTargets,
        dw => this.selected.emit(dw),
        count => this.openPopupCount = count
      );
      points.push(marker);
    });

    this.lastValidCoords = validCoords;
    this.logger.info("createMarkers: results - proximity clusters:", clusters.length, "valid coordinates:", validCoords, "invalid coordinates:", invalidCoords);
    this.allMarkers = points;
    return points;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (this.openPopupRefs.length > 0) {
        const last = this.openPopupRefs[this.openPopupRefs.length - 1];
        try {
          last.marker.closePopup();
        } catch {
        }
        event.preventDefault();
        event.stopPropagation();
      } else if (this.mapRef) {
        try {
          this.mapRef.closePopup();
        } catch {
        }
      }
    }
  }

  private popupHtml(dw: DisplayedWalk, linkId: string): string {
    const title = dw?.walk?.groupEvent?.title || "Walk";
    const start = dw?.walk?.groupEvent?.start_date_time;
    const time = start ? `${this.dateUtils.displayDay(start)}${EM_DASH_WITH_SPACES}${this.dateUtils.displayTime(start)}` : "";
    const group = dw?.walk?.groupEvent?.group_name || "";
    const leader = dw?.walk?.groupEvent?.walk_leader?.name?.replace(/\.$/, "");
    const groupWithLeader = leader ? `${group} (${leader})` : group;
    const distance = this.distanceValidationService.walkDistances(dw?.walk);
    const postcode = dw?.walk?.groupEvent?.start_location?.postcode || "";
    const extraDetails = this.joinWithEmDash([postcode, distance]);
    const media = this.mediaQueryService.imageSource(dw.walk);
    const thumb = media?.url ? `
      <div class=\"popup-thumb-wrap\">\n
        <img src=\"${this.urlService.imageSource(media.url, false, true)}\" alt=\"${this.escape(media?.alt || title)}\" class=\"popup-thumb\">\n
      </div>` : "";
    return `<div style=\"min-width:240px;\">\n`+
           `  <div class=\"small fw-bold mb-1\">${this.escape(title)}</div>\n`+
           `  <div class=\"d-flex align-items-start\">\n`+
           `    <div class=\"me-2\">\n`+
           `      <button type=\"button\" class=\"badge bg-primary border-0\" id=\"${linkId}\">view</button>\n`+
           `    </div>\n`+
           `    <div class=\"flex-grow-1\">\n`+
           `      <div class=\"small text-muted\">${this.escape(groupWithLeader)}</div>\n`+
           `      <div class=\"small\">${this.escape(time)}</div>\n`+
           `      <div class=\"small\">${this.escape(extraDetails)}</div>\n`+
           `    </div>\n`+
           `    ${thumb}\n`+
           `  </div>\n`+
           `</div>`;
  }

  private escape(value: string): string {
    return value?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "";
  }

  private multiPopupHtml(group: DisplayedWalk[]): string {
    let runningIndex = 0;
    let lastTitleKey = "";
    const items = group.map((dw) => {
      const title = dw?.walk?.groupEvent?.title || "Walk";
      const titleKey = title.toLowerCase().trim();
      const start = dw?.walk?.groupEvent?.start_date_time;
      const time = start ? `${this.dateUtils.displayDay(start)}${EM_DASH_WITH_SPACES}${this.dateUtils.displayTime(start)}` : "";
      const groupName = dw?.walk?.groupEvent?.group_name || "";
      const leader = dw?.walk?.groupEvent?.walk_leader?.name?.replace(/\.$/, "");
      const groupWithLeader = leader ? `${groupName} (${leader})` : groupName;
      const distance = this.distanceValidationService.walkDistances(dw?.walk);
      const postcode = dw?.walk?.groupEvent?.start_location?.postcode || "";
      const extraDetails = this.joinWithEmDash([postcode, distance]);
      const linkId = `view-${dw?.walk?.groupEvent?.id}-${runningIndex++}`;
      const media = this.mediaQueryService.imageSource(dw.walk);
      const thumb = media?.url ? `
        <div class=\"popup-thumb-wrap\">\n
          <img src=\"${this.urlService.imageSource(media.url, false, true)}\" alt=\"${this.escape(media?.alt || title)}\" class=\"popup-thumb\">\n
        </div>` : "";
      const titleHeader = titleKey !== lastTitleKey ? `<div class=\"small fw-bold mt-1\">${this.escape(title)}</div>` : "";
      lastTitleKey = titleKey;
      return `
        ${titleHeader}\n` +
        `        <div class=\"d-flex align-items-start py-1\">\n` +
        `          <div class=\"me-2 d-flex align-items-center\">\n` +
        `            <button type=\"button\" class=\"badge bg-primary border-0\" id=\"${linkId}\">view</button>\n` +
        `          </div>\n` +
        `          <div class=\"flex-grow-1\">\n` +
        `            <div class=\"small text-muted\">${this.escape(groupWithLeader)}</div>\n` +
        `            <div class=\"small\">${this.escape(time)}</div>\n` +
        `            <div class=\"small\">${this.escape(extraDetails)}</div>\n` +
        `          </div>\n` +
        `          ${thumb}\n` +
        `        </div>`;
    }).join("");
    return `<div style=\"min-width:260px; max-width:320px;\">\n` +
      `  <div style=\"max-height:260px; overflow-y:auto; padding-right:4px;\">${items}</div>\n` +
      `</div>`;
  }

  private joinWithEmDash(parts: string[]): string {
    const filtered = parts.filter(p => !!p && p.toString().trim().length > 0);
    return filtered.join(EM_DASH_WITH_SPACES);
  }

  private createCluster(markers: L.Marker[]): L.Layer | null {
    const mc: any = (L as any).markerClusterGroup;
    if (mc && typeof mc === "function") {
      const clusterIconFn = this.markerStyle.clusterIconCreate(this.provider, this.osStyle);
      const clusterGroup = mc({
        showCoverageOnHover: false,
        removeOutsideVisibleBounds: true,
        iconCreateFunction: clusterIconFn
      });
      markers.forEach(m => clusterGroup.addLayer(m));

      clusterGroup.on("animationend", () => {
        if (this.autoShowAll) {
          setTimeout(() => this.showAllVisiblePopups(), 300);
        }
      });

      clusterGroup.on("spiderfied", () => {
        if (this.autoShowAll) {
          setTimeout(() => this.showAllVisiblePopups(), 100);
        }
      });

      clusterGroup.on("clusterclick", (e: any) => {
        const cluster = e?.layer;
        if (!cluster || !this.mapRef) return;
        const bounds: L.LatLngBounds | undefined = cluster.getBounds ? cluster.getBounds() : undefined;
        if (!bounds) return;
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const degenerate = ne.equals(sw);
        if (degenerate) {
          try { (L as any).DomEvent?.stop?.(e.originalEvent); } catch {}
          if (cluster.spiderfy) {
            cluster.spiderfy();
          }
        }
      });

      return clusterGroup as L.Layer;
    }
    return null;
  }

  private boundsFromMarkers(markers: L.Marker[]): L.LatLngBounds | null {
    if (!markers || markers.length === 0) {
      return null;
    }
    const group = L.featureGroup(markers);
    return group.getBounds();
  }

  private setupDefaultIcon() {
    const assetsUrl = "assets/images/";
    const mergeOptions: any = {
      iconRetinaUrl: `${assetsUrl}marker-icon-2x.png`,
      iconUrl: `${assetsUrl}marker-icon.png`,
      shadowUrl: `${assetsUrl}marker-shadow.png`
    };
    (L.Icon.Default as any).mergeOptions(mergeOptions);
  }


  private viewWalk(dw: DisplayedWalk) {}

  onMapReady(map: L.Map) {
    this.logger.info("onMapReady:received map, invalidating size and fitting bounds");
    this.mapRef = map;

    map.on("moveend zoomend", () => {
      if (this.autoShowAll) {
        setTimeout(() => this.showAllVisiblePopups(), 300);
      }
      try { this.uiActions.saveValueFor(StoredValue.MAP_ZOOM, map.getZoom()); } catch {}
    });

    setTimeout(() => {
      this.mapRef?.invalidateSize(true);
      if (this.fitBounds && !this.preserveNextView) {
        this.mapRef?.fitBounds(this.normalizeBounds(this.fitBounds));
      }
      if (this.preserveNextView && this.savedCenter && this.savedZoom != null) {
        const targetZoom = this.preserveSameCrs ? this.savedZoom : Math.min(this.savedZoom, this.maxZoomForCurrentStyle());
        try { this.mapRef?.setView(this.savedCenter, targetZoom); } catch {}
        this.preserveNextView = false;
      }
      if (this.autoShowAll) {
        setTimeout(() => this.showAllVisiblePopups(), 500);
      }
    }, 0);
  }



  private maxZoomForCurrentStyle(): number {
    if (this.provider === "os" && this.osStyle.endsWith("27700")) {
      return 9;
    }
    return 19;
  }

  private normalizeBounds(bounds: L.LatLngBounds): L.LatLngBounds {
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    if (ne.equals(sw)) {
      const pad = 0.0005;
      const center = bounds.getCenter();
      return L.latLngBounds(
        L.latLng(center.lat - pad, center.lng - pad),
        L.latLng(center.lat + pad, center.lng + pad)
      );
    }
    return bounds;
  }

  onProviderChange(value: MapProvider) {
    this.provider = value;
    this.uiActions.saveValueFor(StoredValue.MAP_PROVIDER, value);
    this.recreateMap(true);
  }

  onStyleChange(value: string) {
    this.osStyle = value;
    this.uiActions.saveValueFor(StoredValue.MAP_OS_STYLE, value);
    this.recreateMap(true);
  }

  private recreateMap(preserveView?: boolean) {
    this.logger.info("recreateMap: tearing down and rebuilding map for provider/style change");
    if (preserveView && this.mapRef) {
      try { this.savedCenter = this.mapRef.getCenter(); } catch { this.savedCenter = null; }
      this.savedZoom = this.mapRef.getZoom();
      this.preserveNextView = true;
    }

    if (this.mapRef) {
      this.mapRef.remove();
      this.mapRef = undefined;
    }

    this.leafletLayers = [];
    this.clusterGroupRef = undefined;
    this.allMarkers = [];
    this.openPopupCount = 0;
    this.showMap = false;
    this.fitBounds = undefined;
    this.options = null;

    setTimeout(() => {
      this.showMap = true;
      requestAnimationFrame(() => setTimeout(() => this.rebuildMap(), 0));
    }, 50);
  }

  onSmoothScrollChange(value: boolean) {
    this.smoothScroll = value;
    this.uiActions.saveValueFor(StoredValue.MAP_SMOOTH_SCROLL, value);
  }

  selectedStyleInfo(): MapStyleInfo | undefined {
    return this.osStyles.find(s => s.key === this.osStyle);
  }

  onHeightInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseInt(input.value, 10);
    this.mapHeight = Math.min(900, Math.max(300, isNaN(value) ? this.mapHeight : value));
    this.uiActions.saveValueFor(StoredValue.MAP_HEIGHT, this.mapHeight);
    requestAnimationFrame(() => this.mapRef?.invalidateSize(true));
  }

  toggleControls() {
    this.showControls = !this.showControls;
    this.uiActions.saveValueFor(StoredValue.MAP_SHOW_CONTROLS, this.showControls);
  }

  onAutoShowAllChange(value: boolean) {
    this.autoShowAll = value;
    this.uiActions.saveValueFor(StoredValue.MAP_AUTO_SHOW_ALL, value);
    this.autoShowAllChange.emit(value);
    if (value && this.mapRef) {
      setTimeout(() => this.showAllVisiblePopups(), 100);
    }
  }



  private isMarkerInViewport(marker: L.Marker): boolean {
    if (!this.mapRef) return false;
    const bounds = this.mapRef.getBounds();
    const markerLatLng = marker.getLatLng();
    return bounds.contains(markerLatLng);
  }

  private showAllVisiblePopups() {
    if (!this.mapRef || !this.autoShowAll || !this.allMarkers.length) return;

    this.allMarkers.forEach((marker, index) => {
      if (this.isMarkerInViewport(marker)) {
        setTimeout(() => {
          try {
            marker.openPopup();
          } catch {}
        }, index * 50);
      }
    });
  }

  closeAllPopups() {
    if (this.mapRef) {
      try {
        this.mapRef.closePopup();
      } catch {}
    }

    if (this.clusterGroupRef && typeof this.clusterGroupRef.eachLayer === "function") {
      try {
        this.clusterGroupRef.eachLayer((layer: any) => {
          if (layer.closePopup && typeof layer.closePopup === "function") {
            layer.closePopup();
          }
        });
      } catch {}
    }

    this.allMarkers.forEach(marker => {
      try {
        if (marker.isPopupOpen && marker.isPopupOpen()) {
          marker.closePopup();
        }
      } catch {}
    });

    this.openPopupCount = 0;
  }
}
