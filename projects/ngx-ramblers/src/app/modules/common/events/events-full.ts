import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { Location } from "@angular/common";
import { range } from "es-toolkit";
import { isArray, isNull, isUndefined } from "es-toolkit/compat";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { faBug, faImages, faPeopleGroup, faTableCells, faWalking } from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LoginResponse } from "../../../models/member.model";
import { DeviceSize } from "../../../models/page.model";
import { EventPopulation } from "../../../models/system.model";
import { DisplayedWalk, EventField, GroupEventField, WalkListView } from "../../../models/walk.model";
import { EventsData } from "../../../models/group-events.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { LocalWalksAndEventsService } from "../../../services/walks-and-events/local-walks-and-events.service";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { asNumber } from "../../../functions/numbers";
import { quickSearchCriteria } from "../../../functions/walks/quick-search";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { WalkSearch } from "../../../pages/walks/walk-search/walk-search";
import { WalkCardListComponent } from "../../../pages/walks/walk-view/walk-card-list";
import { WalksMapView } from "../../../pages/walks/walk-list/walks-map-view";
import { WalkViewComponent } from "../../../pages/walks/walk-view/walk-view";
import { EventTableView } from "./event-table-view";
import { AdvancedSearchCriteria, DEFAULT_FILTER_PARAMETERS, FilterParameters, FilterStateEvent, resolvePresetByLabel } from "../../../models/search.model";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { InputSource } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { JsonPipe } from "@angular/common";
import { DataQueryOptions, FilterCriteria, SortOrder } from "../../../models/api-request.model";
import { MAP_VIEW_SELECT } from "../../../models/map.model";
import { buildAdvancedSearchCriteria } from "../../../functions/walks/advanced-search-criteria-builder";
import { advancedCriteriaQueryParams, advancedCriteriaToSavedCriteria, advancedSearchCriteriaFromParams, advancedSearchSummary, hasAdvancedCriteria, savedCriteriaToAdvancedCriteria } from "../../../functions/walks/advanced-search";
import { AuthService } from "../../../auth/auth.service";
import { environment } from "../../../../environments/environment";

