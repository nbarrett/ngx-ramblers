import {
  Component,
  DoCheck,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges
} from "@angular/core";
import * as L from "leaflet";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import {
  MapData,
  MapMarker,
  MapRoute,
  PageContent,
  PageContentRow,
  PaletteColor
} from "../../../models/content-text.model";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { GpxParserService, GpxTrack, GpxWaypoint } from "../../../services/maps/gpx-parser.service";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, from, Observable, of, Subject } from "rxjs";
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from "rxjs/operators";
import { UrlService } from "../../../services/url.service";
import { FileNameData, ServerFileNameData } from "../../../models/aws-object.model";
import { MapControls, MapControlsConfig, MapControlsState } from "../../../shared/components/map-controls";
import { MapOverlay } from "../../../shared/components/map-overlay";
import { MapProvider, MapRouteViewModel, RouteGpxData, TrackWithBounds } from "../../../models/map.model";
import { isUndefined } from "es-toolkit/compat";
import { MarkdownComponent } from "ngx-markdown";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { AsyncPipe, NgClass } from "@angular/common";
import { faExclamationTriangle, faSearch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { AlertModule } from "ngx-bootstrap/alert";
import { FormsModule } from "@angular/forms";
import { AutocompleteSuggestion, SpatialFeaturesService } from "../../../services/spatial-features.service";
import { AddressQueryService } from "../../../services/walks/address-query.service";
import { GeocodeResult } from "../../../models/map.model";
import { NgOptionTemplateDirective, NgSelectComponent } from "@ng-select/ng-select";
import { NumberUtilsService } from "../../../services/number-utils.service";

@Component({
  selector: "app-dynamic-content-view-map",
  styles: [`
    .map-wrapper
      position: relative

    .map-controls-docked
      border-bottom: 1px solid #dee2e6
      margin-bottom: 0 !important
      position: relative
      z-index: 1000

    .map-controls-overlap
      margin-top: -15px
      border-top-left-radius: 0 !important
      border-top-right-radius: 0 !important

    .map-text
      margin-bottom: 1rem

    .map-stack
      overflow: hidden
      border-radius: 0.5rem
      background: #fff

    .map-card
      border: none

    .map-stack.has-route-panel .map-card
      border-bottom-left-radius: 0 !important
      border-bottom-right-radius: 0 !important

    .route-panel
      background: #fff
      padding: 1rem

    .route-panel.has-header
      border-top: 1px solid #f1f1f1
      border-top-left-radius: 0
      border-top-right-radius: 0

    .route-panel.attached
      border-bottom-left-radius: 0.5rem
      border-bottom-right-radius: 0.5rem

    .route-panel-row + .route-panel-row
      border-top: 1px solid #f1f1f1
      margin-top: 0.75rem
      padding-top: 0.75rem

    .route-panel-header
      border-bottom: 1px solid #f1f1f1
      padding-bottom: 0.5rem
      margin-bottom: 0.75rem

    .route-color-box
      width: 30px
      height: 6px
      border-radius: 4px

    .route-count-badge
      background-color: var(--ramblers-colour-sunrise)
      color: #3c2a00
      font-weight: 600
      border-radius: 999px
      padding: 0.35rem 0.75rem

    .route-download-btn
      display: inline-flex
      align-items: center
      justify-content: center
      padding: 0.4rem 0.85rem
      min-width: 70px
      background-color: var(--ramblers-colour-sunrise)
      border-color: var(--ramblers-colour-sunrise)
      color: #3c2a00
      font-weight: 600
      line-height: 1

    .route-download-btn:hover,
    .route-download-btn:focus
      background-color: var(--ramblers-colour-sunrise)
      border-color: var(--ramblers-colour-sunrise)
      color: #3c2a00
      filter: brightness(0.92)

    .route-name
      font-size: 0.875rem
    .map-loading-overlay
      position: absolute
      inset: 0
      background: rgba(255, 255, 255, 0.85)
      display: flex
      align-items: center
      justify-content: center
      border-radius: 0.5rem

    :host ::ng-deep .leaflet-control-attribution
      font-size: 0.75rem

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

    :host ::ng-deep .route-arrow-icon
      pointer-events: none
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35))

    :host ::ng-deep .route-arrow
      display: inline-flex
      align-items: center
      justify-content: center
      transform-origin: center center

    :host ::ng-deep .route-arrow svg
      display: block

    :host ::ng-deep .route-arrow path,
    :host ::ng-deep .route-arrow polygon
      fill: #fff
      stroke: #fff

    :host ::ng-deep .waypoint-marker
      background: transparent
      border: none

    :host ::ng-deep .waypoint-marker .marker-pin
      width: 26px
      height: 26px
      border-radius: 50% 50% 50% 0
      background: #204f3d
      border: 3px solid #fff
      transform: rotate(-45deg)
      display: flex
      align-items: center
      justify-content: center
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.35)

    :host ::ng-deep .waypoint-marker .marker-dot
      width: 8px
      height: 8px
      border-radius: 50%
      background: #fff

  `],
  template: `
    @if (row?.map) {
      <div [class]="actions.rowClasses(row)">
        @if (row.map.text) {
          <div class="map-text" markdown [data]="row.map.text"></div>
        }

        @if (!hasVisibleRoutes && !loadingRoutes) {
          <div class="alert alert-warning">
            No visible routes to display
          </div>
        } @else {
          <div class="map-section">
            @if (showControls) {
              <div class="rounded-top img-thumbnail p-2 map-controls-docked">
                <app-map-controls
                  [config]="mapControlsConfig"
                  [state]="mapControlsState"
                  (providerChange)="onProviderChange($event)"
                  (styleChange)="onStyleChange($event)"
                  (heightChange)="onHeightChange($event)">
                </app-map-controls>
              </div>
            }
            <div [class]="showControls ? 'map-controls-overlap' : 'rounded'">
              <div class="map-stack shadow" [class.has-route-panel]="hasRoutePanel">
                <div class="map-wrapper">
                  @if (loadingRoutes || !options) {
                    <div class="card d-flex align-items-center justify-content-center map-card"
                         [ngClass]="hasRoutePanel ? 'rounded-top' : 'rounded'"
                         [style.height.px]="mapHeight">
                      <div class="spinner-border text-secondary" role="status">
                        <span class="visually-hidden">Loading…</span>
                      </div>
                    </div>
                  } @else if (showMap) {
                    <div class="card position-relative map-card"
                         [ngClass]="hasRoutePanel ? 'rounded-top' : 'rounded'"
                         [style.height.px]="mapHeight"
                         leaflet
                         [leafletOptions]="options"
                         [leafletLayers]="leafletLayers"
                         [leafletFitBounds]="fitBounds"
                         (leafletMapReady)="onMapReady($event)">
                      @if (loadingRoutes) {
                        <div class="map-loading-overlay">
                          <div class="spinner-border text-secondary" role="status">
                            <span class="visually-hidden">Loading map…</span>
                          </div>
                        </div>
                      }
                    </div>
                    <app-map-overlay
                      [showControls]="showControls"
                      [allowToggle]="allowControlsToggle"
                      [showWaypoints]="showWaypoints"
                      [allowWaypointsToggle]="allowWaypointsToggle"
                      (toggleControls)="toggleControls()"
                      (toggleWaypoints)="toggleWaypoints()">
                      <div slot="bottom-overlay" class="map-overlay bottom-right">
                        <div class="overlay-content">
                        <span class="badge bg-primary text-white border rounded-pill small fw-bold">
                          {{ routeCountText }}
                        </span>
                        </div>
                      </div>
                    </app-map-overlay>
                  }
                </div>
                @if (hasRoutePanel) {
                  <div class="route-panel attached has-header">
                    @if (hasLargeDatasetWarning()) {
                      <alert type="warning" class="m-3">
                        <fa-icon [icon]="faExclamationTriangle" class="me-2"/>
                        <strong>Large Dataset Warning:</strong>
                        <span class="ms-1">Some routes contain thousands of individual paths. Consider using the search box below to find specific paths.</span>
                      </alert>
                    }
                    @if (hasLargeDatasetWarning()) {
                      <div class="m-3">
                        <div class="mt-3">
                          <label [for]="stringUtils.kebabCase('location-search', uniqueId)">
                            <small class="text-muted mt-1 d-block">
                              <fa-icon [icon]="faSearch" class="me-1"></fa-icon>
                              UK postcode (e.g. CT1 1AA) or address (e.g. Canterbury)
                            </small></label>
                          <div class="input-group">
                            <ng-select [id]="stringUtils.kebabCase('location-search', uniqueId)"
                                       [items]="locationSuggestions$ | async"
                                       [typeahead]="locationInput$"
                                       [loading]="locationLoading"
                                       [multiple]="false"
                                       [searchable]="true"
                                       [clearable]="true"
                                       [minTermLength]="3"
                                       bindLabel="label"
                                       placeholder="Enter postcode or address..."
                                       class="flex-grow-1"
                                       [(ngModel)]="selectedLocation"
                                       (ngModelChange)="onLocationSelected($event)">
                              <ng-template ng-option-tmp let-item="item">
                                <div>
                                  <strong>{{ item.label }}</strong>
                                  @if (item.type) {
                                    <small class="text-muted ms-2">({{ item.type }})</small>
                                  }
                                </div>
                              </ng-template>
                            </ng-select>
                          </div>
                        </div>
                        <div class="mt-3">
                          <label [for]="stringUtils.kebabCase('search-term', uniqueId)">
                            Path Match</label>
                          <ng-select [id]="stringUtils.kebabCase('search-term', uniqueId)"
                                     [items]="autocompleteSuggestions$ | async"
                                     [typeahead]="autocompleteInput$"
                                     [loading]="autocompleteLoading"
                                     [multiple]="false"
                                     [searchable]="true"
                                     [clearable]="true"
                                     [minTermLength]="1"
                                     [hideSelected]="true"
                                     bindLabel="label"
                                     placeholder="Search paths by name or number..."
                                     [(ngModel)]="selectedPath"
                                     (ngModelChange)="onPathSelected($event)">
                            <ng-template ng-option-tmp let-item="item">
                              <div class="d-flex justify-content-between align-items-center">
                                <div>
                                  <strong>{{ item.label }}</strong>
                                  @if (item.description) {
                                    <small class="text-muted d-block">{{ item.description }}</small>
                                  }
                                </div>
                                @if (item.type) {
                                  <span class="badge badge-secondary">{{ item.type }}</span>
                                }
                              </div>
                            </ng-template>
                          </ng-select>
                        </div>
                        @if (searchTerm && searchMatchCount >= 0) {
                          <small class="text-muted mt-1 d-block">
                            {{ searchMatchCount }} paths match "{{ searchTerm }}"</small>
                        }
                      </div>
                    }
                    <div class="route-panel-header row align-items-center text-muted small fw-semibold">
                      <div class="col-md-8 d-flex align-items-center gap-2 text-dark">
                        <h6 class="mb-0">Routes</h6>
                      </div>
                      <div class="col-md-2 text-md-center">Visibility</div>
                      <div class="col-md-2 text-md-end">Downloads</div>
                    </div>
                    @for (route of allRoutes; track route.id) {
                      <div class="route-panel-row row align-items-center gy-2">
                        <div class="col-md-8 d-flex align-items-center gap-2">
                          <div class="route-color-box flex-shrink-0"
                               [style.backgroundColor]="route.color || roseColor"></div>
                          <div class="fw-semibold flex-grow-1">
                            {{ route.name }}
                            @if (route.featureCount && route.featureCount > 100) {
                              <span class="badge badge-mintcake ms-2">
                                @if (useViewportFiltering && routeVisibleCounts.has(route.id)) {
                                  {{ routeVisibleCounts.get(route.id)!.toLocaleString() }} of {{ route.featureCount.toLocaleString() }} in view
                                } @else if (route.featureCount > 500) {
                                  500 of {{ route.featureCount.toLocaleString() }} paths
                                } @else {
                                  {{ route.featureCount.toLocaleString() }} paths
                                }
                              </span>
                            }
                          </div>
                        </div>
                        <div class="col-md-2">
                          <div class="form-check m-0">
                            <input class="form-check-input"
                                   type="checkbox"
                                   [id]="routeVisibilityId(route.id)"
                                   [checked]="isRouteVisible(route.id)"
                                   (change)="onRouteVisibilityToggle(route, $event)">
                            <label class="form-check-label" [for]="routeVisibilityId(route.id)">
                              Show
                            </label>
                          </div>
                        </div>
                        <div class="col-md-2 text-md-end">
                          <div class="d-inline-flex flex-wrap gap-2 justify-content-md-end">
                            @if (fileDownloadUrl(route.gpxFile)) {
                              <a class="btn btn-sm route-download-btn"
                                 [href]="fileDownloadUrl(route.gpxFile)"
                                 [download]="stringUtils.kebabCase(route.name) + '.gpx'">
                                GPX
                              </a>
                            }
                            @if (fileDownloadUrl(route.esriFile)) {
                              <a class="btn btn-sm route-download-btn"
                                 [href]="fileDownloadUrl(route.esriFile)"
                                 [download]="stringUtils.kebabCase(route.name) + '.zip'">
                                ESRI
                              </a>
                            }
                            @if (!fileDownloadUrl(route.gpxFile) && !fileDownloadUrl(route.esriFile)) {
                              <span class="text-muted small">No download available</span>
                            }
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
  imports: [LeafletModule, MapControls, MapOverlay, MarkdownComponent, NgClass, FontAwesomeModule, AlertModule, FormsModule, NgSelectComponent, AsyncPipe, NgOptionTemplateDirective]
})
export class DynamicContentViewMap implements OnInit, OnChanges, OnDestroy, DoCheck {
  @Input() row!: PageContentRow;
  @Input() refreshKey?: number;
  @Input() editing = false;
  @Input() pageContent?: PageContent;
  @Output() mapConfigChange = new EventEmitter<Partial<MapData>>();
  protected faExclamationTriangle = faExclamationTriangle;
  protected faSearch = faSearch;
  protected faTimes = faTimes;
  public searchTerm = "";
  public searchMatchCount = -1;
  private lastAutoFitSearchTerm = "";
  public autocompleteInput$ = new Subject<string>();
  public autocompleteSuggestions$!: Observable<AutocompleteSuggestion[]>;
  public autocompleteLoading = false;
  public locationInput$ = new Subject<string>();
  public locationSuggestions$!: Observable<GeocodeResult[]>;
  public locationLoading = false;
  public selectedLocation: GeocodeResult | null = null;
  public selectedPath: AutocompleteSuggestion | null = null;
  public numberUtils = inject(NumberUtilsService);
  private logger: Logger = inject(LoggerFactory).createLogger("DynamicContentViewMap", NgxLoggerLevel.ERROR);
  private mapTiles = inject(MapTilesService);
  private mapMarkerStyle = inject(MapMarkerStyleService);
  private gpxParser = inject(GpxParserService);
  private http = inject(HttpClient);
  private urlService = inject(UrlService);
  private mapTilesService = inject(MapTilesService);
  public stringUtils = inject(StringUtilsService);
  private spatialFeaturesService = inject(SpatialFeaturesService);
  private addressQueryService = inject(AddressQueryService);
  public actions = inject(PageContentActionsService);
  public options: L.MapOptions | undefined;
  public leafletLayers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  private mapRef: L.Map | undefined;
  private mapLoadHandler = () => this.handleMapLoadComplete();
  private sessionMapCenter: [number, number] | undefined;
  private sessionMapZoom: number | undefined;
  public showMap = false;
  public visibleRoutes: MapRouteViewModel[] = [];
  public allRoutes: MapRouteViewModel[] = [];
  public hasRoutePanel = false;
  public hasVisibleRoutes = false;
  public loadingRoutes = false;
  public showControls = true;
  public allowControlsToggle = true;
  public showWaypoints = true;
  public allowWaypointsToggle = true;
  public useViewportFiltering = true;
  public mapHeight = 500;
  public routeCountText = "";
  private routeData: Map<string, RouteGpxData> = new Map();
  private lastRoutesSignature: string | undefined;
  private routeVisibility: Map<string, boolean> = new Map();
  protected routeVisibleCounts: Map<string, number> = new Map();
  protected uniqueId = this.numberUtils.generateUid();

  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false
  };

  public mapControlsState: MapControlsState = {
    provider: "osm",
    osStyle: "Leisure_27700",
    mapHeight: 500
  };

  private componentReady = false;
  private mapViewChangeHandler = () => this.captureMapView();
  public roseColor = PaletteColor.ROSE;

  async ngOnInit() {
    this.mapTiles.initializeProjections();
    this.setupAutocomplete();
    this.setupLocationSearch();
    this.componentReady = true;
    await this.refreshFromInput();
  }

  private setupAutocomplete() {
    this.autocompleteSuggestions$ = this.autocompleteInput$.pipe(
      tap(term => this.logger.info(`Autocomplete input: "${term}"`)),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.autocompleteLoading = true),
      switchMap(term => {
        if (!term || term.length < 1) {
          this.logger.info("Autocomplete skipped: query too short");
          this.autocompleteLoading = false;
          return of([]);
        }

        const routesWithSpatialData = this.visibleRoutes.filter(route => route.spatialRouteId);
        if (routesWithSpatialData.length === 0) {
          this.logger.info("Autocomplete skipped: no routes with spatial data");
          this.autocompleteLoading = false;
          return of([]);
        }

        const firstRoute = routesWithSpatialData[0];
        this.logger.info(`Querying autocomplete for "${term}" on route: ${firstRoute.name}`);

        return this.spatialFeaturesService.autocomplete(firstRoute.spatialRouteId!, term).pipe(
          map(suggestions => {
            this.logger.info(`Autocomplete returned ${suggestions.length} suggestions:`, suggestions.map(s => s.label));
            this.autocompleteLoading = false;
            return suggestions;
          }),
          catchError(error => {
            this.logger.error("Autocomplete error:", error);
            this.autocompleteLoading = false;
            return of([]);
          })
        );
      })
    );
  }

  private setupLocationSearch() {
    this.locationSuggestions$ = this.locationInput$.pipe(
      tap(term => this.logger.info(`Location search input: "${term}"`)),
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.locationLoading = true),
      switchMap(term => {
        if (!term || term.length < 3) {
          this.locationLoading = false;
          return of([]);
        }

        const ukPostcodeRegex = /^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i;
        if (ukPostcodeRegex.test(term.trim())) {
          this.logger.info(`Searching postcode: ${term}`);
          return from(this.addressQueryService.gridReferenceLookup(term)).pipe(
            map(response => [{
              label: response.description || response.postcode || term,
              lat: response.latlng?.lat || 0,
              lng: response.latlng?.lng || 0
            }]),
            tap(results => this.logger.info(`Postcode found:`, results)),
            catchError(error => {
              this.logger.warn("Postcode not found, trying place name search:", error);
              return from(this.addressQueryService.placeNameLookup(term)).pipe(
                map(response => [{
                  label: response.description || term,
                  lat: response.latlng?.lat || 0,
                  lng: response.latlng?.lng || 0
                }])
              );
            }),
            tap(() => this.locationLoading = false)
          );
        }

        this.logger.info(`Searching address: ${term}`);
        return from(this.addressQueryService.placeNameLookup(term)).pipe(
          map(response => [{
            label: response.description || term,
            lat: response.latlng?.lat || 0,
            lng: response.latlng?.lng || 0
          }]),
          tap(results => this.logger.info(`Address search returned ${results.length} results`)),
          tap(() => this.locationLoading = false),
          catchError(error => {
            this.logger.error("Location search error:", error);
            this.locationLoading = false;
            return of([]);
          })
        );
      })
    );
  }

  onPathSelected(suggestion: AutocompleteSuggestion | null) {
    if (!suggestion) {
      this.searchTerm = "";
      this.lastAutoFitSearchTerm = "";
      this.onSearchChange();
      return;
    }

    this.logger.info(`Path selected:`, suggestion);
    this.searchTerm = suggestion.value.trim();
    this.onSearchChange();
  }

  onLocationSelected(location: GeocodeResult | null) {
    if (!location || !this.mapRef) {
      return;
    }

    this.logger.info(`Jumping to location:`, location);
    this.sessionMapCenter = [location.lat, location.lng];
    this.sessionMapZoom = 15;
    this.mapRef.setView(this.sessionMapCenter, this.sessionMapZoom);
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.componentReady) {
      if ((changes["row"] && !changes["row"].firstChange)
        || (changes["refreshKey"] && !changes["refreshKey"].firstChange)) {
        this.logger.info(changes, "refreshFromInput called");
        await this.refreshFromInput();
      } else {
        this.logger.info("componentReady:true:changes:", changes, "changes not of right type - refreshFromInput not called");
      }
    } else {
      this.logger.info("componentReady:false:changes:", changes, "refreshFromInput not called");
    }
  }

  ngDoCheck() {
    if (!this.row?.map) {
      return;
    }
    const signature = this.routesSignature();
    if (this.componentReady && signature !== this.lastRoutesSignature) {
      this.logger.info("ngDoCheck: route signature changed");
      this.syncAllRoutes(false, signature);
      this.recalculateRouteVisibility();
      if (this.options) {
        this.loadingRoutes = true;
        void this.loadRoutes();
      }
    }
  }

  ngOnDestroy() {
    this.detachMapListeners();
  }

  private async refreshFromInput() {
    this.resetState();
    this.initializeRoutes();
    await this.initialiseMap();
  }

  private resetState() {
    this.detachMapListeners();
    this.options = undefined;
    this.leafletLayers = [];
    this.fitBounds = undefined;
    this.mapRef = undefined;
    this.showMap = false;
    this.visibleRoutes = [];
    this.hasVisibleRoutes = false;
    this.loadingRoutes = true;
    this.mapHeight = 500;
    this.routeCountText = "";
    this.showControls = true;
    this.allowControlsToggle = true;
    this.routeData.clear();
    this.routeVisibility.clear();
    this.allRoutes = [];
    this.hasRoutePanel = false;
    this.logger.info("resetState: Complete - loadingRoutes:", this.loadingRoutes, "options:", this.options);
  }

  private initializeRoutes() {
    this.mapTilesService.syncMarkersFromLocation(this.pageContent, this.row);
    this.refreshRouteCollections(true);
    this.mapHeight = this.row.map?.mapHeight || 500;
    const provider = (this.row.map?.provider || "osm") as MapProvider;
    const osStyle = this.row.map?.osStyle || "Leisure_27700";
    this.allowControlsToggle = this.row.map?.allowControlsToggle !== false;
    const showDefault = this.row.map?.showControlsDefault;
    this.showControls = isUndefined(showDefault) ? true : showDefault;
    this.allowWaypointsToggle = this.row.map?.allowWaypointsToggle !== false;
    const showWaypointsDefault = this.row.map?.showWaypointsDefault;
    this.showWaypoints = isUndefined(showWaypointsDefault) ? true : showWaypointsDefault;
    this.mapControlsState = {
      provider,
      osStyle,
      mapHeight: this.mapHeight
    };
  }

  private refreshRouteCollections(resetVisibility: boolean) {
    const signature = this.routesSignature();
    this.syncAllRoutes(resetVisibility, signature);
    this.recalculateRouteVisibility();
  }

  private syncAllRoutes(resetVisibility: boolean, signature?: string) {
    const routes = this.row.map?.routes || [];
    if (resetVisibility) {
      this.routeVisibility.clear();
    }
    const ids = new Set(routes.map(route => route.id));
    for (const key of Array.from(this.routeVisibility.keys())) {
      if (!ids.has(key)) {
        this.routeVisibility.delete(key);
      }
    }
    this.allRoutes = routes.map(route => {
      if (!this.routeVisibility.has(route.id)) {
        this.routeVisibility.set(route.id, route.visible !== false);
      }
      return {...route, gpxFileUrl: this.routeUrl(route)};
    });
    this.hasRoutePanel = this.allRoutes.length > 0;
    this.lastRoutesSignature = signature ?? this.routesSignature();
  }

  private recalculateRouteVisibility() {
    const markers = (this.row.map?.markers || []).filter(m => m.latitude != null && m.longitude != null);
    this.visibleRoutes = this.allRoutes.filter(route => this.routeVisibility.get(route.id) !== false);
    this.hasVisibleRoutes = this.visibleRoutes.length > 0 || markers.length > 0;
    this.routeCountText = this.stringUtils.pluraliseWithCount(this.visibleRoutes.length, "route");
  }

  private async initialiseMap() {
    if (!this.row.map) {
      this.logger.info("initialiseMap: No map data");
    } else if (!this.hasVisibleRoutes) {
      this.logger.info("initialiseMap: No visible routes or markers");
      this.showMap = false;
    } else {
      this.logger.info("initialiseMap: Start - loadingRoutes=true, options=undefined");
      this.loadingRoutes = true;
      this.options = undefined;
      this.logger.info("initialiseMap: About to load routes (spinner should show)");
      await this.loadRoutes();
      this.logger.info("initialiseMap: Routes loaded, creating map options");
      const provider = this.mapControlsState.provider;
      const style = this.mapControlsState.osStyle;
      const base = this.mapTiles.createBaseLayer(provider, style);
      const crs = this.mapTiles.crsForStyle(provider, style);
      const maxZoom = this.mapTiles.maxZoomForStyle(provider, style);
      const hasSavedPosition = this.row.map.mapCenter && this.row.map.mapZoom;
      const hasSessionPosition = this.sessionMapCenter && this.sessionMapZoom;
      const willAutoFit = !isUndefined(this.fitBounds);
      const useDefaultPosition = !hasSavedPosition || willAutoFit;

      const zoom = hasSessionPosition ? this.sessionMapZoom : (useDefaultPosition ? 10 : this.row.map.mapZoom);
      const center = hasSessionPosition
        ? L.latLng(this.sessionMapCenter[0], this.sessionMapCenter[1])
        : (useDefaultPosition ? L.latLng(51.25, 0.75) : L.latLng(this.row.map.mapCenter[0], this.row.map.mapCenter[1]));

      this.logger.info(`initialiseMap: Position decision - hasSessionPosition=${hasSessionPosition}, hasSavedPosition=${hasSavedPosition}, sessionCenter=${this.sessionMapCenter}, sessionZoom=${this.sessionMapZoom}, using center=${center}, zoom=${zoom}`);

      this.options = {
        layers: [base],
        zoom,
        center,
        crs,
        maxZoom,
        zoomSnap: 0.1,
        zoomDelta: 0.5
      };
      this.logger.info("initialiseMap: Complete - useDefaultPosition:", useDefaultPosition, "willAutoFit:", willAutoFit, "options set, map should appear");
    }
  }

  private async loadRoutes() {
    this.logger.info("loadRoutes: Start - hasVisibleRoutes:", this.hasVisibleRoutes);
    if (!this.hasVisibleRoutes) {
      this.showMap = false;
      this.leafletLayers = [];
      this.loadingRoutes = false;
      this.logger.info("loadRoutes: No visible routes, setting loadingRoutes=false");
      return;
    }

    const desiredRouteIds = new Set(this.visibleRoutes.map(route => route.id));
    for (const routeId of Array.from(this.routeData.keys())) {
      if (!desiredRouteIds.has(routeId)) {
        this.routeData.delete(routeId);
      }
    }

    const routeLayers: L.Layer[] = [];

    this.logger.info("loadRoutes: Loading", this.visibleRoutes.length, "routes (spinner should still be showing)");

    const currentBounds = this.mapRef?.getBounds();
    const maxTracksWithoutFiltering = 500;

    const allRouteLayers = await Promise.all(
      this.visibleRoutes.map(async route => {
        const gpxData = await this.routeDataForRoute(route);
        if (!gpxData?.tracksWithBounds || gpxData.tracksWithBounds.length === 0) {
          this.routeVisibleCounts.set(route.id, 0);
          return [];
        }

        let tracksToRender = gpxData.tracksWithBounds;

        if (this.searchTerm && this.searchTerm.trim().length > 0) {
          tracksToRender = tracksToRender.filter(twb => this.matchesSearch(twb.track));
        }

        if (this.useViewportFiltering && currentBounds) {
          tracksToRender = tracksToRender.filter(twb => currentBounds.intersects(twb.bounds));
        } else {
          tracksToRender = tracksToRender.slice(0, maxTracksWithoutFiltering);
        }

        this.routeVisibleCounts.set(route.id, tracksToRender.length);
        this.searchMatchCount = this.searchTerm ? tracksToRender.length : -1;

        this.logger.info(`loadRoutes: Rendering ${tracksToRender.length} of ${gpxData.totalFeatures} tracks for ${route.name} (viewport filtering: ${this.useViewportFiltering})`);

        return tracksToRender
          .map(twb => this.createRouteLayer(twb.track, gpxData.waypoints, route))
          .filter((layer): layer is L.Layer => layer !== null);
      })
    );

    routeLayers.push(...allRouteLayers.flat());

    const markers = this.row.map?.markers || [];
    const markerLayers = this.createStandaloneMarkers(markers);
    const allLayers = [...routeLayers, ...markerLayers];
    const hasContent = allLayers.length > 0;

    if (hasContent) {
      this.leafletLayers = allLayers;
      const hasSavedPosition = this.row.map?.mapCenter && this.row.map?.mapZoom;
      const shouldAutoFit = this.row.map?.autoFitBounds !== false;
      const hasActiveSearch = this.searchTerm && this.searchTerm.trim().length > 0;
      this.logger.info("loadRoutes: Auto-fit check - shouldAutoFit:", shouldAutoFit, "hasSavedPosition:", hasSavedPosition, "hasActiveSearch:", hasActiveSearch, "autoFitBounds setting:", this.row.map?.autoFitBounds);
      if (!hasActiveSearch && (shouldAutoFit || !hasSavedPosition)) {
        this.calculateFitBounds();
      this.logger.info("loadRoutes: Calculated fitBounds:", this.fitBounds ? `${this.fitBounds.getSouthWest()} to ${this.fitBounds.getNorthEast()}` : "none");
      }
      this.showMap = true;
      this.logger.info("loadRoutes: Map ready to display (routes:", routeLayers.length, "markers:", markerLayers.length, ") - showMap=true");
      this.updateMapSize();
      this.loadingRoutes = false;
    } else {
      this.showMap = false;
      this.logger.info("loadRoutes: No layers or markers, hiding map");
      this.loadingRoutes = false;
    }
  }

  routeVisibilityId(routeId: string): string {
    return `route-visible-${routeId}`;
  }

  isRouteVisible(routeId: string): boolean {
    return this.routeVisibility.get(routeId) !== false;
  }

  hasLargeDatasetWarning(): boolean {
    return this.allRoutes.some(route => route.featureCount && route.featureCount > 1000);
  }

  onSearchChange() {
    this.logger.info("Search term changed:", this.searchTerm);
    this.visibleRoutes.forEach(route => {
      if (route.spatialRouteId) {
        this.routeData.delete(route.id);
      }
    });
    void this.loadRoutes();
  }

  clearSearch() {
    this.searchTerm = "";
    this.searchMatchCount = -1;
    this.lastAutoFitSearchTerm = "";
    this.visibleRoutes.forEach(route => {
      if (route.spatialRouteId) {
        this.routeData.delete(route.id);
      }
    });
    void this.loadRoutes();
  }

  private matchesSearch(track: any): boolean {
    if (!this.searchTerm || this.searchTerm.trim().length === 0) {
      return true;
    }
    const searchLower = this.searchTerm.toLowerCase().trim();
    const trackName = (track.name || "").toLowerCase();
    const trackDescription = (track.description || "").toLowerCase();
    return trackName.includes(searchLower) || trackDescription.includes(searchLower);
  }

  onRouteVisibilityToggle(route: MapRouteViewModel, event: Event) {
    const target = event.target as HTMLInputElement;
    this.routeVisibility.set(route.id, target.checked);
    this.recalculateRouteVisibility();
    this.loadingRoutes = true;
    void this.loadRoutes();
    const targetRoute = this.row.map?.routes.find(route => route.id === route.id);
    if (targetRoute) {
      targetRoute.visible = target.checked;
      this.logger.info("routeVisibility for:", route.id, "is:", targetRoute.visible);
      if (this.editing) {
        this.mapConfigChange.emit({routes: this.row.map.routes});
      }
    } else {
      this.logger.info("could not find route for:", route.id);
    }
    this.lastRoutesSignature = this.routesSignature();
  }

  private async routeDataForRoute(route: MapRouteViewModel): Promise<RouteGpxData | undefined> {
    if (this.routeData.has(route.id)) {
      return this.routeData.get(route.id);
    }

    if (route.spatialRouteId) {
      return this.loadSpatialFeaturesFromMongoDB(route);
    }

    if (!route.gpxFileUrl) {
      this.logger.warn("Route has no GPX file URL:", route);
      return undefined;
    }

    try {
      const gpxContent = await firstValueFrom(
        this.http.get(route.gpxFileUrl, {responseType: "text"})
      );
      const parsedGpx = this.gpxParser.parseGpxFile(gpxContent);

      if (parsedGpx.tracks.length > 0) {
        let currentBounds: L.LatLngBounds | undefined;
        try {
          currentBounds = this.mapRef?.getBounds();
        } catch (error) {
          this.logger.warn("Map not fully initialized, skipping bounds check:", error);
        }
        const startTime = Date.now();

        const tracksWithBounds: TrackWithBounds[] = parsedGpx.tracks.map(track => {
          const latLngs = this.gpxParser.toLeafletLatLngs(track);
          const bounds = L.latLngBounds(latLngs);
          return { track, bounds };
        });

        const processingTime = Date.now() - startTime;
        this.logger.info(`Processed ${parsedGpx.tracks.length} tracks in ${processingTime}ms for ${route.name}`);

        if (currentBounds && this.useViewportFiltering) {
          const inViewCount = tracksWithBounds.filter(twb => currentBounds.intersects(twb.bounds)).length;
          this.logger.info(`${inViewCount} of ${parsedGpx.tracks.length} tracks in viewport`);
        }

        const gpxData: RouteGpxData = {
          tracks: parsedGpx.tracks,
          tracksWithBounds,
          waypoints: parsedGpx.waypoints || [],
          totalFeatures: parsedGpx.tracks.length
        };
        this.routeData.set(route.id, gpxData);
        return gpxData;
      }
    } catch (error) {
      this.logger.error("Failed to load GPX file:", route.gpxFileUrl, error);
    }

    return undefined;
  }

  private async loadSpatialFeaturesFromMongoDB(route: MapRouteViewModel): Promise<RouteGpxData | undefined> {
    if (!route.spatialRouteId || !this.mapRef) {
      return undefined;
    }

    try {
      const currentBounds = this.mapRef.getBounds();
      const bounds = {
        southwest: {lat: currentBounds.getSouth(), lng: currentBounds.getWest()},
        northeast: {lat: currentBounds.getNorth(), lng: currentBounds.getEast()}
      };

      const startTime = Date.now();
      const response = await firstValueFrom(
        this.spatialFeaturesService.queryViewport(route.spatialRouteId, bounds, this.searchTerm)
      );
      const queryTime = Date.now() - startTime;

      this.logger.info(`MongoDB query returned ${response.features.length} features in ${queryTime}ms for ${route.name}`);

      const tracksWithBounds: TrackWithBounds[] = response.features.map(feature => {
        let coordinates: number[][];

        if (feature.geometry.type === "Point") {
          coordinates = [feature.geometry.coordinates as number[]];
        } else if (feature.geometry.type === "LineString") {
          coordinates = feature.geometry.coordinates as number[][];
        } else if (feature.geometry.type === "MultiLineString") {
          coordinates = (feature.geometry.coordinates as number[][][])[0] || [];
        } else {
          coordinates = [];
        }

        const points = coordinates.map(([lng, lat]) => ({latitude: lat, longitude: lng}));
        const latLngs = points.map(p => L.latLng(p.latitude, p.longitude));
        const bounds = L.latLngBounds(latLngs);

        const track: GpxTrack = {
          name: feature.name || route.name,
          description: feature.description,
          points
        };

        return {track, bounds};
      });

      const gpxData: RouteGpxData = {
        tracks: tracksWithBounds.map(twb => twb.track),
        tracksWithBounds,
        waypoints: [],
        totalFeatures: route.featureCount || response.totalCount
      };

      this.routeData.set(route.id, gpxData);
      return gpxData;
    } catch (error) {
      this.logger.error("Failed to load spatial features from MongoDB:", error);
      return undefined;
    }
  }

  private mergeGpxTracks(tracks: GpxTrack[]): GpxTrack {
    if (tracks.length === 1) {
      return tracks[0];
    }

    const allPoints = tracks.flatMap(t => t.points);
    const descriptions = tracks.map(t => t.description).filter(Boolean);
    const elevations = tracks
      .flatMap(t => [t.minElevation, t.maxElevation])
      .filter((e): e is number => !isUndefined(e));

    return {
      name: tracks[0].name,
      description: descriptions.length > 0 ? descriptions.join(" | ") : undefined,
      points: allPoints,
      totalDistance: tracks.reduce((sum, t) => sum + (t.totalDistance || 0), 0),
      minElevation: elevations.length > 0 ? Math.min(...elevations) : undefined,
      maxElevation: elevations.length > 0 ? Math.max(...elevations) : undefined,
      totalAscent: tracks.reduce((sum, t) => sum + (t.totalAscent || 0), 0),
      totalDescent: tracks.reduce((sum, t) => sum + (t.totalDescent || 0), 0)
    };
  }

  private createRouteLayer(track: GpxTrack, waypoints: GpxWaypoint[], route: MapRouteViewModel): L.Layer | null {
    const latLngs = this.gpxParser.toLeafletLatLngs(track);
    if (latLngs.length < 2) {
      return null;
    }

    const color = route.color || PaletteColor.ROSE;
    const weight = route.weight || 8;
    const opacity = route.opacity ?? 1.0;
    const haloWeight = weight + 4;
    const haloOpacity = 0.6;

    const halo = L.polyline(latLngs, {
      color: "#ffffff",
      weight: haloWeight,
      opacity: haloOpacity,
      lineCap: "round",
      lineJoin: "round"
    });

    const core = L.polyline(latLngs, {
      color,
      weight,
      opacity,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 1
    });

    const popupContent = this.createPopupContent(track, route);
    core.bindPopup(popupContent);

    const routeGroup = L.layerGroup([halo, core]);

    if (!route.spatialRouteId) {
      this.createEndpointMarkers(latLngs, color, weight).forEach(marker => routeGroup.addLayer(marker));
      this.createArrowMarkers(latLngs, track, weight).forEach(marker => routeGroup.addLayer(marker));
    }

    this.createWaypointMarkers(track, waypoints, route).forEach(marker => routeGroup.addLayer(marker));

    return routeGroup;
  }


  private createPopupContent(track: GpxTrack, route: MapRouteViewModel): string {
    const pathName = track.name || route.name || "Path";
    const pathType = track.description;

    let content = `<div><strong>${this.escapeHtml(pathName)}</strong></div>`;

    if (pathType && pathType !== pathName) {
      content += `<div class="mt-1"><small class="text-muted">${this.escapeHtml(pathType)}</small></div>`;
    }

    if (track.totalDistance) {
      const distanceKm = (track.totalDistance / 1000).toFixed(2);
      content += `<div class="mt-1"><small>Distance: ${distanceKm} km</small></div>`;
    }

    if (!isUndefined(track.totalAscent) && !isUndefined(track.totalDescent)) {
      content += `<div><small>Ascent: ${track.totalAscent.toFixed(0)}m | Descent: ${track.totalDescent.toFixed(0)}m</small></div>`;
    }

    if (!isUndefined(track.minElevation) && !isUndefined(track.maxElevation)) {
      content += `<div><small>Elevation: ${track.minElevation.toFixed(0)}m - ${track.maxElevation.toFixed(0)}m</small></div>`;
    }

    return content;
  }

  private calculateFitBounds() {
    const allLatLngs: L.LatLng[] = [];
    this.logger.info("calculateFitBounds: Processing", this.leafletLayers.length, "layers");
    this.leafletLayers.forEach((layer, index) => {
      if (!layer) {
        this.logger.warn(`calculateFitBounds: Layer ${index} is undefined, skipping`);
        return;
      }
      const layerLatLngs = this.latLngsFromLayer(layer);
      this.logger.info(`calculateFitBounds: Layer ${index} (${layer.constructor.name}) contributed ${layerLatLngs.length} points`);
      allLatLngs.push(...layerLatLngs);
    });

    this.logger.info("calculateFitBounds: Total points collected:", allLatLngs.length);
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      this.fitBounds = bounds.pad(0.15);
      this.logger.info("calculateFitBounds: Bounds set to:", this.fitBounds.getSouthWest(), "to", this.fitBounds.getNorthEast(), "(with 15% padding)");
    }
  }

  onMapReady(map: L.Map) {
    this.mapRef = map;
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    map.whenReady(() => {
      this.loadingRoutes = false;
      map.invalidateSize();
    });

    map.on("moveend zoomend", () => {
      if (this.useViewportFiltering) {
        this.logger.info("Map viewport changed, refreshing visible tracks");
        this.visibleRoutes.forEach(route => {
          if (route.spatialRouteId) {
            this.routeData.delete(route.id);
          }
        });
        void this.loadRoutes();
      }
    });

      this.attachMapListeners();
      this.captureMapView();
  }

  toggleControls() {
    if (!this.allowControlsToggle) {
      return;
    }
    this.showControls = !this.showControls;
    if (this.editing && this.row.map) {
      this.row.map.showControlsDefault = this.showControls;
      this.mapConfigChange.emit({showControlsDefault: this.showControls});
    }
    setTimeout(() => this.updateMapSize(), 200);
  }

  toggleWaypoints() {
    if (!this.allowWaypointsToggle) {
      return;
    }
    this.showWaypoints = !this.showWaypoints;
    if (this.editing && this.row.map) {
      this.row.map.showWaypointsDefault = this.showWaypoints;
      this.mapConfigChange.emit({showWaypointsDefault: this.showWaypoints});
    }
    this.updateLayersForWaypoints();
  }

  async applyOverlayConfigFromEditor(config?: MapData) {
    if (!config) {
      return;
    }
    this.logger.info("applyOverlayConfigFromEditor: received config", config);
    const provider = (config.provider || this.mapControlsState.provider) as MapProvider;
    const style = config.osStyle || this.mapControlsState.osStyle;
    const providerChanged = provider !== this.mapControlsState.provider;
    const styleChanged = style !== this.mapControlsState.osStyle;
    if (providerChanged || styleChanged) {
      this.logger.info("applyOverlayConfigFromEditor: changing provider/style", provider, style);
      this.mapControlsState = {...this.mapControlsState, provider, osStyle: style};
      await this.initialiseMap();
    }
    if (!isUndefined(config.mapHeight) && config.mapHeight !== this.mapHeight) {
      this.logger.info("applyOverlayConfigFromEditor: updating map height", config.mapHeight);
      this.mapHeight = config.mapHeight;
      this.mapControlsState = {...this.mapControlsState, mapHeight: config.mapHeight};
      this.updateMapSize();
    }
    if (!isUndefined(config.mapZoom) && this.mapRef && config.mapZoom !== this.mapRef.getZoom()) {
      this.logger.info("applyOverlayConfigFromEditor: updating map zoom", config.mapZoom);
      this.mapRef.setZoom(config.mapZoom);
    }
    if (config.mapCenter && this.mapRef) {
      const currentCenter = this.mapRef.getCenter();
      const nextCenter = L.latLng(config.mapCenter[0], config.mapCenter[1]);
      if (!currentCenter.equals(nextCenter)) {
        this.logger.info("applyOverlayConfigFromEditor: updating map center", nextCenter);
        this.mapRef.panTo(nextCenter, {animate: false});
      }
    }
    const showControlsDefault = isUndefined(config.showControlsDefault) ? true : config.showControlsDefault;
    if (showControlsDefault !== this.showControls) {
      this.logger.info("applyOverlayConfigFromEditor: toggling controls visibility", showControlsDefault);
      this.showControls = showControlsDefault;
      setTimeout(() => this.updateMapSize(), 200);
    }
    const allowControls = config.allowControlsToggle !== false;
    if (allowControls !== this.allowControlsToggle) {
      this.logger.info("applyOverlayConfigFromEditor: updating allowControlsToggle", allowControls);
      this.allowControlsToggle = allowControls;
    }
    const showWaypointsDefault = isUndefined(config.showWaypointsDefault) ? true : config.showWaypointsDefault;
    if (showWaypointsDefault !== this.showWaypoints) {
      this.logger.info("applyOverlayConfigFromEditor: toggling waypoint visibility", showWaypointsDefault);
      this.showWaypoints = showWaypointsDefault;
      this.updateLayersForWaypoints();
    }
    const allowWaypoints = config.allowWaypointsToggle !== false;
    if (allowWaypoints !== this.allowWaypointsToggle) {
      this.logger.info("applyOverlayConfigFromEditor: updating allowWaypointsToggle", allowWaypoints);
      this.allowWaypointsToggle = allowWaypoints;
    }
    const autoFitEnabled = config.autoFitBounds !== false;
    if (autoFitEnabled) {
      this.logger.info("applyOverlayConfigFromEditor: auto-fit enabled, recalculating bounds");
      this.calculateFitBounds();
      if (this.mapRef && this.fitBounds) {
        this.logger.info("applyOverlayConfigFromEditor: fitting to bounds", this.fitBounds.getSouthWest(), this.fitBounds.getNorthEast());
        this.mapRef.fitBounds(this.fitBounds);
      }
    }
  }

  private updateLayersForWaypoints() {
    const currentBounds = this.mapRef?.getBounds();
    const maxTracksWithoutFiltering = 500;

    const routeLayers = this.visibleRoutes.flatMap(route => {
      const gpxData = this.routeData.get(route.id);
      if (!gpxData?.tracksWithBounds || gpxData.tracksWithBounds.length === 0) {
        this.routeVisibleCounts.set(route.id, 0);
        return [];
      }

      let tracksToRender = gpxData.tracksWithBounds;

      if (this.searchTerm && this.searchTerm.trim().length > 0) {
        tracksToRender = tracksToRender.filter(twb => this.matchesSearch(twb.track));
      }

      if (this.useViewportFiltering && currentBounds) {
        tracksToRender = tracksToRender.filter(twb => currentBounds.intersects(twb.bounds));
      } else {
        tracksToRender = tracksToRender.slice(0, maxTracksWithoutFiltering);
      }

      this.routeVisibleCounts.set(route.id, tracksToRender.length);

      return tracksToRender
        .map(twb => this.createRouteLayer(twb.track, gpxData.waypoints, route))
        .filter((layer): layer is L.Layer => layer !== null);
    });

    const markerLayers = this.showWaypoints ? this.createStandaloneMarkers(this.row.map?.markers || []) : [];
    this.leafletLayers = [...routeLayers, ...markerLayers];
  }

  onProviderChange(provider: MapProvider) {
    this.mapControlsState = {...this.mapControlsState, provider};
    this.updateRowMap({provider});
    this.initialiseMap();
  }

  onStyleChange(style: string) {
    this.mapControlsState = {...this.mapControlsState, osStyle: style};
    this.updateRowMap({osStyle: style});
    this.initialiseMap();
  }

  onHeightChange(height: number) {
    this.mapHeight = height;
    this.mapControlsState = {...this.mapControlsState, mapHeight: height};
    this.updateRowMap({mapHeight: height});
    this.updateMapSize();
  }

  private updateMapSize() {
    if (this.mapRef) {
      setTimeout(() => {
        this.mapRef?.invalidateSize();
      }, 100);
    }
  }

  private routeUrl(route: MapRoute): string | undefined {
    return this.fileDownloadUrl(route.gpxFile as Partial<ServerFileNameData> | undefined);
  }

  private filePath(fileData: Partial<ServerFileNameData> | undefined): string | undefined {
    if (!fileData || !fileData.awsFileName) {
      return undefined;
    } else if (fileData.rootFolder && !fileData.awsFileName.startsWith(`${fileData.rootFolder}/`)) {
      return `${fileData.rootFolder}/${fileData.awsFileName}`;
    } else {
      return fileData.awsFileName;
    }
  }

  public fileDownloadUrl(fileData: (Partial<ServerFileNameData> | FileNameData) | undefined): string | undefined {
    const filePath = this.filePath(fileData);
    if (!filePath) {
      return undefined;
    }
    if (this.urlService.isRemoteUrl(filePath)) {
      return filePath;
    }
    return this.urlService.resourceRelativePathForAWSFileName(filePath) || undefined;
  }

  private routesSignature(): string {
    const routes = this.row.map?.routes || [];
    return JSON.stringify(routes.map(route => ({
      id: route.id,
      gpx: route.gpxFile?.awsFileName,
      esri: route.esriFile?.awsFileName,
      visible: route.visible !== false,
      color: route.color,
      weight: route.weight,
      opacity: route.opacity,
      name: route.name
    })));
  }

  private attachMapListeners() {
    if (!this.mapRef) {
      return;
    } else {
      this.mapRef.on("moveend", this.mapViewChangeHandler);
      this.mapRef.on("zoomend", this.mapViewChangeHandler);
      this.mapRef.once("load", this.mapLoadHandler);
    }
  }

  private detachMapListeners() {
    if (!this.mapRef) {
      return;
    } else {
      this.mapRef.off("moveend", this.mapViewChangeHandler);
      this.mapRef.off("zoomend", this.mapViewChangeHandler);
      this.mapRef.off("load", this.mapLoadHandler);
    }
  }

  private handleMapLoadComplete() {
    this.loadingRoutes = false;
  }

  private captureMapView() {
    if (!this.mapRef || !this.row?.map) {
      return;
    }

      const center = this.mapRef.getCenter();
      const zoom = this.mapRef.getZoom();

    if (this.editing) {
      this.updateRowMap({
        mapCenter: [center.lat, center.lng],
        mapZoom: zoom
      });
    } else {
      this.sessionMapCenter = [center.lat, center.lng];
      this.sessionMapZoom = zoom;
      this.logger.info(`Session position updated: center=${this.sessionMapCenter}, zoom=${this.sessionMapZoom}`);
    }
  }

  private updateRowMap(partial: Partial<MapData>) {
    if (!this.row?.map) {
      return;
    }
    if (!isUndefined(partial.mapCenter) || !isUndefined(partial.mapZoom)) {
      partial.autoFitBounds = false;
    }
    let changed = false;
    const currentMap = this.row.map as Record<string, any>;
    (Object.keys(partial) as (keyof MapData)[]).forEach(key => {
      const nextValue = partial[key];
      if (isUndefined(nextValue)) {
        return;
      }
      const previous = currentMap[key as string];
      if (!this.valuesEqual(previous, nextValue)) {
        currentMap[key as string] = nextValue;
        changed = true;
      }
    });
    if (changed) {
      this.mapConfigChange.emit(this.row.map);
    }
  }

  private valuesEqual(current: any, next: any): boolean {
    if (Array.isArray(current) && Array.isArray(next)) {
      if (current.length !== next.length) {
        return false;
      }
      return current.every((value, index) => value === next[index]);
    }
    return current === next;
  }

  private createEndpointMarkers(latLngs: [number, number][], color: string, weight: number): L.CircleMarker[] {
    if (latLngs.length === 0) {
      return [];
    }
    const radius = Math.max(weight + 2, 6);
    const start = L.circleMarker(latLngs[0], {
      radius,
      color: "#ffffff",
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    });
    const end = L.circleMarker(latLngs[latLngs.length - 1], {
      radius: radius + 1,
      color: "#ffffff",
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    });
    return [start, end];
  }

  private createStandaloneMarkers(markers: MapMarker[]): L.Layer[] {
    const provider = (this.row.map?.provider || "osm") as "osm" | "os";
    const osStyle = this.row.map?.osStyle || "Leisure_27700";
    const icon = this.mapMarkerStyle.markerIcon(provider, osStyle);
    return markers.map(marker => {
      const latlng: [number, number] = [marker.latitude, marker.longitude];
      const leafletMarker = L.marker(latlng, {icon});
      if (marker.label) {
        leafletMarker.bindPopup(`<div><strong>${this.escapeHtml(marker.label)}</strong></div>`);
      }
      return leafletMarker;
    });
  }

  private createArrowMarkers(latLngs: [number, number][], track: GpxTrack, weight: number): L.Marker[] {
    if (latLngs.length < 2) {
      return [];
    }

    const spacing = this.arrowSpacing(track);
    const markers: L.Marker[] = [];
    if (spacing <= 0) {
      return markers;
    }

    let distanceSinceLast = 0;
    for (let i = 1; i < latLngs.length; i++) {
      const start = L.latLng(latLngs[i - 1]);
      const end = L.latLng(latLngs[i]);
      const segmentDistance = start.distanceTo(end);
      if (segmentDistance === 0) {
        continue;
      }
      distanceSinceLast += segmentDistance;
      while (distanceSinceLast >= spacing) {
        const overshoot = distanceSinceLast - spacing;
        const ratio = (segmentDistance - overshoot) / segmentDistance;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lng = start.lng + (end.lng - start.lng) * ratio;
        const bearing = this.bearingBetween(start, end);
        markers.push(this.createArrowMarker([lat, lng], bearing, weight));
        distanceSinceLast -= spacing;
      }
    }

    if (markers.length === 0) {
      const midIndex = Math.floor(latLngs.length / 2);
      const direction = this.bearingBetween(L.latLng(latLngs[0]), L.latLng(latLngs[latLngs.length - 1]));
      markers.push(this.createArrowMarker(latLngs[midIndex], direction, weight));
    }

    return markers;
  }

  private createWaypointMarkers(track: GpxTrack, waypoints: GpxWaypoint[], route: MapRouteViewModel): L.Marker[] {
    const markers: L.Marker[] = [];

    if (!this.showWaypoints || waypoints.length === 0) {
      return markers;
    }

    const provider = (this.row.map?.provider || "osm") as "osm" | "os";
    const osStyle = this.row.map?.osStyle || "Leisure_27700";
    const icon = this.mapMarkerStyle.markerIcon(provider, osStyle);

    let unnamedIndex = 1;
    waypoints.forEach(waypoint => {
      const label = waypoint.name || `${route.name || "Waypoint"} ${unnamedIndex++}`;
      const popup = this.createWaypointPopupContent(label, waypoint.description);
      const marker = L.marker([waypoint.latitude, waypoint.longitude], {icon});
      marker.bindPopup(popup);
      markers.push(marker);
    });

    return markers;
  }

  private createWaypointPopupContent(name: string, description?: string): string {
    const title = this.escapeHtml(name);
    const details = description
      ? `<div class="mt-1"><small>${this.escapeHtml(description)}</small></div>`
      : `<div class="mt-1 text-muted"><small>This waypoint has no description</small></div>`;
    return `<div><strong>${title}</strong></div>${details}`;
  }

  private escapeHtml(value?: string): string {
    if (!value) {
      return "";
    }
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private arrowSpacing(track: GpxTrack): number {
    const distance = track.totalDistance || 0;
    if (distance <= 0) {
      return 2000;
    }
    const spacing = distance / 6;
    return Math.min(Math.max(spacing, 2000), 8000);
  }

  private createArrowMarker(position: [number, number], bearing: number, weight: number): L.Marker {
    const size = Math.max(14, Math.min(weight * 4, 28));
    const height = Math.round(size / 2.4);
    const strokeWidth = Math.max(1.5, weight / 3);
    const html = `
        <div class="route-arrow" style="transform: rotate(${bearing - 90}deg);">
          <svg viewBox="0 0 24 8" width="${size}" height="${height}">
            <path d="M2 4 L16 4" stroke-width="${strokeWidth}" stroke-linecap="round"></path>
            <polygon points="16,0 24,4 16,8"></polygon>
          </svg>
        </div>`;
    return L.marker(position, {
      icon: L.divIcon({
        className: "route-arrow-icon",
        html,
        iconSize: [size, height],
        iconAnchor: [size / 2, height / 2]
      }),
      interactive: false
    });
  }

  private bearingBetween(start: L.LatLng, end: L.LatLng): number {
    const startLat = start.lat * Math.PI / 180;
    const endLat = end.lat * Math.PI / 180;
    const dLng = (end.lng - start.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(endLat);
    const x = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  private latLngsFromLayer(layer: L.Layer): L.LatLng[] {
    if (layer instanceof L.Polyline) {
      return this.flattenLatLngs(layer.getLatLngs());
    } else if (layer instanceof L.CircleMarker) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.Marker) {
      return [layer.getLatLng()];
    } else if (layer instanceof L.LayerGroup) {
      const nested: L.LatLng[] = [];
      layer.getLayers().forEach(child => nested.push(...this.latLngsFromLayer(child)));
      return nested;
    } else {
      return [];
    }
  }

  private flattenLatLngs(latLngs: L.LatLng[] | L.LatLng[][] | L.LatLng[][][]): L.LatLng[] {
    const flat: L.LatLng[] = [];
    latLngs.forEach(entry => {
      if (Array.isArray(entry)) {
        flat.push(...this.flattenLatLngs(entry as any));
      } else {
        flat.push(entry as L.LatLng);
      }
    });
    return flat;
  }
}
