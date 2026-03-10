import { AfterViewChecked, Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Location } from "@angular/common";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { isNumber, isUndefined } from "es-toolkit/compat";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { DeviceSize } from "../../../models/page.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { Organisation, SystemConfig } from "../../../models/system.model";
import { WalkDisplayService } from "../walk-display.service";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faSliders } from "@fortawesome/free-solid-svg-icons";
import {
  AdvancedSearchCriteria,
  AdvancedSearchPreset,
  PRESET_MATCH_THRESHOLD_MS,
  createAllWalksPresetRanges,
  createFuturePresetRanges,
  createPastPresetRanges,
  FilterParameters,
  FilterStateEvent,
  RelativeDateRange,
  WalkLeaderOption
} from "../../../models/search.model";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { StringUtilsService } from "../../../services/string-utils.service";
import { AdvancedSearchPane } from "./advanced-search-pane";
import {
  advancedCriteriaQueryParams,
  advancedCriteriaToSavedCriteria,
  advancedSearchCriteriaFromParams,
  hasAdvancedCriteria
} from "../../../functions/walks/advanced-search";
import { NgSelectModule } from "@ng-select/ng-select";
import { FilterCriteria } from "../../../models/api-request.model";
import { DateTime } from "luxon";
import { DateUtilsService } from "../../../services/date-utils.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";

interface DateRangePreset {
  id: string;
  label: string;
  filterType?: FilterCriteria;
  preset?: AdvancedSearchPreset;
  dateRange?: RelativeDateRange;
  groupLabel?: string;
  adminOnly?: boolean;
  localWalkPopulationOnly?: boolean;
}