@Component({
  selector: "app-events-full",
  styleUrls: ["../../../pages/walks/walk-list/walk-list.sass"],
  template: `
    <div class="row mb-n3">
      <div class="mb-3 col-sm-12">
        <app-walks-search [filterParameters]="filterParameters" [notifyTarget]="notifyTarget"
                          [showAdvancedSearch]="advancedSearchAllowed()"
                          [advancedCriteria]="advancedSearchCriteria"
                          (advancedSearchChange)="onAdvancedSearch($event)"
                          (filterStateChange)="onFilterStateChange($event)">
          <div view-selector>
            <div class="d-flex gap-2">
              <div class="btn-group mb-0 btn-group-custom w-100 w-md-auto" dropdown>
                <button aria-controls="dropdown-animated" class="dropdown-toggle btn pager-btn me-0"
                        dropdownToggle type="button">
                  <fa-icon
                    [icon]="walkListView === WalkListView.CARDS ? faImages : (walkListView === WalkListView.TABLE ? faTableCells : faWalking)"/>
                  <span class="ms-2">{{ stringUtils.asTitle(walkListView) }} View</span>
                  <span class="caret"></span>
                </button>
                <ul *dropdownMenu class="dropdown-menu" id="dropdown-animated" role="menu">
                  <li role="menuitem"><a (click)="switchToView(WalkListView.CARDS)" class="dropdown-item">
                    <div><fa-icon [icon]="faImages" class="me-2"/>{{ stringUtils.asTitle(WalkListView.CARDS) }} View</div>
                  </a></li>
                  <li role="menuitem"><a (click)="switchToView(WalkListView.TABLE)" class="dropdown-item">
                    <div><fa-icon [icon]="faTableCells" class="me-2"/>{{ stringUtils.asTitle(WalkListView.TABLE) }} View
                    </div>
                  </a></li>
                  <li role="menuitem"><a (click)="switchToView(WalkListView.MAP)" class="dropdown-item">
                    <div><fa-icon [icon]="faWalking" class="me-2"/>{{ stringUtils.asTitle(WalkListView.MAP) }} View</div>
                  </a></li>
                </ul>
              </div>
              @if (showDiagnostics && !production && memberLoginService.allowWalkAdminEdits()) {
                <button type="button" class="btn pager-btn" (click)="showDiagnostics = !showDiagnostics"
                        [class.active]="showDiagnostics">
                  <fa-icon [icon]="faBug"/>
                </button>
              }
            </div>
          </div>
          @if (walkListView !== WalkListView.MAP && pageCount > 1) {
            <div class="d-flex align-items-center mt-0 mt-md-0 me-2 flex-shrink-0"
                 [class.cards-view-spacing]="walkListView === WalkListView.CARDS">
              <pagination class="pagination rounded mb-0" [boundaryLinks]=true [rotate]="true"
                          [maxSize]="maxSize()"
                          [totalItems]="paginationTotalItems" [(ngModel)]="pageNumber"
                          (pageChanged)="pageChanged($event)"/>
            </div>
          }
        </app-walks-search>
        @if (showDiagnostics) {
          <pre class="bg-dark text-light p-3 rounded mb-2 mt-2" style="font-size: 0.8rem; max-height: 300px; overflow: auto;">{{ debugCriteria() | json }}</pre>
        }
        @if (walkListView === WalkListView.CARDS) {
          <app-walk-card-list [currentPageWalks]="currentPageWalks"/>
        }
        @if (walkListView === WalkListView.MAP) {
          <app-walks-map-view class="d-block" [filteredWalks]="filteredWalks" [loading]="notifyTarget.busy"
                              [class.mt-2]="notifyTarget.showAlert"
                              (selected)="onMapSelect($event)"/>
          @if (mapSelected) {
            <div class="map-selected-walk" id="map-selected-walk">
              <app-walk-view [displayedWalk]="mapSelected" [showPanelExpander]="false"/>
            </div>
          }
        }
        @if (!walkListView || walkListView === WalkListView.TABLE) {
          <app-event-table-view [currentPageEvents]="currentPageWalks"/>
        }
      </div>
    </div>
  `,
  imports: [WalkSearch, BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective,
    PaginationComponent, FormsModule, WalkCardListComponent, WalksMapView, WalkViewComponent, EventTableView, JsonPipe]
})
export class EventsFull implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EventsFull", NgxLoggerLevel.ERROR);
  private uiActionsService = inject(UiActionsService);
  private systemConfigService = inject(SystemConfigService);
  googleMapsService = inject(GoogleMapsService);
  private authService = inject(AuthService);
  memberLoginService = inject(MemberLoginService);
  display = inject(WalkDisplayService);
  protected stringUtils = inject(StringUtilsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private notifierService = inject(NotifierService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
  private dateUtils = inject(DateUtilsService);
  protected readonly faWalking = faWalking;
  protected readonly faPeopleGroup = faPeopleGroup;
  protected readonly faTableCells = faTableCells;
  protected readonly faImages = faImages;
  protected readonly faBug = faBug;
  protected readonly WalkListView = WalkListView;
  protected readonly production = environment.production;

  @Input() eventsData: EventsData;

  public filteredWalks: DisplayedWalk[] = [];
  public currentPageWalks: DisplayedWalk[] = [];
  public filterParameters: FilterParameters = DEFAULT_FILTER_PARAMETERS();
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private pageSize = 10;
  public pageNumber = 1;
  public pageCount = 0;
  public pages: number[] = [];
  public advancedSearchCriteria: AdvancedSearchCriteria | null = null;
  private serverSideTotalItems = 0;
  private lastNonMapPageNumber = 1;
  private searchCounter = 0;
  private latestSearchId = 0;
  public mapSelected: DisplayedWalk | null = null;
  public paginationTotalItems = 0;
  private isInitializing = true;
  private queryParamsActive = false;
  private subscriptions: Subscription[] = [];
  protected walkListView: WalkListView;
  public storedAdvancedSearchCriteria: AdvancedSearchCriteria | null = null;
  public showDiagnostics = false;
  private defaultWalkListView: WalkListView = WalkListView.CARDS;
  private selectedPresetLabel: string | undefined;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.pageSize = 10;
    this.pageNumber = 1;
    this.route.queryParamMap.subscribe(params => {
      const q = params.get(this.stringUtils.kebabCase(StoredValue.SEARCH));
      const type = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE));
      const sort = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC));
      const view = params.get(this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW));
      const page = params.get(this.stringUtils.kebabCase(StoredValue.PAGE));
      const advancedSearch = params.get(this.stringUtils.kebabCase(StoredValue.ADVANCED_SEARCH));
      const dateRangePreset = params.get(this.stringUtils.kebabCase(StoredValue.DATE_RANGE_PRESET));
      const advancedCriteria = advancedSearchCriteriaFromParams(params, this.stringUtils);
      const hasQueryState = [q, type, sort, view, page, advancedSearch, dateRangePreset].some(value => !isNull(value)) || !!advancedCriteria;
      this.queryParamsActive = hasQueryState;
      if (!hasQueryState) {
        this.resetQueryDrivenState();
        return;
      }
      if (!isNull(q)) {
        this.filterParameters.quickSearch = q;
      }
      if (type) {
        this.filterParameters.selectType = type.replace(/-/g, "_").toUpperCase() as any;
      }
      if (!isNull(sort)) {
        this.filterParameters.ascending = sort !== "false";
      }
      if (view === "cards" || view === "table" || view === "map") {
        this.updateViewAndPagination(view as WalkListView);
        this.uiActionsService.saveValueFor(StoredValue.WALK_LIST_VIEW, this.walkListView);
      }
      if (page) {
        const pageNum = asNumber(page);
        if (!isNaN(pageNum) && pageNum > 0) {
          this.pageNumber = pageNum;
        }
      }
      if (dateRangePreset) {
        this.selectedPresetLabel = this.stringUtils.asTitle(dateRangePreset);
        const resolvedPreset = resolvePresetByLabel(dateRangePreset, this.stringUtils);
        if (resolvedPreset) {
          const range = resolvedPreset.range();
          const presetCriteria: AdvancedSearchCriteria = {
            ...(advancedCriteria || {}),
            dateFrom: range.from,
            dateTo: range.to
          };
          this.storedAdvancedSearchCriteria = presetCriteria;
          this.advancedSearchCriteria = this.advancedSearchAllowed() ? presetCriteria : null;
        } else {
          this.storedAdvancedSearchCriteria = advancedCriteria;
          this.advancedSearchCriteria = this.advancedSearchAllowed() ? this.storedAdvancedSearchCriteria : null;
        }
      } else {
        this.storedAdvancedSearchCriteria = advancedCriteria;
        this.advancedSearchCriteria = this.advancedSearchAllowed() ? this.storedAdvancedSearchCriteria : null;
      }
    });
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.defaultWalkListView = systemConfig.group.defaultWalkListView;
      this.updateViewAndPagination(this.uiActionsService.initialValueFor(StoredValue.WALK_LIST_VIEW, systemConfig.group.defaultWalkListView) as WalkListView);
    }));
    this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, () => this.refreshEvents(NamedEventType.SYSTEM_CONFIG_LOADED));
    this.broadcastService.on(NamedEventType.WALK_SLOTS_CREATED, () => this.refreshEvents(NamedEventType.WALK_SLOTS_CREATED));
    this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshEvents(NamedEventType.REFRESH));
    this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilter(searchTerm));
    this.broadcastService.on(NamedEventType.WALK_SAVED, () => this.refreshEvents(NamedEventType.WALK_SAVED));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.logger.debug("route paramMap:", paramMap);
    }));
    this.display.refreshCachedData();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.refreshEvents(loginResponse)));
    if (this.eventsData) {
      if (this.eventsData.filterCriteria) {
        this.filterParameters.selectType = this.eventsData.filterCriteria;
      }
      if (this.eventsData.sortOrder) {
        this.filterParameters.ascending = this.eventsData.sortOrder === "DATE_ASCENDING";
      }
      const savedCriteria = savedCriteriaToAdvancedCriteria(this.eventsData.savedCriteria);
      if (savedCriteria) {
        this.storedAdvancedSearchCriteria = savedCriteria;
        this.advancedSearchCriteria = this.advancedSearchAllowed() ? savedCriteria : null;
      }
      this.selectedPresetLabel = this.eventsData.savedCriteria?.presetLabel;
      this.logger.info("ngOnInit: applied eventsData config, filterParameters:", this.filterParameters, "savedCriteria:", savedCriteria);
    }
    setTimeout(() => {
      this.performServerSideSearch();
      this.isInitializing = false;
    }, 100);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  maxSize(): number {
    return window.innerWidth <= DeviceSize.MEDIUM ? 3 : 5;
  }

  applyFilter(searchTerm?: NamedEvent<string>): void {
    if (Boolean(searchTerm)) {
      this.pageNumber = 1;
      if (this.queryParamsActive) {
        this.replaceQueryParams({
          [this.stringUtils.kebabCase(StoredValue.PAGE)]: 1,
          [this.stringUtils.kebabCase(StoredValue.SEARCH)]: this.filterParameters.quickSearch || null
        });
      }
    }
    this.performServerSideSearch();
  }

  onAdvancedSearch(criteria: AdvancedSearchCriteria) {
    const nextCriteria = hasAdvancedCriteria(criteria) ? criteria : null;
    const criteriaChanged = JSON.stringify(this.advancedSearchCriteria) !== JSON.stringify(nextCriteria);
    const shouldResetPage = !this.isInitializing && criteriaChanged;
    this.storedAdvancedSearchCriteria = nextCriteria;
    this.advancedSearchCriteria = this.advancedSearchAllowed() ? nextCriteria : null;
    this.logger.info("onAdvancedSearch: shouldResetPage:", shouldResetPage, "criteriaChanged:", criteriaChanged, "queryParamsActive:", this.queryParamsActive);
    if (shouldResetPage) {
      this.pageNumber = 1;
      if (this.queryParamsActive) {
        const criteriaParams = advancedCriteriaQueryParams(nextCriteria, this.stringUtils, this.dateUtils);
        this.replaceQueryParams({
          [this.stringUtils.kebabCase(StoredValue.PAGE)]: 1,
          ...criteriaParams
        });
      }
    }
    setTimeout(() => this.performServerSideSearch(), 0);
  }

  onFilterStateChange(event: FilterStateEvent) {
    this.selectedPresetLabel = event.presetLabel;
    if (this.eventsData) {
      this.eventsData.filterCriteria = event.filterCriteria;
      this.eventsData.sortOrder = event.ascending ? SortOrder.DATE_ASCENDING : SortOrder.DATE_DESCENDING;
      this.eventsData.savedCriteria = event.savedCriteria;
      this.logger.info("onFilterStateChange: synced eventsData:", this.eventsData);
    }
  }

  advancedSearchAllowed(): boolean {
    return !this.eventsData || this.eventsData?.allow?.advancedSearch !== false;
  }

  private async performServerSideSearch() {
    this.searchCounter++;
    const thisSearchId = this.searchCounter;
    this.latestSearchId = thisSearchId;
    this.notify.setBusy();
    try {
      const criteriaParts: any[] = [];
      const walkPopulation = this.display?.group?.walkPopulation;
      const hasConfiguredEventTypes = this.eventsData?.eventTypes?.length > 0;

      if (hasConfiguredEventTypes) {
        criteriaParts.push({[GroupEventField.ITEM_TYPE]: {$in: this.eventsData.eventTypes}});
      } else if (walkPopulation === EventPopulation.LOCAL) {
        criteriaParts.push({[GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK});
      } else if (walkPopulation === EventPopulation.WALKS_MANAGER) {
        criteriaParts.push({[GroupEventField.ITEM_TYPE]: {$ne: RamblersEventType.GROUP_EVENT}});
      }

      if (walkPopulation === EventPopulation.LOCAL) {
        criteriaParts.push({[EventField.INPUT_SOURCE]: InputSource.MANUALLY_CREATED});
        criteriaParts.push({"events.eventType": {$ne: "deleted"}});
      } else if (walkPopulation === EventPopulation.WALKS_MANAGER) {
        criteriaParts.push({[EventField.INPUT_SOURCE]: {$ne: InputSource.MANUALLY_CREATED}});
      }

      const todayStart = this.dateUtils.dateTimeNow().startOf("day");
      const defaultFutureEnd = todayStart.plus({years: 2});
      let baseFrom: any = null;
      let baseTo: any = null;
      switch (this.filterParameters.selectType) {
        case FilterCriteria.FUTURE_EVENTS:
          baseFrom = todayStart;
          baseTo = defaultFutureEnd;
          break;
        case FilterCriteria.PAST_EVENTS:
          baseTo = todayStart;
          break;
        case FilterCriteria.ALL_EVENTS:
          break;
        default:
          baseFrom = todayStart;
          baseTo = defaultFutureEnd;
      }
      let dateFrom = baseFrom;
      let dateTo = baseTo;
      if (this.advancedSearchCriteria?.dateFrom) {
        const advFrom = this.dateUtils.asDateTime(this.advancedSearchCriteria.dateFrom);
        if (baseFrom) {
          dateFrom = advFrom > baseFrom ? advFrom : baseFrom;
        } else if (!baseTo || advFrom < baseTo) {
          dateFrom = advFrom;
        }
      }
      if (this.advancedSearchCriteria?.dateTo) {
        const advTo = this.dateUtils.asDateTime(this.advancedSearchCriteria.dateTo);
        if (baseTo) {
          dateTo = advTo < baseTo ? advTo : baseTo;
        } else if (!baseFrom || advTo > baseFrom) {
          dateTo = advTo;
        }
      }
      if (dateFrom || dateTo) {
        const dateCriteria: any = {};
        if (dateFrom) {
          dateCriteria.$gte = dateFrom.toISO();
        }
        if (dateTo) {
          dateCriteria.$lte = dateTo.toISO();
        }
        criteriaParts.push({[GroupEventField.START_DATE]: dateCriteria});
      }
      const quickCriteria = quickSearchCriteria(this.filterParameters.quickSearch);
      if (quickCriteria) {
        criteriaParts.push(quickCriteria);
      }
      const advancedCriteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: this.advancedSearchCriteria,
        dateUtils: this.dateUtils,
        walkPopulationLocal: this.display.walkPopulationLocal(),
        logger: this.logger
      });
      criteriaParts.push(...advancedCriteria);
      const criteria = criteriaParts.length === 0 ? {} : (criteriaParts.length === 1 ? criteriaParts[0] : {$and: criteriaParts});
      const sortAscending = this.uiActionsService.booleanOf(this.filterParameters.ascending);
      const sort = sortAscending
        ? {[GroupEventField.START_DATE]: 1}
        : {[GroupEventField.START_DATE]: -1};
      const dataQueryOptions: DataQueryOptions = {criteria, sort};
      if (this.walkListView === WalkListView.MAP) {
        dataQueryOptions.select = MAP_VIEW_SELECT;
      } else {
        dataQueryOptions.page = this.pageNumber;
        dataQueryOptions.limit = this.pageSize;
      }
      const response = await this.localWalksAndEventsService.allWithPagination(dataQueryOptions);
      if (thisSearchId === this.latestSearchId) {
        const events = isArray(response.response) ? response.response : [response.response].filter(Boolean);
        this.serverSideTotalItems = response.pagination?.total || events.length || 0;
        const displayedWalks = events.map(event => this.display.toDisplayedWalk(event));
        this.filteredWalks = displayedWalks;
        this.currentPageWalks = displayedWalks;
        this.updatePaginationStatus();
        if (this.currentPageWalks.length > 0 && this.display.expandedWalks.length === 0 && this.walkListView !== WalkListView.TABLE) {
          this.display.view(this.currentPageWalks[0].walk);
        }
      }
      this.notify.clearBusy();
    } catch (error) {
      if (thisSearchId === this.latestSearchId) {
        this.notify.error({
          title: "Search Failed",
          message: error.error?.message || "Failed to perform search"
        });
      }
      this.notify.clearBusy();
    }
  }

  private updatePaginationStatus() {
    const totalItems = this.serverSideTotalItems;
    this.paginationTotalItems = totalItems;
    if (this.walkListView === WalkListView.MAP) {
      this.pageCount = 1;
      this.pageNumber = 1;
      this.pages = [1];
      this.currentPageWalks = this.filteredWalks;
    } else {
      this.pageCount = Math.ceil(totalItems / this.pageSize);
      if (this.pageNumber > this.pageCount && this.pageCount > 0) {
        this.pageNumber = 1;
        if (this.queryParamsActive) {
          this.replaceQueryParams({[this.stringUtils.kebabCase(StoredValue.PAGE)]: 1});
        }
      }
      this.pages = range(1, this.pageCount + 1);
    }
    const hasEvents = this.currentPageWalks.length > 0;
    const offset = hasEvents ? ((this.pageNumber - 1) * this.pageSize + 1) : 0;
    const pageIndicator = this.pages.length > 1 ? `page ${this.pageNumber} of ${this.pageCount}` : "";
    const toNumber = hasEvents ? Math.min(this.pageNumber * this.pageSize, totalItems || 0) : 0;
    const totalOnly = `${this.stringUtils.pluraliseWithCount(totalItems || 0, "event")}`;
    const hasSearchTerm = this.filterParameters?.quickSearch && this.filterParameters.quickSearch.trim().length > 0;
    const noResultsBase = hasSearchTerm ? `No results match "${this.filterParameters.quickSearch}"` : "No events found";
    const filterSummary = advancedSearchSummary(this.advancedSearchCriteria, this.stringUtils, this.dateUtils, this.selectedPresetLabel, this.filterParameters.ascending);
    const filterSuffix = filterSummary ? `${EM_DASH_WITH_SPACES}${filterSummary}` : "";
    const noResultsMessage = `${noResultsBase}${filterSuffix}`;
    const alertMessage = this.walkListView === WalkListView.MAP
      ? (this.filteredWalks?.length ? `Showing ${totalOnly}${filterSuffix}` : noResultsMessage)
      : (hasEvents ? (this.pageCount <= 1 ? `${totalOnly}${filterSuffix}` : `${offset} to ${toNumber} of ${totalOnly}${pageIndicator ? EM_DASH_WITH_SPACES + pageIndicator : ""}${filterSuffix}`) : noResultsMessage);
    this.notify.progress(alertMessage);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pageCount > 1 || this.walkListView === WalkListView.MAP));
  }

  refreshEvents(_event?: any): void {
    this.advancedSearchCriteria = this.advancedSearchAllowed() ? this.storedAdvancedSearchCriteria : null;
    if (!this.advancedSearchAllowed() && this.queryParamsActive) {
      const criteriaParams = advancedCriteriaQueryParams(null, this.stringUtils, this.dateUtils);
      this.replaceQueryParams(criteriaParams);
    }
    this.performServerSideSearch();
  }

  pageChanged(event: PageChangedEvent): void {
    this.goToPage(event.page);
  }

  goToPage(pageNumber: number) {
    this.pageNumber = pageNumber;
    this.queryParamsActive = true;
    this.performServerSideSearch();
    this.replaceQueryParams({[this.stringUtils.kebabCase(StoredValue.PAGE)]: pageNumber});
  }

  onMapSelect(displayedWalk: DisplayedWalk) {
    const same = this.mapSelected?.walk?.id === displayedWalk?.walk?.id;
    if (same) {
      this.mapSelected = null as any;
      setTimeout(() => this.mapSelected = displayedWalk, 0);
    } else {
      this.mapSelected = displayedWalk;
    }
    const smooth = this.uiActionsService.initialBooleanValueFor(StoredValue.MAP_SMOOTH_SCROLL, true);
    if (smooth) {
      setTimeout(() => {
        const el = document.getElementById("map-selected-walk");
        if (el) {
          el.scrollIntoView({behavior: "smooth", block: "start"});
        }
      }, 0);
    }
  }

  switchToView(walkListView: WalkListView) {
    this.updateViewAndPagination(walkListView);
    this.uiActionsService.saveValueFor(StoredValue.WALK_LIST_VIEW, walkListView);
    if (this.queryParamsActive) {
      this.replaceQueryParams({[this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW)]: this.stringUtils.kebabCase(walkListView)});
    }
    this.performServerSideSearch();
  }

  private updateViewAndPagination(nextView: WalkListView) {
    if (nextView === WalkListView.MAP && this.walkListView !== WalkListView.MAP) {
      this.lastNonMapPageNumber = this.pageNumber || 1;
      this.pageNumber = 1;
    }
    if (this.walkListView === WalkListView.MAP && nextView !== WalkListView.MAP) {
      this.pageNumber = this.lastNonMapPageNumber || 1;
    }
    this.walkListView = nextView;
  }

  debugCriteria(): any {
    return {
      filterParameters: this.filterParameters,
      advancedSearchCriteria: this.advancedSearchCriteria,
      eventsData: this.eventsData,
      walkListView: this.walkListView,
      pageNumber: this.pageNumber,
      pageCount: this.pageCount,
      totalItems: this.serverSideTotalItems
    };
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

  private resetQueryDrivenState() {
    this.filterParameters = DEFAULT_FILTER_PARAMETERS();
    this.pageNumber = 1;
    this.storedAdvancedSearchCriteria = null;
    this.advancedSearchCriteria = null;
    this.updateViewAndPagination(this.defaultWalkListView);
  }
}
