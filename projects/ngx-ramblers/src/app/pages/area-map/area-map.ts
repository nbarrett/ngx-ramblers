import {
  ApplicationRef,
  Component,
  ComponentRef,
  createComponent,
  EnvironmentInjector,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges
} from "@angular/core";
import * as L from "leaflet";
import { FormsModule } from "@angular/forms";

declare module "leaflet" {
  interface GeoJSONOptions {
    renderer?: L.Renderer;
  }
}
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { GroupAreasService } from "../../services/group-areas.service";
import { GroupAreaConfig, GroupAreaRegionConfig, SharedDistrictInfo } from "../../models/group-area.model";
import { SharedDistrictStyle } from "../../models/system.model";
import { MapTilesService } from "../../services/maps/map-tiles.service";
import { MapControls, MapControlsConfig, MapControlsState } from "../../shared/components/map-controls";
import { MapOverlay } from "../../shared/components/map-overlay";
import { MapControlsStateService } from "../../shared/services/map-controls-state.service";
import { MapRecreationService } from "../../shared/services/map-recreation.service";
import { MapProvider, OUTDOOR_OS_STYLE } from "../../models/map.model";
import { MapDefaultsService } from "../../services/maps/map-defaults.service";
import { UiActionsService } from "../../services/ui-actions.service";
import { StoredValue } from "../../models/ui-actions";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import {
  AreaMapClickAction,
  AreaMapData,
  LegendPosition,
  PageContent,
  PageContentRow
} from "../../models/content-text.model";
import { forkJoin, of, Subscription } from "rxjs";
import { toPairs, isArray, isFunction, isNull, isNumber, keys, values } from "es-toolkit/compat";
import { NgSelectComponent } from "@ng-select/ng-select";
import { SystemConfigService } from "../../services/system/system-config.service";
import { BroadcastService } from "../../services/broadcast-service";
import { NamedEvent, NamedEventType } from "../../models/broadcast.model";
import { ResizerComponent } from "../../modules/common/resizer/resizer";
import { MaximisableMapComponent, MaximisableMapState } from "../../modules/common/maximisable-map/maximisable-map";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { ParishMapService } from "../../services/parish-map.service";
import { ParishFeatureProperties } from "../../models/parish-map.model";
import { MemberLoginService } from "../../services/member/member-login.service";
import { catchError } from "rxjs/operators";
import { ParishPopup } from "./parish-popup";
import { FullNamePipe } from "../../pipes/full-name.pipe";
import { Member, MemberWithLabel } from "../../models/member.model";
import { MemberService } from "../../services/member/member.service";
import { sortBy } from "../../functions/arrays";
import { memberDisambiguatedLabel } from "../../functions/member-names";
import { VolunteerMapAssignment, VolunteerMapCoverage, VolunteerParish } from "../../models/volunteer-management.model";
import { VolunteerManagementService } from "../../services/volunteer-management.service";
import {
  AreaMapLegendItem,
  ParishColourLegendItem,
  ParishColourMode,
  ParishColourModeOption,
  ParishCoverageFilter,
  ParishFilterSelectOption,
  ParishOverlayFilter,
  ParishOverlayStyle,
  PixelRect
} from "../../models/area-map.model";
import {
  boundsCornersAround,
  clampZoom,
  estimateLabelSize,
  featureHasRenderableGeometry,
  findLabelPlacement,
  hashedLabelOffset,
  labelBoundsAround,
  parsedStoredZoom,
  pointInPolygonRings,
  zoomWithinStoredRange
} from "../../functions/area-map-geometry";
import { gradientPatternSvg, lightenedFillColor, stripePatternSvg } from "../../functions/area-map-patterns";
import {
  assignmentsByParishCode,
  categoricalColourMap,
  footpathObserverAssignment,
  footpathObserverAssignmentRequest,
  localAuthorityFilterOptions,
  parishMatchesOverlayFilter,
  parishOverlayFilterActive,
  parishTooltipText,
  parishesByCode,
  rightsOfWayGroupFilterOptions,
  sectorFilterOptions,
  volunteerParishFor,
  withFootpathObserverAssignment,
  withoutAssignment
} from "../../functions/area-map-parishes";

