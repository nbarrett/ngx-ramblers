import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap, Router } from "@angular/router";
import { range } from "es-toolkit";
import { uniq } from "es-toolkit/compat";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LoginResponse } from "../../../models/member.model";
import { DeviceSize } from "../../../models/page.model";
import { SystemConfig } from "../../../models/system.model";
import { DisplayedWalk, WalkListView } from "../../../models/walk.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { RamblersWalksAndEventsService } from "../../../services/walks-and-events/ramblers-walks-and-events.service";
import { ExtendedGroupEventQueryService } from "../../../services/walks-and-events/extended-group-event-query.service";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { sortBy } from "../../../functions/arrays";
import { faImages, faPeopleGroup, faTableCells, faWalking } from "@fortawesome/free-solid-svg-icons";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { WalkSearchComponent } from "../walk-search/walk-search.component";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { WalkCardListComponent } from "../walk-view/walk-card-list";
import { WalksMapViewComponent } from "./walks-map-view";
import { WalkViewComponent } from "../walk-view/walk-view";
import { WalkEditComponent } from "../walk-edit/walk-edit.component";
import { NgClass } from "@angular/common";
import { WalkGradingComponent } from "../walk-view/walk-grading";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DEFAULT_FILTER_PARAMETERS, FilterParameters } from "../../../models/search.model";
import { BuiltInAnchor, EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { RamblersEventType } from "../../../models/ramblers-walks-manager";
import { DisplayTimePipe } from "../../../pipes/display-time.pipe";
import { DataMigrationService } from "../../../services/walks/data-migration.service";
import { FilterCriteria } from "../../../models/api-request.model";
import { EventsMigrationService } from "../../../services/migration/events-migration.service";

@Component({
    selector: "app-walk-list",
    template: `
      <app-page>
        <app-dynamic-content [anchor]="BuiltInAnchor.PAGE_HEADER" contentPathReadOnly/>
        <div class="row mb-n3">
          @if (display.allowAdminEdits() && systemConfig?.enableMigration?.events) {
            <div class="mb-3 col-sm-12">
              <button (click)="performMigration()" class="btn btn-primary me-2"
                      type="button">Migrate
              </button>
            </div>
          }
          <div class="mb-3 col-sm-12">
            <app-walks-search [filterParameters]="filterParameters" [notifyTarget]="notifyTarget" [showAlerts]="walkListView !== WalkListView.MAP">
              <div view-selector>
                <div class="btn-group mb-0 btn-group-custom me-md-2 w-100 w-md-auto" dropdown>
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
              @if (walkListView !== WalkListView.MAP) {
                <div class="d-flex align-items-center mt-0 mt-md-0 me-2 flex-shrink-0"
                     [class.cards-view-spacing]="walkListView === WalkListView.CARDS">
                  <pagination class="pagination rounded mb-0" [boundaryLinks]=true [rotate]="true"
                               [maxSize]="maxSize()"
                               [totalItems]="filteredWalks?.length" [(ngModel)]="pageNumber"
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
                <div class="table-responsive">
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
    styleUrls: ["./walk-list.component.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
  imports: [PageComponent, DynamicContentComponent, WalkSearchComponent, BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective, PaginationComponent, FormsModule, WalkCardListComponent, WalkViewComponent, WalkEditComponent, NgClass, WalkGradingComponent, TooltipDirective, WalkPanelExpanderComponent, DisplayDatePipe, DisplayTimePipe, WalksMapViewComponent]
})
export class WalkListComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("WalkListComponent", NgxLoggerLevel.ERROR);
  private uiActionsService = inject(UiActionsService);
  private systemConfigService = inject(SystemConfigService);
  private modalService = inject(BsModalService);
  private pageService = inject(PageService);
  googleMapsService = inject(GoogleMapsService);
  protected walksAndEventsService = inject(WalksAndEventsService);
  protected eventsMigrationService = inject(EventsMigrationService);
  protected dataMigrationService = inject(DataMigrationService);
  private authService = inject(AuthService);
  ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  memberLoginService = inject(MemberLoginService);
  display = inject(WalkDisplayService);
  protected stringUtils = inject(StringUtilsService);
  private searchFilterPipe = inject(SearchFilterPipe);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private extendedGroupEventQueryService = inject(ExtendedGroupEventQueryService);
  private notifierService = inject(NotifierService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  protected readonly faWalking = faWalking;
  protected readonly faPeopleGroup = faPeopleGroup;
  public currentWalkId: string;
  public walks: ExtendedGroupEvent[];
  public filteredWalks: DisplayedWalk[] = [];
  public currentPageWalks: DisplayedWalk[] = [];
  public filterParameters: FilterParameters = DEFAULT_FILTER_PARAMETERS();
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private pageSize: number;
  public pageNumber: number;
  public pageCount: number;
  public pages: number[] = [];
  public mapSelected: DisplayedWalk | null = null;
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
    this.route.queryParamMap.subscribe(params => {
      const q = params.get(this.stringUtils.kebabCase(StoredValue.WALK_QUICK_SEARCH));
      const type = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SELECT_TYPE));
      const sort = params.get(this.stringUtils.kebabCase(StoredValue.WALK_SORT_ASC));
      const view = params.get(this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW));
      if (q !== null) {
        this.filterParameters.quickSearch = q;
      }
      if (type) {
        this.filterParameters.selectType = type.replace(/-/g, "_").toUpperCase() as any;
      }
      if (sort !== null) {
        this.filterParameters.ascending = sort === "date-ascending" || sort === "1" || sort === "true";
      }
      if (view === "cards" || view === "table" || view === "map") {
        this.walkListView = view as any;
        this.uiActionsService.saveValueFor(StoredValue.WALK_LIST_VIEW, this.walkListView);
      }
    });
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
      this.walkListView = this.uiActionsService.initialValueFor(StoredValue.WALK_LIST_VIEW, this.systemConfig.group.defaultWalkListView) as WalkListView;
    }));
    this.pageSize = 10;
    this.pageNumber = 1;
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, () => this.refreshWalks(NamedEventType.SYSTEM_CONFIG_LOADED));
    this.broadcastService.on(NamedEventType.WALK_SLOTS_CREATED, () => this.refreshWalks(NamedEventType.WALK_SLOTS_CREATED));
    this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshWalks(NamedEventType.REFRESH));
    this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilterToWalks(searchTerm));
    this.broadcastService.on(NamedEventType.WALK_SAVED, (event: NamedEvent<ExtendedGroupEvent>) => this.replaceWalkInList(event.data));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.currentWalkId = paramMap.get("walk-id");
      this.logger.debug("walk-id from route params:", this.currentWalkId);
    }));
    this.display.refreshCachedData();
    this.pageService.setTitle("Home");
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.refreshWalks(loginResponse)));
  }

  public async performMigration() {
    // const migrated = await this.eventsMigrationService.migrateWalks(true);
    // this.applyWalks(migrated);
    this.dataMigrationService.migrateMedia(false);
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

  paginate(walks: DisplayedWalk[], pageSize, pageNumber): DisplayedWalk[] {
    return walks.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  }

  applyFilterToWalks(searchTerm?: NamedEvent<string>): void {
    this.notify.setBusy();
    const sort = this.extendedGroupEventQueryService.localWalksSortObject(this.filterParameters);
    this.logger.info("applyFilterToWalks:searchTerm:", searchTerm, "filterParameters:", this.filterParameters, "localWalksSortObject:", sort);
    this.filteredWalks = this.searchFilterPipe.transform(this.walks, this.filterParameters.quickSearch)
      .map(walk => this.display.toDisplayedWalk(walk)).sort(sortBy(sort));
    this.pageNumber = 1;
    this.applyPagination();
    if (this.currentPageWalks.length > 0 && this.display.expandedWalks.length === 0) {
      this.display.view(this.currentPageWalks[0].walk);
    }
    this.notify.clearBusy();
  }

  private applyPagination() {
    this.pageCount = Math.ceil(this.filteredWalks?.length / this.pageSize);
    this.currentPageWalks = this.paginate(this.filteredWalks, this.pageSize, this.pageNumber);
    this.pages = range(1, this.pageCount + 1);
    this.logger.debug("total walks count", this.walks?.length, "walks:", this.walks, "filteredWalks count", this.filteredWalks?.length, "currentPageWalks count", this.currentPageWalks.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages);
    this.logger.info("total walks count", this.walks?.length, "filteredWalks count", this.filteredWalks?.length, "currentPageWalks:", this.currentPageWalks, "pageSize:", this.pageSize, "pageCount", this.pageCount);
    const hasWalks = this.currentPageWalks.length > 0;
    const offset = hasWalks ? ((this.pageNumber - 1) * this.pageSize + 1) : 0;
    const pageIndicator = this.pages.length > 1 ? `page ${this.pageNumber} of ${this.pageCount}` : "";
    const toWalkNumber = hasWalks ? Math.min(this.pageNumber * this.pageSize, this.filteredWalks?.length || 0) : 0;
    const totalOnly = `${this.stringUtils.pluraliseWithCount(this.filteredWalks?.length || 0, "walk")}`;
    const alertMessage = this.walkListView === WalkListView.MAP
      ? (this.filteredWalks?.length ? `Showing ${totalOnly}` : "No walks found")
      : (hasWalks ? `${offset} to ${toWalkNumber} of ${totalOnly}${pageIndicator ? EM_DASH_WITH_SPACES + pageIndicator : ""}` : "No walks found");
    this.notify.progress(alertMessage);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, (this.filteredWalks?.length || 0) > 0 || this.walkListView === WalkListView.MAP));
  }

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }


  query() {
    return this.walksAndEventsService.all({
      inputSource: this.display.walkPopulationLocal() ? InputSource.MANUALLY_CREATED : InputSource.WALKS_MANAGER_IMPORT,
      suppressEventLinking: false,
      types: [RamblersEventType.GROUP_WALK],
      dataQueryOptions: this.extendedGroupEventQueryService.dataQueryOptions(this.filterParameters)
    });
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

  private replaceWalkInList(walk: ExtendedGroupEvent) {
    this.logger.debug("Received updated walk", walk);
    const existingWalk: ExtendedGroupEvent = this.walks?.find(listedWalk => listedWalk?.id === walk?.id);
    if (existingWalk) {
      this.walks[(this.walks?.indexOf(existingWalk))] = walk;
      this.applyFilterToWalks();
    }
  }

  refreshWalks(event?: any): Promise<any> {
    this.logger.info("Refreshing walks due to", event, "event and walkPopulation:", this.display?.group?.walkPopulation);
    this.notify.progress(`Refreshing ${this.stringUtils.asTitle(this.display?.group?.walkPopulation)} walks...`, true);
    return this.query()
      .then(walks => {
        this.display.setNextWalkId(walks);
        this.queryGroups(walks);
        this.logger.info("refreshWalks", "hasWalksId", this.currentWalkId, "walks:", walks);
        this.applyWalks(this.currentWalkId || this.filterParameters.selectType === FilterCriteria.ALL_EVENTS ? walks : this.extendedGroupEventQueryService.activeEvents(walks));
        this.applyFilterToWalks();
        this.notify.clearBusy();
      }).catch(error => {
        this.logger.error("error->", error);
        this.notify.error({
          title: "Problem with querying walks",
          continue: true,
          message: error
        });
      });
  }

  private applyWalks(walks: ExtendedGroupEvent[]) {
    this.walks = walks;
    this.applyFilterToWalks();
    this.notify.clearBusy();
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
    this.applyPagination();
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


  private queryGroups(walks: ExtendedGroupEvent[]): void {
    const groups: string[] = uniq(walks.map((groupWalk: ExtendedGroupEvent) => groupWalk?.groupEvent?.group_code)).filter(item => item);
    if (groups.length > 0) {
      this.logger.info("finding groups:", groups);
      this.ramblersWalksAndEventsService.listRamblersGroups(groups);
    } else {
      this.logger.info("no groups to query:", groups);
    }
  }

  switchToView(walkListView: WalkListView) {
    this.walkListView = walkListView;
    this.logger.info("switching to", walkListView, "view");
    this.uiActionsService.saveValueFor(StoredValue.WALK_LIST_VIEW, walkListView);
    this.replaceQueryParams({ [this.stringUtils.kebabCase(StoredValue.WALK_LIST_VIEW)]: this.stringUtils.kebabCase(walkListView) });
  }

  private replaceQueryParams(params: { [key: string]: any }) {
    const queryParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: "merge" });
  }
}
