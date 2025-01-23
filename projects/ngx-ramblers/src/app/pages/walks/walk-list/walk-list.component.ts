import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import range from "lodash-es/range";
import uniq from "lodash-es/uniq";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { PageChangedEvent, PaginationComponent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LoginResponse } from "../../../models/member.model";
import { DeviceSize } from "../../../models/page.model";
import { Organisation } from "../../../models/system.model";
import {
  DisplayedWalk,
  EventType,
  FilterParameters,
  Walk,
  WalkDateAscending,
  WalkDateDescending,
  WalkListView
} from "../../../models/walk.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { WalksService } from "../../../services/walks/walks.service";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { sortBy } from "../../../functions/arrays";
import { faImages, faPeopleGroup, faTableCells, faWalking } from "@fortawesome/free-solid-svg-icons";
import { DataMigrationService } from "../../../services/walks/data-migration.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { DynamicContentComponent } from "../../../modules/common/dynamic-content/dynamic-content";
import { WalkSearchComponent } from "../walk-search/walk-search.component";
import { BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective } from "ngx-bootstrap/dropdown";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { FormsModule } from "@angular/forms";
import { WalkCardListComponent } from "../walk-view/walk-card-list";
import { WalkViewComponent } from "../walk-view/walk-view";
import { WalkEditComponent } from "../walk-edit/walk-edit.component";
import { NgClass } from "@angular/common";
import { WalkGradingComponent } from "../walk-view/walk-grading";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { WalkPanelExpanderComponent } from "../../../panel-expander/walk-panel-expander";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";

@Component({
    selector: "app-walk-list",
    template: `
    <app-page>
      <app-dynamic-content [anchor]="'page-header'" contentPathReadOnly/>
      <div class="row mb-n3">
        <div class="mb-3 col-sm-12">
          <app-walks-search [filterParameters]="filterParameters" [notifyTarget]="notifyTarget">
            <div class="row no-gutters">
              <div class="col">
                @if (group?.allowSwitchWalkView) {
                  <div class="btn-group w-100 mb-3 btn-group-custom" dropdown>
                    <button aria-controls="dropdown-animated" class="dropdown-toggle btn btn-primary mr-2" dropdownToggle
                      type="button">
                      <fa-icon [icon]="walkListView===WalkListView.CARDS ? faImages : faTableCells"/>
                      <span class="ml-2">{{ stringUtils.asTitle(walkListView) }} View</span><span class="caret"></span>
                    </button>
                    <ul *dropdownMenu class="dropdown-menu" id="dropdown-animated" role="menu">
                      <li role="menuitem">
                        <a (click)="switchToView(WalkListView.CARDS)" class="dropdown-item">
                          <div>
                            <fa-icon [icon]="faImages" class="mr-2"/>
                            {{ stringUtils.asTitle(WalkListView.CARDS) }} View
                          </div>
                        </a>
                      </li>
                      <li role="menuitem">
                        <a (click)="switchToView(WalkListView.TABLE)" class="dropdown-item">
                          <div>
                            <fa-icon [icon]="faTableCells" class="mr-2"/>
                            {{ stringUtils.asTitle(WalkListView.TABLE) }} View
                          </div>
                        </a>
                      </li>
                    </ul>
                  </div>
                }
              </div>
              <div class="col">
                <pagination class="pagination rounded w-100" [boundaryLinks]=true [rotate]="true" [maxSize]="maxSize()"
                  [totalItems]="walks?.length" [(ngModel)]="pageNumber"
                  (pageChanged)="pageChanged($event)"/>
              </div>
            </div>
          </app-walks-search>
          @if (walkListView===WalkListView.CARDS) {
            <app-walk-card-list [currentPageWalks]="currentPageWalks"/>
          }
          @if (!walkListView || walkListView===WalkListView.TABLE) {
            @for (displayedWalk of currentPageWalks; track walkTracker(index, displayedWalk); let index = $index) {
              <div class="table-responsive"
                >
                @if (display.isExpanded(displayedWalk.walk)) {
                  <div>
                    @if (!display.isEdit(displayedWalk.walk)) {
                      <app-walk-view
                        [displayedWalk]="displayedWalk"/>
                    }
                    @if (display.isEdit(displayedWalk.walk)) {
                      <app-walk-edit
                        [displayedWalk]="displayedWalk"/>
                    }
                  </div>
                }
                @if (!display.isExpanded(displayedWalk.walk)) {
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
                              class="button-form">
                          }
                        </td>
                      }
                      <td width="8%" class="event-type"
                        (click)="display.view(displayedWalk.walk)"
                        id="eventType-{{index}}">
                        @if (display.isWalk(displayedWalk.walk)) {
                          <app-walk-grading [grading]="displayedWalk.walk.grade"/>
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
                        {{ displayedWalk.walk.walkDate|displayDate }}
                      </td>
                      <td width="7%" class="d-none d-lg-table-cell start-time" (click)="display.view(displayedWalk.walk)"
                        id="startTime-{{index}}">{{ displayedWalk.walk.startTime }}
                      </td>
                      <td width="25%" name="briefDescriptionAndStartPoint"
                        (click)="display.view(displayedWalk.walk)"
                        id="briefDescription-{{index}}">{{ displayedWalk.walk.briefDescriptionAndStartPoint || displayedWalk?.latestEventType?.description }}
                      </td>
                      <td width="7%" class="d-none d-lg-table-cell distance" (click)="display.view(displayedWalk.walk)"
                        id="distance-{{index}}">{{ displayedWalk.walk.distance }}
                      </td>
                      <td width="8%" class="d-none d-lg-table-cell postcode" id="postcode-{{index}}">
                    <a [href]="'http://maps.google.co.uk/maps?q=' + displayedWalk.walk.start_location?.postcode"
                       target="_blank" name="postcode"
                       tooltip="Click to locate postcode {{displayedWalk.walk.start_location?.postcode}} on Google Maps"
                       placement="left">{{ displayedWalk.walk.start_location?.postcode }}</a></td>
                  <td width="12%" class="d-none d-lg-table-cell walk-leader" id="contactEmail-{{index}}">
                    @if (allowDetailView()) {
<a [href]="'mailto:'+ displayedWalk.walk.contactEmail"
                       tooltip="Click to email {{displayedWalk.walk.displayName}} at {{displayedWalk.walk.contactEmail}}"
                       placement="left">{{ displayedWalk.walk.displayName }}</a>
}
                    @if (!allowDetailView()) {
<div class="tooltip-link" placement="left"
                         (click)="login()"
                         tooltip="Click to login as an {{group?.shortName}} member and send an email to {{displayedWalk.walk.displayName}}">
                      {{ displayedWalk.walk.displayName }}
                    </div>
}
                  </td>
                  @if (display.walkContactDetailsPublic()) {
<td width="11%"
                      class="d-none d-lg-table-cell contact-phone"
                      id="contactPhone-{{index}}" name="contactPhone">
                    @if (allowDetailView()) {
<a [href]="'tel:' + displayedWalk.walk.contactPhone"
                       [textContent]="displayedWalk.walk.contactPhone"
                       tooltip="Click to ring {{displayedWalk.walk.displayName}} on {{displayedWalk.walk.contactPhone}} (mobile devices only)"
                       placement="left"></a>
}
                    @if (!allowDetailView()) {
<a [href]="'tel:' + displayedWalk.walk.contactPhone">
                    <span [textContent]="displayedWalk.walk.contactPhone"
                          tooltip="Click to ring {{displayedWalk.walk.displayName}} on {{displayedWalk.walk.contactPhone}} (mobile devices only)"
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
      <app-dynamic-content [anchor]="'action-buttons'" contentPathReadOnly/>
    </app-page>
  `,
    styleUrls: ["./walk-list.component.sass"],
    changeDetection: ChangeDetectionStrategy.Default,
    imports: [PageComponent, DynamicContentComponent, WalkSearchComponent, BsDropdownDirective, BsDropdownToggleDirective, FontAwesomeModule, BsDropdownMenuDirective, PaginationComponent, FormsModule, WalkCardListComponent, WalkViewComponent, WalkEditComponent, NgClass, WalkGradingComponent, TooltipDirective, WalkPanelExpanderComponent, DisplayDatePipe]
})
export class WalkListComponent implements OnInit, OnDestroy {