@Component({
  selector: "app-area-map",
  styles: [`
    .map-container
      width: 100%
      height: 480px
      border-radius: 0.5rem
      overflow: hidden
    :host ::ng-deep .map-container *:focus
      outline: none !important
      box-shadow: none !important
    :host ::ng-deep .leaflet-interactive:focus
      outline: none !important
    :host ::ng-deep .leaflet-control-attribution
      font-size: 0.75rem
    :host ::ng-deep .group-name-label span
      -webkit-font-smoothing: subpixel-antialiased !important
      -moz-osx-font-smoothing: auto !important
      text-rendering: geometricPrecision !important
      transform: translate(-50%, -50%) !important
      position: relative !important

    .map-wrapper
      position: relative

    .map-controls
      border-bottom: 1px solid #dee2e6
      margin-bottom: 0 !important
      gap: 1rem

    .map-control-item
      gap: 0.25rem
      flex-shrink: 0

    .map-control-range
      width: 80px
      accent-color: var(--ramblers-colour-sunrise)

    .map-control-value
      min-width: 45px
      font-size: 0.8rem

    .parish-filter-bar
      margin-top: 8px

    .parish-filter-grid
      display: grid
      grid-template-columns: repeat(2, minmax(0, 1fr))
      gap: 0.5rem 0.75rem
      align-items: center
    .parish-filter-grid .map-control-item
      min-width: 0
    .parish-filter-grid .map-control-item .ng-select
      min-width: 0
      flex: 1 1 auto
    @media (min-width: 1200px)
      .parish-filter-grid
        grid-template-columns: repeat(3, minmax(0, 1fr))

    .parish-legend-swatch
      display: inline-block
      width: 14px
      height: 14px
      border-radius: 3px
      border: 1px solid rgba(0, 0, 0, 0.25)

    :host ::ng-deep .groups-select .ng-select-container
      flex-wrap: wrap

    :host ::ng-deep .groups-select .ng-value-container
      flex-wrap: wrap
      max-width: 100%

    :host ::ng-deep .groups-select .ng-value
      margin-bottom: 2px

    :host ::ng-deep .bootstrap-tooltip
      background: rgba(60, 60, 60, 0.9) !important
      border-radius: 3px !important
      padding: 4px 6px !important
      font-size: 11px !important
      line-height: 1.2 !important
      color: white !important
      font-weight: 500 !important
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2) !important
      white-space: nowrap !important
      max-width: none !important

    :host ::ng-deep .bootstrap-tooltip *
      white-space: nowrap !important

    :host ::ng-deep .bootstrap-tooltip .tooltip-arrow
      border-top-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .bootstrap-tooltip.bs-tooltip-bottom .tooltip-arrow
      border-bottom-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .bootstrap-tooltip.bs-tooltip-left .tooltip-arrow
      border-left-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .bootstrap-tooltip.bs-tooltip-right .tooltip-arrow
      border-right-color: rgba(60, 60, 60, 0.9) !important

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-content-wrapper
      border-radius: 6px
      padding: 6px

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-content
      margin: 0
      min-width: 0
      line-height: 1

    :host ::ng-deep .area-action-leaflet-popup .badge
      cursor: pointer
      padding: 4px 8px
      font-size: 11px
      font-weight: 500

    :host ::ng-deep .group-name-label
      width: auto !important
      white-space: nowrap !important

    :host ::ng-deep .group-name-label span
      white-space: nowrap !important
      max-width: none !important
      margin: 2px

    :host ::ng-deep .area-action-leaflet-popup .badge:hover
      opacity: 0.85

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-tip
      background: white

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-close-button
      color: #000
      font-size: 18px
      padding: 0
      top: -8px
      right: -8px
      width: 20px
      height: 20px
      line-height: 20px
      text-align: center
      background: white
      border-radius: 50%
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)

    :host ::ng-deep .area-action-leaflet-popup .leaflet-popup-close-button:hover
      background: #f8f9fa

    .map-loading
      display: flex
      flex-direction: column
      align-items: center
      gap: 12px
      color: #6c757d
      font-weight: 600
      font-size: 1.1rem
      letter-spacing: 0.01em

    .map-loading-icon
      font-size: 2.8rem
      color: var(--ramblers-colour-sunrise, #e2a100)
      display: inline-flex

    .map-loading-text
      animation: pulse 2.2s ease-in-out infinite

    @keyframes pulse
      0%
        opacity: 0.75
      50%
        opacity: 0.95
      100%
        opacity: 0.75

    .map-legend
      position: absolute
      background: rgba(255, 255, 255, 0.95)
      border-radius: 6px
      padding: 8px 12px
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)
      z-index: 1000
      max-height: 60%
      overflow-y: auto
      font-size: 12px

    .map-legend.top-left
      top: 10px
      left: 10px

    .map-legend.top-right
      top: 10px
      right: 10px

    .map-legend.bottom-left
      bottom: 30px
      left: 10px

    .map-legend.bottom-right
      bottom: 30px
      right: 10px

    .map-legend-title
      font-weight: 600
      margin-bottom: 6px
      font-size: 13px
      border-bottom: 1px solid #dee2e6
      padding-bottom: 4px

    .map-legend-item
      display: flex
      align-items: center
      gap: 8px
      padding: 3px 0
      cursor: pointer
      border-radius: 4px
      transition: background-color 0.15s ease

    .map-legend-item:hover
      background-color: rgba(0, 0, 0, 0.05)

    .map-legend-color
      width: 16px
      height: 16px
      border-radius: 3px
      flex-shrink: 0
      border: 1px solid rgba(0, 0, 0, 0.2)

    .map-legend-label
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis
      max-width: 180px

    .map-legend-below
      display: flex
      flex-wrap: wrap
      background: rgba(255, 255, 255, 0.95)
      border-radius: 6px
      padding: 8px 12px
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)
      margin-top: 8px
      font-size: 12px
      gap: 4px 16px

    .map-legend-below .map-legend-title
      width: 100%
      margin-bottom: 4px

    .map-legend-below .map-legend-item
      display: flex
      align-items: center
      gap: 6px
      padding: 2px 0

    .parish-loading-indicator, .parish-count-indicator
      font-size: 0.8rem
      color: #6c757d
      padding: 4px 8px
      text-align: right

    .parish-loading-indicator fa-icon
      margin-right: 4px

    :host ::ng-deep .parish-admin-popup .leaflet-popup-content-wrapper
      border-radius: 6px
      padding: 6px

    :host ::ng-deep .parish-admin-popup .leaflet-popup-content
      margin: 0
      min-width: 0
      line-height: 1.4

    :host ::ng-deep .parish-admin-popup .leaflet-popup-close-button
      color: #000
      font-size: 18px
      padding: 0
      top: -8px
      right: -8px
      width: 20px
      height: 20px
      line-height: 20px
      text-align: center
      background: white
      border-radius: 50%
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2)

    :host ::ng-deep .parish-admin-popup .leaflet-popup-close-button:hover
      background: #f8f9fa

    :host ::ng-deep .parish-admin-popup .leaflet-popup-tip
      background: white
  `],
  template: `
    @if (standalone && !mapFullScreen) {
      @if (showControls) {
        <div class="rounded-top img-thumbnail p-2 map-controls">
          <app-map-controls
            [config]="mapControlsConfig"
            [state]="mapControlsState"
            (providerChange)="onProviderChange($event)"
            (styleChange)="onStyleChange($event)"
            (heightChange)="onHeightChange($event)">
            <div class="d-flex align-items-center flex-wrap" style="gap: 0.5rem;">
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Opacity</span>
                <input type="range" class="form-range map-control-range" min="0.1" max="1.0" step="0.1"
                       [(ngModel)]="opacityNormal" (input)="onOpacityChange()">
                <span class="ms-1 text-muted small map-control-value">{{ opacityNormal }}</span>
              </div>
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Hover</span>
                <input type="range" class="form-range map-control-range" min="0.1" max="1.0" step="0.1"
                       [(ngModel)]="opacityHover" (input)="onOpacityChange()">
                <span class="ms-1 text-muted small map-control-value">{{ opacityHover }}</span>
              </div>
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Text</span>
                <input type="range" class="form-range map-control-range" min="0.1" max="1.0" step="0.1"
                       [(ngModel)]="textOpacity" (input)="onOpacityChange()">
                <span class="ms-1 text-muted small map-control-value">{{ textOpacity }}</span>
              </div>
              @if (!preview) {
                <div class="d-flex align-items-start map-control-item flex-grow-1" style="min-width: 250px;">
                  <span class="small mx-1 text-nowrap mt-1">Groups</span>
                  <ng-select
                    [items]="availableGroups"
                    [multiple]="true"
                    [closeOnSelect]="false"
                    [searchable]="true"
                    [clearable]="true"
                    placeholder="All groups"
                    [(ngModel)]="selectedGroups"
                    (change)="onGroupSelectionChange()"
                    class="flex-grow-1 groups-select">
                  </ng-select>
                </div>
              }
            </div>
          </app-map-controls>
        </div>
      }
    }
    <div class="map-wrapper">
      <app-maximisable-map title="Area coverage map"
                           [enabled]="!preview"
                           [allowExpanded]="false"
                           [syncToUrl]="!preview"
                           offsetTop="8px"
                           offsetRight="8px"
                           (sizeChange)="onMapSizeChange($event)">
        @if (dataLoading) {
          <div class="map-container card shadow d-flex align-items-center justify-content-center rounded maximisable-map-fill"
               [style.height.px]="mapHeight">
            <div class="map-loading">
              <fa-icon class="map-loading-icon" [icon]="faSpinner" animation="spin-pulse"></fa-icon>
              <div class="map-loading-text">Loading area map data…</div>
            </div>
          </div>
        } @else if (showMap && options) {
          <div class="map-container maximisable-map-fill"
               [style.height.px]="mapHeight"
               leaflet
               [leafletOptions]="options"
               [leafletLayers]="layers"
               [leafletFitBounds]="fitBounds"
               (leafletMapReady)="onMapReady($event)">
          </div>
          @if (showLegend && legendItems.length > 0 && legendPosition !== LegendPosition.BELOW_MAP) {
            <div class="map-legend" [class]="legendPosition">
              <div class="map-legend-title">Groups</div>
              @for (item of legendItems; track item.name) {
                <div class="map-legend-item"
                     style="cursor: pointer;"
                     (mouseenter)="onLegendItemHover($event, item.name, true)"
                     (mouseleave)="onLegendItemHover($event, item.name, false)"
                     (click)="onLegendItemClick(item.name)">
                  <div class="map-legend-color" [style.background]="item.color"></div>
                  <div class="map-legend-label" [title]="item.name">{{ item.name }}</div>
                </div>
              }
            </div>
          }
          @if (standalone && !mapFullScreen) {
            <app-resizer orientation="vertical" variant="tab" compact
                         [size]="mapHeight"
                         [minSize]="200"
                         [maxSize]="1200"
                         (sizeChange)="onResizerHeightChange($event)"/>
          }
        }
        @if (parishFilterControlsVisible) {
          <div class="rounded img-thumbnail p-2 parish-filter-bar maximisable-map-filter">
            <div class="parish-filter-grid">
              <div class="d-flex align-items-center map-control-item">
                <span class="small mx-1 text-nowrap">Colour by</span>
                <ng-select
                  [items]="parishColourModeOptions"
                  bindLabel="label"
                  bindValue="value"
                  [clearable]="false"
                  [searchable]="false"
                  [(ngModel)]="parishColourMode"
                  (change)="onParishColourModeChange()"
                  class="flex-grow-1">
                </ng-select>
              </div>
              <div class="d-flex align-items-start map-control-item">
                <span class="small mx-1 text-nowrap mt-1">Coverage</span>
                <ng-select
                  [items]="parishCoverageFilterOptions"
                  [multiple]="true"
                  [closeOnSelect]="false"
                  [searchable]="false"
                  [clearable]="true"
                  placeholder="All coverage"
                  [(ngModel)]="selectedParishCoverage"
                  (change)="onParishFilterChange()"
                  class="flex-grow-1 groups-select">
                </ng-select>
              </div>
              @if (rightsOfWayGroupOptions.length > 0) {
                <div class="d-flex align-items-center map-control-item">
                  <span class="small mx-1 text-nowrap">Rights of way group</span>
                  <ng-select
                    [items]="rightsOfWayGroupOptions"
                    bindLabel="label"
                    bindValue="value"
                    [multiple]="true"
                    [closeOnSelect]="false"
                    [clearable]="true"
                    placeholder="All"
                    [(ngModel)]="selectedRightsOfWayGroup"
                    (change)="onParishFilterChange()"
                    class="flex-grow-1">
                  </ng-select>
                </div>
              }
              @if (localAuthorityOptions.length > 0) {
                <div class="d-flex align-items-center map-control-item">
                  <span class="small mx-1 text-nowrap">Authority</span>
                  <ng-select
                    [items]="localAuthorityOptions"
                    bindLabel="label"
                    bindValue="value"
                    [multiple]="true"
                    [closeOnSelect]="false"
                    [clearable]="true"
                    placeholder="All"
                    [(ngModel)]="selectedLocalAuthority"
                    (change)="onParishFilterChange()"
                    class="flex-grow-1">
                  </ng-select>
                </div>
              }
              @if (sectorOptions.length > 0) {
                <div class="d-flex align-items-center map-control-item">
                  <span class="small mx-1 text-nowrap">Sector</span>
                  <ng-select
                    [items]="sectorOptions"
                    bindLabel="label"
                    bindValue="value"
                    [multiple]="true"
                    [closeOnSelect]="false"
                    [clearable]="true"
                    placeholder="All"
                    [(ngModel)]="selectedSector"
                    (change)="onParishFilterChange()"
                    class="flex-grow-1">
                  </ng-select>
                </div>
              }
              @if (parishFiltersActive) {
                <div class="d-flex align-items-center map-control-item">
                  <button type="button" class="btn btn-sm btn-quiet text-nowrap" (click)="resetParishFilters()">Reset filters</button>
                </div>
              }
            </div>
            <div class="parish-colour-legend d-flex flex-wrap align-items-center mt-2" style="gap: 0.35rem 0.9rem;">
              @for (item of parishColourLegend; track item.label) {
                <div class="d-flex align-items-center" style="gap: 0.3rem;">
                  <span class="parish-legend-swatch" [style.background]="item.color"></span>
                  <span class="small text-nowrap">{{ item.label }}</span>
                </div>
              }
            </div>
          </div>
        }
      </app-maximisable-map>
      @if (standalone && !mapFullScreen) {
        <app-map-overlay
          [offsetTop]="'52px'"
          [showControls]="showControls"
          [allowWaypointsToggle]="false"
          (toggleControls)="toggleControls()">
        </app-map-overlay>
      }
    </div>
    @if (showLegend && legendItems.length > 0 && legendPosition === LegendPosition.BELOW_MAP) {
      <div class="map-legend-below">
        <div class="map-legend-title">Groups</div>
        @for (item of legendItems; track item.name) {
          <div class="map-legend-item"
               style="cursor: pointer;"
               (mouseenter)="onLegendItemHover($event, item.name, true)"
               (mouseleave)="onLegendItemHover($event, item.name, false)"
               (click)="onLegendItemClick(item.name)">
            <div class="map-legend-color" [style.background]="item.color"></div>
            <div class="map-legend-label">{{ item.name }}</div>
          </div>
        }
      </div>
    }
  `,
  imports: [FormsModule, LeafletModule, MapControls, MapOverlay, NgSelectComponent, ResizerComponent, FontAwesomeModule, MaximisableMapComponent]
})
export class AreaMap implements OnInit, OnDestroy, OnChanges {
  private logger: Logger = inject(LoggerFactory).createLogger("AreaMap", NgxLoggerLevel.ERROR);
  private _row?: PageContentRow;
  private _pageContent?: PageContent;
  @Input() region?: string;
  @Input() preview = false;
  @Input() previewSharedDistrictStyle?: SharedDistrictStyle;
  @Input() previewAreaColors?: Record<string, string>;
  @Input() previewSelectedGroups?: string[];
  public mapFullScreen = false;
  private suppressViewPersist = false;
  public dataLoading = true;
  protected readonly faSpinner = faSpinner;
  protected readonly LegendPosition = LegendPosition;

  @Input() set row(value: PageContentRow | undefined) {
    this._row = value;
    if (this.isInitialized) {
      this.initializeComponent();
    }
  }

  get row(): PageContentRow | undefined {
    return this._row;
  }

  @Input() set pageContent(value: PageContent | undefined) {
    this._pageContent = value;
    if (this.isInitialized) {
      this.initializeComponent();
    }
  }

  get pageContent(): PageContent | undefined {
    return this._pageContent;
  }

