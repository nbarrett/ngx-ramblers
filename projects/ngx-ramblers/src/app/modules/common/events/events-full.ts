import { WalkProgrammeCalendarComponent } from "../../../pages/walks/walk-programme-calendar/walk-programme-calendar";
import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { JsonPipe, Location, NgTemplateOutlet } from "@angular/common";
import { range } from "es-toolkit";
import { isArray, isNull, keys } from "es-toolkit/compat";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { firstValueFrom, Subscription } from "rxjs";
import {
  faBug,
  faCalendarDays,
  faCalendarPlus,
  faCheck,
  faImages,
  faPeopleGroup,
  faTableCells,
  faWalking
} from "@fortawesome/free-solid-svg-icons";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LoginResponse } from "../../../models/member.model";
import { DeviceSize } from "../../../models/page.model";
import { EventPopulation } from "../../../models/system.model";
import {
  DisplayedWalk,
  EventEventField,
  EventField,
  GroupEventField,
  PUBLIC_GROUP_EVENT_SELECT,
  WalkListView,
  WalkViewMode
} from "../../../models/walk.model";
import { EventsData } from "../../../models/group-events.model";
import { CalendarMonthSummary } from "../../../models/walk-programme.model";
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
import { WalksConfig } from "../../../models/walks-config.model";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { StoredValue, StoredValueQueryParameters } from "../../../models/ui-actions";
import { WalkSearch } from "../../../pages/walks/walk-search/walk-search";
import { WalkCardListComponent } from "../../../pages/walks/walk-view/walk-card-list";
import { WalksMapView } from "../../../pages/walks/walk-list/walks-map-view";
import { WalkViewComponent } from "../../../pages/walks/walk-view/walk-view";
import { EventTableView } from "./event-table-view";
import {
  AdvancedSearchCriteria,
  DateRangePresetLabel,
  DEFAULT_FILTER_PARAMETERS,
  FilterParameters,
  FilterStateEvent,
  resolvePresetByLabel
} from "../../../models/search.model";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { InputSource } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { DataQueryOptions, FilterCriteria, SortOrder } from "../../../models/api-request.model";
import { MAP_VIEW_MAX_EVENTS, MAP_VIEW_SELECT } from "../../../models/map.model";
import { buildAdvancedSearchCriteria } from "../../../functions/walks/advanced-search-criteria-builder";
import {
  advancedCriteriaQueryParams,
  advancedSearchCriteriaFromParams,
  advancedSearchSummary,
  hasAdvancedCriteria,
  savedCriteriaToAdvancedCriteria
} from "../../../functions/walks/advanced-search";
import { AuthService } from "../../../auth/auth.service";
import { environment } from "../../../../environments/environment";