@Component({
    selector: "app-walks-search",
    styles: [`
      app-advanced-search-panel
        display: block
        overflow: hidden
        max-height: 0
        opacity: 0
        transition: max-height 0.3s ease-in-out, opacity 0.3s ease-in-out

        &.show
          max-height: 2000px
          opacity: 1

      .advanced-search-icon
        transition: transform 0.3s ease-in-out

        &.rotated
          transform: rotate(90deg)

      ::ng-deep .ng-select
        .ng-select-container
          font-size: 1rem
          min-height: 38px
          border: 1px solid #ced4da
          border-radius: 0.375rem

          .ng-value-container
            padding-left: 0.75rem
            padding-right: 0.75rem

            .ng-input
              padding-left: 0

        .ng-dropdown-panel
          .ng-dropdown-panel-items
            .ng-option
              font-size: 0.9rem
              padding: 0.5rem 0.75rem 0.5rem 1.5rem

            .ng-optgroup
              font-weight: 700
              font-size: 1rem
              padding: 0.75rem 0.75rem 0.5rem 0.75rem
              color: #212529
              background-color: #e9ecef
              border-top: 1px solid #dee2e6

    `],
    template: `
    @if (!currentWalkId) {
      <div class="d-lg-flex pb-0 pb-lg-2 align-items-lg-center gap-lg-3">
        <div class="mb-2 mb-lg-0 flex-lg-fill">
          <input [(ngModel)]="filterParameters.quickSearch" #quickSearch
            (ngModelChange)="onSearchChange($event)"
            name="quickSearch"
            class="form-control rounded w-100"
            type="text" placeholder="Quick Search">
        </div>
        <div class="mb-2 mb-lg-0 flex-lg-fill">
          <ng-select
            [items]="dateRangePresets"
            [(ngModel)]="selectedDateRangePreset"
            bindLabel="label"
            groupBy="groupLabel"
            [clearable]="false"
            [searchable]="false"
            dropdownPosition="bottom"
            (change)="onDateRangePresetChange($event)"
            class="rounded w-100">
            <ng-template ng-label-tmp let-item="item">
              <span [title]="(item.groupLabel ? item.groupLabel + ' - ' : '') + item.label">
                {{ item.label }}
              </span>
            </ng-template>
          </ng-select>
        </div>
        <div class="mb-2 mb-lg-0 flex-lg-fill">
          <ng-select
            [items]="sortOptions"
            [(ngModel)]="filterParameters.ascending"
            bindLabel="label"
            bindValue="value"
            [clearable]="false"
            [searchable]="false"
            dropdownPosition="bottom"
            (ngModelChange)="refreshWalks('change filterParameters.ascending')"
            class="rounded w-100">
          </ng-select>
        </div>
        <div class="mb-2 mb-lg-0 flex-lg-shrink-0">
          <ng-content select="[view-selector]"/>
        </div>
        @if (showAdvancedSearch) {
          <div class="mb-1 mb-lg-0 flex-lg-shrink-0">
            <button type="button" class="btn pager-btn rounded w-100" (click)="toggleAdvancedSearch()">
              <fa-icon [icon]="faSliders" class="me-2 advanced-search-icon" [class.rotated]="advancedSearchExpanded"/>
              Advanced Search
            </button>
          </div>
        }
        @if (alertInline() && showAlerts && notifyTarget.showAlert) {
          <div class="mb-2 mb-lg-0 flex-lg-fill d-flex justify-content-end">
            <div class="alert {{notifyTarget.alertClass}} my-0 d-flex align-items-center">
              <fa-icon [icon]="notifyTarget.alert.icon" class="flex-shrink-0"></fa-icon>
              <span class="flex-shrink-0 ms-2"><strong>{{ notifyTarget.alertTitle }}</strong></span>
              <span class="ms-1">{{ notifyTarget.alertMessage }}</span>
            </div>
          </div>
        }
      </div>
      @if (showPagination || !alertInline()) {
        <div class="d-flex full-width-pagination align-items-center gap-2 flex-wrap mt-1">
          @if (showPagination) {
            <ng-content/>
          }
          @if (showAlerts && notifyTarget.showAlert) {
            <div class="alert-wrapper flex-grow-1">
              <div class="alert {{notifyTarget.alertClass}} my-0 d-flex align-items-center">
                <fa-icon [icon]="notifyTarget.alert.icon" class="flex-shrink-0"></fa-icon>
                <span class="flex-shrink-0 ms-2"><strong>{{ notifyTarget.alertTitle }}</strong></span>
                <span class="ms-1">{{ notifyTarget.alertMessage }}</span>
              </div>
            </div>
          }
        </div>
      }
      @if (showAdvancedSearch) {
        <app-advanced-search-panel
          [class.show]="advancedSearchExpanded"
          [criteria]="advancedCriteria"
          [filterSelectType]="filterParameters?.selectType"
          [expanded]="advancedSearchExpanded"
          (toggleAdvancedSearch)="toggleAdvancedSearch()"
          (searchCriteriaChange)="onAdvancedSearchChange($event)"/>
      }
    }`,
  imports: [FormsModule, FontAwesomeModule, AdvancedSearchPane, NgSelectModule],
    standalone: true
})
export class WalkSearch implements OnInit, OnDestroy, AfterViewChecked {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkSearch", NgxLoggerLevel.ERROR);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private walksReferenceService = inject(WalksReferenceService);
  private displayService = inject(WalkDisplayService);
  private memberLoginService = inject(MemberLoginService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private dateUtils = inject(DateUtilsService);
  private walksAndEventsService = inject(WalksAndEventsService);
  public currentWalkId: string;
  public showPagination = false;
  public group: Organisation;
  private searchChangeObservable: Subject<string> = new Subject<string>();
  private subscriptions: Subscription[] = [];
  private ui = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);
  private shouldFocusSearch = false;
  @ViewChild("quickSearch") quickSearchInput: ElementRef;
  @Input()
  notifyTarget: AlertTarget;
  @Input()
  filterParameters: FilterParameters;
  @Input()
  showAlerts = true;
  @Input()
  showAdvancedSearch = true;
  @Input()
  advancedCriteria: AdvancedSearchCriteria | null = null;
  @Output()
  advancedSearchChange = new EventEmitter<AdvancedSearchCriteria>();
  @Output()
  filterStateChange = new EventEmitter<FilterStateEvent>();

  advancedSearchExpanded = false;
  private queryParamsActive = false;
  faSliders = faSliders;
  dateRangePresets: DateRangePreset[] = [];
  selectedDateRangePreset: DateRangePreset | null = null;
  private dataMinDate: DateTime = this.dateUtils.dateTimeNowNoTime().minus({years: 5});
  private dataMaxDate: DateTime = this.dateUtils.dateTimeNowNoTime().plus({years: 2}).endOf("day");
  minDate = this.dataMinDate;
  maxDate = this.dataMaxDate;

  sortOptions = [
    {value: true, label: "Sort (date ascending)"},
    {value: false, label: "Sort (date descending)"}
  ];