  public options: any;
  public layers: L.Layer[] = [];
  public fitBounds: L.LatLngBounds | undefined;
  public showMap = true;
  public mapHeight = 480;
  public mapKey = 0;
  public provider: MapProvider = MapProvider.OSM;
  public osStyle = OUTDOOR_OS_STYLE;
  public opacityNormal = 0.5;
  public opacityHover = 0.8;
  public textOpacity = 0.9;
  public showControls = true;
  public selectedGroups: string[] = [];
  public availableGroups: string[] = [];
  public clickAction: AreaMapClickAction = AreaMapClickAction.GROUP_WEBSITE;
  public showLegend = false;
  public legendPosition: LegendPosition = LegendPosition.TOP_RIGHT;
  public legendItems: AreaMapLegendItem[] = [];
  private areaLayerMap: Map<string, L.GeoJSON> = new Map();
  private areaDataMap: Map<string, GroupAreaConfig> = new Map();
  private legendHoverTimeout: any = null;
  public mapControlsConfig: MapControlsConfig = {
    showProvider: true,
    showStyle: true,
    showHeight: true,
    showSmoothScroll: false,
    showAutoShowAll: false,
    minHeight: 300,
    maxHeight: 1200,
    heightStep: 10
  };
  public mapControlsState: MapControlsState = {
    provider: MapProvider.OSM,
    osStyle: OUTDOOR_OS_STYLE,
    mapHeight: 480
  };
  private mapRef: L.Map | undefined;
  private areaColors: Record<string, string> = {};
  private isInitialized = false;
  private cmsSettingsSubscription?: Subscription;
  private labelPlacements: PixelRect[] = [];
  private hoverTimeout: any = null;
  private sharedDistricts: Record<string, SharedDistrictInfo> = {};
  private sharedDistrictStyle: SharedDistrictStyle = SharedDistrictStyle.FIRST_GROUP;
  private mainAreaGroupCodes: string[] = [];
  private stripePatternContainer: HTMLElement | null = null;
  private stripePatternCounter = 0;
  private mapDefaults = inject(MapDefaultsService);
  private areas = inject(GroupAreasService);
  private parishService = inject(ParishMapService);
  private volunteerManagementService = inject(VolunteerManagementService);
  private tiles = inject(MapTilesService);
  private mapControlsStateService = inject(MapControlsStateService);
  private mapRecreation = inject(MapRecreationService);
  private uiActions = inject(UiActionsService);
  private systemConfigService = inject(SystemConfigService);
  private broadcastService = inject(BroadcastService);
  private memberLoginService = inject(MemberLoginService);
  private appRef = inject(ApplicationRef);
  private environmentInjector = inject(EnvironmentInjector);
  private fullNamePipe = inject(FullNamePipe);
  private memberService = inject(MemberService);
  private cmsSettings?: AreaMapData;
  private popupComponentRef: ComponentRef<ParishPopup> | null = null;
  private membersWithLabel: MemberWithLabel[] = [];
  private membersLoaded = false;

  private savedCenter: L.LatLng | null = null;
  private savedZoom = 9;
  private preserveNextView = false;
  private parishLayer: L.GeoJSON | null = null;
  private volunteerParishes: Map<string, VolunteerParish> = new Map();
  private volunteerAssignments: Map<string, VolunteerMapAssignment[]> = new Map();
  private clippedParishFeatures: GeoJSON.Feature[] = [];
  public parishCount = 0;
  public parishesLoading = false;
  public parishOverlayLoaded = false;
  public parishCoverageFilterOptions: ParishCoverageFilter[] = values(ParishCoverageFilter);
  public selectedParishCoverage: ParishCoverageFilter[] = [];
  public selectedRightsOfWayGroup: string[] = [];
  public selectedLocalAuthority: string[] = [];
  public selectedSector: string[] = [];
  public rightsOfWayGroupOptions: ParishFilterSelectOption[] = [];
  public localAuthorityOptions: ParishFilterSelectOption[] = [];
  public sectorOptions: ParishFilterSelectOption[] = [];
  public parishColourMode: ParishColourMode = ParishColourMode.COVERAGE;
  public readonly parishColourModeOptions: ParishColourModeOption[] = [
    {value: ParishColourMode.COVERAGE, label: "Coverage (covered / vacant)"},
    {value: ParishColourMode.RIGHTS_OF_WAY_GROUP, label: "Rights of way group"},
    {value: ParishColourMode.LOCAL_AUTHORITY, label: "Local authority"},
    {value: ParishColourMode.SECTOR, label: "Sector"}
  ];
  private rightsOfWayGroupColours: Map<string, string> = new Map();
  private localAuthorityColours: Map<string, string> = new Map();
  private sectorColours: Map<string, string> = new Map();
  protected readonly ParishColourMode = ParishColourMode;

  get standalone(): boolean {
    return !this.row;
  }

  onMapSizeChange(state: MaximisableMapState) {
    this.mapFullScreen = state.fullScreen;
    this.scheduleMapInvalidate();
    if (state.fullScreen) {
      setTimeout(() => this.fitToContent(), 500);
    } else {
      setTimeout(() => this.forceMapReset(), 500);
    }
  }

  private forceMapReset(): void {
    if (this.mapRef) {
      this.suppressViewPersist = true;
      this.mapRef.invalidateSize(true);
      this.mapRef.setView(this.mapRef.getCenter(), this.mapRef.getZoom(), {animate: false});
      setTimeout(() => this.suppressViewPersist = false, 200);
    }
  }

  private scheduleMapInvalidate() {
    this.suppressViewPersist = true;
    [50, 250, 450].forEach(delay => setTimeout(() => this.mapRef?.invalidateSize(true), delay));
    setTimeout(() => this.suppressViewPersist = false, 650);
  }

  fitToContent(): void {
    if (this.mapRef) {
      const bounds = L.latLngBounds([]);
      this.areaLayerMap.forEach(layer => {
        const layerBounds = layer.getBounds();
        if (layerBounds.isValid()) {
          bounds.extend(layerBounds);
        }
      });
      if (this.parishLayer) {
        const parishBounds = this.parishLayer.getBounds();
        if (parishBounds.isValid()) {
          bounds.extend(parishBounds);
        }
      }
      if (bounds.isValid()) {
        this.suppressViewPersist = true;
        this.mapRef.fitBounds(bounds, {animate: false, padding: [20, 20]});
        setTimeout(() => {
          this.mapRef?.invalidateSize(true);
          this.suppressViewPersist = false;
        }, 300);
      }
    }
  }

  ngOnInit() {
    this.logger.info("AreaMapComponent ngOnInit started");
    this.isInitialized = true;
    this.initializeComponent();
    this.logger.info("AreaMapComponent ngOnInit completed");
  }

