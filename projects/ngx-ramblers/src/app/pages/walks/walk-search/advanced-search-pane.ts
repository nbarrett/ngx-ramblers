import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp, faLocationDot, faTimes } from "@fortawesome/free-solid-svg-icons";
import { NgSelectModule } from "@ng-select/ng-select";
import { DateRange, DateRangeSlider } from "../../../components/date-range-slider/date-range-slider";
import { DateTime } from "luxon";
import { Member } from "../../../models/member.model";
import { EventPopulation } from "../../../models/system.model";
import {
  AdvancedSearchCriteria,
  AdvancedSearchPreset,
  CUSTOM_PRESET_LABEL,
  DateRangeDirection,
  DateRangeUnit,
  DistanceRange,
  DistanceUnit,
  LocationMethod,
  PRESET_MATCH_THRESHOLD_MS,
  RANGE_UNIT_OPTIONS,
  SearchDateRange,
  WalkLeaderOption
} from "../../../models/search.model";
import { MemberService } from "../../../services/member/member.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { RamblersGroupWithLabel, WalkLeaderContact } from "../../../models/ramblers-walks-manager";
import { from, Subject } from "rxjs";
import { WALK_GRADES } from "../../../models/walk.model";
import { FEATURE_CATEGORIES, FeatureCategory } from "../../../models/walk-feature.model";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { sortBy } from "../../../functions/arrays";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { DataQueryOptions, FilterCriteria } from "../../../models/api-request.model";
import { isNumber } from "es-toolkit/compat";
import { DistanceRangeSlider } from "../../../components/distance-range-slider/distance-range-slider";
import { ActivatedRoute } from "@angular/router";
import { advancedSearchCriteriaFromParams } from "../../../functions/walks/advanced-search";
import { buildAdvancedSearchCriteria } from "../../../functions/walks/advanced-search-criteria-builder";
import { LocationAutocompleteComponent } from "../../../shared/components/location-autocomplete";
import { GridReferenceLookupResponse } from "../../../models/address-model";
import { debounceTime } from "rxjs/operators";
import * as L from "leaflet";
import { LeafletModule } from "@bluehalo/ngx-leaflet";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapMarkerStyleService } from "../../../services/maps/map-marker-style.service";
import { LocalWalksAndEventsService } from "../../../services/walks-and-events/local-walks-and-events.service";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { GroupEventField } from "../../../models/walk.model";
import { DEFAULT_OS_STYLE, MapProvider } from "../../../models/map.model";