  alertInline(): boolean {
    return !this.showPagination && !hasAdvancedCriteria(this.advancedCriteria);
  }

  logAlertDebug(location: string) {
    this.logger.off(`logAlertDebug walk-search ${location}:`, {
      showAlerts: this.showAlerts,
      showPagination: this.showPagination,
      showAlert: this.notifyTarget.showAlert,
      alertMessage: this.notifyTarget.alertMessage,
      busy: this.notifyTarget.busy
    });
    return "";
  }


  ngOnInit(): void {
    void this.loadDateRange();
    const initialCriteria = advancedSearchCriteriaFromParams(this.route.snapshot.queryParamMap, this.stringUtils);
    this.logger.info("ngOnInit: initialCriteria:", initialCriteria, "queryParamsActive:", this.queryParamsActive);
    if (initialCriteria) {
      this.advancedCriteria = initialCriteria;
      this.queryParamsActive = true;
      this.logger.info("ngOnInit: set queryParamsActive=true from URL criteria");
    }
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.currentWalkId = paramMap.get("walk-id");
      this.logger.debug("walk-id from route params:", this.currentWalkId);
    }));
    this.subscriptions.push(this.route.queryParamMap.subscribe(paramMap => this.applyAdvancedSearchQueryParam(paramMap)));
    this.broadcastService.on(NamedEventType.SHOW_PAGINATION, (show: NamedEvent<boolean>) => {
      this.logger.info("showPagination:", show);
      if (this.showPagination !== show.data) {
        this.showPagination = show.data;
        if (this.filterParameters?.quickSearch) {
          this.shouldFocusSearch = true;
        }
      }
      return this.showPagination;
    });
    this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, (namedEvent: NamedEvent<SystemConfig>) => {
      this.logger.info("showPagination:", namedEvent.data.group);
      return this.group = namedEvent.data.group;
    });
    this.subscriptions.push(this.searchChangeObservable.pipe(debounceTime(500))
      .pipe(distinctUntilChanged())
      .subscribe(searchTerm => {
        this.ui.saveValueFor(StoredValue.SEARCH, searchTerm || "");
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.APPLY_FILTER, searchTerm));
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngAfterViewChecked(): void {
    if (this.shouldFocusSearch && this.quickSearchInput) {
      this.quickSearchInput.nativeElement.focus();
      this.shouldFocusSearch = false;
    }
  }

  onSearchChange(searchEntry: string) {
    this.logger.debug("received searchEntry:" + searchEntry);
    this.searchChangeObservable.next(searchEntry);
  }

  walksFilter() {
    return this.walksReferenceService.walksFilter
      .filter(item => {
        const condition1 = item.adminOnly ? this.memberLoginService.allowWalkAdminEdits() : true;
        const condition2 = item.localWalkPopulationOnly ? this.displayService.walkPopulationLocal() : true;
        return condition1 && condition2;
      });
  }

  refreshWalks(selectType: string) {
    this.logger.info("refreshWalks: selectType:", selectType, "queryParamsActive:", this.queryParamsActive, "filterParameters:", this.filterParameters);
    this.ui.saveValueFor(StoredValue.WALK_SELECT_TYPE, this.filterParameters.selectType);
    this.ui.saveValueFor(StoredValue.WALK_SORT_ASC, this.filterParameters.ascending);
    if (this.queryParamsActive) {
      const ascending = this.stringUtils.asBoolean(this.filterParameters.ascending);
      this.replaceQueryParams({
        [this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE)]: this.stringUtils.kebabCase(this.filterParameters.selectType),
        [this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC)]: ascending ? null : "false"
      });
    }
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.REFRESH, selectType));
    this.emitFilterState();
  }

  toggleAdvancedSearch() {
    this.advancedSearchExpanded = !this.advancedSearchExpanded;
    this.queryParamsActive = true;
    const paramValue = this.advancedSearchExpanded ? "true" : "false";
    this.replaceQueryParams({
      [this.stringUtils.kebabCase(StoredValue.ADVANCED_SEARCH)]: paramValue
    });
    this.logger.info("Advanced search expanded:", this.advancedSearchExpanded);
  }

  private applyAdvancedSearchQueryParam(params: ParamMap) {
    const value = params.get(this.stringUtils.kebabCase(StoredValue.ADVANCED_SEARCH));
    this.advancedSearchExpanded = value === "true";
  }

  onAdvancedSearchChange(event: { criteria: AdvancedSearchCriteria; leaderOptions: WalkLeaderOption[] }) {
    this.logger.info("onAdvancedSearchChange: queryParamsActive:", this.queryParamsActive, "criteria:", event.criteria);
    this.advancedCriteria = hasAdvancedCriteria(event.criteria) ? event.criteria : null;
    if (this.advancedCriteria) {
      this.syncDateRangePresetWithCriteria(event.criteria);
    } else {
      this.resetToDefaultPreset();
    }
    if (this.queryParamsActive) {
      const queryParams = advancedCriteriaQueryParams(this.advancedCriteria, this.stringUtils, this.dateUtils, event.leaderOptions);
      this.logger.info("onAdvancedSearchChange: writing query params:", queryParams);
      this.replaceQueryParams(queryParams);
    } else {
      this.logger.info("onAdvancedSearchChange: skipping query params (queryParamsActive=false)");
    }
    this.advancedSearchChange.emit(event.criteria);
    this.emitFilterState();
  }

  private syncDateRangePresetWithCriteria(criteria: AdvancedSearchCriteria) {
    if (!criteria?.dateFrom || !criteria?.dateTo || !this.dateRangePresets.length) {
      return;
    }
    let bestPreset: DateRangePreset | null = null;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const preset of this.dateRangePresets) {
      if (preset.preset) {
        const range = preset.preset.range();
        const diff = Math.abs(range.from - criteria.dateFrom) + Math.abs(range.to - criteria.dateTo);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestPreset = preset;
        }
      }
    }
    if (bestPreset && this.rangesAreClose(criteria, bestPreset.preset.range())) {
      this.selectedDateRangePreset = bestPreset;
      if (bestPreset.filterType) {
        this.filterParameters.selectType = bestPreset.filterType;
      }
    }
  }

  private rangesAreClose(criteria: AdvancedSearchCriteria, range: { from: number; to: number }): boolean {
    const fromDiff = Math.abs(range.from - criteria.dateFrom);
    const toDiff = Math.abs(range.to - criteria.dateTo);
    return fromDiff <= PRESET_MATCH_THRESHOLD_MS && toDiff <= PRESET_MATCH_THRESHOLD_MS;
  }

  private emitFilterState() {
    const savedCriteria = advancedCriteriaToSavedCriteria(
      this.advancedCriteria,
      this.selectedDateRangePreset?.preset?.relativeDateRange,
      this.selectedDateRangePreset?.label
    );
    this.filterStateChange.emit({
      filterCriteria: this.filterParameters.selectType,
      ascending: this.filterParameters.ascending,
      presetLabel: this.selectedDateRangePreset?.label,
      savedCriteria
    });
  }

  private replaceQueryParams(params: Record<string, string | number | null>) {
    this.logger.info("replaceQueryParams called with:", params, "queryParamsActive:", this.queryParamsActive);
    const queryParams = Object.fromEntries(Object.entries(params).filter(([, v]) => !isUndefined(v)));
    const urlTree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: "merge",
      fragment: this.route.snapshot.fragment
    });
    this.location.replaceState(this.router.serializeUrl(urlTree));
  }

  showAlertInline(): boolean {
    const inline = window.innerWidth >= DeviceSize.EXTRA_LARGE;
    this.logger.info("window.innerWidth:", window.innerWidth, "showAlertInline ->", inline);
    return inline;
  }

  private initialiseDateRangePresets() {
    const futurePresets = createFuturePresetRanges(this.minDate, this.maxDate).map((preset, idx) => ({
      id: `future-${idx}`,
      label: preset.label,
      filterType: FilterCriteria.FUTURE_EVENTS,
      preset,
      groupLabel: "Walks Today Onwards"
    }));

    const pastPresets = createPastPresetRanges(this.minDate, this.maxDate).map((preset, idx) => ({
      id: `past-${idx}`,
      label: preset.label,
      filterType: FilterCriteria.PAST_EVENTS,
      preset,
      groupLabel: "Past Walks"
    }));

    const allPresets = createAllWalksPresetRanges(this.minDate, this.maxDate).map((preset, idx) => ({
      id: `all-${idx}`,
      label: preset.label,
      filterType: FilterCriteria.ALL_EVENTS,
      preset,
      groupLabel: "All Walks"
    }));

    const otherFilters = this.walksReferenceService.walksFilter
      .filter(f => ![FilterCriteria.FUTURE_EVENTS, FilterCriteria.PAST_EVENTS, FilterCriteria.ALL_EVENTS].includes(f.value))
      .filter(item => {
        const condition1 = item.adminOnly ? this.memberLoginService.allowWalkAdminEdits() : true;
        const condition2 = item.localWalkPopulationOnly ? this.displayService.walkPopulationLocal() : true;
        return condition1 && condition2;
      })
      .map(f => ({
        id: f.value,
        label: f.description,
        filterType: f.value,
        adminOnly: f.adminOnly,
        localWalkPopulationOnly: f.localWalkPopulationOnly
      }));

    this.dateRangePresets = [
      ...futurePresets,
      ...pastPresets,
      ...allPresets,
      ...otherFilters
    ];
  }

  private resetToDefaultPreset() {
    this.filterParameters.selectType = FilterCriteria.FUTURE_EVENTS;
    const futurePresets = this.dateRangePresets.filter(opt => opt.filterType === FilterCriteria.FUTURE_EVENTS);
    const allTimePreset = futurePresets.find(opt => opt.label.startsWith("All "));
    this.selectedDateRangePreset = allTimePreset || futurePresets[0] || this.dateRangePresets[0];
    this.filterParameters.ascending = true;
    this.ui.saveValueFor(StoredValue.WALK_SELECT_TYPE, this.filterParameters.selectType);
    this.ui.saveValueFor(StoredValue.WALK_SORT_ASC, this.filterParameters.ascending);
  }

  private initialiseSelectedDateRangePreset() {
    const presetParam = this.route.snapshot.queryParamMap.get(this.stringUtils.kebabCase(StoredValue.DATE_RANGE_PRESET));
    if (presetParam) {
      const match = this.dateRangePresets.find(p => this.stringUtils.kebabCase(p.label) === presetParam);
      if (match) {
        this.selectedDateRangePreset = match;
        if (match.filterType) {
          this.filterParameters.selectType = match.filterType;
        }
        return;
      }
    }
    const currentFilter = this.filterParameters?.selectType || FilterCriteria.FUTURE_EVENTS;
    const matchingPresets = this.dateRangePresets.filter(opt => opt.filterType === currentFilter);
    if (matchingPresets.length > 0) {
      const allTimePreset = matchingPresets.find(opt => opt.label.startsWith("All "));
      this.selectedDateRangePreset = allTimePreset || matchingPresets[0];
    } else {
      this.selectedDateRangePreset = this.dateRangePresets[0];
    }
  }

  onDateRangePresetChange(preset: DateRangePreset | null) {
    if (!preset) {
      return;
    }

    this.logger.info("Date range preset changed:", preset);
    this.queryParamsActive = true;

    const allParams: Record<string, string | number | null> = {
      [this.stringUtils.kebabCase(StoredValue.DATE_RANGE_PRESET)]: this.stringUtils.kebabCase(preset.label)
    };

    if (preset.preset) {
      const range = preset.preset.range();
      const criteria: AdvancedSearchCriteria = {
        ...(this.advancedCriteria || {}),
        dateFrom: range.from,
        dateTo: range.to
      };
      this.advancedCriteria = criteria;
      this.advancedSearchChange.emit(criteria);
      const nonDateParams = advancedCriteriaQueryParams({...criteria, dateFrom: undefined, dateTo: undefined}, this.stringUtils, this.dateUtils, []);
      Object.assign(allParams, nonDateParams);
    }

    if (preset.filterType) {
      this.filterParameters.selectType = preset.filterType;
      this.ui.saveValueFor(StoredValue.WALK_SELECT_TYPE, this.filterParameters.selectType);
      this.ui.saveValueFor(StoredValue.WALK_SORT_ASC, this.filterParameters.ascending);
      const ascending = this.stringUtils.asBoolean(this.filterParameters.ascending);
      allParams[this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE)] = this.stringUtils.kebabCase(this.filterParameters.selectType);
      allParams[this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC)] = ascending ? null : "false";
    }

    this.replaceQueryParams(allParams);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.REFRESH, "date-range-preset-change"));
    this.emitFilterState();
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
      this.initialiseDateRangePresets();
      this.initialiseSelectedDateRangePreset();
      if (this.advancedCriteria) {
        this.syncDateRangePresetWithCriteria(this.advancedCriteria);
      }
    } catch (error) {
      this.logger.error("Failed to load date range:", error);
    }
  }
}