  private async ensureMembersWithLabel(): Promise<void> {
    if (this.membersLoaded || !this.memberLoginService.allowContentEdits()) {
      return;
    }
    this.membersLoaded = true;
    const members = await this.memberService.all();
    this.membersWithLabel = members.map(member => ({
      ...member,
      ngSelectAttributes: {label: memberDisambiguatedLabel(member)}
    })).sort(sortBy("ngSelectAttributes.label"));
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes["previewSharedDistrictStyle"] && !changes["previewSharedDistrictStyle"].firstChange && this.isInitialized) {
      this.logger.info("previewSharedDistrictStyle changed:", changes["previewSharedDistrictStyle"].currentValue);
      this.sharedDistrictStyle = changes["previewSharedDistrictStyle"].currentValue || SharedDistrictStyle.FIRST_GROUP;
      this.preserveCurrentView();
      this.rebuildMap();
    }
    if (changes["previewAreaColors"] && !changes["previewAreaColors"].firstChange && this.isInitialized) {
      this.areaColors = {...(changes["previewAreaColors"].currentValue || {})};
      this.preserveCurrentView();
      this.rebuildMap();
    }
    if (changes["previewSelectedGroups"] && !changes["previewSelectedGroups"].firstChange && this.isInitialized) {
      this.selectedGroups = changes["previewSelectedGroups"].currentValue || [];
      this.preserveCurrentView();
      this.rebuildMap();
    }
  }

  private preserveCurrentView() {
    if (this.mapRef) {
      try {
        this.savedCenter = this.mapRef.getCenter();
        this.savedZoom = this.mapRef.getZoom();
        this.preserveNextView = true;
        this.logger.info("Preserved current view:", { center: this.savedCenter, zoom: this.savedZoom });
      } catch (e) {
        this.logger.warn("Could not preserve current view:", e);
      }
    }
  }

  ngOnDestroy() {
    this.destroyPopupComponent();
    this.cmsSettingsSubscription?.unsubscribe();
    this.clearHoverTimeout();
    this.clearLegendHoverTimeout();
    if (this.stripePatternContainer) {
      this.stripePatternContainer.remove();
      this.stripePatternContainer = null;
    }
    if (this.parishLayer && this.mapRef) {
      this.mapRef.removeLayer(this.parishLayer);
      this.parishLayer = null;
    }
  }

  private initializeComponent() {
    if (this.row && this.pageContent) {
      this.logger.info("Initializing CMS mode with full context");
      this.initializeCmsMode();
    } else if (this.row && !this.pageContent) {
      this.logger.info("Initializing CMS preview mode (no persistence)");
      this.initializeCmsMode();
    } else {
      this.initializeStandaloneMode();
    }

    this.logger.info("Calling rebuildMap from initializeComponent");
    this.rebuildMap();
  }

  private initializeCmsMode() {
    this.logger.info("Initializing CMS mode");

    if (this.row && !this.row.areaMap) {
      this.row.areaMap = this.defaultAreaMapData();
    }

    if (this.row?.areaMap) {
      this.cmsSettings = this.row.areaMap;
    }

    this.region = this.systemConfigService.systemConfig()?.area?.shortName || this.cmsSettings?.region;
    this.mapHeight = this.cmsSettings?.mapHeight || 480;
    this.provider = (this.cmsSettings?.provider as MapProvider) || this.provider;
    this.osStyle = this.cmsSettings?.osStyle || this.osStyle;
    this.showControls = false;
    this.opacityNormal = this.cmsSettings?.opacityNormal || 0.5;
    this.opacityHover = this.cmsSettings?.opacityHover || 0.8;
    this.textOpacity = this.cmsSettings?.textOpacity || 0.9;
    this.selectedGroups = this.previewSelectedGroups || this.cmsSettings?.selectedGroups || [];
    this.clickAction = this.uiActions.initialValueFor(StoredValue.AREA_MAP_CLICK_ACTION, AreaMapClickAction.GROUP_WEBSITE) as AreaMapClickAction;
    this.areaColors = this.cmsSettings?.areaColors || {};
    this.showLegend = this.cmsSettings?.showLegend ?? false;
    this.legendPosition = this.cmsSettings?.legendPosition || LegendPosition.TOP_RIGHT;
    if (this.cmsSettings?.sharedDistrictStyle) {
      this.sharedDistrictStyle = this.cmsSettings.sharedDistrictStyle;
    }

    this.logger.info("CMS settings for map position:", {
      mapCenter: this.cmsSettings?.mapCenter,
      mapZoom: this.cmsSettings?.mapZoom
    });

    if (this.cmsSettings?.mapCenter && this.cmsSettings?.mapZoom) {
      this.savedCenter = L.latLng(this.cmsSettings.mapCenter[0], this.cmsSettings.mapCenter[1]);
      this.savedZoom = this.cmsSettings.mapZoom;
      this.preserveNextView = true;
      this.logger.info("Restored CMS map position:", {
        savedCenter: this.savedCenter,
        savedZoom: this.savedZoom
      });
    } else {
      this.logger.info("No CMS map position to restore");
    }

    this.mapControlsState = {
      provider: this.provider,
      osStyle: this.osStyle,
      mapHeight: this.mapHeight
    };

    if (!this.cmsSettingsSubscription) {
      this.cmsSettingsSubscription = this.broadcastService.on(NamedEventType.MARKDOWN_CONTENT_CHANGED, (event: NamedEvent<any>) => {
        if (event.data === this.row && this.row?.areaMap) {
          this.restyleParishLayer();
          const selectedGroupsChanged = JSON.stringify(this.row.areaMap.selectedGroups) !== JSON.stringify(this.selectedGroups);
          const opacityNormalChanged = this.row.areaMap.opacityNormal !== this.opacityNormal;
          const opacityHoverChanged = this.row.areaMap.opacityHover !== this.opacityHover;
          const textOpacityChanged = this.row.areaMap.textOpacity !== this.textOpacity;
          const heightChanged = this.row.areaMap.mapHeight !== this.mapHeight;
          const zoomChanged = this.row.areaMap.mapZoom !== this.savedZoom;
          const centerChanged = this.row.areaMap.mapCenter &&
            (!this.savedCenter ||
             this.row.areaMap.mapCenter[0] !== this.savedCenter.lat ||
             this.row.areaMap.mapCenter[1] !== this.savedCenter.lng);
          const providerChanged = this.row.areaMap.provider !== this.provider;
          const osStyleChanged = this.row.areaMap.osStyle !== this.osStyle;

          if (selectedGroupsChanged) {
            this.selectedGroups = this.row.areaMap.selectedGroups || [];
          }

          if (opacityNormalChanged) {
            this.opacityNormal = this.row.areaMap.opacityNormal;
          }

          if (opacityHoverChanged) {
            this.opacityHover = this.row.areaMap.opacityHover;
          }

          if (textOpacityChanged) {
            this.textOpacity = this.row.areaMap.textOpacity;
          }

          if (heightChanged) {
            this.mapHeight = this.row.areaMap.mapHeight;
            setTimeout(() => this.mapRef?.invalidateSize(true), 0);
          }

          if (providerChanged) {
            this.provider = this.row.areaMap.provider as MapProvider;
            this.mapControlsState.provider = this.provider;
          }

          if (osStyleChanged) {
            this.osStyle = this.row.areaMap.osStyle || this.osStyle;
            this.mapControlsState.osStyle = this.osStyle;
          }

          if (zoomChanged && this.mapRef) {
            this.savedZoom = this.row.areaMap.mapZoom;
            this.mapRef.off("zoomend");
            this.mapRef.setZoom(this.row.areaMap.mapZoom);
            setTimeout(() => {
              if (this.mapRef) {
                this.mapRef.invalidateSize();
                this.mapRef.on("zoomend", () => this.handleZoomEnd());
              }
            }, 50);
          }

          if (centerChanged && this.mapRef && this.row.areaMap.mapCenter) {
            this.savedCenter = L.latLng(this.row.areaMap.mapCenter[0], this.row.areaMap.mapCenter[1]);
            this.mapRef.off("moveend");
            this.mapRef.setView(this.savedCenter, this.mapRef.getZoom(), { animate: false });
            setTimeout(() => {
              if (this.mapRef) {
                this.mapRef.on("moveend", () => this.handleMoveEnd());
              }
            }, 0);
          }

          if (selectedGroupsChanged || opacityNormalChanged || opacityHoverChanged || textOpacityChanged) {
            if (this.mapRef) {
              this.updateMap();
            }
          }
        }
      });
    }
  }

  private defaultAreaMapData(): AreaMapData {
    const systemConfig = this.systemConfigService.systemConfig();
    const regionName = systemConfig?.area?.shortName;
    return {
      region: regionName,
      title: "Areas",
      mapCenter: this.mapDefaults.center(),
      mapZoom: this.mapDefaults.zoom(),
      mapHeight: 480,
      showControls: true,
      selectedGroups: [],
      clickAction: "group-website" as any,
      opacityNormal: 0.5,
      opacityHover: 0.8,
      textOpacity: 0.9,
      provider: MapProvider.OSM,
      osStyle: OUTDOOR_OS_STYLE,
      areaColors: {},
      showLegend: false,
      legendPosition: LegendPosition.TOP_RIGHT,
      sharedDistrictStyle: systemConfig?.area?.sharedDistrictStyle
    };
  }

  private broadcastCmsChange() {
    if (this.row) {
      this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.MARKDOWN_CONTENT_CHANGED, this.row));
    }
  }

  private initializeStandaloneMode() {
    this.logger.info("Initializing standalone mode");
    const initialState = this.mapControlsStateService.queryInitialState({
      provider: MapProvider.OSM,
      osStyle: OUTDOOR_OS_STYLE,
      mapHeight: 480
    });
    this.logger.info("Initial map state:", initialState);
    this.provider = initialState.provider;
    this.osStyle = initialState.osStyle;
    this.mapHeight = this.preview ? 560 : (initialState.mapHeight || 480);
    this.mapControlsState = initialState;
    this.showControls = this.preview ? false : this.uiActions.initialBooleanValueFor(StoredValue.MAP_SHOW_CONTROLS, true);
    this.clickAction = this.uiActions.initialValueFor(StoredValue.AREA_MAP_CLICK_ACTION, AreaMapClickAction.GROUP_WEBSITE) as AreaMapClickAction;
    if (this.preview) {
      this.selectedGroups = [];
    }
    this.loadOpacityFromStorage();
    this.loadAreaColorsFromStorage();
  }

  onProviderChange(value: MapProvider) {
    if (this.standalone) {
      this.provider = value;
      this.mapControlsState.provider = value;
      this.mapControlsStateService.saveProvider(value);
      this.recreateMap(true);
    } else if (this.row?.areaMap) {
      this.provider = value;
      this.row.areaMap.provider = value;
      if (value === MapProvider.OS && !this.osStyle) {
        this.osStyle = OUTDOOR_OS_STYLE;
        this.row.areaMap.osStyle = this.osStyle;
      }
      this.broadcastCmsChange();
      this.recreateMap(true);
    }
  }

  onStyleChange(value: string) {
    if (this.standalone) {
      this.osStyle = value;
      this.mapControlsState.osStyle = value;
      this.mapControlsStateService.saveOsStyle(value);
      this.recreateMap(true);
    } else if (this.row?.areaMap) {
      this.osStyle = value;
      this.row.areaMap.osStyle = value;
      this.broadcastCmsChange();
      this.recreateMap(true);
    }
  }

  onHeightChange(value: number) {
    if (this.standalone) {
      this.mapHeight = value;
      this.mapControlsState.mapHeight = value;
      this.mapControlsStateService.saveHeight(value);
    } else if (this.row?.areaMap) {
      this.mapHeight = value;
      this.row.areaMap.mapHeight = value;
      this.broadcastCmsChange();
    }
    setTimeout(() => {
      this.mapRef?.invalidateSize(true);
    }, 0);
  }

  onResizerHeightChange(value: number) {
    this.mapHeight = value;
    if (this.standalone && !this.preview) {
      this.mapControlsState.mapHeight = value;
      this.mapControlsStateService.saveHeight(value);
    } else if (this.row?.areaMap) {
      this.row.areaMap.mapHeight = value;
      this.broadcastCmsChange();
    }
    setTimeout(() => {
      this.mapRef?.invalidateSize(true);
    }, 0);
  }

  onOpacityChange() {
    if (this.standalone) {
      this.saveOpacityToStorage();
    }
    this.areaLayerMap.forEach(polygon => {
      polygon.setStyle({fillOpacity: this.opacityNormal});
    });
    this.updateLabelOpacity();
    this.broadcastCmsChange();
  }

  private updateLabelOpacity() {
    document.querySelectorAll(".group-name-label span").forEach(el => {
      (el as HTMLElement).style.background = `rgba(60, 60, 60, ${this.textOpacity})`;
    });
  }

  onGroupSelectionChange() {
    if (this.row?.areaMap) {
      this.row.areaMap.selectedGroups = this.selectedGroups;
    }
    this.updateMap();
  }

  toggleControls() {
    if (!this.standalone) {
      return;
    }
    this.showControls = !this.showControls;
    this.mapControlsStateService.saveShowControls(this.showControls);
  }

  onMapReady(map: L.Map) {
    this.mapRef = map;
    this.logger.info("Map ready, preview:", this.preview, "fitBounds:", !!this.fitBounds);

    map.on("zoomend", () => this.handleZoomEnd());
    map.on("moveend", () => this.handleMoveEnd());

    if (this.preview) {
      this.applyFitBoundsWhenReady();
    }
    if (this.mapFullScreen) {
      this.scheduleMapInvalidate();
    }
  }

  refreshMapSize() {
    if (this.mapRef) {
      setTimeout(() => {
        this.mapRef?.invalidateSize(true);
        if (this.fitBounds?.isValid()) {
          this.mapRef?.fitBounds(this.fitBounds, {animate: false, padding: [20, 20]});
        }
      }, 100);
    }
  }

  private applyFitBoundsWhenReady(attempt = 0) {
    const maxAttempts = 10;
    const delay = 50;

    setTimeout(() => {
      if (!this.mapRef) {
        if (attempt < maxAttempts) {
          this.applyFitBoundsWhenReady(attempt + 1);
        }
        return;
      }

      const container = this.mapRef.getContainer();
      const hasSize = container && container.offsetWidth > 0 && container.offsetHeight > 0;

      if (!hasSize && attempt < maxAttempts) {
        this.applyFitBoundsWhenReady(attempt + 1);
        return;
      }

      this.mapRef.invalidateSize(true);

      if (this.fitBounds && this.fitBounds.isValid()) {
        this.logger.info(`Applying fitBounds on attempt ${attempt}:`, this.fitBounds.toBBoxString());
        this.mapRef.fitBounds(this.fitBounds, { animate: false, padding: [20, 20] });
      } else if (attempt < maxAttempts) {
        this.applyFitBoundsWhenReady(attempt + 1);
      } else {
        this.logger.warn("Could not apply fitBounds after max attempts");
      }
    }, delay);
  }

  private recreateMap(preserveView = false) {
    const context = {
      mapRef: this.mapRef,
      savedCenter: this.savedCenter,
      savedZoom: this.savedZoom,
      preserveNextView: this.preserveNextView,
      showMap: this.showMap,
      logger: this.logger,
      leafletLayers: this.layers,
      fitBounds: this.fitBounds,
      options: this.options
    };

    this.mapRecreation.recreateMap(
      context,
      {
        onRebuildMap: () => {
          this.mapKey++;
        },
        onSetShowMap: (show: boolean) => this.showMap = show,
        onAfterShowMap: () => {
          this.rebuildMap();
        }
      },
      preserveView
    );

    this.mapRef = context.mapRef;
    this.savedCenter = context.savedCenter;
    this.savedZoom = context.savedZoom;
    this.preserveNextView = context.preserveNextView;
    this.showMap = context.showMap;
    this.layers = context.leafletLayers || [];
    this.fitBounds = context.fitBounds;
    this.options = context.options;
  }

  private rebuildMap() {
    this.logger.info("rebuildMap: provider:", this.provider, "osStyle:", this.osStyle);
    this.rebuildMapWithGeoJSON();
  }

  private updateMap() {
    this.logger.info("updateMap called - rebuilding map");
    this.rebuildMap();
  }

  private loadOpacityFromStorage() {
    const normalOpacity = this.uiActions.initialValueFor(StoredValue.GROUP_AREA_OPACITY_NORMAL, 0.5);
    const hoverOpacity = this.uiActions.initialValueFor(StoredValue.GROUP_AREA_OPACITY_HOVER, 0.8);
    const textOpacity = this.uiActions.initialValueFor(StoredValue.GROUP_AREA_TEXT_OPACITY, 0.9);
    this.opacityNormal = isNumber(normalOpacity) ? normalOpacity : parseFloat(normalOpacity as string) || 0.5;
    this.opacityHover = isNumber(hoverOpacity) ? hoverOpacity : parseFloat(hoverOpacity as string) || 0.8;
    this.textOpacity = isNumber(textOpacity) ? textOpacity : parseFloat(textOpacity as string) || 0.9;
  }

  private saveOpacityToStorage() {
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_OPACITY_NORMAL, this.opacityNormal);
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_OPACITY_HOVER, this.opacityHover);
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_TEXT_OPACITY, this.textOpacity);
  }

  private loadAreaColorsFromStorage() {
    this.areaColors = this.uiActions.initialObjectValueFor<Record<string, string>>(StoredValue.GROUP_AREA_COLORS, {});
  }

  private saveAreaColorsToStorage() {
    this.uiActions.saveValueFor(StoredValue.GROUP_AREA_COLORS, this.areaColors);
  }

  private ensureStripePatternContainer(): HTMLElement {
    if (!this.stripePatternContainer) {
      this.stripePatternContainer = document.createElement("div");
      this.stripePatternContainer.id = "area-map-stripe-patterns";
      this.stripePatternContainer.innerHTML = `<svg style="position: absolute; width: 0; height: 0;"><defs></defs></svg>`;
      document.body.appendChild(this.stripePatternContainer);
    }
    return this.stripePatternContainer;
  }

  private appendPatternDefinition(patternSvg: string) {
    const defs = this.ensureStripePatternContainer().querySelector("defs");
    if (defs) {
      defs.insertAdjacentHTML("beforeend", patternSvg);
    }
  }

  private createStripePattern(colors: string[]): string {
    const patternId = `stripe-pattern-${this.stripePatternCounter++}`;
    this.appendPatternDefinition(stripePatternSvg(colors, patternId));
    return `url(#${patternId})`;
  }

  private createGradientPattern(colors: string[]): string {
    const patternId = `gradient-pattern-${this.stripePatternCounter++}`;
    this.appendPatternDefinition(gradientPatternSvg(colors, patternId));
    return `url(#${patternId})`;
  }

  private clearStripePatterns() {
    if (this.stripePatternContainer) {
      const defs = this.stripePatternContainer.querySelector("defs");
      if (defs) {
        defs.innerHTML = "";
      }
    }
    this.stripePatternCounter = 0;
  }

  private resolveAreaColor(areaName: string): string {
    if (!this.areaColors[areaName]) {
      const hue = Math.floor(Math.random() * 360);
      const saturation = 60 + Math.floor(Math.random() * 30);
      const lightness = 45 + Math.floor(Math.random() * 20);
      this.areaColors[areaName] = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      if (this.standalone) {
        this.saveAreaColorsToStorage();
      }
    }
    return this.areaColors[areaName];
  }

  private resolveLabelPosition(initial: L.LatLng, text: string): L.LatLng {
    if (this.mapRef) {
      const size = estimateLabelSize(text);
      const originPoint = this.mapRef.latLngToLayerPoint(initial);
      const placement = findLabelPlacement(originPoint, size, this.labelPlacements);
      if (placement) {
        this.labelPlacements.push(placement.bounds);
        return this.mapRef.layerPointToLatLng(L.point(placement.point.x, placement.point.y));
      } else {
        this.labelPlacements.push(labelBoundsAround(originPoint, size));
        return initial;
      }
    } else {
      const offset = hashedLabelOffset(text);
      return L.latLng(initial.lat + offset.lat, initial.lng + offset.lng);
    }
  }

  private rebuildMapWithGeoJSON() {
    this.logger.info("rebuildMapWithGeoJSON: fetching data from backend");
    this.dataLoading = true;
    this.resetOverlayState();
    this.configureMapOptions();
    this.preserveNextView = false;
    this.areas.getRegionWithBoundsAsync(this.region, {
      north: 51.55,
      south: 50.90,
      west: -0.10,
      east: 1.60
    }).subscribe({
      next: (cfg) => this.applyRegionConfig(cfg),
      error: (error) => {
        this.logger.error("Failed to fetch GeoJSON areas:", error);
        this.layers = [];
        this.dataLoading = false;
        this.loadParishesIfEnabled([]);
      }
    });
  }

  private resetOverlayState() {
    this.labelPlacements = [];
    this.clearStripePatterns();
    this.areaLayerMap.clear();
    this.areaDataMap.clear();
  }

  private configureMapOptions() {
    const baseLayer = this.tiles.createBaseLayer(this.provider, this.osStyle);
    this.options = {
      center: this.initialMapCenter(),
      zoom: this.initialMapZoom(),
      maxZoom: this.tiles.maxZoomForStyle(this.provider, this.osStyle),
      crs: this.tiles.crsForStyle(this.provider, this.osStyle),
      zoomDelta: 0.25,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 120,
      layers: [baseLayer]
    };
  }

  private initialMapCenter(): L.LatLng {
    if (this.preserveNextView && this.savedCenter) {
      return this.savedCenter;
    } else if (this.cmsSettings?.mapCenter && isArray(this.cmsSettings.mapCenter)) {
      return L.latLng(this.cmsSettings.mapCenter[0], this.cmsSettings.mapCenter[1]);
    } else if (this.preview) {
      return L.latLng(52.5, -1.5);
    } else {
      const storedCenter = this.standalone ? this.uiActions.initialObjectValueFor<{
        lat: number,
        lng: number
      }>(StoredValue.AREA_MAP_CENTER, null) : null;
      return storedCenter && isNumber(storedCenter.lat) && isNumber(storedCenter.lng)
        ? L.latLng(storedCenter.lat, storedCenter.lng)
        : L.latLng(52.5, -1.5);
    }
  }

  private initialMapZoom(): number {
    if (this.preserveNextView && this.savedZoom) {
      return clampZoom(this.savedZoom);
    } else if (this.cmsSettings?.mapZoom && isNumber(this.cmsSettings.mapZoom)) {
      return clampZoom(this.cmsSettings.mapZoom);
    } else if (this.preview) {
      return 6;
    } else {
      const storedZoom = this.standalone ? this.uiActions.initialValueFor(StoredValue.AREA_MAP_ZOOM, null) as any : null;
      return isNull(storedZoom) ? 9 : this.validatedStoredZoom(storedZoom);
    }
  }

  private validatedStoredZoom(storedZoom: any): number {
    const parsedZoom = parsedStoredZoom(storedZoom);
    if (zoomWithinStoredRange(parsedZoom)) {
      return parsedZoom;
    } else {
      this.persistDefaultZoom();
      return 9;
    }
  }

  private persistDefaultZoom() {
    if (this.row?.areaMap) {
      this.row.areaMap.mapZoom = 9;
      this.broadcastCmsChange();
    } else {
      this.uiActions.saveValueFor(StoredValue.AREA_MAP_ZOOM, 9);
    }
  }

  private applyRegionConfig(cfg: GroupAreaRegionConfig | null) {
    if (!cfg || !cfg.areas || cfg.areas.length === 0) {
      this.logger.info("No GeoJSON areas received from backend, showParishes:", this.cmsSettings?.showParishes, "mapCenter:", this.cmsSettings?.mapCenter);
      this.layers = [];
      this.dataLoading = false;
      this.loadParishesIfEnabled([]);
      return;
    }

    this.applySharedDistrictSettings(cfg);
    this.applyConfigCenterWhenViewUnset(cfg);
    const validAreas = cfg.areas.filter(area => featureHasRenderableGeometry(area.geoJsonFeature));
    const showAreas = this.cmsSettings?.showAreas !== false;
    this.availableGroups = validAreas.map(area => area.name).sort();
    const areasToDisplay = showAreas
      ? (this.selectedGroups.length > 0
        ? validAreas.filter(area => this.selectedGroups.includes(area.name))
        : validAreas)
      : [];
    this.logger.info(`Creating overlays for ${areasToDisplay.length} areas (showAreas: ${showAreas})`);
    const sortedAreas = [...areasToDisplay].sort((a, b) => a.name.localeCompare(b.name));
    this.logAreaDiagnostics(sortedAreas);
    const sharedDistrictPatterns = this.sharedDistrictPatternsForStyle();

    const overlays: L.Layer[] = sortedAreas.map((area, index) => this.createAreaOverlay(area, index, sharedDistrictPatterns));
    this.layers = overlays;
    this.legendItems = sortedAreas.map(area => ({
      name: area.name,
      color: area.color || this.areaColors[area.name] || "#888888"
    }));
    const bounds = this.combinedOverlayBounds(overlays, cfg);
    this.applyBoundsToView(bounds, cfg);
    this.logger.info("Successfully loaded GeoJSON areas");
    this.dataLoading = false;
    this.loadParishesIfEnabled(validAreas, bounds);
  }

  private applySharedDistrictSettings(cfg: GroupAreaRegionConfig) {
    this.sharedDistricts = cfg.sharedDistricts || {};
    if (this.preview && this.previewSharedDistrictStyle) {
      this.sharedDistrictStyle = this.previewSharedDistrictStyle;
    } else if (this.cmsSettings?.sharedDistrictStyle) {
      this.sharedDistrictStyle = this.cmsSettings.sharedDistrictStyle;
    } else {
      this.sharedDistrictStyle = cfg.sharedDistrictStyle || SharedDistrictStyle.FIRST_GROUP;
    }
    this.mainAreaGroupCodes = cfg.mainAreaGroupCodes || [];
    this.logger.info("Shared districts:", keys(this.sharedDistricts), "style:", this.sharedDistrictStyle, "preview:", this.preview, "previewStyle:", this.previewSharedDistrictStyle);
  }

  private applyConfigCenterWhenViewUnset(cfg: GroupAreaRegionConfig) {
    if (!this.preserveNextView && !this.savedCenter && cfg.center && this.mapRef) {
      const configCenter = L.latLng(cfg.center[0], cfg.center[1]);
      const configZoom = cfg.zoom || 10;
      this.mapRef.setView(configCenter, configZoom, { animate: false });
      this.logger.info("Applied region config center:", configCenter, "zoom:", configZoom);
    }
  }

  private logAreaDiagnostics(sortedAreas: GroupAreaConfig[]) {
    this.logger.info("All area popup data:", sortedAreas.map(area => ({
      name: area.name,
      url: area.url,
      externalUrl: area.externalUrl,
      groupCode: area.groupCode,
      isMainArea: area.groupCode ? this.mainAreaGroupCodes.includes(area.groupCode) : false
    })));
    sortedAreas.slice(0, 3).forEach((area, index) => {
      const geoJson = area.geoJsonFeature as any;
      const coordSample = geoJson?.geometry?.coordinates?.[0]?.[0]?.slice(0, 2) ||
        geoJson?.features?.[0]?.geometry?.coordinates?.[0]?.[0]?.slice(0, 2);
      this.logger.info(`Area ${index} "${area.name}" GeoJSON structure:`, {
        type: geoJson?.type,
        geometryType: geoJson?.geometry?.type,
        featureCount: geoJson?.features?.length,
        hasCoordinates: !!(geoJson?.geometry?.coordinates?.length || geoJson?.features?.[0]?.geometry?.coordinates?.length),
        coordSample
      });
    });
  }

  private get usingSharedDistrictPatterns(): boolean {
    return this.sharedDistrictStyle === SharedDistrictStyle.STRIPES || this.sharedDistrictStyle === SharedDistrictStyle.GRADIENT;
  }

  private sharedDistrictPatternsForStyle(): Record<string, string> {
    const sharedDistrictPatterns: Record<string, string> = {};
    if (this.usingSharedDistrictPatterns) {
      toPairs(this.sharedDistricts).forEach(([district, info]) => {
        const colors = info.groups.map(g => g.color);
        sharedDistrictPatterns[district] = this.sharedDistrictStyle === SharedDistrictStyle.STRIPES
          ? this.createStripePattern(colors)
          : this.createGradientPattern(colors);
      });
    }
    return sharedDistrictPatterns;
  }

  get coverageFocusMode(): boolean {
    return !!this.cmsSettings?.showParishes && this.cmsSettings?.showGroupLabels === false;
  }

  private createAreaOverlay(area: GroupAreaConfig, index: number, sharedDistrictPatterns: Record<string, string>): L.Layer {
    const borderColor = this.areaColors[area.name] || area.color || this.resolveAreaColor(area.name);
    const fillColor = lightenedFillColor(borderColor);
    this.warnWhenAreaHasNoCoordinates(area);
    const polygon = this.createAreaPolygon(area, borderColor, fillColor, sharedDistrictPatterns);
    this.areaLayerMap.set(area.name, polygon);
    this.areaDataMap.set(area.name, area);
    if (this.coverageFocusMode) {
      return L.layerGroup([polygon]);
    } else {
      this.bindAreaTooltipAndPopup(polygon, area);
      const marker = this.createAreaLabelMarker(polygon, area, index);
      this.attachAreaHoverHandlers(polygon, marker);
      return marker ? L.layerGroup([polygon, marker]) : L.layerGroup([polygon]);
    }
  }

  private warnWhenAreaHasNoCoordinates(area: GroupAreaConfig) {
    if (!featureHasRenderableGeometry(area.geoJsonFeature)) {
      this.logger.warn("Area has no coordinates:", area.name, area.geoJsonFeature);
    }
  }

  private createAreaPolygon(area: GroupAreaConfig, borderColor: string, fillColor: string, sharedDistrictPatterns: Record<string, string>): L.GeoJSON {
    const polygon = L.geoJSON(area.geoJsonFeature, {
      interactive: !this.coverageFocusMode,
      style: (feature) => this.areaFeatureStyle(feature, borderColor, fillColor),
      onEachFeature: (feature, layer) => {
        const districtName = feature?.properties?.LAD23NM;
        if (districtName && sharedDistrictPatterns[districtName] && this.usingSharedDistrictPatterns) {
          (layer as any)._sharedDistrictPattern = sharedDistrictPatterns[districtName];
        }
      }
    });
    if (this.usingSharedDistrictPatterns) {
      polygon.on("add", () => this.applyPatternFills(polygon));
    }
    return polygon;
  }

  private areaFeatureStyle(feature: any, borderColor: string, fillColor: string): L.PathOptions {
    const districtName = feature?.properties?.LAD23NM;
    const isShared = districtName && this.sharedDistricts[districtName];
    const dashedBorder = isShared && this.sharedDistrictStyle === SharedDistrictStyle.DASHED_BORDER;
    return {
      color: borderColor,
      weight: dashedBorder ? 3 : 2,
      fillColor,
      fillOpacity: this.opacityNormal,
      dashArray: dashedBorder ? "8, 4" : undefined
    };
  }

  private bindAreaTooltipAndPopup(polygon: L.GeoJSON, area: GroupAreaConfig) {
    const tooltipContent = `${area.name} — click for options`;
    const tooltipOptions: L.TooltipOptions = {
      sticky: true,
      direction: "top",
      className: "bootstrap-tooltip",
      opacity: 0.9
    };
    polygon.bindTooltip(tooltipContent, tooltipOptions);
    polygon.on("click", (e) => {
      polygon.unbindTooltip();
      this.showAreaPopup(e.latlng, area);
    });
    polygon.on("popupclose", () => {
      polygon.bindTooltip(tooltipContent, tooltipOptions);
    });
  }

  private createAreaLabelMarker(polygon: L.GeoJSON, area: GroupAreaConfig, index: number): L.Marker | null {
    if (this.cmsSettings?.showGroupLabels === false) {
      return null;
    } else {
      const centroid = this.areaCentroid(polygon, area);
      return centroid ? L.marker(this.resolveLabelPosition(centroid, area.name), {
        icon: L.divIcon({
          className: "group-name-label",
          html: this.areaLabelHtml(area.name),
          iconSize: undefined,
          iconAnchor: [0, 0]
        }),
        zIndexOffset: 1000 + index
      }) : null;
    }
  }

  private areaCentroid(polygon: L.GeoJSON, area: GroupAreaConfig): L.LatLng | null {
    try {
      return polygon.getBounds().getCenter();
    } catch (error) {
      this.logger.warn("Could not calculate centroid for:", area.name);
      return null;
    }
  }

  private areaLabelHtml(name: string): string {
    return `<span style="
                  background: rgba(60, 60, 60, ${this.textOpacity});
                  padding: 4px 6px;
                  font-size: 11px;
                  font-weight: 500;
                  color: white;
                  border-radius: 3px;
                  pointer-events: none;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: inline-block;
                  white-space: nowrap;
                  line-height: 1.2;
                  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
                  max-width: none;
                ">${name}</span>`;
  }

  private attachAreaHoverHandlers(polygon: L.GeoJSON, marker: L.Marker | null) {
    polygon.on("mouseover", () => {
      polygon.setStyle({fillOpacity: this.opacityHover});
      marker?.getElement()?.style.setProperty("display", "none");
    });
    polygon.on("mouseout", () => {
      polygon.setStyle({fillOpacity: this.opacityNormal});
      this.reapplyPatterns(polygon);
      marker?.getElement()?.style.setProperty("display", "block");
    });
  }

  private combinedOverlayBounds(overlays: L.Layer[], cfg: GroupAreaRegionConfig): L.LatLngBounds {
    const bounds = L.latLngBounds([]);
    let validBoundsCount = 0;
    let totalLayersChecked = 0;
    overlays.forEach((layerGroup: any, groupIndex: number) => {
      layerGroup.eachLayer((layer: any) => {
        totalLayersChecked++;
        if (layer && isFunction(layer.getBounds)) {
          try {
            const layerBounds = layer.getBounds();
            const isValid = layerBounds && layerBounds.isValid();
            this.logger.debug(`Layer ${groupIndex}.${totalLayersChecked} bounds:`, {
              hasGetBounds: true,
              boundsValid: isValid,
              bounds: isValid ? layerBounds.toBBoxString() : "invalid",
              layerType: layer.constructor?.name || "unknown"
            });
            if (isValid) {
              bounds.extend(layerBounds);
              validBoundsCount++;
            }
          } catch (e) {
            this.logger.warn(`Layer ${groupIndex}.${totalLayersChecked} getBounds() threw error:`, e);
          }
        } else if (layer instanceof L.GeoJSON) {
          layer.eachLayer((subLayer: any) => {
            if (subLayer && isFunction(subLayer.getBounds)) {
              try {
                const subBounds = subLayer.getBounds();
                if (subBounds && subBounds.isValid()) {
                  bounds.extend(subBounds);
                  validBoundsCount++;
                  this.logger.debug(`GeoJSON sublayer bounds valid:`, subBounds.toBBoxString());
                }
              } catch (e) {
                this.logger.warn(`GeoJSON sublayer getBounds() threw error:`, e);
              }
            }
          });
        }
      });
    });
    this.logger.info("Areas loaded:", cfg.areas?.length, "layers:", overlays.length, "layersChecked:", totalLayersChecked, "valid bounds:", validBoundsCount, "total bounds valid:", bounds.isValid(), "preview:", this.preview);
    return bounds;
  }

  private applyBoundsToView(bounds: L.LatLngBounds, cfg: GroupAreaRegionConfig) {
    if (!this.preserveNextView && bounds.isValid()) {
      this.fitBounds = bounds.pad(0.05);
      this.logger.info("fitBounds set to:", this.fitBounds?.toBBoxString());
    } else if (this.preview && !bounds.isValid()) {
      this.logger.warn("Preview mode: bounds invalid, using region center fallback");
      if (cfg.center && cfg.zoom) {
        this.logger.info("Using region config center:", cfg.center, "zoom:", cfg.zoom);
        if (this.mapRef) {
          this.mapRef.setView(L.latLng(cfg.center[0], cfg.center[1]), cfg.zoom, { animate: false });
        } else {
          this.options.center = L.latLng(cfg.center[0], cfg.center[1]);
          this.options.zoom = cfg.zoom;
        }
      }
    }
  }

  private loadParishesIfEnabled(areas: GroupAreaConfig[], areaBounds?: L.LatLngBounds) {
    if (!this.cmsSettings?.showParishes) {
      return;
    }
    const boundsFromAreas = areaBounds?.isValid() ? areaBounds : this.computeBoundsFromAreas(areas);
    const bounds = boundsFromAreas.isValid() ? boundsFromAreas : this.computeBoundsFromMapSettings();
    if (bounds.isValid()) {
      this.loadParishOverlay(bounds, areas);
    } else {
      this.logger.warn("Cannot load parishes: no valid bounds available from areas or map settings");
    }
  }

  private computeBoundsFromMapSettings(): L.LatLngBounds {
    const center = this.cmsSettings?.mapCenter;
    if (center && isArray(center) && center.length === 2) {
      const corners = boundsCornersAround({lat: center[0], lng: center[1]}, this.cmsSettings?.mapZoom ?? 10);
      return L.latLngBounds(
        [corners.southWest.lat, corners.southWest.lng],
        [corners.northEast.lat, corners.northEast.lng]
      );
    } else {
      return L.latLngBounds([]);
    }
  }

  private computeBoundsFromAreas(areas: GroupAreaConfig[]): L.LatLngBounds {
    const allBounds = L.latLngBounds([]);
    areas.forEach(area => {
      try {
        const tempLayer = L.geoJSON(area.geoJsonFeature);
        const layerBounds = tempLayer.getBounds();
        if (layerBounds.isValid()) {
          allBounds.extend(layerBounds);
        }
      } catch (e) {
        this.logger.warn("Could not compute bounds for area:", area.name);
      }
    });
    return allBounds;
  }

  private buildAreaClipLayers(areas: GroupAreaConfig[]): L.GeoJSON[] {
    return areas.map(area => L.geoJSON(area.geoJsonFeature)).filter(layer => {
      try {
        return layer.getBounds().isValid();
      } catch {
        return false;
      }
    });
  }

  private isPointInsideAnyLayer(point: L.LatLng, layers: L.GeoJSON[]): boolean {
    return layers.some(areaLayer => {
      let inside = false;
      areaLayer.eachLayer((sublayer: any) => {
        if (!inside && sublayer.getBounds && sublayer.getBounds().contains(point)) {
          if (isFunction(sublayer.getLatLngs)) {
            inside = pointInPolygonRings(point, sublayer.getLatLngs());
          }
        }
      });
      return inside;
    });
  }

  private loadParishOverlay(areaBounds: L.LatLngBounds, areas: GroupAreaConfig[]) {
    this.parishesLoading = true;
    this.parishCount = 0;
    const bbox = {
      west: areaBounds.getWest(),
      south: areaBounds.getSouth(),
      east: areaBounds.getEast(),
      north: areaBounds.getNorth()
    };
    const groupCode = this.systemConfigService.systemConfig()?.group?.groupCode;
    this.logger.info("Loading parishes for bounds:", bbox, "groupCode:", groupCode);
    const parishes$ = this.parishService.queryParishes(bbox);
    const volunteerSnapshot$ = groupCode
      ? this.volunteerManagementService.coverage(groupCode).pipe(catchError(() => of(null as VolunteerMapCoverage | null)))
      : of(null as VolunteerMapCoverage | null);
    const clipLayers = this.buildAreaClipLayers(areas);
    forkJoin({parishes: parishes$, volunteerSnapshot: volunteerSnapshot$}).subscribe({
      next: ({parishes, volunteerSnapshot}) => this.renderParishOverlay(parishes, volunteerSnapshot, clipLayers),
      error: (error) => {
        this.logger.error("Failed to load parishes:", error);
        this.parishesLoading = false;
      }
    });
  }

  private renderParishOverlay(parishes: GeoJSON.FeatureCollection, volunteerSnapshot: VolunteerMapCoverage | null, clipLayers: L.GeoJSON[]) {
    this.logger.info(`Received ${parishes.features.length} parishes before clipping, ${volunteerSnapshot?.assignments.length ?? 0} volunteer assignments`);
    this.clippedParishFeatures = this.clipFeaturesToAreas(parishes.features, clipLayers);
    this.logger.info(`${this.clippedParishFeatures.length} parishes after clipping to area boundaries`);
    this.storeVolunteerCoverage(volunteerSnapshot);
    this.refreshParishLayer();
    this.parishOverlayLoaded = true;
    this.parishesLoading = false;
  }

  private refreshParishLayer() {
    const features = this.filteredParishFeatures();
    this.parishCount = features.length;
    this.replaceParishLayer({type: "FeatureCollection", features});
    this.attachParishLayerToMap();
  }

  private parishOverlayFilter(): ParishOverlayFilter {
    return {
      coverage: this.selectedParishCoverage,
      rightsOfWayGroupCode: this.selectedRightsOfWayGroup,
      localAuthorityCode: this.selectedLocalAuthority,
      sectorCode: this.selectedSector
    };
  }

  private filteredParishFeatures(): GeoJSON.Feature[] {
    const filter = this.parishOverlayFilter();
    return parishOverlayFilterActive(filter)
      ? this.clippedParishFeatures.filter(feature => {
          const props = feature.properties as ParishFeatureProperties;
          return parishMatchesOverlayFilter(filter, this.volunteerParishes.get(props?.PARNCP24CD), this.volunteerAssignments.get(props?.PARNCP24CD) ?? []);
        })
      : this.clippedParishFeatures;
  }

  onParishFilterChange() {
    this.refreshParishLayer();
  }

  get parishFilterControlsVisible(): boolean {
    return this.parishOverlayLoaded && !!this.cmsSettings?.showParishes;
  }

  private clipFeaturesToAreas(features: GeoJSON.Feature[], clipLayers: L.GeoJSON[]): GeoJSON.Feature[] {
    return clipLayers.length > 0
      ? features.filter(feature => {
          const tempLayer = L.geoJSON(feature);
          const center = tempLayer.getBounds().getCenter();
          return this.isPointInsideAnyLayer(center, clipLayers);
        })
      : features;
  }

  private storeVolunteerCoverage(volunteerSnapshot: VolunteerMapCoverage | null) {
    const parishes = volunteerSnapshot?.parishes ?? [];
    this.volunteerParishes = parishesByCode(parishes);
    this.volunteerAssignments = assignmentsByParishCode(volunteerSnapshot?.assignments ?? []);
    this.rightsOfWayGroupOptions = rightsOfWayGroupFilterOptions(parishes);
    this.localAuthorityOptions = localAuthorityFilterOptions(parishes);
    this.sectorOptions = sectorFilterOptions(parishes);
    this.rightsOfWayGroupColours = categoricalColourMap(this.rightsOfWayGroupOptions.map(option => option.value));
    this.localAuthorityColours = categoricalColourMap(this.localAuthorityOptions.map(option => option.value));
    this.sectorColours = categoricalColourMap(this.sectorOptions.map(option => option.value));
  }

  onParishColourModeChange(): void {
    this.restyleParishLayer();
  }

  get parishFiltersActive(): boolean {
    return this.parishColourMode !== ParishColourMode.COVERAGE
      || this.selectedParishCoverage.length > 0
      || this.selectedRightsOfWayGroup.length > 0
      || this.selectedLocalAuthority.length > 0
      || this.selectedSector.length > 0;
  }

  resetParishFilters(): void {
    this.parishColourMode = ParishColourMode.COVERAGE;
    this.selectedParishCoverage = [];
    this.selectedRightsOfWayGroup = [];
    this.selectedLocalAuthority = [];
    this.selectedSector = [];
    this.onParishFilterChange();
    this.onParishColourModeChange();
  }

  private restyleParishLayer(): void {
    if (this.parishLayer) {
      const style = this.parishOverlayStyle();
      this.parishLayer.setStyle(feature => this.parishFeatureStyle(feature, style));
    }
  }

  get parishColourLegend(): ParishColourLegendItem[] {
    const style = this.parishOverlayStyle();
    if (this.parishColourMode === ParishColourMode.COVERAGE) {
      return [
        {label: "Parish footpath observer covered", color: style.allocatedColor},
        {label: "Vacant", color: style.vacantColor}
      ];
    } else {
      const {options, colours} = this.parishColourDimension();
      const items = options.map(option => ({label: option.label, color: colours.get(option.value) ?? style.vacantColor}));
      return [...items, {label: "Not set", color: style.vacantColor}];
    }
  }

  private parishColourDimension(): {options: ParishFilterSelectOption[]; colours: Map<string, string>; codeFor: (parish: VolunteerParish | undefined) => string | undefined} {
    return this.parishColourMode === ParishColourMode.RIGHTS_OF_WAY_GROUP
      ? {options: this.rightsOfWayGroupOptions, colours: this.rightsOfWayGroupColours, codeFor: parish => parish?.rightsOfWayGroupCode}
      : this.parishColourMode === ParishColourMode.LOCAL_AUTHORITY
        ? {options: this.localAuthorityOptions, colours: this.localAuthorityColours, codeFor: parish => parish?.localAuthorityCode}
        : {options: this.sectorOptions, colours: this.sectorColours, codeFor: parish => parish?.sectorCode};
  }

  private parishOverlayStyle(): ParishOverlayStyle {
    return {
      allocatedColor: this.cmsSettings?.parishAllocatedColor || "#4a8c3f",
      vacantColor: this.cmsSettings?.parishVacantColor || "#cc0000",
      borderColor: this.cmsSettings?.parishBorderColor || "#3f3f3f",
      fillOpacity: this.cmsSettings?.parishFillOpacity ?? 0.7
    };
  }

  private replaceParishLayer(clippedParishes: GeoJSON.FeatureCollection) {
    if (this.parishLayer && this.mapRef) {
      this.mapRef.removeLayer(this.parishLayer);
    }
    const style = this.parishOverlayStyle();
    this.parishLayer = L.geoJSON(clippedParishes, {
      renderer: L.svg({padding: 0.5}),
      style: (feature) => this.parishFeatureStyle(feature, style),
      onEachFeature: (feature, layer) => this.bindParishInteractions(feature.properties as ParishFeatureProperties, layer, style)
    });
  }

  private parishFeatureStyle(feature: GeoJSON.Feature | undefined, style: ParishOverlayStyle): L.PathOptions {
    const props = feature?.properties as ParishFeatureProperties;
    return {
      color: style.borderColor,
      weight: 1,
      fillColor: this.parishFillColor(props, style),
      fillOpacity: style.fillOpacity
    };
  }

  private parishFillColor(props: ParishFeatureProperties | undefined, style: ParishOverlayStyle): string {
    if (this.parishColourMode === ParishColourMode.COVERAGE) {
      const assignment = props?.PARNCP24CD ? this.parishFootpathObserverAssignment(props.PARNCP24CD) : null;
      return assignment ? style.allocatedColor : style.vacantColor;
    } else {
      const {colours, codeFor} = this.parishColourDimension();
      const code = codeFor(props?.PARNCP24CD ? this.volunteerParishes.get(props.PARNCP24CD) : undefined);
      return (code && colours.get(code)) || style.vacantColor;
    }
  }

  private bindParishInteractions(props: ParishFeatureProperties, layer: L.Layer, style: ParishOverlayStyle) {
    if (props?.PARNCP24NM) {
      const assignment = this.parishFootpathObserverAssignment(props.PARNCP24CD);
      const assignee = assignment?.supporterId
        ? this.membersWithLabel.find(m => m.id === assignment.supporterId)
        : null;
      layer.bindTooltip(parishTooltipText(props.PARNCP24NM, assignment, assignee ? this.fullNamePipe.transform(assignee) : null), {
        sticky: true,
        direction: "top",
        className: "bootstrap-tooltip",
        opacity: 0.9
      });
      layer.on("click", async () => {
        if (this.mapRef) {
          await this.ensureMembersWithLabel();
          this.showParishPopup(props, layer, style);
        }
      });
      layer.on("mouseover", () => {
        if (this.popupComponentRef) {
          this.mapRef?.closePopup();
        }
        (layer as any).setStyle({fillOpacity: Math.min(1, style.fillOpacity + 0.3), weight: 2});
      });
      layer.on("mouseout", () => {
        const currentFill = this.parishFillColor(props, style);
        (layer as any).setStyle({fillColor: currentFill, fillOpacity: style.fillOpacity, weight: 1});
      });
    }
  }

  private attachParishLayerToMap() {
    if (this.mapRef) {
      if (this.layers.length > 0) {
        this.parishLayer.addTo(this.mapRef);
        this.parishLayer.bringToBack();
      } else {
        this.layers = [this.parishLayer];
        const parishBounds = this.parishLayer.getBounds();
        if (parishBounds.isValid()) {
          this.fitBounds = parishBounds.pad(0.05);
        }
      }
    }
  }

  private destroyPopupComponent() {
    if (this.popupComponentRef) {
      this.appRef.detachView(this.popupComponentRef.hostView);
      this.popupComponentRef.destroy();
      this.popupComponentRef = null;
    }
  }

  private showParishPopup(props: ParishFeatureProperties, layer: L.Layer, style: ParishOverlayStyle) {
    this.destroyPopupComponent();
    const assignment = this.parishFootpathObserverAssignment(props.PARNCP24CD);
    const isAdmin = this.memberLoginService.allowVolunteerAdminEdits();

    const componentRef = createComponent(ParishPopup, {
      environmentInjector: this.environmentInjector
    });

    componentRef.instance.props = props;
    componentRef.instance.assignment = assignment;
    componentRef.instance.isAdmin = isAdmin;
    componentRef.instance.allocatedColor = style.allocatedColor;
    componentRef.instance.vacantColor = style.vacantColor;
    componentRef.instance.membersWithLabel = this.membersWithLabel;

    if (assignment?.supporterId) {
      const matched = this.membersWithLabel.find(m => m.id === assignment.supporterId);
      componentRef.instance.selectedMember = matched || null;
      componentRef.instance.assignedMember = matched || null;
    }

    componentRef.instance.memberAssigned.subscribe((member: Member | null) => {
      this.assignMemberToParish(props, layer, style, member);
    });

    componentRef.instance.statusToggled.subscribe(() => {
      this.markParishVacant(props, layer, style);
      this.mapRef?.closePopup();
    });

    componentRef.instance.closed.subscribe(() => {
      this.mapRef?.closePopup();
    });

    this.appRef.attachView(componentRef.hostView);
    this.popupComponentRef = componentRef;

    const popupElement = componentRef.location.nativeElement;

    L.popup({closeButton: true, autoClose: true, closeOnClick: true, autoPan: true, keepInView: true, autoPanPadding: [28, 28], className: "parish-admin-popup"})
      .setLatLng((layer as any).getBounds().getCenter())
      .setContent(popupElement)
      .openOn(this.mapRef!);

    this.mapRef?.once("popupclose", () => {
      this.destroyPopupComponent();
    });
  }

  private parishFootpathObserverAssignment(parishCode: string): VolunteerMapAssignment | null {
    return footpathObserverAssignment(this.volunteerAssignments.get(parishCode));
  }

  private markParishVacant(props: ParishFeatureProperties, layer: L.Layer, style: ParishOverlayStyle) {
    const assignment = this.parishFootpathObserverAssignment(props.PARNCP24CD);
    if (assignment?.id) {
      this.volunteerManagementService.endAssignment(assignment.id).subscribe({
        next: () => {
          this.volunteerAssignments.set(props.PARNCP24CD, withoutAssignment(this.volunteerAssignments.get(props.PARNCP24CD) ?? [], assignment.id));
          this.updateParishLayerPresentation(props, layer, style.vacantColor, style, "PFO vacant");
        },
        error: error => this.logger.error("Failed to end parish volunteer assignment", error)
      });
    }
  }

  private assignMemberToParish(props: ParishFeatureProperties, layer: L.Layer, style: ParishOverlayStyle, member: Member | null) {
    const groupCode = this.systemConfigService.systemConfig()?.group?.groupCode;
    if (!groupCode) {
      return;
    }
    const existing = this.parishFootpathObserverAssignment(props.PARNCP24CD);
    if (member?.id) {
      const assignment = footpathObserverAssignmentRequest(existing, groupCode, props.PARNCP24CD, member.id, null);
      const parish = volunteerParishFor(this.volunteerParishes.get(props.PARNCP24CD), groupCode, props);
      this.volunteerManagementService.saveParish(parish).subscribe({
        next: savedParish => {
          this.volunteerParishes.set(savedParish.parishCode, savedParish);
          const saveAssignment = existing?.id
            ? this.volunteerManagementService.updateAssignment(assignment)
            : this.volunteerManagementService.createAssignment(assignment);
          saveAssignment.subscribe({
            next: savedAssignment => {
              this.volunteerAssignments.set(props.PARNCP24CD, withFootpathObserverAssignment(this.volunteerAssignments.get(props.PARNCP24CD) ?? [], savedAssignment));
              this.updateParishLayerPresentation(props, layer, style.allocatedColor, style, `PFO covered - ${this.fullNamePipe.transform(member)}`);
            },
            error: error => this.logger.error("Failed to save parish volunteer assignment", error)
          });
        },
        error: error => this.logger.error("Failed to save volunteer parish", error)
      });
    } else {
      this.markParishVacant(props, layer, style);
    }
  }

  private updateParishLayerPresentation(props: ParishFeatureProperties, layer: L.Layer, fillColor: string, style: ParishOverlayStyle, status: string): void {
    (layer as any).setStyle({fillColor, fillOpacity: style.fillOpacity, color: style.borderColor, weight: 1});
    (layer as any).unbindTooltip();
    (layer as any).bindTooltip(`${props.PARNCP24NM} (${status})`, {
      sticky: true,
      direction: "top",
      className: "bootstrap-tooltip",
      opacity: 0.9
    });
  }

  private handleZoomEnd() {
    if (!this.suppressViewPersist) {
      if (this.mapRef && this.standalone) {
        const currentZoom = this.mapRef.getZoom();
        this.logger.info("Zoom changed to:", currentZoom);
        if (currentZoom && isFinite(currentZoom) && currentZoom >= 2 && currentZoom <= 18) {
          this.logger.info("Saving zoom level to storage:", currentZoom);
          this.uiActions.saveValueFor(StoredValue.AREA_MAP_ZOOM, currentZoom);
        } else {
          this.logger.warn("Not saving invalid zoom level:", currentZoom);
        }
      } else if (!this.standalone && this.mapRef && this.row?.areaMap) {
        const currentZoom = this.mapRef.getZoom();
        if (currentZoom && isFinite(currentZoom) && currentZoom >= 2 && currentZoom <= 18) {
          this.logger.info("CMS mode: updating editor zoom to:", currentZoom);
          this.row.areaMap.mapZoom = currentZoom;
          this.broadcastCmsChange();
        }
      } else {
        this.logger.warn("Zoom changed but mapRef is null");
      }
    }
  }

  private clearHoverTimeout() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }

  onLegendItemHover(event: MouseEvent, areaName: string, isHovering: boolean) {
    const polygon = this.areaLayerMap.get(areaName);
    if (polygon) {
      if (isHovering) {
        polygon.setStyle({ fillOpacity: 1.0, weight: 4 });
        polygon.bringToFront();
      } else {
        polygon.setStyle({ fillOpacity: this.opacityNormal, weight: 2 });
        this.reapplyPatterns(polygon);
      }
    }
  }

  onLegendItemClick(areaName: string) {
    const polygon = this.areaLayerMap.get(areaName);
    const areaData = this.areaDataMap.get(areaName);
    if (polygon && areaData) {
      const centroid = polygon.getBounds().getCenter();
      this.showAreaPopup(centroid, areaData);
    }
  }

  private clearLegendHoverTimeout() {
    if (this.legendHoverTimeout) {
      clearTimeout(this.legendHoverTimeout);
      this.legendHoverTimeout = null;
    }
  }

  private applyPatternFills(polygon: L.GeoJSON) {
    polygon.eachLayer((layer: any) => {
      if (layer._sharedDistrictPattern && layer._path) {
        layer._path.setAttribute("fill", layer._sharedDistrictPattern);
      }
    });
  }

  private reapplyPatterns(polygon: L.GeoJSON) {
    if (this.usingSharedDistrictPatterns) {
      this.applyPatternFills(polygon);
    }
  }

  private showAreaPopup(position: L.LatLng, area: { name: string; url: string; externalUrl?: string; groupCode?: string }) {
    this.logger.info("showAreaPopup area data:", area);
    const isMainAreaGroup = area.groupCode && this.mainAreaGroupCodes.includes(area.groupCode);
    const hasExternalUrl = !!area.externalUrl;
    const content = `
      <div style="text-align: center;">
        <div style="font-weight: 600; margin-bottom: 6px; font-size: 12px;">${area.name}</div>
        ${hasExternalUrl ? `<button type="button" class="badge bg-success border-0 me-1" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.open('${area.externalUrl}', '_blank'), 100);">group website</button>` : ""}
        ${area.url ? `<button type="button" class="badge bg-primary border-0 me-1" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.open('${area.url}', '_blank'), 100);">ramblers page</button>` : ""}
        ${isMainAreaGroup ? `<button type="button" class="badge bg-primary border-0" onclick="document.querySelector('.leaflet-popup-close-button')?.click(); setTimeout(() => window.location.href='/walks?${StoredValue.SEARCH}=${encodeURIComponent(area.groupCode)}', 100);">view walks</button>` : ""}
      </div>
    `;

    if (!this.mapRef) {
      return;
    }

    const popup = L.popup({
      closeButton: true,
      autoClose: true,
      closeOnClick: true,
      className: "area-action-leaflet-popup"
    })
      .setLatLng(position)
      .setContent(content)
      .openOn(this.mapRef);

    const escHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        this.mapRef?.closePopup();
        document.removeEventListener("keydown", escHandler);
      }
    };
    document.addEventListener("keydown", escHandler);

    popup.on("remove", () => {
      document.removeEventListener("keydown", escHandler);
    });
  }

  private handleMoveEnd() {
    if (!this.suppressViewPersist) {
      if (this.mapRef && this.standalone) {
        const center = this.mapRef.getCenter();
        const centerObj = { lat: center.lat, lng: center.lng };
        this.logger.info("Map center changed to:", centerObj);
        this.uiActions.saveValueFor(StoredValue.AREA_MAP_CENTER, centerObj);
      } else if (!this.standalone && this.mapRef && this.row) {
        const center = this.mapRef.getCenter();
        this.logger.info("CMS mode: updating editor center to:", center.lat, center.lng);
        if (this.row.areaMap) {
          this.row.areaMap.mapCenter = [center.lat, center.lng];
          this.broadcastCmsChange();
        }
      } else {
        this.logger.warn("Map moved but mapRef is null");
      }
    }
  }
}