@Component({
  selector: "app-advanced-search-panel",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FontAwesomeModule,
    NgSelectModule,
    DateRangeSlider,
    DistanceRangeSlider,
    LeafletModule,
    LocationAutocompleteComponent
  ],
  template: `
    <div class="advanced-search-panel card mt-3 mb-2">
      <div class="card-body py-2 px-3 pb-3">
        <div class="row">
          <div class="col-12 mb-3">
            <app-date-range-slider
              [minDate]="minDate"
              [maxDate]="maxDate"
              [range]="sliderRange"
              (rangeChange)="onDateRangeChange($event)"/>
            <div class="custom-range-row align-items-center mt-3">
              <div class="preset-wrapper flex-fill">
                <div class="btn-group w-100 preset-btn" role="group">
                  @for (preset of presetRanges; track preset.label) {
                    <button
                      type="button"
                      class="btn btn-sm preset-btn"
                      [class.active]="isPresetActive(preset)"
                      (click)="applyPreset(preset)">
                      {{ preset.label }}
                    </button>
                  }
                  <button
                    type="button"
                    class="btn btn-sm preset-btn custom-preset-btn"
                    [class.active]="isCustomPresetActive()"
                    (click)="activateCustomRangePreset()">
                    Custom
                  </button>
                </div>
              </div>
              <div class="custom-range-inputs ms-3">
                <label class="visually-hidden">Range amount</label>
                <input
                  type="number"
                  class="form-control custom-range-input"
                  placeholder="Range amount"
                  aria-label="Range amount"
                  min="1"
                  [disabled]="!isCustomPresetActive()"
                  [(ngModel)]="customRangeAmount"
                  [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onCustomRangeAmountChange($event)"/>
                <label class="visually-hidden">Range units</label>
                <select
                  class="form-select custom-range-select"
                  aria-label="Range units"
                  [disabled]="!isCustomPresetActive()"
                  [(ngModel)]="customRangeUnit"
                  [ngModelOptions]="{standalone: true}"
                  (ngModelChange)="onCustomRangeUnitChange($event)">
                  @for (unitOption of customRangeUnits; track unitOption.value) {
                    <option [value]="unitOption.value">{{ unitOption.label }}</option>
                  }
                </select>
              </div>
            </div>
          </div>

          <div class="col-12 mb-2">
            <app-distance-range-slider
              [minValue]="distanceSliderMin"
              [maxValue]="distanceSliderMax"
              [range]="distanceRange"
              (rangeChange)="onDistanceRangeChange($event)"/>
          </div>

          <div class="col-12 mb-2">
            <label class="form-label">Walk Leaders ({{ filteredLeaderOptions.length }})</label>
            <ng-select
              [items]="filteredLeaderOptions"
              [multiple]="true"
              [closeOnSelect]="false"
              [searchable]="true"
              [clearSearchOnAdd]="true"
              dropdownPosition="bottom"
              bindLabel="label"
              bindValue="id"
              placeholder="Select leaders..."
              [(ngModel)]="selectedLeaderIds"
              (ngModelChange)="onCriteriaChange()">
            </ng-select>
          </div>
          @if (showGroupSelector) {
            <div class="col-md-6 mb-3">
              <label class="form-label">Groups</label>
              <ng-select
                [items]="availableGroups"
                [multiple]="true"
                [closeOnSelect]="false"
                [searchable]="true"
                [clearSearchOnAdd]="true"
                [loading]="loadingGroups"
                dropdownPosition="bottom"
                bindLabel="ngSelectAttributes.label"
                bindValue="group_code"
                placeholder="Select groups..."
                [(ngModel)]="selectedGroupCodes"
                (ngModelChange)="onGroupsChange()">
              </ng-select>
            </div>
          }
          <div class="col-md-6 mb-3">
            <label class="form-label">Day of the Week</label>
            <ng-select
              [items]="daysOfWeek"
              [multiple]="true"
              [closeOnSelect]="false"
              [clearSearchOnAdd]="true"
              dropdownPosition="bottom"
              placeholder="Select days..."
              [(ngModel)]="selectedDaysOfWeek"
              (ngModelChange)="onCriteriaChange()">
            </ng-select>
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Difficulty</label>
            <ng-select
              [items]="difficultyLevels"
              [multiple]="true"
              [closeOnSelect]="false"
              [clearSearchOnAdd]="true"
              dropdownPosition="bottom"
              placeholder="Select difficulty..."
              [(ngModel)]="selectedDifficulty"
              (ngModelChange)="onCriteriaChange()">
            </ng-select>
          </div>

          <div class="col-md-6 mb-3">
            <label class="form-label">Accessibility</label>
            <ng-select
              [items]="accessibilityOptions"
              [multiple]="true"
              [closeOnSelect]="false"
              [clearSearchOnAdd]="true"
              dropdownPosition="bottom"
              placeholder="Select accessibility..."
              [(ngModel)]="selectedAccessibility"
              (ngModelChange)="onCriteriaChange()">
            </ng-select>
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label">Facilities</label>
            <ng-select
              [items]="facilityOptions"
              [multiple]="true"
              [closeOnSelect]="false"
              [clearSearchOnAdd]="true"
              dropdownPosition="bottom"
              placeholder="Select facilities..."
              [(ngModel)]="selectedFacilities"
              (ngModelChange)="onCriteriaChange()">
            </ng-select>
          </div>
          <div class="col-12 mb-3 d-flex">
            <div class="form-check me-4">
              <input
                class="form-check-input"
                type="checkbox"
                id="freeOnly"
                [(ngModel)]="freeOnly"
                (ngModelChange)="onCriteriaChange()">
              <label class="form-check-label" for="freeOnly">
                Show free routes
              </label>
            </div>
            <div class="form-check me-4">
              <input
                class="form-check-input"
                type="checkbox"
                id="cancelled"
                [(ngModel)]="cancelled"
                (ngModelChange)="onCriteriaChange()">
              <label class="form-check-label" for="cancelled">
                Show cancelled walks
              </label>
            </div>
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                id="noLocation"
                [(ngModel)]="noLocation"
                (ngModelChange)="onCriteriaChange()">
              <label class="form-check-label" for="noLocation">
                No location details
              </label>
            </div>
          </div>
          <div class="col-12 mb-3">
            <label class="form-label">
              <fa-icon [icon]="faLocationDot" class="me-2"/>
              Proximity Search
            </label>
            <div class="row">
              <div class="col-md-6">
                <div class="mb-3">
                  <div class="form-check form-check-inline">
                    <input
                      class="form-check-input"
                      type="radio"
                      id="location-method-none"
                      name="locationMethod"
                      [value]="LocationMethod.NONE"
                      [(ngModel)]="locationMethod"
                      (ngModelChange)="onLocationMethodChange()">
                    <label class="form-check-label" for="location-method-none">
                      None
                    </label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input
                      class="form-check-input"
                      type="radio"
                      id="location-method-current"
                      name="locationMethod"
                      [value]="LocationMethod.CURRENT_LOCATION"
                      [(ngModel)]="locationMethod"
                      (ngModelChange)="onLocationMethodChange()">
                    <label class="form-check-label" for="location-method-current">
                      Current Location
                      @if (gettingLocation) {
                        <span class="spinner-border spinner-border-sm ms-2"></span>
                      }
                    </label>
                  </div>
                  <div class="form-check form-check-inline">
                    <input
                      class="form-check-input"
                      type="radio"
                      id="location-method-enter"
                      name="locationMethod"
                      [value]="LocationMethod.ENTER_LOCATION"
                      [(ngModel)]="locationMethod"
                      (ngModelChange)="onLocationMethodChange()">
                    <label class="form-check-label" for="location-method-enter">
                      Enter Location
                    </label>
                  </div>
                </div>
                @if (locationMethod === LocationMethod.ENTER_LOCATION) {
                  <div class="mb-2">
                    <label class="form-label mb-1">Location Search</label>
                    <app-location-autocomplete
                      placeholder="Enter UK postcode or place name..."
                      (locationChange)="onLocationSelected($event)"/>
                  </div>
                }
                @if (locationMethod !== LocationMethod.NONE) {
                  <div>
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="form-label mb-0">Radius</label>
                      <div class="text-end">
                        @if (radiusRange) {
                          <span class="selected-range">{{ radiusRange.max.toFixed(1) }} mi</span>
                        } @else {
                          <span class="selected-range">5.0 mi</span>
                        }
                      </div>
                    </div>
                    @if (proximityLat && proximityLng) {
                      <div class="location-coords mb-2">
                        <small class="text-muted">Location: {{ formatLatLng(proximityLat, proximityLng) }}</small>
                      </div>
                    }
                    <div class="range-slider-container pb-0 mt-2">
                      <div class="range-slider-row">
                        <span class="range-edge text-start">1 mi</span>
                        <div class="slider-wrapper">
                          <input
                            type="range"
                            class="range-slider range-high"
                            min="1"
                            max="50"
                            step="0.5"
                            [ngModel]="radiusRange?.max || 5"
                            (ngModelChange)="onRadiusSliderChange($event)"/>
                          <div class="slider-track">
                            <div class="slider-fill" [style.width.%]="radiusFillWidth"></div>
                          </div>
                        </div>
                        <span class="range-edge text-end">50 mi</span>
                      </div>
                    </div>
                    <div class="btn-group w-100 mt-2 radius-preset-btn" role="group">
                      @for (preset of radiusPresets; track preset) {
                        <button
                          type="button"
                          class="btn btn-sm preset-btn"
                          [class.active]="isRadiusPresetActive(preset)"
                          (click)="applyRadiusPreset(preset)">
                          {{ preset }} mi
                        </button>
                      }
                      <button
                        type="button"
                        class="btn btn-sm preset-btn custom-preset-btn"
                        [class.active]="isCustomRadiusActive()">
                        Custom
                      </button>
                    </div>
                  </div>
                }
              </div>
              @if (locationMethod !== LocationMethod.NONE && proximityLat && proximityLng) {
                <div class="col-md-6">
                  <div class="proximity-map-container"
                       leaflet
                       [leafletOptions]="proximityMapOptions"
                       [leafletLayers]="proximityMapLayers"
                       (leafletMapReady)="onProximityMapReady($event)">
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="col-12 d-flex flex-wrap align-items-center gap-2">
            <button type="button" class="btn btn-sunrise action-clear" (click)="clearSearch()">
              <fa-icon [icon]="faTimes" class="me-2"/>
              Clear Filters
            </button>
            <button type="button" class="btn pager-btn advanced-toggle ms-auto" (click)="toggleAdvancedSearch.emit()">
              <fa-icon [icon]="expanded ? faChevronUp : faChevronDown" class="me-2"/>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .advanced-search-panel
      .ng-value-label
        display: inline-block
        margin-right: 5px
    .btn-outline-sunset
      border-color: var(--ramblers-colour-sunset)
      color: var(--ramblers-colour-sunset)
    .btn-outline-sunset:hover,
    .btn-outline-sunset:focus
      background-color: var(--ramblers-colour-sunset)
      border-color: var(--ramblers-colour-sunset)
      color: #fff
    .preset-btns
      flex-wrap: nowrap
      gap: 0
      overflow-x: auto
    .preset-btn
      flex: 1 0 120px
      min-width: 120px
      border: 1px solid var(--ramblers-colour-sunrise)
      color: var(--ramblers-colour-sunset)
      background-color: #fff
    .preset-btn.active
      background-color: var(--ramblers-colour-sunrise)
      border-color: var(--ramblers-colour-sunrise)
      color: var(--ramblers-colour-black)
    .custom-range-row
      display: flex
      align-items: center
      gap: 0.5rem
      flex-wrap: nowrap
      flex: 1 1 100%
      min-width: 0
      overflow-x: auto
    .preset-wrapper
      flex: 1 1 auto
      min-width: 0
    .custom-range-inputs
      display: flex
      gap: 0.5rem
      align-items: center
      flex-shrink: 0
      input,
      select
        min-width: 70px
    .action-clear
      padding-right: 1.5rem
      padding-left: 1.5rem
    .advanced-toggle
      flex-shrink: 0
    .selected-range
      font-size: 0.8rem
      color: #6c757d
    .range-slider-container
      padding: 0
    .range-slider-row
      display: flex
      align-items: center
      gap: 0.5rem
    .range-edge
      flex: 0 0 70px
      font-size: 0.75rem
    .slider-wrapper
      position: relative
      flex: 1
      height: 6px
    .slider-track
      position: absolute
      top: 50%
      left: 0
      right: 0
      height: 5px
      background-color: #dee2e6
      border-radius: 3px
      transform: translateY(-50%)
      pointer-events: none
    .slider-fill
      position: absolute
      height: 100%
      background-color: var(--ramblers-colour-sunrise)
      border-radius: 3px
      transition: all 0.1s ease
    .range-slider
      position: absolute
      width: 100%
      height: 5px
      top: 50%
      transform: translateY(-50%)
      -webkit-appearance: none
      appearance: none
      background: transparent
      outline: none
      pointer-events: none
    .range-slider::-webkit-slider-thumb
      -webkit-appearance: none
      appearance: none
      width: 20px
      height: 20px
      background: var(--ramblers-colour-sunrise)
      border: 2px solid #fff
      border-radius: 50%
      cursor: pointer
      pointer-events: auto
      box-shadow: 0 2px 4px rgba(0,0,0,0.2)
      position: relative
      z-index: 3
    .range-slider::-moz-range-thumb
      width: 20px
      height: 20px
      background: var(--ramblers-colour-sunrise)
      border: 2px solid #fff
      border-radius: 50%
      cursor: pointer
      pointer-events: auto
      box-shadow: 0 2px 4px rgba(0,0,0,0.2)
    .range-slider::-webkit-slider-thumb:hover,
    .range-slider::-moz-range-thumb:hover
      background: var(--ramblers-colour-sunrise-hover-background)
    .range-slider.range-high
      z-index: 4
    .proximity-map-container
      height: 300px
      border-radius: 0.5rem
      overflow: hidden
      border: 1px solid #dee2e6
    .radius-preset-btn
      .preset-btn
        flex: 1
        white-space: nowrap
        font-size: 0.75rem
        padding: 0.25rem 0.5rem
        min-width: 0
  `]
})
export class AdvancedSearchPane implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("AdvancedSearchPane", NgxLoggerLevel.ERROR);
  private memberService = inject(MemberService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private systemConfigService = inject(SystemConfigService);
  private dateUtils = inject(DateUtilsService);
  private stringUtils = inject(StringUtilsService);
  private route = inject(ActivatedRoute);
  private mapTilesService = inject(MapTilesService);
  private mapMarkerStyleService = inject(MapMarkerStyleService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private criteriaChangeSubject = new Subject<void>();
  proximityMapOptions?: L.MapOptions;
  proximityMapLayers: L.Layer[] = [];
  private proximityMap?: L.Map;
  private proximityCircle?: L.Circle;
  private proximityMarker?: L.Marker;
  private walkMarkers: L.Marker[] = [];
  private suppressCriteriaChanges = false;
  private lastFlushTime = 0;
  private criteriaValue: AdvancedSearchCriteria = null;
  private isInitializing = true;
  @Output() searchCriteriaChange = new EventEmitter<{ criteria: AdvancedSearchCriteria; leaderOptions: WalkLeaderOption[] }>();
  @Output() toggleAdvancedSearch = new EventEmitter<void>();
  @Input()
  set filterSelectType(value: FilterCriteria) {
    this.selectedFilterCriteria = value || null;
    this.updateDateScale();
    this.updatePresetRanges();
    this.applyFilterRangePreset();
  }
  @Input() expanded = false;
  @Input()
  set criteria(value: AdvancedSearchCriteria) {
    this.criteriaValue = value;
    this.populateFromCriteria();
  }
  faTimes = faTimes;
  faLocationDot = faLocationDot;
  faChevronDown = faChevronDown;
  faChevronUp = faChevronUp;
  members: Member[] = [];
  leaderOptions: WalkLeaderOption[] = [];
  filteredLeaderOptions: WalkLeaderOption[] = [];
  leaderIds: string[] = [];
  selectedLeaderIds: string[] = [];
  private leaderContactLabels = new Map<string, { label: string; contactId?: string }>();
  private loadingLeaderRange?: string;
  availableGroups: RamblersGroupWithLabel[] = [];
  showGroupSelector = false;
  selectedGroupCodes: string[] = [];
  loadingGroups = false;
  private dataMinDate: DateTime = this.dateUtils.dateTimeNowNoTime().minus({ years: 5 });
  private dataMaxDate: DateTime = this.dateUtils.dateTimeNowNoTime().plus({ years: 2 }).endOf("day");
  dateRange?: SearchDateRange;
  minDate = this.dataMinDate;
  maxDate = this.dataMaxDate;
  proximityLat?: number;
  proximityLng?: number;
  proximityRadiusMiles?: number;
  radiusRange?: DistanceRange;
  locationMethod = LocationMethod.NONE;
  radiusPresets = [5, 10, 25, 50];
  protected readonly LocationMethod = LocationMethod;
  gettingLocation = false;
  daysOfWeek = this.dateUtils.daysOfWeek();
  selectedDaysOfWeek: string[] = [];
  difficultyLevels = WALK_GRADES.map(grade => grade.description);
  selectedDifficulty: string[] = [];

  distanceMin?: number;
  distanceMax?: number;
  distanceSliderMin = 0;
  distanceSliderMax = 50;
  distanceRange?: DistanceRange;

  accessibilityOptions = FEATURE_CATEGORIES
    .find(cat => cat.category === FeatureCategory.ACCESSIBILITY)
    ?.features.map(f => f.description) || [];
  selectedAccessibility: string[] = [];

  facilityOptions = FEATURE_CATEGORIES
    .find(cat => cat.category === FeatureCategory.FACILITIES)
    ?.features.map(f => f.description) || [];
  selectedFacilities: string[] = [];

  freeOnly = false;
  cancelled = false;
  noLocation = false;
  presetRanges: AdvancedSearchPreset[] = [];
  private selectedFilterCriteria: FilterCriteria | null = null;
  customRangeAmount = 7;
  customRangeUnit: DateRangeUnit = DateRangeUnit.DAYS;
  customRangeUnits = RANGE_UNIT_OPTIONS;
  private selectedPresetLabel?: string;
  sliderRange?: DateRange;

  async ngOnInit() {
    this.logger.info("ngOnInit: starting initialization");
    this.updateDateScale();
    this.updatePresetRanges();
    this.loadMembers();
    await this.loadGroups();
    await this.loadDateRange();
    await this.loadLeaderIds(this.dateRange);
    const config = this.systemConfigService.systemConfig();
    const walkPopulation = config?.group?.walkPopulation;

    if (walkPopulation === EventPopulation.WALKS_MANAGER) {
      await this.loadLeaderContacts();
    }

    this.logger.info("ngOnInit: about to build leader options");
    this.buildLeaderOptions();
    this.logger.info("ngOnInit: initialization complete");

    this.criteriaChangeSubject.pipe(
      debounceTime(500)
    ).subscribe(() => {
      const timeSinceLastFlush = this.dateUtils.dateTimeNowAsValue() - this.lastFlushTime;
      if (timeSinceLastFlush < 600) {
        return;
      }
      this.applySearch();
    });

    this.isInitializing = false;

    const params = this.route.snapshot.queryParamMap;
    const urlCriteria = advancedSearchCriteriaFromParams(params, this.stringUtils, this.leaderOptions);
    if (urlCriteria) {
      this.logger.info("ngOnInit: parsed criteria from URL:", urlCriteria);
      this.criteriaValue = urlCriteria;
      this.populateFromCriteria();
    }

    if (this.criteriaValue) {
      this.applySearch();
    }
  }

  ngOnDestroy() {
    this.criteriaChangeSubject.complete();
  }

  private loadMembers() {
    from(this.memberService.all()).subscribe({
      next: (members) => {
        this.members = (members || [])
          .map(member => ({member, label: this.memberLabel(member)}))
          .sort(sortBy("label"))
          .map(item => item.member);
        this.logger.info("loadMembers: loaded", this.members, "eligible members");
      },
      error: (error) => {
        this.logger.error("Failed to load members:", error);
      }
    });
  }

  private async loadLeaderIds(range?: SearchDateRange | null) {
    try {
      const effectiveRange = this.effectiveLeaderRange(range);
      const rangeParam = effectiveRange ?? null;
      const rangeKey = rangeParam ? `${rangeParam.from}-${rangeParam.to}` : "null";
      this.logger.info("loadLeaderIds: requested range:", range, "effectiveRange:", effectiveRange, "rangeKey:", rangeKey, "loadingLeaderRange:", this.loadingLeaderRange);
      if (this.loadingLeaderRange !== rangeKey) {
        this.loadingLeaderRange = rangeKey;
        this.logger.info("loadLeaderIds: fetching walk leaders for rangeKey:", rangeKey);
        this.leaderIds = (await this.walksAndEventsService.queryWalkLeaders(rangeParam)) || [];
        this.logger.info("loadLeaderIds: received", this.leaderIds.length, "leader IDs");
        this.loadingLeaderRange = undefined;
        this.buildLeaderOptions();
      } else {
        this.logger.info("loadLeaderIds: skipping duplicate request for rangeKey:", rangeKey);
      }
    } catch (error) {
      this.loadingLeaderRange = undefined;
      this.logger.error("Failed to load walk leader ids:", error);
    }
  }

  private effectiveLeaderRange(range?: SearchDateRange | null): SearchDateRange | undefined {
    const candidate = range ?? this.dateRange;
    return this.resolvedDateRange(candidate);
  }

  private resolvedDateRange(range?: SearchDateRange | null): SearchDateRange | undefined {
    const candidate = range ?? this.dateRange;
    if (isNumber(candidate?.from) && isNumber(candidate?.to)) {
      return candidate as SearchDateRange;
    } else if (this.minDate && this.maxDate) {
      return {
        from: this.minDate.toMillis(),
        to: this.maxDate.toMillis()
      };
    } else {
      return undefined;
    }
  }

  private async loadLeaderContacts() {
    try {
      const contacts: WalkLeaderContact[] = await this.ramblersWalksAndEventsService.queryWalkLeaders();
      contacts.forEach(contact => {
        const slug = contact.slug || contact.id || contact.name;
        const label = (contact.name || "").trim() || contact.id || "";
        if (slug && label) {
          this.leaderContactLabels.set(slug, { label, contactId: contact.id });
        }
      });
      this.logger.info("loadLeaderContacts: loaded", this.leaderContactLabels.size, "contact labels");
      this.buildLeaderOptions();
    } catch (error) {
      this.logger.error("Failed to load ramblers leader contacts:", error);
    }
  }

  private async loadDateRange() {
    try {
      const range = await this.walksAndEventsService.dateRange();
      if (isNumber(range.minDate) && !Number.isNaN(range.minDate)) {
        this.dataMinDate = this.dateUtils.asDateTime(range.minDate).startOf("day");
      }
      if (isNumber(range.maxDate) && !Number.isNaN(range.maxDate)) {
        this.dataMaxDate = this.dateUtils.asDateTime(range.maxDate).endOf("day");
      }
      this.minDate = this.dataMinDate;
      this.maxDate = this.dataMaxDate;
      this.logger.info("loadDateRange: bounds", this.dataMinDate.toISO(), this.dataMaxDate.toISO());
    } catch (error) {
      this.logger.error("Failed to load date range:", error);
    }
  }

  private buildLeaderOptions() {
    const leaderIdSet = new Set(this.leaderIds);
    const memberLabelMap = new Map<string, string>();
    this.members.forEach(member => {
      const memberId = member.id;
      if (leaderIdSet.has(memberId)) {
        const label = this.memberLabel(member);
        if (memberId && label) {
          memberLabelMap.set(memberId, label);
        }
      }
    });

    const leaderRecords = this.walksAndEventsService.leaderLabelRecords();
    const recordOptions = leaderRecords
      .filter(record => record?.id && record?.label)
      .map(record => {
        return {
          id: record.id,
          label: record.label,
          allIds: [record.id],
          allLabels: record.allLabels || [record.label]
        };
      });

    const contactOptions = Array.from(this.leaderContactLabels.entries())
      .filter(([slug, info]) => slug && info?.label)
      .map(([slug, info]) => {
        const additionalIds = info.contactId && info.contactId !== slug ? [info.contactId] : [];
        const idSet = new Set([slug, ...additionalIds]);
        return {
          id: slug,
          label: info.label,
          allIds: Array.from(idSet),
          allLabels: [info.label]
        };
      });

    const combinedOptionsMap = new Map<string, WalkLeaderOption>();
    const labelSet = new Set<string>();
    [...recordOptions, ...contactOptions].forEach(option => {
      if (!combinedOptionsMap.has(option.id) && !labelSet.has(option.label)) {
        combinedOptionsMap.set(option.id, option);
        labelSet.add(option.label);
      }
    });

    const options = Array.from(combinedOptionsMap.values());
    this.leaderOptions = this.sortLeaderOptions(options);
    this.logger.info("buildLeaderOptions: available leader options", this.leaderOptions.length, "options from", recordOptions.length, "records and", contactOptions.length, "contacts");
    this.convertKebabLabelsToIds();
    this.updateFilteredLeaderOptions();
  }

  private convertKebabLabelsToIds() {
    if (!this.selectedLeaderIds || this.selectedLeaderIds.length === 0) {
      this.logger.info("convertKebabLabelsToIds: skipping - no selectedLeaderIds");
    } else if (this.leaderOptions.length === 0) {
      this.logger.info("convertKebabLabelsToIds: skipping - no leaderOptions yet");
    } else {
      const kebabToIdMap = new Map<string, string>();
      const alternateIdMap = new Map<string, string>();
      const idSet = new Set<string>();
      this.leaderOptions.forEach(option => {
        idSet.add(option.id);
        if (option.allIds) {
          option.allIds.forEach(altId => {
            if (altId !== option.id && !alternateIdMap.has(altId)) {
              alternateIdMap.set(altId, option.id);
            }
          });
        }
        if (option.allLabels) {
          option.allLabels.forEach(label => {
            const kebabLabel = this.stringUtils.kebabCase(label);
            kebabToIdMap.set(kebabLabel, option.id);
          });
        } else {
          const kebabLabel = this.stringUtils.kebabCase(option.label);
          kebabToIdMap.set(kebabLabel, option.id);
        }
      });

      this.logger.info("convertKebabLabelsToIds: processing", this.selectedLeaderIds, "with", this.leaderOptions.length, "options");

      const convertedIds = this.selectedLeaderIds.map(id => {
        if (idSet.has(id)) {
          this.logger.info("convertKebabLabelsToIds:", id, "is already a valid ID");
          return id;
        }
        const converted = kebabToIdMap.get(id) || alternateIdMap.get(id);
        if (converted) {
          this.logger.info("convertKebabLabelsToIds: converted kebab", id, "to", converted);
          return converted;
        }
        this.logger.warn("convertKebabLabelsToIds: no conversion found for", id);
        return id;
      });

      const normalizedIds = convertedIds.filter(id => !!id);
      const uniqueIds = normalizedIds.filter((id, index) => normalizedIds.indexOf(id) === index);
      const hasChanges = JSON.stringify(uniqueIds) !== JSON.stringify(this.selectedLeaderIds);
      if (hasChanges) {
        this.logger.info("convertKebabLabelsToIds: updating selectedLeaderIds from", this.selectedLeaderIds, "to", uniqueIds);
        this.suppressCriteriaChanges = true;
        this.selectedLeaderIds = uniqueIds;
        if (this.criteriaValue) {
          this.criteriaValue = {
            ...this.criteriaValue,
            leaderIds: uniqueIds
          };
          this.logger.info("convertKebabLabelsToIds: updated criteriaValue.leaderIds to", uniqueIds);
        }
        this.suppressCriteriaChanges = false;
      } else {
        this.logger.info("convertKebabLabelsToIds: no changes needed");
      }
    }
  }


  private memberLabel(member: Member): string {
    if (member.displayName) {
      return member.displayName;
    } else if (member.firstName || member.lastName) {
      return `${member.firstName || ""} ${member.lastName || ""}`.trim();
    } else if (member.userName) {
      return member.userName;
    } else {
      return member.memberId || member.id || "Unknown";
    }
  }

  private sortLeaderOptions(options: WalkLeaderOption[]): WalkLeaderOption[] {
    return [...options].sort((a, b) => a.label.localeCompare(b.label));
  }

  private async loadGroups() {
    try {
      this.loadingGroups = true;
      const config = this.systemConfigService.systemConfig();
      const allowedCodes = new Set([
        config?.group?.groupCode,
        config?.area?.groupCode,
        ...(config?.area?.groups?.map(group => group.groupCode) || [])
      ].filter(Boolean));
      const groups = await this.ramblersWalksAndEventsService.listRamblersGroups([]);
      this.availableGroups = groups
        .filter(group => group.scope === "G")
        .filter(group => allowedCodes.size === 0 || allowedCodes.has(group.group_code))
        .map(group => ({
          ...group,
          ngSelectAttributes: { label: `${group.name} (${group.group_code})` }
        }))
        .sort(sortBy("name"));
      this.showGroupSelector = this.availableGroups.length > 1;
      this.logger.info("Loaded groups:", this.availableGroups.length);
    } catch (error) {
      this.logger.error("Failed to load groups:", error);
    } finally {
      this.loadingGroups = false;
    }
  }

  onCriteriaChange(flush = false) {
    if (this.suppressCriteriaChanges) {
      return;
    }
    if (flush) {
      this.lastFlushTime = this.dateUtils.dateTimeNowAsValue();
      this.applySearch();
      return;
    }
    this.criteriaChangeSubject.next();
  }

  onGroupsChange() {
    this.updateFilteredLeaderOptions();
    const filteredIds = new Set(this.filteredLeaderOptions.map(option => option.id));
    this.selectedLeaderIds = this.selectedLeaderIds.filter(id => filteredIds.has(id));
    this.onCriteriaChange();
  }

  private updateFilteredLeaderOptions() {
    if (!this.selectedGroupCodes || this.selectedGroupCodes.length === 0) {
      this.filteredLeaderOptions = this.leaderOptions;
    } else {
      const kebabGroupCodes = this.selectedGroupCodes.map(code => this.stringUtils.kebabCase(code) + "-");
      this.filteredLeaderOptions = this.leaderOptions.filter(option => {
        return kebabGroupCodes.some(prefix => option.id.startsWith(prefix));
      });
    }
  }

  onDateRangeChange(range: DateRange) {
    this.dateRange = range;
    if (!this.updatePresetSelectionForRange(range)) {
      this.markCustomPresetActive();
    }
    this.syncCustomInputsWithRange(range);
    this.onCriteriaChange(true);
  }

  private updateSliderRange() {
    this.sliderRange = this.dateRange ? { ...this.dateRange } : undefined;
  }

  onDistanceRangeChange(range: DistanceRange) {
    this.distanceMin = range.min;
    this.distanceMax = range.max;
    this.updateDistanceRange(range);
    this.onCriteriaChange();
  }

  applySearch() {
    if (this.isInitializing) {
      this.logger.info("Skipping applySearch during initialization");
    } else {
      const range = this.resolvedDateRange();
      const expandedLeaderIds = this.expandLeaderIds(this.selectedLeaderIds);

      this.logger.info("Proximity search raw values:", {
        locationMethod: this.locationMethod,
        proximityLat: this.proximityLat,
        proximityLng: this.proximityLng,
        proximityRadiusMiles: this.proximityRadiusMiles,
        proximityLatType: typeof this.proximityLat,
        proximityLngType: typeof this.proximityLng,
        proximityRadiusMilesType: typeof this.proximityRadiusMiles
      });

      const hasProximitySearch = this.locationMethod !== LocationMethod.NONE &&
                                 isNumber(this.proximityLat) &&
                                 isNumber(this.proximityLng) &&
                                 isNumber(this.proximityRadiusMiles);

      this.logger.info("hasProximitySearch:", hasProximitySearch);

      const criteria: AdvancedSearchCriteria = {
        dateFrom: range?.from,
        dateTo: range?.to,
        leaderIds: expandedLeaderIds.length > 0 ? expandedLeaderIds : undefined,
        groupCodes: this.selectedGroupCodes.length > 0 ? this.selectedGroupCodes : undefined,
        locationMethod: this.locationMethod !== LocationMethod.NONE ? this.locationMethod : undefined,
        proximityLat: hasProximitySearch ? this.proximityLat : undefined,
        proximityLng: hasProximitySearch ? this.proximityLng : undefined,
        proximityRadiusMiles: hasProximitySearch ? this.proximityRadiusMiles : undefined,
        daysOfWeek: this.selectedDaysOfWeek.length > 0 ? this.selectedDaysOfWeek : undefined,
        difficulty: this.selectedDifficulty.length > 0 ? this.selectedDifficulty : undefined,
        distanceMin: this.distanceMin,
        distanceMax: this.distanceMax,
        accessibility: this.selectedAccessibility.length > 0 ? this.selectedAccessibility : undefined,
        facilities: this.selectedFacilities.length > 0 ? this.selectedFacilities : undefined,
        freeOnly: this.freeOnly,
        cancelled: this.cancelled,
        noLocation: this.noLocation
      };

      this.logger.info("Final search criteria being emitted:", criteria);
      this.searchCriteriaChange.emit({ criteria, leaderOptions: this.leaderOptions });
      void this.loadLeaderIds(range);
      if (this.proximityMap && this.proximityLat && this.proximityLng) {
        void this.updateWalkMarkers();
      }
    }
  }

  private expandLeaderIds(selectedIds: string[]): string[] {
    const leaderOptionMap = new Map(
      this.leaderOptions.map(option => [option.id, option])
    );

    return selectedIds.flatMap(id => {
      const option = leaderOptionMap.get(id);
      return option?.allIds || [id];
    });
  }

  clearSearch() {
    this.selectedLeaderIds = [];
    this.selectedGroupCodes = [];
    this.dateRange = undefined;
    this.updateSliderRange();
    this.proximityLat = undefined;
    this.proximityLng = undefined;
    this.proximityRadiusMiles = undefined;
    this.radiusRange = undefined;
    this.locationMethod = LocationMethod.NONE;
    this.selectedDaysOfWeek = [];
    this.selectedDifficulty = [];
    this.selectedAccessibility = [];
    this.selectedFacilities = [];
    this.freeOnly = false;
    this.cancelled = false;
    this.noLocation = false;
    this.customRangeAmount = 7;
    this.customRangeUnit = DateRangeUnit.DAYS;
    this.selectDefaultPreset();
    this.searchCriteriaChange.emit({ criteria: {}, leaderOptions: this.leaderOptions });
    void this.loadLeaderIds(this.dateRange);
    this.updateDistanceRange();
  }

  onLocationMethodChange() {
    if (this.locationMethod === LocationMethod.NONE) {
      this.proximityLat = undefined;
      this.proximityLng = undefined;
      this.proximityRadiusMiles = undefined;
      this.radiusRange = undefined;
    } else if (this.locationMethod === LocationMethod.CURRENT_LOCATION) {
      this.useCurrentLocation();
    }
    this.onCriteriaChange();
  }

  onRadiusChange(range: DistanceRange) {
    this.proximityRadiusMiles = range.max;
    this.radiusRange = range;
    this.onCriteriaChange();
  }

  onRadiusSliderChange(value: number) {
    this.proximityRadiusMiles = value;
    this.radiusRange = { min: 1, max: value, unit: DistanceUnit.MILES };
    this.updateProximityMap();
    this.onCriteriaChange();
  }

  get radiusFillWidth(): number {
    const value = this.radiusRange?.max || 5;
    return ((value - 1) / (50 - 1)) * 100;
  }

  isRadiusPresetActive(preset: number): boolean {
    const currentRadius = this.radiusRange?.max || 5;
    return Math.abs(currentRadius - preset) < 0.1;
  }

  isCustomRadiusActive(): boolean {
    const currentRadius = this.radiusRange?.max || 5;
    return !this.radiusPresets.some(preset => Math.abs(currentRadius - preset) < 0.1);
  }

  applyRadiusPreset(preset: number) {
    this.proximityRadiusMiles = preset;
    this.radiusRange = { min: 1, max: preset, unit: DistanceUnit.MILES };
    this.updateProximityMap();
    this.onCriteriaChange();
  }

  useCurrentLocation() {
    if (!navigator.geolocation) {
      this.logger.error("Geolocation is not supported by this browser");
      alert("Geolocation is not supported by your browser");
      return;
    }

    this.gettingLocation = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.proximityLat = position.coords.latitude;
        this.proximityLng = position.coords.longitude;
        if (!this.proximityRadiusMiles) {
          this.proximityRadiusMiles = 5;
          this.radiusRange = { min: 1, max: 5, unit: DistanceUnit.MILES };
        }
        this.gettingLocation = false;
        this.initializeProximityMapOptions();
        setTimeout(() => this.updateProximityMap(), 0);
        this.onCriteriaChange();
      },
      (error) => {
        this.gettingLocation = false;
        if (error.code === 1) {
          this.logger.error("Location permission denied");
          alert("Location access denied. Please enable location permissions in your browser.");
        } else if (error.code === 2) {
          this.logger.error("Location unavailable");
          alert("Location unavailable. Please check your device settings.");
        } else if (error.code === 3) {
          this.logger.error("Location request timed out");
          alert("Location request timed out. Please try again.");
        } else {
          this.logger.error("Error getting current location:", error);
          alert("Failed to get your location. Please try again.");
        }
      },
      {
        timeout: 30000,
        enableHighAccuracy: true,
        maximumAge: 60000
      }
    );
  }

  onLocationSelected(location: GridReferenceLookupResponse | null) {
    if (!location || !location.latlng) {
      return;
    }
    this.logger.info(`Location selected:`, location);
    this.proximityLat = location.latlng.lat;
    this.proximityLng = location.latlng.lng;
    if (!this.proximityRadiusMiles) {
      this.proximityRadiusMiles = 5;
      this.radiusRange = { min: 1, max: 5, unit: DistanceUnit.MILES };
    }
    this.initializeProximityMapOptions();
    setTimeout(() => this.updateProximityMap(), 0);
    this.onCriteriaChange();
  }

  formatLatLng(lat: number, lng: number): string {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  onProximityMapReady(map: L.Map) {
    this.proximityMap = map;
    this.updateProximityMap();
  }

  private initializeProximityMapOptions() {
    this.mapTilesService.initializeProjections();

    const hasOsKey = this.mapTilesService.hasOsApiKey();
    const provider = hasOsKey ? MapProvider.OS : MapProvider.OSM;
    const style = hasOsKey ? DEFAULT_OS_STYLE : "";

    this.logger.info(`Initializing proximity map with provider: ${provider}, style: ${style}, hasOsKey: ${hasOsKey}`);

    const baseLayer = this.mapTilesService.createBaseLayer(provider, style);
    this.proximityMapLayers = [baseLayer];
    const center: L.LatLngExpression = this.proximityLat && this.proximityLng
      ? [this.proximityLat, this.proximityLng]
      : [51.5074, -0.1278];

    const crs = this.mapTilesService.crsForStyle(provider, style);
    const maxZoom = this.mapTilesService.maxZoomForStyle(provider, style);
    const initialZoom = Math.min(9, maxZoom);

    this.proximityMapOptions = {
      center,
      zoom: initialZoom,
      layers: this.proximityMapLayers,
      zoomControl: true,
      attributionControl: true,
      crs,
      maxZoom,
      minZoom: 1,
      zoomSnap: 0.1,
      zoomDelta: 0.5
    };
  }

  private updateProximityMap() {
    if (!this.proximityMap || !this.proximityLat || !this.proximityLng) {
      return;
    }

    const center: L.LatLngExpression = [this.proximityLat, this.proximityLng];
    const radiusMiles = this.radiusRange?.max || 5;
    const radiusMeters = radiusMiles * 1609.34;

    if (this.proximityMarker) {
      this.proximityMap.removeLayer(this.proximityMarker);
    }
    if (this.proximityCircle) {
      this.proximityMap.removeLayer(this.proximityCircle);
    }

    const smallCenterIcon = L.divIcon({
      className: 'center-marker-icon',
      html: '<div style="width: 12px; height: 12px; background-color: #FF6B35; border: 2px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
    this.proximityMarker = L.marker(center, {
      icon: smallCenterIcon
    }).addTo(this.proximityMap);

    this.proximityCircle = L.circle(center, {
      radius: radiusMeters,
      color: '#FF6B35',
      fillColor: '#FF6B35',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(this.proximityMap);

    const bounds = this.proximityCircle.getBounds();
    this.proximityMap.fitBounds(bounds, { padding: [20, 20] });

    this.updateWalkMarkers();
  }

  private async updateWalkMarkers() {
    if (!this.proximityMap || !this.proximityLat || !this.proximityLng) {
      return;
    }

    this.walkMarkers.forEach(marker => {
      this.proximityMap?.removeLayer(marker);
    });
    this.walkMarkers = [];

    const range = this.resolvedDateRange();
    const expandedLeaderIds = this.expandLeaderIds(this.selectedLeaderIds);

    const criteriaForMap: AdvancedSearchCriteria = {
      dateFrom: range?.from,
      dateTo: range?.to,
      leaderIds: expandedLeaderIds.length > 0 ? expandedLeaderIds : undefined,
      groupCodes: this.selectedGroupCodes.length > 0 ? this.selectedGroupCodes : undefined,
      daysOfWeek: this.selectedDaysOfWeek.length > 0 ? this.selectedDaysOfWeek : undefined,
      difficulty: this.selectedDifficulty.length > 0 ? this.selectedDifficulty : undefined,
      distanceMin: this.distanceMin,
      distanceMax: this.distanceMax,
      accessibility: this.selectedAccessibility.length > 0 ? this.selectedAccessibility : undefined,
      facilities: this.selectedFacilities.length > 0 ? this.selectedFacilities : undefined,
      freeOnly: this.freeOnly,
      cancelled: this.cancelled,
      noLocation: this.noLocation
    };

    const criteriaParts: any[] = [];

    if (this.selectedFilterCriteria === FilterCriteria.FUTURE_EVENTS) {
      const today = this.dateUtils.dateTimeNowNoTime();
      if (criteriaForMap.dateFrom) {
        const dateFrom = this.dateUtils.asDateTime(criteriaForMap.dateFrom);
        criteriaParts.push({ [GroupEventField.START_DATE]: { $gte: dateFrom > today ? dateFrom.toISO() : today.toISO() } });
      } else {
        criteriaParts.push({ [GroupEventField.START_DATE]: { $gte: today.toISO() } });
      }
      if (criteriaForMap.dateTo) {
        criteriaParts.push({ [GroupEventField.START_DATE]: { $lte: this.dateUtils.asDateTime(criteriaForMap.dateTo).toISO() } });
      }
    } else if (criteriaForMap.dateFrom || criteriaForMap.dateTo) {
      const dateCriteria: any = {};
      if (criteriaForMap.dateFrom) {
        dateCriteria.$gte = this.dateUtils.asDateTime(criteriaForMap.dateFrom).toISO();
      }
      if (criteriaForMap.dateTo) {
        dateCriteria.$lte = this.dateUtils.asDateTime(criteriaForMap.dateTo).toISO();
      }
      criteriaParts.push({ [GroupEventField.START_DATE]: dateCriteria });
    }

    const advancedCriteria = buildAdvancedSearchCriteria({
      advancedSearchCriteria: criteriaForMap,
      dateUtils: this.dateUtils,
      walkPopulationLocal: false,
      logger: this.logger
    });

    criteriaParts.push(...advancedCriteria);

    const criteria = criteriaParts.length === 0 ? {} : (criteriaParts.length === 1 ? criteriaParts[0] : { $and: criteriaParts });

    const dataQueryOptions: DataQueryOptions = {
      criteria,
      limit: 500
    };

    try {
      const walks = await this.localWalksAndEventsService.allWithPagination(dataQueryOptions);
      const walkEvents = Array.isArray(walks.response) ? walks.response : [];

      walkEvents.forEach(walkEvent => {
        const lat = walkEvent.groupEvent?.start_location?.latitude;
        const lng = walkEvent.groupEvent?.start_location?.longitude;

        if (lat && lng && this.proximityMap) {
          const walkIcon = L.divIcon({
            className: 'walk-marker-icon',
            html: '<div style="width: 16px; height: 16px; background-color: #7C3AED; border: 3px solid white; border-radius: 50%; box-shadow: 0 3px 6px rgba(0,0,0,0.4);"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          const marker = L.marker([lat, lng], { icon: walkIcon }).addTo(this.proximityMap);
          this.walkMarkers.push(marker);
        }
      });

      this.logger.info(`Added ${this.walkMarkers.length} walk markers to proximity map`);
    } catch (error) {
      this.logger.error("Failed to load walks for proximity map:", error);
    }
  }

  applyPreset(preset: AdvancedSearchPreset) {
    this.setRangeFromPreset(preset, true);
  }

  activateCustomRangePreset() {
    this.applyCustomRangeFromInputs();
  }

  onCustomRangeAmountChange(value: number | string | null) {
    const parsedValue = Number(value);
    const validated = Number.isFinite(parsedValue) ? Math.max(1, Math.floor(parsedValue)) : this.customRangeAmount;
    if (this.customRangeAmount !== validated) {
      this.customRangeAmount = validated;
    }
    this.applyCustomRangeFromInputs(validated);
  }
  onCustomRangeUnitChange(value: DateRangeUnit) {
    if (this.customRangeUnit === value) {
      return;
    }
    this.customRangeUnit = value;
    this.applyCustomRangeFromInputs();
  }
  private applyCustomRangeFromInputs(amountOverride?: number) {
    const baseAmount = amountOverride ?? Number(this.customRangeAmount);
    const amount = Number.isFinite(baseAmount) ? Math.max(1, Math.floor(baseAmount)) : Math.max(1, Math.floor(this.customRangeAmount || 0));
    if (amount <= 0) {
      return;
    }
    this.customRangeAmount = amount;
    this.markCustomPresetActive();
    this.dateRange = this.buildCustomRange(amount);
    this.updateSliderRange();
    this.onCriteriaChange();
  }
  private syncCustomInputsWithRange(range?: DateRange) {
    if (!this.isCustomPresetActive() || !range) {
      return;
    }
    const updatedAmount = this.customRangeAmountFromRange(range);
    if (this.customRangeAmount !== updatedAmount) {
      this.customRangeAmount = updatedAmount;
    }
  }
  private customRangeAmountFromRange(range: DateRange): number {
    const fromDate = this.dateUtils.asDateTime(range.from);
    const toDate = this.dateUtils.asDateTime(range.to);
    const diff = toDate.diff(fromDate, this.customRangeUnit);
    const rawValue = Math.abs(diff[this.customRangeUnit] ?? 0);
    return Math.max(1, Math.round(rawValue));
  }

  private updateDistanceRange(range?: DistanceRange) {
    if (range) {
      this.distanceRange = { min: range.min, max: range.max };
      return;
    }
    if (isNumber(this.distanceMin) || isNumber(this.distanceMax)) {
      const min = isNumber(this.distanceMin) ? this.distanceMin : this.distanceSliderMin;
      const max = isNumber(this.distanceMax) ? this.distanceMax : this.distanceSliderMax;
      this.distanceRange = { min, max };
    } else {
      this.distanceRange = undefined;
    }
  }
  private buildCustomRange(amount: number): SearchDateRange {
    const now = this.dateUtils.dateTimeNowNoTime();
    const direction = this.customRangeDirection();
    const spec = this.customRangeDurationSpec(amount);
    if (direction === DateRangeDirection.PAST) {
      return {
        from: now.minus(spec).toMillis(),
        to: now.toMillis()
      };
    } else {
      return {
        from: now.toMillis(),
        to: now.plus(spec).toMillis()
      };
    }
  }
  private customRangeDirection(): DateRangeDirection {
    if (this.selectedFilterCriteria === FilterCriteria.PAST_EVENTS) {
      return DateRangeDirection.PAST;
    } else {
      return DateRangeDirection.FUTURE;
    }
  }
  private customRangeDurationSpec(amount: number): { days?: number; weeks?: number; months?: number; years?: number } {
    switch (this.customRangeUnit) {
      case DateRangeUnit.WEEKS:
        return { weeks: amount };
      case DateRangeUnit.MONTHS:
        return { months: amount };
      case DateRangeUnit.YEARS:
        return { years: amount };
      default:
        return { days: amount };
    }
  }
  private markCustomPresetActive() {
    this.selectedPresetLabel = CUSTOM_PRESET_LABEL;
  }

  private ensurePresetSelection() {
    if (!this.presetRanges.length) {
      this.selectedPresetLabel = undefined;
      return;
    }
    if (this.selectedPresetLabel === CUSTOM_PRESET_LABEL) {
      return;
    }
    const matchesExistingPreset = this.presetRanges.some(preset => preset.label === this.selectedPresetLabel);
    if (!matchesExistingPreset) {
      this.selectDefaultPreset();
    }
  }

  private selectDefaultPreset() {
    if (!this.presetRanges.length) {
      this.selectedPresetLabel = undefined;
      return;
    }
    const allTimePreset = this.presetRanges.find(p => p.label === "All Time");
    this.selectedPresetLabel = allTimePreset ? allTimePreset.label : this.presetRanges[0].label;
  }

  isPresetActive(preset: AdvancedSearchPreset): boolean {
    return this.selectedPresetLabel === preset.label;
  }

  isCustomPresetActive(): boolean {
    return this.selectedPresetLabel === CUSTOM_PRESET_LABEL;
  }

  private populateFromCriteria() {
    const criteria = this.criteriaValue;
    this.suppressCriteriaChanges = true;
    this.selectedLeaderIds = criteria?.leaderIds ? [...criteria.leaderIds] : [];
    this.selectedGroupCodes = criteria?.groupCodes ? [...criteria.groupCodes] : [];
    this.locationMethod = criteria?.locationMethod ?? LocationMethod.NONE;
    this.proximityLat = criteria?.proximityLat;
    this.proximityLng = criteria?.proximityLng;
    this.proximityRadiusMiles = criteria?.proximityRadiusMiles;

    if (this.proximityRadiusMiles) {
      this.radiusRange = { min: 1, max: this.proximityRadiusMiles, unit: DistanceUnit.MILES };
    }

    if (this.locationMethod !== LocationMethod.NONE && this.proximityLat && this.proximityLng) {
      this.initializeProximityMapOptions();
      setTimeout(() => this.updateProximityMap(), 0);
    }

    this.selectedDaysOfWeek = criteria?.daysOfWeek ? [...criteria.daysOfWeek] : [];
    this.selectedDifficulty = criteria?.difficulty ? [...criteria.difficulty] : [];
    this.selectedAccessibility = criteria?.accessibility ? [...criteria.accessibility] : [];
    this.selectedFacilities = criteria?.facilities ? [...criteria.facilities] : [];
    this.freeOnly = criteria?.freeOnly ?? false;
    this.cancelled = criteria?.cancelled ?? false;
    this.noLocation = criteria?.noLocation ?? false;
    const hasFrom = isNumber(criteria?.dateFrom);
    const hasTo = isNumber(criteria?.dateTo);
    this.dateRange = hasFrom && hasTo ? { from: criteria.dateFrom as number, to: criteria.dateTo as number } : undefined;
    this.updateSliderRange();
    if (this.dateRange) {
      if (!this.updatePresetSelectionForRange(this.dateRange)) {
        this.markCustomPresetActive();
        this.syncCustomInputsWithRange(this.dateRange);
      }
    }
    this.distanceMin = criteria?.distanceMin;
    this.distanceMax = criteria?.distanceMax;
    this.updateDistanceRange();
    if (this.leaderOptions.length > 0) {
      this.convertKebabLabelsToIds();
    }
    this.updateFilteredLeaderOptions();
    this.suppressCriteriaChanges = false;
  }

  private updateDateScale() {
    const today = DateTime.now().startOf("day");
    const dataMin = this.dataMinDate;
    const dataMax = this.dataMaxDate;
    if (this.selectedFilterCriteria === FilterCriteria.FUTURE_EVENTS) {
      this.minDate = DateTime.max(dataMin, today);
      this.maxDate = dataMax;
    } else if (this.selectedFilterCriteria === FilterCriteria.PAST_EVENTS) {
      this.minDate = dataMin;
      this.maxDate = DateTime.min(dataMax, today);
    } else {
      this.minDate = dataMin;
      this.maxDate = dataMax;
    }
    this.clampDateRange();
  }

  private clampDateRange() {
    if (!this.dateRange) {
      return;
    }
    const minMillis = this.minDate.toMillis();
    const maxMillis = this.maxDate.toMillis();
    const boundedFrom = Math.max(minMillis, Math.min(maxMillis, this.dateRange.from));
    const boundedTo = Math.max(minMillis, Math.min(maxMillis, this.dateRange.to));
    this.dateRange = {
      from: Math.min(boundedFrom, boundedTo),
      to: Math.max(boundedFrom, boundedTo)
    };
  }

  private setRangeFromPreset(preset: AdvancedSearchPreset, emit: boolean) {
    this.selectedPresetLabel = preset.label;
    this.dateRange = preset.range();
    this.updateSliderRange();
    this.syncCustomInputsWithRange(this.dateRange);
    if (emit) {
      this.onCriteriaChange(true);
    }
  }

  private applyFilterRangePreset() {
    const allTimePreset = this.presetRanges.find(p => p.label === "All Time");
    if (allTimePreset) {
      this.setRangeFromPreset(allTimePreset, true);
    } else if (this.presetRanges.length > 0) {
      this.setRangeFromPreset(this.presetRanges[0], true);
    } else {
      this.ensurePresetSelection();
    }
  }

  private closestPresetToRange(range: DateRange): AdvancedSearchPreset | undefined {
    let bestPreset: AdvancedSearchPreset | undefined;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const preset of this.presetRanges) {
      const presetRange = preset.range();
      const diff = Math.abs(presetRange.from - range.from) + Math.abs(presetRange.to - range.to);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPreset = preset;
      }
    }
    return bestPreset;
  }

  private updatePresetSelectionForRange(range?: DateRange): boolean {
    if (!range || !this.presetRanges.length) {
      this.ensurePresetSelection();
      return false;
    } else {
      const preset = this.closestPresetToRange(range);
      if (!preset) {
        return false;
      } else {
        const presetRange = preset.range();
        if (this.rangesAreClose(range, presetRange)) {
          this.selectedPresetLabel = preset.label;
          return true;
        } else {
          return false;
        }
      }
    }
  }

  private rangesAreClose(rangeA: DateRange, rangeB: DateRange): boolean {
    const fromDiff = Math.abs(rangeA.from - rangeB.from);
    const toDiff = Math.abs(rangeA.to - rangeB.to);
    return fromDiff <= PRESET_MATCH_THRESHOLD_MS && toDiff <= PRESET_MATCH_THRESHOLD_MS;
  }

  private updatePresetRanges() {
    if (this.selectedFilterCriteria === FilterCriteria.FUTURE_EVENTS) {
      this.presetRanges = this.futurePresetRanges();
    } else if (this.selectedFilterCriteria === FilterCriteria.PAST_EVENTS) {
      this.presetRanges = this.pastPresetRanges();
    } else {
      this.presetRanges = this.allWalksPresetRanges();
    }
    this.ensurePresetSelection();
  }

  private allWalksPresetRanges(): AdvancedSearchPreset[] {
    return [
      this.pastPreset("Past Month", { months: 1 }),
      this.pastPreset("Past Year", { years: 1 }),
      this.futurePreset("30 Days", { days: 30 }),
      this.futurePreset("6 Months", { months: 6 }),
      this.allTimePreset()
    ];
  }

  private pastPreset(label: string, duration: { days?: number; months?: number; years?: number }): AdvancedSearchPreset {
    return {
      label,
      range: () => {
        const now = DateTime.now().startOf("day");
        return {
          from: now.minus(duration).toMillis(),
          to: now.toMillis()
        };
      }
    };
  }

  private pastPresetRanges(): AdvancedSearchPreset[] {
    return [
      this.pastPreset("Past Week", { days: 7 }),
      this.pastPreset("Past Month", { months: 1 }),
      this.pastPreset("Past Year", { years: 1 }),
      this.pastPreset("Past 2 Years", { years: 2 }),
      this.allTimePreset()
    ];
  }

  private futurePresetRanges(): AdvancedSearchPreset[] {
    return [
      this.futurePreset("7 Days", { days: 7 }),
      this.futurePreset("30 Days", { days: 30 }),
      this.futurePreset("3 Months", { months: 3 }),
      this.futurePreset("6 Months", { months: 6 }),
      this.allTimePreset()
    ];
  }

  private allTimePreset(): AdvancedSearchPreset {
    return {
      label: "All Time",
      range: () => ({
        from: this.minDate.toMillis(),
        to: this.maxDate.toMillis()
      })
    };
  }

  private futurePreset(label: string, duration: { days?: number; months?: number; years?: number }): AdvancedSearchPreset {
    return {
      label,
      range: () => {
        const start = DateTime.now().startOf("day");
        return {
          from: start.toMillis(),
          to: start.plus(duration).toMillis()
        };
      }
    };
  }
}
