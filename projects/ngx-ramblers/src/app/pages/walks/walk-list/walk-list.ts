import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { range } from "es-toolkit";
import { isArray, isNull, isUndefined } from "es-toolkit/compat";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LoginResponse } from "../../../models/member.model";
import { DeviceSize } from "../../../models/page.model";
import { EventPopulation, SystemConfig } from "../../../models/system.model";
import { DisplayedWalk, EventField, GroupEventField, WalkListView } from "../../../models/walk.model";
import { BroadcastService } from "../../../services/broadcast-service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { LocalWalksAndEventsService } from "../../../services/walks-and-events/local-walks-and-events.service";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { asNumber } from "../../../functions/numbers";
import { quickSearchCriteria } from "../../../functions/walks/quick-search";
import { faImages, faPeopleGroup, faTableCells, faWalking } from "@fortawesome/free-solid-svg-icons";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { WalkSearch } from "../walk-search/walk-search";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { WalkCardListComponent } from "../walk-view/walk-card-list";
import { WalksMapView } from "./walks-map-view";
import { WalkViewComponent } from "../walk-view/walk-view";
import { WalkEditComponent } from "../walk-edit/walk-edit.component";
import { NgClass } from "@angular/common";
import { WalkGradingComponent } from "../walk-view/walk-grading";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { AdvancedSearchCriteria, DEFAULT_FILTER_PARAMETERS, FilterParameters } from "../../../models/search.model";
import { BuiltInAnchor, EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { InputSource } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { DataQueryOptions, FilterCriteria } from "../../../models/api-request.model";
import { MAP_VIEW_SELECT } from "../../../models/map.model";
import { buildAdvancedSearchCriteria } from "../../../functions/walks/advanced-search-criteria-builder";
import { advancedCriteriaQueryParams } from "../../../functions/walks/advanced-search";

@Component({
    selector: "app-walk-list",
    template: `
      <app-page>
        <app-dynamic-content [anchor]="BuiltInAnchor.PAGE_HEADER" contentPathReadOnly/>
        <div class="row mb-n3">
          <div class="mb-3 col-sm-12">
            <app-walks-search [filterParameters]="filterParameters" [notifyTarget]="notifyTarget" [showAlerts]="walkListView !== WalkListView.MAP" [advancedCriteria]="advancedSearchCriteria">
              <div view-selector>
                <div class="btn-group mb-0 btn-group-custom w-100 w-md-auto" dropdown>
                  <button aria-controls="dropdown-animated" class="dropdown-toggle btn pager-btn me-0"
                           dropdownToggle type="button">
                    <fa-icon [icon]="walkListView === WalkListView.CARDS ? faImages : (walkListView === WalkListView.TABLE ? faTableCells : faWalking)"/>
                    <span class="ms-2">{{ stringUtils.asTitle(walkListView) }} View</span>
                    <span class="caret"></span>
                  </button>
                  <ul *dropdownMenu class="dropdown-menu" id="dropdown-animated" role="menu">
                    <li role="menuitem"><a (click)="switchToView(WalkListView.CARDS)" class="dropdown-item"><div><fa-icon [icon]="faImages" class="me-2"/>{{ stringUtils.asTitle(WalkListView.CARDS) }} View</div></a></li>
                    <li role="menuitem"><a (click)="switchToView(WalkListView.TABLE)" class="dropdown-item"><div><fa-icon [icon]="faTableCells" class="me-2"/>{{ stringUtils.asTitle(WalkListView.TABLE) }} View</div></a></li>
                    <li role="menuitem"><a (click)="switchToView(WalkListView.MAP)" class="dropdown-item"><div><fa-icon [icon]="faWalking" class="me-2"/>{{ stringUtils.asTitle(WalkListView.MAP) }} View</div></a></li>
                  </ul>
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
            @if (walkListView === WalkListView.CARDS) {
              <app-walk-card-list [currentPageWalks]="currentPageWalks"/>
            }
            @if (walkListView === WalkListView.MAP) {
              <app-walks-map-view [filteredWalks]="filteredWalks" [loading]="notifyTarget.busy" (selected)="onMapSelect($event)"/>
              @if (mapSelected) {
                <div class="map-selected-walk" id="map-selected-walk">
                  <app-walk-view [displayedWalk]="mapSelected" [showPanelExpander]="false"/>
                </div>
              }
            }
            @if (!walkListView || walkListView === WalkListView.TABLE) {
              @for (displayedWalk of currentPageWalks; track walkTracker(index, displayedWalk); let index = $index) {
                <div class="table-responsive mt-2">
                  @if (display.isExpanded(displayedWalk?.walk)) {
                    <div>
                      @if (!display.isEdit(displayedWalk?.walk)) {
                        <app-walk-view [displayedWalk]="displayedWalk"/>
                      }
                      @if (display.isEdit(displayedWalk?.walk)) {
                        <app-walk-edit
                          [displayedWalk]="displayedWalk"/>
                      }
                    </div>
                  }
                  @if (!display.isExpanded(displayedWalk?.walk)) {
                    <table
                      class="rounded table styled-table table-striped table-hover table-sm">
                      @if (showTableHeader(displayedWalk)) {
                        <thead class="styled-table">
                        <tr>
                          @if (display.walkPopulationLocal() && memberLoginService.memberLoggedIn()) {
                            <th class="action"
                                width="8%">Action
                            </th>
                          }
                          <th width="8%">Type</th>
                          <th width="13%">Walk Date</th>
                          <th class="d-none d-lg-table-cell" width="7%">Start Time</th>
                          <th width="25%">Title</th>
                          <th class="d-none d-lg-table-cell" width="7%">Distance</th>
                          <th class="d-none d-lg-table-cell" width="8%">Postcode</th>
                          <th class="d-none d-lg-table-cell" width="12%">Leader</th>
                          @if (display.walkContactDetailsPublic()) {
                            <th class="d-none d-lg-table-cell" width="11%">Contact
                              Phone
                            </th>
                          }
                        </tr>
                        </thead>
                      }
                      <tbody>
                      <tr [ngClass]="tableRowEven(displayedWalk)? 'default': 'active'">
                        @if (display.walkPopulationLocal() && memberLoginService.memberLoggedIn()) {
                          <td
                            id="walkAction-{{index}}"
                            class="nowrap action" width="7%">@if (displayedWalk?.walkAccessMode?.walkWritable) {
                            <input
                              type="submit"
                              value="{{displayedWalk?.walkAccessMode?.caption}}"
                              (click)="display.edit(displayedWalk)"
                              class="btn btn-primary">
                          }
                          </td>
                        }
                        <td width="8%" class="event-type"
                            (click)="display.view(displayedWalk?.walk)"
                            id="eventType-{{index}}">
                          @if (display.isWalk(displayedWalk?.walk)) {
                            <app-walk-grading [grading]="displayedWalk?.walk?.groupEvent?.difficulty?.code"/>
                          }
                          @if (!display.isWalk(displayedWalk.walk)) {
                            <fa-icon
                              class="{{display.eventType(displayedWalk.walk)}}"
                              tooltip="{{display.eventTypeTitle(displayedWalk.walk)}}" adaptivePosition
                              [icon]="display.isWalk(displayedWalk.walk)? faWalking: faPeopleGroup"/>
                          }
                        </td>
                        <td width="13%" (click)="display.view(displayedWalk.walk)" id="walkDate-{{index}}"
                            class="nowrap walk-date">
                          {{ displayedWalk.walk?.groupEvent?.start_date_time|displayDate }}
                        </td>
                        <td width="7%" class="d-none d-lg-table-cell start-time"
                            (click)="display.view(displayedWalk.walk)"
                            id="startTime-{{index}}">{{ displayedWalk.walk?.groupEvent?.start_date_time| displayTime }}
                        </td>
                        <td width="25%" name="title"
                            (click)="display.view(displayedWalk.walk)"
                            id="briefDescription-{{index}}">{{ displayedWalk.walk?.groupEvent?.title || displayedWalk?.latestEventType?.description }}
                        </td>
                        <td width="7%" class="d-none d-lg-table-cell distance"
                            (click)="display.view(displayedWalk.walk)"
                            id="distance-{{index}}">{{ displayedWalk.walk?.groupEvent?.distance_miles }}
                        </td>
                        <td width="8%" class="d-none d-lg-table-cell postcode" id="postcode-{{index}}">
                          <a
                            [href]="'http://maps.google.co.uk/maps?q=' + displayedWalk.walk?.groupEvent?.start_location?.postcode"
                            target="_blank" name="postcode"
                            tooltip="Click to locate postcode {{displayedWalk.walk?.groupEvent?.start_location?.postcode}} on Google Maps"
                            placement="left">{{ displayedWalk.walk?.groupEvent?.start_location?.postcode }}</a></td>
                        <td width="12%" class="d-none d-lg-table-cell walk-leader" id="contactEmail-{{index}}">
                          @if (allowDetailView()) {
                            <a [href]="'mailto:'+ displayedWalk.walk?.fields?.contactDetails?.email"
                               tooltip="Click to email {{displayedWalk.walk?.fields?.contactDetails?.phone}} at {{displayedWalk.walk?.fields?.contactDetails?.email}}"
                               placement="left">{{ displayedWalk.walk?.fields?.contactDetails?.phone }}</a>
                          }
                          @if (!allowDetailView()) {
                            <div class="tooltip-link" placement="left"
                                 (click)="login()"
                                 tooltip="Click to login as an {{systemConfig?.group?.shortName}} member and send an email to {{displayedWalk.walk?.fields?.contactDetails?.displayName}}">
                              {{ displayedWalk.walk?.fields?.contactDetails?.displayName }}
                            </div>
                          }
                        </td>
                        @if (display.walkContactDetailsPublic()) {
                          <td width="11%"
                              class="d-none d-lg-table-cell contact-phone"
                              id="contactPhone-{{index}}" name="contactPhone">
                            @if (allowDetailView()) {
                              <a [href]="'tel:' + displayedWalk.walk?.fields?.contactDetails?.phone"
                                 [textContent]="displayedWalk.walk?.fields?.contactDetails?.displayName"
                                 tooltip="Click to ring {{displayedWalk.walk?.fields?.contactDetails?.displayName}} on {{displayedWalk.walk?.fields?.contactDetails?.phone}} (mobile devices only)"
                                 placement="left"></a>
                            }
                            @if (!allowDetailView()) {
                              <a [href]="'tel:' + displayedWalk.walk?.fields?.contactDetails?.phone">
                    <span [textContent]="displayedWalk.walk?.fields?.contactDetails?.phone"
                          tooltip="Click to ring {{displayedWalk.walk?.fields?.contactDetails?.displayName}} on {{displayedWalk.walk?.fields?.contactDetails?.phone}} (mobile devices only)"
                          placement="left"></span></a>
                            }
                            <app-walk-panel-expander class="d-none d-lg-inline" [walk]="displayedWalk.walk"
                                                     [expandable]="true"/>
                          </td>
                        }
                      </tr>
                      </tbody>
                    </table>
                  }
                </div>
              }

            }
          </div>
        </div>
        <app-dynamic-content [anchor]="BuiltInAnchor.ACTION_BUTTONS" contentPathReadOnly/>
      </app-page>
    `,
    styleUrls: ["./walk-list.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, DynamicContentComponent, WalkSearch, BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective, PaginationComponent, FormsModule, WalkCardListComponent, WalkViewComponent, WalkEditComponent, NgClass, WalkGradingComponent, TooltipDirective, WalkPanelExpanderComponent, DisplayDatePipe, DisplayTimePipe, WalksMapView]
})
export class WalkList implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkList", NgxLoggerLevel.ERROR);
  private uiActionsService = inject(UiActionsService);
  private systemConfigService = inject(SystemConfigService);
  private modalService = inject(BsModalService);
  private pageService = inject(PageService);
  googleMapsService = inject(GoogleMapsService);
  private authService = inject(AuthService);
  memberLoginService = inject(MemberLoginService);
  display = inject(WalkDisplayService);
  protected stringUtils = inject(StringUtilsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notifierService = inject(NotifierService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
  private dateUtils = inject(DateUtilsService);
  protected readonly faWalking = faWalking;
  protected readonly faPeopleGroup = faPeopleGroup;
  public currentWalkId: string;
  public filteredWalks: DisplayedWalk[] = [];
  public currentPageWalks: DisplayedWalk[] = [];
  public filterParameters: FilterParameters = DEFAULT_FILTER_PARAMETERS();
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private pageSize: number;
  public pageNumber: number;
  public pageCount: number;
  public pages: number[] = [];
  public advancedSearchCriteria: AdvancedSearchCriteria | null = null;
  private serverSideTotalItems = 0;
  private lastNonMapPageNumber = 1;
  private searchCounter = 0;
  private latestSearchId = 0;
  public mapSelected: DisplayedWalk | null = null;
  public paginationTotalItems = 0;
  private isInitializing = true;
  config: ModalOptions = {
    animated: false,
    initialState: {}
  };
  private subscriptions: Subscription[] = [];
  protected readonly faTableCells = faTableCells;
  protected readonly WalkListView = WalkListView;
  protected walkListView: WalkListView;
  protected readonly faImages = faImages;
  protected readonly BuiltInAnchor = BuiltInAnchor;
  protected systemConfig: SystemConfig;

  async ngOnInit() {
    this.logger.debug("ngOnInit");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.pageSize = 10;
    this.pageNumber = 1;
    this.route.queryParamMap.subscribe(params => {
      const q = params.get(this.stringUtils.kebabCase(StoredValue.SEARCH));
      const type = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE));
      const sort = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC));
      const view = params.get(this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW));
      const page = params.get(this.stringUtils.kebabCase(StoredValue.PAGE));
      if (!isNull(q)) {
        this.filterParameters.quickSearch = q;
      }
      if (type) {
        this.filterParameters.selectType = type.replace(/-/g, "_").toUpperCase() as any;
      }
      if (!isNull(sort)) {
        this.filterParameters.ascending = sort === "date-ascending" || sort === "1" || sort === "true";
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
    });
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
      this.updateViewAndPagination(this.uiActionsService.initialValueFor(StoredValue.WALK_LIST_VIEW, this.systemConfig.group.defaultWalkListView) as WalkListView);
    }));
    this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, () => this.refreshWalks(NamedEventType.SYSTEM_CONFIG_LOADED));
    this.broadcastService.on(NamedEventType.WALK_SLOTS_CREATED, () => this.refreshWalks(NamedEventType.WALK_SLOTS_CREATED));
    this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshWalks(NamedEventType.REFRESH));
    this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilterToWalks(searchTerm));
    this.broadcastService.on(NamedEventType.ADVANCED_SEARCH, (event: NamedEvent<AdvancedSearchCriteria>) => this.onAdvancedSearch(event.data));
    this.broadcastService.on(NamedEventType.WALK_SAVED, () => this.refreshWalks(NamedEventType.WALK_SAVED));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.currentWalkId = paramMap.get("walk-id");
      this.logger.debug("walk-id from route params:", this.currentWalkId);
    }));
    this.display.refreshCachedData();
    this.pageService.setTitle("Home");
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.refreshWalks(loginResponse)));
    setTimeout(() => {
      this.logger.info("Initial search with page:", this.pageNumber);
      this.performServerSideSearch();
      this.isInitializing = false;
    }, 100);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  walkTracker(index: number, walk: DisplayedWalk) {
    return walk.walk.id;
  }

  maxSize(): number {
    const maxSize = window.innerWidth <= DeviceSize.MEDIUM ? 3 : 5;
    this.logger.debug("window.innerWidth:", window.innerWidth, "->", maxSize);
    return maxSize;
  }

  applyFilterToWalks(searchTerm?: NamedEvent<string>): void {
    const searchTriggered = Boolean(searchTerm);
    if (searchTriggered) {
      this.pageNumber = 1;
      this.replaceQueryParams({
        [this.stringUtils.kebabCase(StoredValue.PAGE)]: 1,
        [this.stringUtils.kebabCase(StoredValue.SEARCH)]: this.filterParameters.quickSearch || null
      });
    }
    this.performServerSideSearch();
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
        this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.PAGE)]: 1 });
      }
      this.pages = range(1, this.pageCount + 1);
    }
    this.logger.info("filteredWalks count", this.filteredWalks?.length, "currentPageWalks:", this.currentPageWalks, "pageSize:", this.pageSize, "pageCount", this.pageCount);
    const hasWalks = this.currentPageWalks.length > 0;
    const offset = hasWalks ? ((this.pageNumber - 1) * this.pageSize + 1) : 0;
    const pageIndicator = this.pages.length > 1 ? `page ${this.pageNumber} of ${this.pageCount}` : "";
    const toWalkNumber = hasWalks ? Math.min(this.pageNumber * this.pageSize, totalItems || 0) : 0;
    const totalOnly = `${this.stringUtils.pluraliseWithCount(totalItems || 0, "walk")}`;
    const hasSearchTerm = this.filterParameters?.quickSearch && this.filterParameters.quickSearch.trim().length > 0;
    const noResultsMessage = hasSearchTerm ? `No results match "${this.filterParameters.quickSearch}"` : "No walks found";
    const alertMessage = this.walkListView === WalkListView.MAP
      ? (this.filteredWalks?.length ? `Showing ${totalOnly}` : noResultsMessage)
      : (hasWalks ? (this.pageCount <= 1 ? totalOnly : `${offset} to ${toWalkNumber} of ${totalOnly}${pageIndicator ? EM_DASH_WITH_SPACES + pageIndicator : ""}`) : noResultsMessage);
    this.logger.info("ALERT DEBUG - updatePaginationStatus:", {
      walkListView: this.walkListView,
      pageCount: this.pageCount,
      filteredWalksLength: this.filteredWalks?.length,
      hasWalks,
      alertMessage,
      notifyTargetBefore_showAlert: this.notifyTarget.showAlert,
      notifyTargetBefore_alertMessage: this.notifyTarget.alertMessage,
      notifyTargetBefore_busy: this.notifyTarget.busy
    });
    this.notify.progress(alertMessage);
    this.logger.info("ALERT DEBUG - after notify.progress:", {
      notifyTargetAfter_showAlert: this.notifyTarget.showAlert,
      notifyTargetAfter_alertMessage: this.notifyTarget.alertMessage,
      notifyTargetAfter_busy: this.notifyTarget.busy
    });
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pageCount > 1 || this.walkListView === WalkListView.MAP));
  }

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }

  onAdvancedSearch(criteria: AdvancedSearchCriteria) {
    this.logger.info("Advanced search triggered:", criteria, "isInitializing:", this.isInitializing);
    const criteriaChanged = JSON.stringify(this.advancedSearchCriteria) !== JSON.stringify(criteria);
    const shouldResetPage = !this.isInitializing && criteriaChanged;
    this.advancedSearchCriteria = criteria;
    if (shouldResetPage) {
      this.pageNumber = 1;
      const criteriaParams = advancedCriteriaQueryParams(criteria, this.stringUtils, this.dateUtils);
      this.replaceQueryParams({
        [this.stringUtils.kebabCase(StoredValue.PAGE)]: 1,
        ...criteriaParams
      });
    }
    setTimeout(() => this.performServerSideSearch(), 0);
  }

  private async performServerSideSearch() {
    this.searchCounter++;
    const thisSearchId = this.searchCounter;
    this.latestSearchId = thisSearchId;

    this.logger.info("Starting search", thisSearchId);
    this.notify.setBusy();
    try {
      const criteriaParts: any[] = [];

      const walkPopulation = this.display?.group?.walkPopulation;
      if (walkPopulation === EventPopulation.LOCAL) {
        criteriaParts.push({ [EventField.INPUT_SOURCE]: InputSource.MANUALLY_CREATED });
        criteriaParts.push({ [GroupEventField.ITEM_TYPE]: RamblersEventType.GROUP_WALK });
        criteriaParts.push({ "events.eventType": { $ne: "deleted" } });
      } else if (walkPopulation === EventPopulation.WALKS_MANAGER) {
        criteriaParts.push({ [EventField.INPUT_SOURCE]: { $ne: InputSource.MANUALLY_CREATED } });
        criteriaParts.push({ [GroupEventField.ITEM_TYPE]: { $ne: RamblersEventType.GROUP_EVENT } });
      }
      const todayStart = this.dateUtils.dateTimeNow().startOf("day");
      const defaultFutureEnd = todayStart.plus({ years: 2 });

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
        criteriaParts.push({ [GroupEventField.START_DATE]: dateCriteria });
      }

      const quickCriteria = quickSearchCriteria(this.filterParameters.quickSearch);
      if (quickCriteria) {
        criteriaParts.push(quickCriteria);
      }

      this.logger.info("Advanced search criteria input:", this.advancedSearchCriteria);

      const advancedCriteria = buildAdvancedSearchCriteria({
        advancedSearchCriteria: this.advancedSearchCriteria,
        dateUtils: this.dateUtils,
        walkPopulationLocal: this.display.walkPopulationLocal(),
        logger: this.logger
      });

      this.logger.debug("Built advanced criteria parts:", advancedCriteria);
      this.logger.debug("Advanced criteria count:", advancedCriteria.length);

      criteriaParts.push(...advancedCriteria);

      this.logger.debug("All criteria parts before combining:", criteriaParts);

      const criteria = criteriaParts.length === 0 ? {} : (criteriaParts.length === 1 ? criteriaParts[0] : {$and: criteriaParts});

      this.logger.debug("Final MongoDB criteria:", JSON.stringify(criteria, null, 2));

      const sortAscending = this.uiActionsService.booleanOf(this.filterParameters.ascending);
      const sort = sortAscending
        ? { [GroupEventField.START_DATE]: 1 }
        : { [GroupEventField.START_DATE]: -1 };

      const dataQueryOptions: DataQueryOptions = {
        criteria,
        sort
      };
      if (this.walkListView === WalkListView.MAP) {
        dataQueryOptions.select = MAP_VIEW_SELECT;
      } else {
        dataQueryOptions.page = this.pageNumber;
        dataQueryOptions.limit = this.pageSize;
      }

      this.logger.debug("Performing server-side search with options:", dataQueryOptions);

      const response = await this.localWalksAndEventsService.allWithPagination(dataQueryOptions);

      this.logger.info("Server-side search results for search", thisSearchId, ":", response);

      if (thisSearchId === this.latestSearchId) {
        const events = isArray(response.response) ? response.response : [response.response].filter(Boolean);
        this.serverSideTotalItems = response.pagination?.total || events.length || 0;
        const displayedWalks = events.map(event => this.display.toDisplayedWalk(event));
        this.filteredWalks = displayedWalks;
        this.currentPageWalks = displayedWalks;
        this.updatePaginationStatus();
        if (this.currentPageWalks.length > 0 && this.display.expandedWalks.length === 0) {
          this.display.view(this.currentPageWalks[0].walk);
        }
      } else {
        this.logger.info("Discarding search", thisSearchId, "results - newer search", this.latestSearchId, "completed");
      }
      this.notify.clearBusy();
    } catch (error) {
      this.logger.error("Server-side search error for search", thisSearchId, ":", error);
      if (thisSearchId === this.latestSearchId) {
        this.notify.error({
          title: "Search Failed",
          message: error.error?.message || "Failed to perform search"
        });
      } else {
        this.logger.info("Ignoring error for search", thisSearchId, "- newer search", this.latestSearchId, "in progress");
      }
      this.notify.clearBusy();
    }
  }

  showTableHeader(walk: DisplayedWalk) {
    return this.currentPageWalks.indexOf(walk) === 0 ||
      this.display.isExpanded(this.currentPageWalks[this.currentPageWalks.indexOf(walk) - 1].walk);
  }

  tableRowOdd(walk: DisplayedWalk) {
    return this.currentPageWalks.indexOf(walk) % 2 === 0;
  }

  tableRowEven(walk: DisplayedWalk) {
    return !this.tableRowOdd(walk);
  }

  refreshWalks(event?: any): void {
    this.logger.info("Refreshing walks due to", event, "event and walkPopulation:", this.display?.group?.walkPopulation);
    this.performServerSideSearch();
  }

  login() {
    this.modalService.show(LoginModalComponent, this.config);
  }

  allowEdits() {
    return false;
  }

  pageChanged(event: PageChangedEvent): void {
    this.logger.debug("event:", event);
    this.goToPage(event.page);
  }

  goToPage(pageNumber) {
    this.pageNumber = pageNumber;
    this.performServerSideSearch();
    this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.PAGE)]: pageNumber });
  }

  onMapSelect(displayedWalk: DisplayedWalk) {
    this.logger.info("onMapSelect called with walk:", displayedWalk?.walk?.groupEvent?.title);
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
        this.logger.info("looking for map-selected-walk element:", !!el);
        if (el) {
          el.scrollIntoView({behavior: "smooth", block: "start"});
        }
      }, 0);
    }
  }

  switchToView(walkListView: WalkListView) {
    this.updateViewAndPagination(walkListView);
    this.logger.info("switching to", walkListView, "view");
    this.uiActionsService.saveValueFor(StoredValue.WALK_LIST_VIEW, walkListView);
    this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW)]: this.stringUtils.kebabCase(walkListView) });
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

  private replaceQueryParams(params: Record<string, string | number | null>) {
    const queryParams = Object.fromEntries(Object.entries(params).filter(([, v]) => !isUndefined(v)));
    const extras:any = { relativeTo: this.route, queryParams, queryParamsHandling: "merge" };
    this.logger.info("replaceQueryParams:navigate to", extras);
    this.router.navigate([], extras);
  }
}