  constructor(
    private uiActionsService: UiActionsService,
    private systemConfigService: SystemConfigService,
    private modalService: BsModalService,
    private pageService: PageService,
    public googleMapsService: GoogleMapsService,
    protected walksService: WalksService,
    protected dataMigrationService: DataMigrationService,
    private authService: AuthService,
    public ramblersWalksAndEventsService: RamblersWalksAndEventsService,
    public memberLoginService: MemberLoginService,
    public display: WalkDisplayService,
    protected stringUtils: StringUtilsService,
    private searchFilterPipe: SearchFilterPipe,
    private route: ActivatedRoute,
    private walksQueryService: WalksQueryService,
    private dateUtils: DateUtilsService,
    private notifierService: NotifierService,
    private broadcastService: BroadcastService<any>,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("WalkListComponent", NgxLoggerLevel.ERROR);
  }

  protected readonly faWalking = faWalking;
  protected readonly faPeopleGroup = faPeopleGroup;
  public currentWalkId: string;
  private logger: Logger;
  private todayValue: number;
  public walks: Walk[];
  public filteredWalks: DisplayedWalk[] = [];
  public currentPageWalks: DisplayedWalk[] = [];
  public filterParameters: FilterParameters = {quickSearch: "", selectType: 1, ascending: true};
  private notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  private pageSize: number;
  public pageNumber: number;
  public pageCount: number;
  public pages: number[] = [];
  config: ModalOptions = {
    animated: false,
    initialState: {}
  };
  private subscriptions: Subscription[] = [];
  public group: Organisation;
  protected readonly faTableCells = faTableCells;
  protected readonly WalkListView = WalkListView;
  protected walkListView: WalkListView;
  protected readonly faImages = faImages;

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.walkListView = this.uiActionsService.initialValueFor(StoredValue.WALK_LIST_VIEW, this.group.defaultWalkListView) as WalkListView;
    }));
    this.todayValue = this.dateUtils.momentNowNoTime().valueOf();
    this.pageSize = 10;
    this.pageNumber = 1;
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.broadcastService.on(NamedEventType.SYSTEM_CONFIG_LOADED, () => this.refreshWalks(NamedEventType.SYSTEM_CONFIG_LOADED));
    this.broadcastService.on(NamedEventType.WALK_SLOTS_CREATED, () => this.refreshWalks(NamedEventType.WALK_SLOTS_CREATED));
    this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshWalks(NamedEventType.REFRESH));
    this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilterToWalks(searchTerm));
    this.broadcastService.on(NamedEventType.WALK_SAVED, (event: NamedEvent<Walk>) => this.replaceWalkInList(event.data));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      this.currentWalkId = paramMap.get("walk-id");
      this.logger.debug("walk-id from route params:", this.currentWalkId);
    }));
    this.display.refreshCachedData();
    this.pageService.setTitle("Home");
    this.subscriptions.push(this.authService.authResponse().subscribe((loginResponse: LoginResponse) => this.refreshWalks(loginResponse)));
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
    this.logger.info("applyFilterToWalks:searchTerm:", searchTerm, "filterParameters:", this.filterParameters, "localWalksSortObject:", this.localWalksSortObject());
    this.filteredWalks = this.searchFilterPipe.transform(this.walks, this.filterParameters.quickSearch)
      .map(walk => this.display.toDisplayedWalk(walk)).sort(sortBy(this.localWalksSortObject()));
    this.pageNumber = 1;
    this.applyPagination();
    if (this.currentPageWalks.length > 0 && this.display.expandedWalks.length === 0) {
      this.display.view(this.currentPageWalks[0].walk);
    }
    this.notify.clearBusy();
  }

  private applyPagination() {
    this.pageCount = Math.ceil(this.filteredWalks.length / this.pageSize);
    this.currentPageWalks = this.paginate(this.filteredWalks, this.pageSize, this.pageNumber);
    this.pages = range(1, this.pageCount + 1);
    this.logger.info("total walks count", this.walks.length, "walks:", this.walks, "filteredWalks count", this.filteredWalks.length, "currentPageWalks count", this.currentPageWalks.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages);
    const offset = (this.pageNumber - 1) * this.pageSize + 1;
    const pageIndicator = this.pages.length > 1 ? `page ${this.pageNumber} of ${this.pageCount}` : "";
    const toWalkNumber = Math.min(offset + this.pageSize - 1, this.currentPageWalks.length);
    const alertMessage = this.currentPageWalks.length > 0 ? `Showing ${offset} to ${toWalkNumber} of ${this.stringUtils.pluraliseWithCount(this.walks.length, "walk")}${pageIndicator ? " - " + pageIndicator : ""}` : "No walks found";
    this.notify.progress(alertMessage);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pageCount > 1));
    this.dataMigrationService.migrateWalkLocations(this.walks);
  }

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }

  walksCriteriaObject() {
    switch (this.filterParameters.selectType) {
      case 1:
        return {walkDate: {$gte: this.todayValue}};
      case 2:
        return {walkDate: {$lt: this.todayValue}};
      case 3:
        return {};
      case 4:
        return {displayName: {$exists: false}};
      case 5:
        return {briefDescriptionAndStartPoint: {$exists: false}};
      case 6:
        return {"events.eventType": {$eq: EventType.DELETED.toString()}};
    }
  }

  walksSortObject() {
    this.logger.info("walksSortObject:", this.filterParameters);
    switch (this.stringUtils.asBoolean(this.filterParameters.ascending)) {
      case true:
        return WalkDateAscending;
      case false:
        return WalkDateDescending;
    }
  }

  localWalksSortObject() {
    this.logger.info("localWalksSortObject:walksSortObject:", this.filterParameters);
    switch (this.stringUtils.asBoolean(this.filterParameters.ascending)) {
      case true:
        return "walk.walkDate";
      case false:
        return "-walk.walkDate";
    }
  }

  query() {
    const criteria = this.walksCriteriaObject();
    const sort = this.walksSortObject();
    this.logger.debug("walksCriteriaObject:this.filterParameters.criteria", criteria, "sort:", sort);
    return this.walksService.all({criteria, sort});
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

  private replaceWalkInList(walk: Walk) {
    this.logger.debug("Received updated walk", walk);
    const existingWalk: Walk = this.walks?.find(listedWalk => listedWalk?.id === walk?.id);
    if (existingWalk) {
      this.walks[(this.walks.indexOf(existingWalk))] = walk;
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
        this.applyWalks(this.currentWalkId || this.filterParameters.selectType === 6 ? walks : this.walksQueryService.activeWalks(walks));
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

  private applyWalks(walks: Walk[]) {
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

  private queryGroups(walks: Walk[]): void {
    const groups: string[] = uniq(walks.map((groupWalk: Walk) => groupWalk?.group?.groupCode)).filter(item => item);
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
  }
}
