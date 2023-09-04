import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import range from "lodash-es/range";
import uniq from "lodash-es/uniq";
import { BsModalService, ModalOptions } from "ngx-bootstrap/modal";
import { PageChangedEvent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AuthService } from "../../../auth/auth.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { LoginResponse } from "../../../models/member.model";
import { DeviceSize } from "../../../models/page.model";
import { GroupWalk, RamblersWalksRawApiResponse } from "../../../models/ramblers-walks-manager";
import { Organisation, WalkPopulation } from "../../../models/system.model";
import { DisplayedWalk, EventType, FilterParameters, Walk } from "../../../models/walk.model";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { DisplayDatePipe } from "../../../pipes/display-date.pipe";
import { DisplayDayPipe } from "../../../pipes/display-day.pipe";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { GoogleMapsService } from "../../../services/google-maps.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { MemberService } from "../../../services/member/member.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { RamblersWalksAndEventsService } from "../../../services/walks/ramblers-walks-and-events.service";
import { WalkNotificationService } from "../../../services/walks/walk-notification.service";
import { WalksQueryService } from "../../../services/walks/walks-query.service";
import { WalksReferenceService } from "../../../services/walks/walks-reference-data.service";
import { WalksService } from "../../../services/walks/walks.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { LoginModalComponent } from "../../login/login-modal/login-modal.component";
import { WalkDisplayService } from "../walk-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { sortBy } from "../../../services/arrays";

@Component({
  selector: "app-walk-list",
  templateUrl: "./walk-list.component.html",
  styleUrls: ["./walk-list.component.sass"],
  changeDetection: ChangeDetectionStrategy.Default
})
export class WalkListComponent implements OnInit, OnDestroy {
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

  constructor(
    private systemConfigService: SystemConfigService,
    private modalService: BsModalService,
    private pageService: PageService,
    public googleMapsService: GoogleMapsService,
    private walksService: WalksService,
    private memberService: MemberService,
    private numberUtils: NumberUtilsService,
    private authService: AuthService,
    public ramblersWalksAndEventsService: RamblersWalksAndEventsService,
    public memberLoginService: MemberLoginService,
    private walksNotificationService: WalkNotificationService,
    public display: WalkDisplayService,
    private stringUtils: StringUtilsService,
    private displayDay: DisplayDayPipe,
    private displayDate: DisplayDatePipe,
    private searchFilterPipe: SearchFilterPipe,
    private displayDateAndTime: DisplayDateAndTimePipe,
    private route: ActivatedRoute,
    private walksQueryService: WalksQueryService,
    private dateUtils: DateUtilsService,
    private notifierService: NotifierService,
    private broadcastService: BroadcastService<any>,
    private urlService: UrlService,
    private walksReferenceService: WalksReferenceService,
    private changeDetectorRef: ChangeDetectorRef,
    private siteEditService: SiteEditService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkListComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.group = item.group));
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
    const maxSize = window.innerWidth <= DeviceSize.SMALL ? 3 : 5;
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
    const toWalkNumber = Math.min(offset + this.pageSize - 1, this.walks.length);
    this.notify.progress(`Showing ${offset} to ${toWalkNumber} of ${this.stringUtils.pluraliseWithCount(this.walks.length, "walk")} - ${pageIndicator}`);
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pageCount > 1));
  }

  allowDetailView() {
    return this.memberLoginService.memberLoggedIn();
  }

  viewWalkField(displayedWalk: DisplayedWalk, field) {
    if (displayedWalk.walk.events.length === 0 || displayedWalk.latestEventType.showDetails) {
      return displayedWalk.walk[field] || "";
    } else if (field === "briefDescriptionAndStartPoint") {
      return displayedWalk?.latestEventType?.description;
    } else {
      return "";
    }
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
        return {walkDate: 1};
      case false:
        return {walkDate: -1};
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
    const existingWalk: Walk = this.walks.find(listedWalk => listedWalk.id === walk.id);
    if (existingWalk) {
      this.walks[(this.walks.indexOf(existingWalk))] = walk;
      this.applyFilterToWalks();
    }
  }

  refreshWalks(event?: any): Promise<any> {
    this.logger.info("Refreshing walks due to", event, "event and walkPopulation:", this.display.group.walkPopulation);
    this.notify.progress(`Refreshing ${this.stringUtils.asTitle(this.display.group.walkPopulation)} walks...`, true);
    switch (this.display.group.walkPopulation) {
      case WalkPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.listRamblersWalksRawData()
          .then((ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) => {
            this.applyWalks(this.populateFromGroupWalks(ramblersWalksRawApiResponse));
          })
          .catch(error => {
            this.logger.error("error->", error);
            this.notify.error({
              title: "Problem with Querying Ramblers Walks Manager",
              continue: true,
              message: error
            });
          });
      case WalkPopulation.LOCAL:
        return this.query()
          .then(walks => {
            this.display.setNextWalkId(walks);
            this.logger.info("refreshWalks", "hasWalksId", this.currentWalkId, "walks:", walks);
            this.applyWalks(this.currentWalkId || this.filterParameters.selectType === 6 ? walks : this.walksQueryService.activeWalks(walks));
            this.applyFilterToWalks();
            this.notify.clearBusy();
          });
      default:
        return Promise.resolve(() => {
          this.logger.warn("unhandled case:", this.display?.group?.walkPopulation);
          this.applyWalks([]);
        });
    }
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

  private populateFromGroupWalks(ramblersWalksRawApiResponse: RamblersWalksRawApiResponse): Walk[] {
    this.queryGroups(ramblersWalksRawApiResponse);
    return ramblersWalksRawApiResponse.data.map(remoteWalk => this.ramblersWalksAndEventsService.toWalk(remoteWalk));
  }

  private async queryGroups(ramblersWalksRawApiResponse: RamblersWalksRawApiResponse) {
    const groups: string[] = uniq(ramblersWalksRawApiResponse.data.map((groupWalk: GroupWalk) => groupWalk.group_code));
    this.logger.info("finding groups:", groups);
    await this.ramblersWalksAndEventsService.listRamblersGroups(groups);
  }
}