@Component({
  selector: "app-events-full",
  styleUrls: ["../../../pages/walks/walk-list/walk-list.sass"],
  template: `
    <div class="mb-n3">
      <div class="mb-3">
        <app-walks-search [filterParameters]="filterParameters" [notifyTarget]="notifyTarget"
                          [showAdvancedSearch]="advancedSearchAllowed()"
                          [advancedCriteria]="advancedSearchCriteria"
                          (advancedSearchChange)="onAdvancedSearch($event)"
                          (filterStateChange)="onFilterStateChange($event)">
          <div view-selector>
            <div class="d-flex gap-2">
              <div class="btn-group mb-0 btn-group-custom w-100 w-md-auto" dropdown container="body" placement="bottom left">
                <button aria-controls="dropdown-animated" class="dropdown-toggle btn pager-btn me-0"
                        dropdownToggle type="button">
                  <fa-icon
                    [icon]="walkListView === WalkListView.CALENDAR ? faCalendarDays : walkListView === WalkListView.CARDS ? faImages : (walkListView === WalkListView.TABLE ? faTableCells : faWalking)"/>
                  <span class="ms-2">{{ stringUtils.asTitle(walkListView) }} View</span>
                  <span class="caret"></span>
                </button>
                <ul *dropdownMenu class="dropdown-menu walk-list-view-menu" id="dropdown-animated" role="menu">
                  <li role="menuitem"><a role="button" (click)="switchToView(WalkListView.CARDS)" class="dropdown-item d-flex align-items-center">
                    <fa-icon [icon]="faImages" class="me-2"/>{{ stringUtils.asTitle(WalkListView.CARDS) }} View
                    @if (walkListView === WalkListView.CARDS) {
                      <fa-icon [icon]="faCheck" class="ms-auto ps-3"/>
                    }
                  </a></li>
                  <li role="menuitem"><a role="button" (click)="switchToView(WalkListView.TABLE)" class="dropdown-item d-flex align-items-center">
                    <fa-icon [icon]="faTableCells" class="me-2"/>{{ stringUtils.asTitle(WalkListView.TABLE) }} View
                    @if (walkListView === WalkListView.TABLE) {
                      <fa-icon [icon]="faCheck" class="ms-auto ps-3"/>
                    }
                  </a></li>
                  <li role="menuitem"><a role="button" (click)="switchToView(WalkListView.MAP)" class="dropdown-item d-flex align-items-center">
                    <fa-icon [icon]="faWalking" class="me-2"/>{{ stringUtils.asTitle(WalkListView.MAP) }} View
                    @if (walkListView === WalkListView.MAP) {
                      <fa-icon [icon]="faCheck" class="ms-auto ps-3"/>
                    }
                  </a></li>
                  @if (showCalendarView()) {
                    <li role="menuitem"><a role="button" (click)="switchToView(WalkListView.CALENDAR)" class="dropdown-item d-flex align-items-center">
                      <fa-icon [icon]="faCalendarDays" class="me-2"/>Calendar View
                      @if (walkListView === WalkListView.CALENDAR) {
                        <fa-icon [icon]="faCheck" class="ms-auto ps-3"/>
                      }
                    </a></li>
                  }
                  <li class="dropdown-divider" [class.d-none]="!display.memberCanCreateWalk()"></li>
                  <li role="menuitem" [class.d-none]="!display.memberCanCreateWalk()">
                    <a role="button" (click)="display.addMemberLedWalk()" class="dropdown-item d-flex align-items-center">
                      <fa-icon [icon]="faCalendarPlus" class="me-2"/>{{ addWalkMenuLabel() }}
                    </a>
                  </li>
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
          @if (walkListView !== WalkListView.MAP && walkListView !== WalkListView.CALENDAR && pageCount > 1) {
            <ng-container *ngTemplateOutlet="paginationControls"/>
          }
        </app-walks-search>
        @if (showDiagnostics) {
          <pre class="bg-dark text-light p-3 rounded mb-2 mt-2" style="font-size: 0.8rem; max-height: 300px; overflow: auto;">{{ debugCriteria() | json }}</pre>
        }
        @if (walkListView === WalkListView.CALENDAR) {
          <app-walk-programme-calendar [embedded]="true" [readOnly]="true"
                                       [criteria]="calendarCriteria" [constrainFrom]="calendarConstrainFrom" [constrainTo]="calendarConstrainTo"
                                       (monthLoaded)="onCalendarMonthLoaded($event)"/>
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
        @if (walkListView === WalkListView.TABLE) {
          <app-event-table-view [currentPageEvents]="currentPageWalks"/>
        }

      </div>
    </div>
    <ng-template #paginationControls>
      <div class="d-flex align-items-center flex-shrink-0"
           [class.cards-view-spacing]="walkListView === WalkListView.CARDS">
        <pagination class="pagination rounded mb-0" [boundaryLinks]=true [rotate]="true"
                    [maxSize]="maxSize()"
                    [totalItems]="paginationTotalItems" [itemsPerPage]="pageSize" [(ngModel)]="pageNumber"
                    (pageChanged)="pageChanged($event)"/>
      </div>
    </ng-template>
  `,
  imports: [WalkProgrammeCalendarComponent, WalkSearch, BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective,
    PaginationComponent, FormsModule, WalkCardListComponent, WalksMapView, WalkViewComponent, EventTableView, JsonPipe, NgTemplateOutlet]
})
export class EventsFull implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EventsFull", NgxLoggerLevel.ERROR);
  private uiActionsService = inject(UiActionsService);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
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
  protected readonly faCalendarPlus = faCalendarPlus;
  protected readonly faCalendarDays = faCalendarDays;
  protected readonly faCheck = faCheck;
  protected readonly WalkListView = WalkListView;
  protected readonly RamblersEventType = RamblersEventType;
  protected readonly production = environment.production;

  showCalendarView(): boolean {
    const types = this.eventsData?.eventTypes;
    return !types?.length || types.includes(RamblersEventType.GROUP_WALK);
  }

  addWalkMenuLabel(): string {
    const regularWalkDay = this.walksConfig?.regularWalkDay ?? 0;
    const dayName = this.dateUtils.dayNameFor(regularWalkDay);
    if (dayName) {
      return `Add non-${dayName} walk`;
    } else {
      return "Add walk";
    }
  }

  public eventsData: EventsData;
  private appliedEventsDataKey: string = null;
  private eventsInitialised = false;

  @Input("eventsData") set acceptEventsData(eventsData: EventsData) {
    this.eventsData = eventsData;
    const nextKey = this.eventsDataKey(eventsData);
    if (nextKey !== this.appliedEventsDataKey) {
      this.appliedEventsDataKey = nextKey;
      this.logger.info("eventsData changed:", nextKey, "eventsInitialised:", this.eventsInitialised);
      this.applyEventsDataConfig();
      if (this.eventsInitialised) {
        const pageFromUrl = this.route.snapshot.queryParamMap.get(this.stringUtils.kebabCase(StoredValue.PAGE));
        if (!pageFromUrl) {
          this.pageNumber = 1;
        }
        this.performServerSideSearch();
      }
    }
  }

  public filteredWalks: DisplayedWalk[] = [];
  public currentPageWalks: DisplayedWalk[] = [];
  public filterParameters: FilterParameters = DEFAULT_FILTER_PARAMETERS();
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public pageSize = 10;
  public pageNumber = 1;
  public pageCount = 0;
  public pages: number[] = [];
  public advancedSearchCriteria: AdvancedSearchCriteria | null = null;
  private serverSideTotalItems = 0;
  private lastNonMapPageNumber = 1;
  private searchCounter = 0;
  private latestSearchId = 0;
  public calendarCriteria: object | null = null;
  public calendarConstrainFrom: number | null = null;
  public calendarConstrainTo: number | null = null;
  public mapSelected: DisplayedWalk | null = null;
  public paginationTotalItems = 0;
  private isInitializing = true;
  private queryParamsActive = false;
  private subscriptions: Subscription[] = [];
  protected walkListView: WalkListView = WalkListView.CARDS;
  public storedAdvancedSearchCriteria: AdvancedSearchCriteria | null = null;
  public showDiagnostics = false;
  private defaultWalkListView: WalkListView = WalkListView.CARDS;
  private selectedPresetLabel: string | undefined;
  public walksConfig: WalksConfig;

  async ngOnInit() {
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.notify.setBusy();
    const systemConfig = await firstValueFrom(this.systemConfigService.events());
    this.defaultWalkListView = systemConfig.group.defaultWalkListView;
    this.pageSize = 10;
    this.pageNumber = 1;
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      const q = params.get(this.stringUtils.kebabCase(StoredValue.SEARCH));
      const type = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE));
      const sort = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC));
      const view = params.get(this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW));
      const page = params.get(this.stringUtils.kebabCase(StoredValue.PAGE));
      const advancedSearch = params.get(this.stringUtils.kebabCase(StoredValue.ADVANCED_SEARCH));
      const dateRangePreset = params.get(this.stringUtils.kebabCase(StoredValue.DATE_RANGE_PRESET));
      const calendarDate = params.get(this.stringUtils.kebabCase(StoredValue.CALENDAR_DATE));
      const calendarView = params.get(this.stringUtils.kebabCase(StoredValue.CALENDAR_VIEW));
      const calendarColour = params.get(this.stringUtils.kebabCase(StoredValue.CALENDAR_COLOUR_BY));
      const advancedCriteria = advancedSearchCriteriaFromParams(params, this.stringUtils);
      const hasQueryState = [q, type, sort, view, page, advancedSearch, dateRangePreset, calendarDate, calendarView, calendarColour].some(value => !isNull(value)) || !!advancedCriteria;
      this.queryParamsActive = hasQueryState;
      if (!hasQueryState) {
        this.resetQueryDrivenState();
      } else {
        if (!isNull(q)) {
          this.filterParameters.quickSearch = q;
        }
        if (type) {
          this.filterParameters.selectType = type.replace(/-/g, "_").toUpperCase() as any;
        }
        if (!isNull(sort)) {
          this.filterParameters.ascending = sort !== "false";
        }
        const allowedViews: WalkListView[] = [WalkListView.CARDS, WalkListView.TABLE, WalkListView.MAP, WalkListView.CALENDAR];
        const resolvedView = allowedViews.find(item => item === view) || WalkListView.CARDS;
        this.updateViewAndPagination(resolvedView);
        this.uiActionsService.saveValueFor(StoredValue.WALK_LIST_VIEW, this.walkListView);
        if (!view) {
          this.replaceQueryParams({[StoredValue.WALK_LIST_VIEW]: WalkListView.CARDS});
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
      }
      this.performServerSideSearch();
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.defaultWalkListView = systemConfig.group.defaultWalkListView;
      if (!this.queryParamsActive) {
        this.updateViewAndPagination(this.defaultWalkListView);
      }
    }));
    this.walksConfig = this.walksConfigService.walksConfig() ?? this.walksConfigService.default();
    this.subscriptions.push(this.walksConfigService.events().subscribe(config => this.walksConfig = config));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, () => this.refreshEvents(NamedEventType.SYSTEM_CONFIG_LOADED)));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.WALK_SLOTS_CREATED, () => this.refreshEvents(NamedEventType.WALK_SLOTS_CREATED)));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshEvents(NamedEventType.REFRESH)));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilter(searchTerm)));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.WALK_SAVED, () => this.refreshEvents(NamedEventType.WALK_SAVED)));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.logger.debug("route paramMap:", paramMap);
    }));
    this.display.refreshCachedData();
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => {
      this.display.closeAllExpanded();
      this.refreshEvents(loginResponse);
    }));
    this.applyEventsDataConfig();
    this.eventsInitialised = true;
    setTimeout(() => {
      this.isInitializing = false;
    }, 100);
  }

  private eventsDataKey(eventsData: EventsData): string {
    if (!eventsData) {
      return "none";
    } else {
      const eventTypes = (eventsData.eventTypes || []).join(",");
      const eventIds = (eventsData.eventIds || []).join(",");
      const tagsAny = (eventsData.tagsAny || []).join(",");
      const tagsExclude = (eventsData.tagsExclude || []).join(",");
      return [
        eventTypes,
        eventsData.filterCriteria || "",
        eventsData.sortOrder || "",
        eventIds,
        tagsAny,
        tagsExclude,
        eventsData.allow?.viewSelector ? "selector" : "list"
      ].join("|");
    }
  }

  private applyEventsDataConfig() {
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
      } else if (!this.queryParamsActive) {
        this.storedAdvancedSearchCriteria = null;
        this.advancedSearchCriteria = null;
      }
      this.selectedPresetLabel = this.eventsData.savedCriteria?.presetLabel;
      this.logger.info("applyEventsDataConfig: filterParameters:", this.filterParameters, "savedCriteria:", savedCriteria);
    }
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
      this.queryParamsActive = true;
      this.replaceQueryParams({
        [this.stringUtils.kebabCase(StoredValue.PAGE)]: 1,
        [this.stringUtils.kebabCase(StoredValue.SEARCH)]: this.filterParameters.quickSearch || null
      });
    }
    this.performServerSideSearch();
  }

  onAdvancedSearch(criteria: AdvancedSearchCriteria) {
    const nextCriteria = hasAdvancedCriteria(criteria) ? criteria : null;
    this.storedAdvancedSearchCriteria = nextCriteria;
    this.advancedSearchCriteria = this.advancedSearchAllowed() ? nextCriteria : null;
    this.logger.info("onAdvancedSearch: queryParamsActive:", this.queryParamsActive, "nextCriteria:", nextCriteria);
    this.performServerSideSearch();
  }

  onCalendarMonthLoaded(summary: CalendarMonthSummary) {
    this.serverSideTotalItems = summary.eventCount;
    this.pageCount = 1;
    this.pages = [1];
    const totalOnly = this.stringUtils.pluraliseWithCount(summary.eventCount, "event");
    this.notify.progress(`Showing ${totalOnly}${EM_DASH_WITH_SPACES}${summary.periodTitle}`);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, true));
  }

  onFilterStateChange(event: FilterStateEvent) {
    this.selectedPresetLabel = event.presetLabel;
    this.calendarConstrainFrom = event.rangeFrom ?? null;
    this.calendarConstrainTo = event.rangeTo ?? null;
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
    this.logger.info("performServerSideSearch called, advancedSearchCriteria:", this.advancedSearchCriteria);
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
        criteriaParts.push({[EventEventField.EVENT_TYPE]: {$ne: "deleted"}});
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
      const allTimeSelected = this.selectedPresetLabel === DateRangePresetLabel.ALL_TIME;
      const presetFrom = this.advancedSearchCriteria?.dateFrom ? this.dateUtils.asDateTime(this.advancedSearchCriteria.dateFrom) : null;
      const presetTo = this.advancedSearchCriteria?.dateTo ? this.dateUtils.asDateTime(this.advancedSearchCriteria.dateTo) : null;
      if (allTimeSelected) {
        dateFrom = null;
        dateTo = null;
      } else if (presetFrom) {
        if (baseFrom) {
          dateFrom = presetFrom > baseFrom ? presetFrom : baseFrom;
        } else if (!baseTo || presetFrom < baseTo) {
          dateFrom = presetFrom;
        }
      }
      if (!allTimeSelected && presetTo) {
        if (baseTo) {
          dateTo = presetTo < baseTo ? presetTo : baseTo;
        } else if (!baseFrom || presetTo > baseFrom) {
          dateTo = presetTo;
        }
      }
      this.calendarConstrainFrom = allTimeSelected ? (presetFrom ? presetFrom.valueOf() : null) : (dateFrom ? dateFrom.valueOf() : null);
      this.calendarConstrainTo = allTimeSelected ? (presetTo ? presetTo.valueOf() : null) : (dateTo ? dateTo.valueOf() : null);
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
      criteriaParts.push(...advancedCriteria.filter(part => part && keys(part).length > 0));
      const populatedCriteria = criteriaParts.filter(part => part && keys(part).length > 0);
      const criteria = populatedCriteria.length === 0 ? {} : (populatedCriteria.length === 1 ? populatedCriteria[0] : {$and: populatedCriteria});
      const sortAscending = this.uiActionsService.booleanOf(this.filterParameters.ascending);
      const sort = sortAscending
        ? {[GroupEventField.START_DATE]: 1}
        : {[GroupEventField.START_DATE]: -1};
      const dataQueryOptions: DataQueryOptions = {criteria, sort};
      if (!this.memberLoginService.memberLoggedIn()) {
        await this.walksConfigService.walksConfigLoaded();
      }
      if (this.walkListView === WalkListView.CALENDAR) {
        this.calendarCriteria = criteria;
        this.filteredWalks = [];
        this.currentPageWalks = [];
        this.serverSideTotalItems = 0;
        this.pageCount = 1;
        this.pages = [1];
        this.notify.clearBusy();
      } else {
      const clientSidePagination = this.walkListView !== WalkListView.MAP && this.display.publicVisibilityFilteringActive();
      if (this.walkListView === WalkListView.MAP) {
        dataQueryOptions.select = MAP_VIEW_SELECT;
        dataQueryOptions.limit = MAP_VIEW_MAX_EVENTS;
      } else if (clientSidePagination) {
        dataQueryOptions.select = PUBLIC_GROUP_EVENT_SELECT;
        dataQueryOptions.limit = MAP_VIEW_MAX_EVENTS;
      } else {
        dataQueryOptions.page = this.pageNumber;
        dataQueryOptions.limit = this.pageSize;
        if (!this.memberLoginService.memberLoggedIn()) {
          dataQueryOptions.select = PUBLIC_GROUP_EVENT_SELECT;
        } else {
          dataQueryOptions.select = {[EventEventField.DATA]: 0};
        }
      }
      const response = await this.localWalksAndEventsService.allWithPagination(dataQueryOptions);
      if (thisSearchId === this.latestSearchId) {
        let events = isArray(response.response) ? response.response : [response.response].filter(Boolean);
        if (!this.memberLoginService.memberLoggedIn()) {
          events = events.filter(event => !this.display.walkHiddenFromPublic(event));
        }
        const displayedWalks = events.map(event => this.display.toDisplayedWalk(event));
        this.filteredWalks = displayedWalks;
        if (clientSidePagination) {
          this.serverSideTotalItems = displayedWalks.length;
          const pageCount = Math.max(1, Math.ceil(displayedWalks.length / this.pageSize));
          if (displayedWalks.length > 0 && this.pageNumber > pageCount) {
            this.pageNumber = pageCount;
            if (this.queryParamsActive) {
              this.replaceQueryParams({[this.stringUtils.kebabCase(StoredValue.PAGE)]: this.pageNumber});
            }
          }
          const startIndex = (this.pageNumber - 1) * this.pageSize;
          this.currentPageWalks = displayedWalks.slice(startIndex, startIndex + this.pageSize);
        } else {
          this.serverSideTotalItems = response.pagination?.total || events.length || 0;
          const totalPages = Math.ceil(this.serverSideTotalItems / this.pageSize);
          if (this.serverSideTotalItems > 0 && this.pageNumber > totalPages) {
            this.pageNumber = totalPages;
            if (this.queryParamsActive) {
              this.replaceQueryParams({[this.stringUtils.kebabCase(StoredValue.PAGE)]: this.pageNumber});
            }
            this.notify.clearBusy();
            await this.performServerSideSearch();
          } else {
            this.currentPageWalks = displayedWalks;
            this.updatePaginationStatus();
            if (this.currentPageWalks.length > 0 && this.display.expandedWalks.length === 0 && this.walkListView !== WalkListView.TABLE) {
              const firstWalk = this.currentPageWalks[0].walk;
              if (this.display.walkDetailsComplete(firstWalk)) {
                this.display.toggleExpandedViewFor(firstWalk, WalkViewMode.VIEW_SINGLE);
              }
            }
          }
        }
        if (clientSidePagination) {
          this.updatePaginationStatus();
          if (this.currentPageWalks.length > 0 && this.display.expandedWalks.length === 0 && this.walkListView !== WalkListView.TABLE) {
            const firstWalk = this.currentPageWalks[0].walk;
            if (this.display.walkDetailsComplete(firstWalk)) {
              this.display.toggleExpandedViewFor(firstWalk, WalkViewMode.VIEW_SINGLE);
            }
          }
        }
      }
      this.notify.clearBusy();
      }
    } catch (error) {
      if (thisSearchId === this.latestSearchId) {
        this.logger.error("performServerSideSearch failed:", error);
        this.notify.error({
          title: "Search Failed",
          message: error,
          continue: true
        });
      }
      this.notify.clearBusy();
    }
  }

  private updatePaginationStatus() {
    const totalItems = this.serverSideTotalItems;
    this.paginationTotalItems = totalItems;
    if (this.walkListView === WalkListView.MAP || this.walkListView === WalkListView.CALENDAR) {
      this.pageCount = 1;
      this.pageNumber = 1;
      this.pages = [1];
      this.currentPageWalks = this.filteredWalks;
    } else {
      this.pageCount = Math.ceil(totalItems / this.pageSize);
      if (totalItems > 0 && this.pageNumber > this.pageCount && this.pageCount > 0) {
        this.pageNumber = this.pageCount;
        if (this.queryParamsActive) {
          this.replaceQueryParams({[this.stringUtils.kebabCase(StoredValue.PAGE)]: this.pageNumber});
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
    const alertMessage = this.walkListView === WalkListView.MAP || this.walkListView === WalkListView.CALENDAR
      ? (this.filteredWalks?.length ? `Showing ${totalOnly}${filterSuffix}` : noResultsMessage)
      : (hasEvents ? (this.pageCount <= 1 ? `${totalOnly}${filterSuffix}` : `${offset} to ${toNumber} of ${totalOnly}${pageIndicator ? EM_DASH_WITH_SPACES + pageIndicator : ""}${filterSuffix}`) : noResultsMessage);
    this.notify.progress(alertMessage);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pageCount > 1 || this.walkListView === WalkListView.MAP || this.walkListView === WalkListView.CALENDAR));
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
    this.queryParamsActive = true;
    this.replaceQueryParams({[StoredValue.WALK_LIST_VIEW]: walkListView});
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
    if (nextView === WalkListView.TABLE) {
      this.display.expandedWalks = [];
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
    void this.uiActionsService.updateQueryParameters(params as StoredValueQueryParameters);
  }

  private resetQueryDrivenState() {
    this.filterParameters = DEFAULT_FILTER_PARAMETERS();
    this.pageNumber = 1;
    this.storedAdvancedSearchCriteria = null;
    this.advancedSearchCriteria = null;
    this.selectedPresetLabel = null;
    this.updateViewAndPagination(this.defaultWalkListView);
  }
}
