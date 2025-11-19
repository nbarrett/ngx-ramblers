import { Component, EventEmitter, inject, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import * as L from "leaflet";
import { isFunction, isNumber } from "es-toolkit/compat";
import "leaflet.markercluster";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { FormsModule } from "@angular/forms";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { MapProvider, MapStyleInfo, OS_MAP_STYLE_LIST } from "../../../models/map.model";
import { DisplayedWalk } from "../../../models/walk.model";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../../../services/date-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { DistanceValidationService } from "../../../services/walks/distance-validation.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapPopupService } from "../../../services/maps/map-popup.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { UrlService } from "../../../services/url.service";
import { MediaQueryService } from "../../../services/committee/media-query.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import {
  MapControlsComponent,
  MapControlsConfig,
  MapControlsState
} from "../../../shared/components/map-controls.component";
import { MapControlsStateService } from "../../../shared/services/map-controls-state.service";
import { MapRecreationService } from "../../../shared/services/map-recreation.service";
import { MapOverlayComponent } from "../../../shared/components/map-overlay.component";

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
          <app-map-controls
            [config]="mapControlsConfig"
            [state]="mapControlsState"
            (providerChange)="onProviderChange($event)"
            (styleChange)="onStyleChange($event)"
            (heightChange)="onHeightChange($event)"
            (smoothScrollChange)="onSmoothScrollChange($event)"
            (autoShowAllChange)="onAutoShowAllChange($event)">
          </app-map-controls>
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
            <app-map-overlay
              [showControls]="showControls"
              (toggleControls)="toggleControls()">
              <div slot="additional-buttons">
                @if (openPopupCount > 1) {
                  <button type="button" class="badge bg-warning text-dark border-0" (click)="closeAllPopups()">
                    <fa-icon [icon]="faEyeSlash"></fa-icon>
                    <span class="ms-1">Close all popups</span>
                  </button>
                }
              </div>
              <div slot="bottom-overlay" class="map-overlay bottom-right">
                <div class="overlay-content">
                  <span class="badge bg-primary text-white border rounded-pill small fw-bold">
                    {{ walkCountText }}
                  </span>
                </div>
              </div>
            </app-map-overlay>
          }
        </div>
      </div>
    } @else {
      <div class="mt-3"></div>
    }
  `,
  imports: [LeafletModule, FormsModule, FontAwesomeModule, MapControlsComponent, MapOverlayComponent]
})
export class WalksMapViewComponent implements OnInit, OnChanges {
  @Input() filteredWalks: DisplayedWalk[] = [];
  @Input() loading = false;
  @Output() selected = new EventEmitter<DisplayedWalk>();
  @Output() autoShowAllChange = new EventEmitter<boolean>();
  public provider: MapProvider = "osm";
  public osStyle = "Leisure_27700";
  public osStyles: MapStyleInfo[] = OS_MAP_STYLE_LIST;
  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: true,
    showAutoShowAll: true,
    minHeight: 300,
    maxHeight: 900,
    heightStep: 10
  };
  public mapControlsState: MapControlsState = {
    provider: "osm",
    osStyle: "Leisure_27700",
    mapHeight: 520,
    smoothScroll: true,
    autoShowAll: false
  };
  public options: any;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  public showMap = true;
  public hasMarkers = false;
  public mapHeight = 520;
  public showControls = true;
  public autoShowAll = false;
  private clusterGroupRef: any;
  private allMarkers: L.Marker[] = [];
  public openPopupCount = 0;
  private lastValidCoords = 0;
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;
  public smoothScroll = true;
  private savedCenter: L.LatLng | null = null;
  private savedZoom: number | null = null;
  private preserveNextView = false;

  private logger: Logger = inject(LoggerFactory).createLogger("WalksMapViewComponent", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private distanceValidationService = inject(DistanceValidationService);
  private mediaQueryService = inject(MediaQueryService);
  private mapTiles = inject(MapTilesService);
  private popupService = inject(MapPopupService);
  private markerStyle = inject(MapMarkerStyleService);
  private urlService = inject(UrlService);
  private mapControlsStateService = inject(MapControlsStateService);
  private mapRecreation = inject(MapRecreationService);

  ngOnInit() {
    this.mapTiles.initializeProjections();

    const initialState = this.mapControlsStateService.queryInitialState({
      mapHeight: this.mapHeight,
      smoothScroll: this.smoothScroll,
      autoShowAll: this.autoShowAll
    });

    this.provider = initialState.provider;
    this.osStyle = initialState.osStyle;
    this.mapHeight = initialState.mapHeight || 520;
    this.smoothScroll = initialState.smoothScroll || true;
    this.autoShowAll = initialState.autoShowAll || false;
    this.showControls = this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true);

    this.mapControlsState = initialState;

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
    this.logger.info("rebuildMap START:provider:", this.provider, "osStyle:", this.osStyle, "savedZoom:", this.savedZoom);
    this.setupDefaultIcon();
    const base = this.mapTiles.createBaseLayer(this.provider, this.osStyle);
    this.logger.info("rebuildMap:base layer created for provider:", this.provider);
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


  get hasOsApiKey(): boolean { return this.mapTiles.hasOsApiKey(); }

  get walkCountText(): string {
    const total = this.filteredWalks?.length || 0;
    const withCoords = this.lastValidCoords;
    const missing = total - withCoords;

    if (total === 0) return "0 walks";
    if (missing === 0) return `${total} ${total === 1 ? "walk" : "walks"}`;

    return `${withCoords} ${withCoords === 1 ? "walk" : "walks"}${missing > 0 ? ` (${missing} missing location)` : ""}`;
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
      if (isNumber(lat) && isNumber(lng) && lat !== 0 && lng !== 0 && Math.abs(lat) > 0.001 && Math.abs(lng) > 0.001) {
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
    if (mc && isFunction(mc)) {
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
          try { (L as any).DomEvent?.stop?.(e.originalEvent); } catch (error) { this.logger.debug("DomEvent.stop failed", error); }
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



  onMapReady(map: L.Map) {
    this.logger.info("onMapReady:received map, invalidating size and fitting bounds");
    this.mapRef = map;

    map.on("moveend zoomend", () => {
      if (this.autoShowAll) {
        setTimeout(() => this.showAllVisiblePopups(), 300);
      }
      try { this.mapControlsStateService.saveZoom(map.getZoom()); } catch (error) { this.logger.debug("saveZoom failed", error); }
    });

    setTimeout(() => {
      this.mapRef?.invalidateSize(true);
      if (this.fitBounds && !this.preserveNextView) {
        this.mapRef?.fitBounds(this.normalizeBounds(this.fitBounds));
      }
      if (this.preserveNextView && this.savedCenter && this.savedZoom != null) {
        const targetZoom = Math.min(this.savedZoom, this.maxZoomForCurrentStyle());
        try { this.mapRef?.setView(this.savedCenter, targetZoom); } catch (error) { this.logger.debug("mapRef.setView failed", error); }
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
    const oldProvider = this.provider;

    this.provider = value;
    this.mapControlsState.provider = value;
    this.mapControlsStateService.saveProvider(value);

    this.savedZoom = undefined;
    this.savedCenter = undefined;
    this.preserveNextView = false;
    this.recreateMap(false);
  }

  onStyleChange(value: string) {
    this.osStyle = value;
    this.mapControlsState.osStyle = value;
    this.mapControlsStateService.saveOsStyle(value);
    this.recreateMap(true);
  }

  onHeightChange(value: number) {
    this.mapHeight = value;
    this.mapControlsState.mapHeight = value;
    this.mapControlsStateService.saveHeight(value);
    requestAnimationFrame(() => this.mapRef?.invalidateSize(true));
  }

  private recreateMap(preserveView?: boolean) {
    const context = {
      mapRef: this.mapRef,
      savedCenter: this.savedCenter,
      savedZoom: this.savedZoom,
      preserveNextView: this.preserveNextView,
      showMap: this.showMap,
      logger: this.logger,
      leafletLayers: this.leafletLayers,
      clusterGroupRef: this.clusterGroupRef,
      allMarkers: this.allMarkers,
      openPopupCount: this.openPopupCount,
      fitBounds: this.fitBounds,
      options: this.options
    };

    this.mapRecreation.recreateMap(
      context,
      {
        onRebuildMap: () => this.rebuildMap(),
        onSetShowMap: (show: boolean) => this.showMap = show
      },
      preserveView
    );

    this.mapRef = context.mapRef;
    this.savedCenter = context.savedCenter;
    this.savedZoom = context.savedZoom;
    this.preserveNextView = context.preserveNextView;
    this.showMap = context.showMap;
    this.leafletLayers = context.leafletLayers || [];
    this.clusterGroupRef = context.clusterGroupRef;
    this.allMarkers = context.allMarkers || [];
    this.openPopupCount = context.openPopupCount || 0;
    this.fitBounds = context.fitBounds;
    this.options = context.options;
  }

  onSmoothScrollChange(value: boolean) {
    this.smoothScroll = value;
    this.mapControlsState.smoothScroll = value;
    this.mapControlsStateService.saveSmoothScroll(value);
  }

  selectedStyleInfo(): MapStyleInfo | undefined {
    return this.osStyles.find(s => s.key === this.osStyle);
  }


  toggleControls() {
    this.showControls = !this.showControls;
    this.mapControlsStateService.saveShowControls(this.showControls);
  }

  onAutoShowAllChange(value: boolean) {
    this.autoShowAll = value;
    this.mapControlsState.autoShowAll = value;
    this.mapControlsStateService.saveAutoShowAll(value);
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
          try { marker.openPopup(); } catch (error) { this.logger.debug("marker.openPopup failed", error); }
        }, index * 50);
      }
    });
  }

  closeAllPopups() {
    if (this.mapRef) { try { this.mapRef.closePopup(); } catch (error) { this.logger.debug("mapRef.closePopup failed", error); } }

    if (this.clusterGroupRef && isFunction(this.clusterGroupRef.eachLayer)) {
      try {
        this.clusterGroupRef.eachLayer((layer: any) => {
          if (layer.closePopup && isFunction(layer.closePopup)) { layer.closePopup(); }
        });
      } catch (error) { this.logger.debug("clusterGroupRef.eachLayer closePopup failed", error); }
    }

    this.allMarkers.forEach(marker => {
      try { if (marker.isPopupOpen && marker.isPopupOpen()) { marker.closePopup(); } }
      catch (error) { this.logger.debug("marker.closePopup failed", error); }
    });

    this.openPopupCount = 0;
  }
}
