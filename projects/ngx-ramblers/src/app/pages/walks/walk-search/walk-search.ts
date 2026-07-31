import { AfterViewChecked, Component, ElementRef, EventEmitter, inject, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { ActivatedRoute, ParamMap, Router, RouterLink } from "@angular/router";
import { Location, NgTemplateOutlet } from "@angular/common";
import { NgxLoggerLevel } from "ngx-logger";
import { Subject, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { toPairs, isNumber, isUndefined } from "es-toolkit/compat";
import { AlertTarget } from "../../../models/alert-target.model";
import { RouteParam } from "../../../models/content-text.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { DeviceSize } from "../../../models/page.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { Organisation, SystemConfig } from "../../../models/system.model";
import { WalkDisplayService } from "../walk-display.service";
import { walksLeaderPath } from "../../../models/walks-route-paths.model";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faPersonHiking, faSliders } from "@fortawesome/free-solid-svg-icons";
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

      .my-walks-action
        position: absolute
        top: 8px
        right: 0
        z-index: 6

      .advanced-search-icon
        transition: transform 0.3s ease-in-out

        &.rotated
          transform: rotate(90deg)

      .search-alert
        box-sizing: border-box
        min-width: 0
        max-width: 100%
        white-space: normal
        min-height: 0
        padding: calc(.75rem - 1px) .85rem
        line-height: 1
        border-width: 1px
        border-radius: 6px
        align-items: center

        .mt-1
          margin-top: 0

      .search-alert-body
        min-width: 0
        flex: 1 1 auto
        display: flex
        flex-direction: column
        justify-content: center
        line-height: 1

      .search-alert-message
        white-space: pre-wrap
        overflow-wrap: anywhere
        word-break: break-word
        line-height: 1
        font-size: 1rem
        margin: 0

      @media (min-width: 992px)
        .search-alert-inline
          flex: 0 1 auto

          .search-alert-body
            flex-direction: row
            align-items: baseline
            gap: .35rem

          strong,
          .search-alert-message
            white-space: nowrap
            overflow: hidden
            text-overflow: ellipsis

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
      @if (showMyWalks()) {
        <a class="btn pager-btn-primary rounded my-walks-action" [routerLink]="myWalksLink()">
          <fa-icon [icon]="faPersonHiking" class="me-2"/>My Walks
        </a>
      }
      <div class="sticky-toolbar">
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
          <div class="mb-2 mb-lg-0 d-flex justify-content-end min-w-0">
            <ng-container *ngTemplateOutlet="searchAlert; context: {inline: true}"/>
          </div>
        }
      </div>
      @if (showPagination || !alertInline()) {
        <div class="d-flex full-width-pagination align-items-center gap-2 flex-wrap mt-1">
          @if (showPagination) {
            <ng-content/>
          }
          @if (showAlerts && notifyTarget.showAlert) {
            <div class="alert-wrapper flex-grow-1 min-w-0">
              <ng-container *ngTemplateOutlet="searchAlert; context: {inline: false}"/>
            </div>
          }
        </div>
      }
      </div>
      <ng-template #searchAlert let-inline="inline">
        <div class="alert {{notifyTarget.alertClass}} search-alert my-0 d-flex align-items-center gap-2"
             [class.search-alert-inline]="inline" [title]="inline ? notifyTarget.alertMessage : null">
          <fa-icon [icon]="notifyTarget.alert.icon" class="flex-shrink-0"></fa-icon>
          <div class="search-alert-body">
            @if (notifyTarget.alertTitle) {
              <strong class="d-block">{{ notifyTarget.alertTitle }}</strong>
            }
            @if (notifyTarget.alertMessage) {
              <div class="search-alert-message">{{ notifyTarget.alertMessage }}</div>
            }
          </div>
        </div>
      </ng-template>
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
  imports: [FormsModule, FontAwesomeModule, AdvancedSearchPane, NgSelectModule, RouterLink, NgTemplateOutlet],
    standalone: true
})
export class WalkSearch implements OnInit, OnDestroy, AfterViewChecked {

  protected readonly faPersonHiking = faPersonHiking;
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
      this.currentWalkId = paramMap.get(RouteParam.WALK_ID);
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
        this.queryParamsActive = true;
        this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.APPLY_FILTER, searchTerm));
      }));
  }

  showMyWalks(): boolean {
    return this.memberLoginService.memberLoggedIn();
  }

  myWalksLink(): string {
    return "/" + walksLeaderPath(this.displayService.walksArea());
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
    const criteria = this.constrainCriteriaToSelectedPreset(event.criteria);
    this.advancedCriteria = hasAdvancedCriteria(criteria) ? criteria : null;
    if (this.advancedCriteria) {
      this.syncDateRangePresetWithCriteria(this.advancedCriteria);
    } else {
      this.resetToDefaultPreset();
    }
    this.queryParamsActive = true;
    const queryParams = advancedCriteriaQueryParams(this.advancedCriteria, this.stringUtils, this.dateUtils, event.leaderOptions);
    queryParams[this.stringUtils.kebabCase(StoredValue.DATE_RANGE_PRESET)] = this.selectedDateRangePreset?.label
      ? this.stringUtils.kebabCase(this.selectedDateRangePreset.label)
      : null;
    if (this.selectedDateRangePreset?.filterType) {
      this.filterParameters.selectType = this.selectedDateRangePreset.filterType;
      queryParams[this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE)] = this.stringUtils.kebabCase(this.filterParameters.selectType);
    }
    this.logger.info("onAdvancedSearchChange: writing query params:", queryParams);
    this.replaceQueryParams(queryParams);
    this.advancedSearchChange.emit(criteria);
    this.emitFilterState();
  }

  private constrainCriteriaToSelectedPreset(criteria: AdvancedSearchCriteria | null): AdvancedSearchCriteria | null {
    if (!criteria || !this.selectedDateRangePreset?.preset?.relativeDateRange) {
      return criteria;
    }
    if (!isNumber(criteria.dateFrom) || !isNumber(criteria.dateTo)) {
      return criteria;
    }
    const expected = this.selectedDateRangePreset.preset.range();
    if (this.rangesAreClose(criteria, expected)) {
      return criteria;
    }
    const criteriaSpan = Math.max(0, criteria.dateTo - criteria.dateFrom);
    const expectedSpan = Math.max(1, expected.to - expected.from);
    if (criteriaSpan > expectedSpan * 1.25) {
      return {
        ...criteria,
        dateFrom: expected.from,
        dateTo: expected.to
      };
    }
    return criteria;
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
    const currentTree = this.router.parseUrl(this.location.path());
    const merged = {...currentTree.queryParams, ...params};
    const queryParams = Object.fromEntries(toPairs(merged).filter(([, v]) => v !== null && !isUndefined(v)));
    const urlTree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams,
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
      Object.assign(allParams, advancedCriteriaQueryParams(criteria, this.stringUtils, this.dateUtils, []));
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
