import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import range from "lodash-es/range";
import { PageChangedEvent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DataQueryOptions, FilterCriteria, SortOrder } from "../../../models/api-request.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { EventsData } from "../../../models/social-events.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { SocialDisplayService } from "../../../pages/social/social-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { EventsHeader } from "./events-header";
import { FormsModule } from "@angular/forms";
import { EventCardsList } from "./event-cards-list";
import { ExtendedGroupEvent } from "../../../models/group-event.model";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { EventQueryParameters, RamblersEventType } from "../../../models/ramblers-walks-manager";
import { DateFilterParameters } from "../../../models/search.model";
import { MongoSort } from "../../../models/mongo-models";
import { GroupEventField } from "../../../models/walk.model";

@Component({
    selector: "app-events",
    template: `
      <app-events-header [totalItems]="extendedGroupEvents?.length" [filterParameters]="filterParameters" [currentPageFilteredEvents]="currentPageFilteredEvents"
                         [notifyTarget]="notifyTarget" [eventsData]="eventsData" [pageNumber]="pageNumber"
                         (pageChanged)="pageChanged($event)"/>
      <app-event-cards-list [eventsData]="eventsData"
                            [notifyTarget]="notifyTarget"
                            [currentPageFilteredEvents]="currentPageFilteredEvents"/>
    `,
  styleUrls: ["../../../pages/social/home/social-home.component.sass"],
  imports: [EventsHeader, FormsModule, EventCardsList]
})
export class Events implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("Events", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  pageService = inject(PageService);
  private stringUtils = inject(StringUtilsService);
  private searchFilterPipe = inject(SearchFilterPipe);
  private notifierService = inject(NotifierService);
  display = inject(SocialDisplayService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private route = inject(ActivatedRoute);
  private walksAndEventsService = inject(WalksAndEventsService);
  private memberLoginService = inject(MemberLoginService);
  protected dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public socialEventId: string;
  public filterParameters: DateFilterParameters = {
    fieldSort: 1,
    selectType: FilterCriteria.FUTURE_EVENTS,
    quickSearch: ""
  };
  private pageSize = 8;
  public pageNumber = 1;
  public pageCount: number;
  public pages: number[] = [];
  public extendedGroupEvents: ExtendedGroupEvent[] = [];
  public filteredExtendedGroupEvents: ExtendedGroupEvent[] = [];
  public currentPageFilteredEvents: ExtendedGroupEvent[] = this.filteredExtendedGroupEvents;
  @Input() rowIndex: number;
  @Input() eventsData: EventsData;

  ngOnInit() {
    this.logger.info("ngOnInit started");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.systemConfigService.events().subscribe(item => {
      this.notify.success({
        title: "Social Events",
        message: "Querying for data"
      });
      this.refreshEvents();
    });
    this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshEvents());
    this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilterToSocialEvents(searchTerm));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const socialEventId = paramMap.get("relativePath");
      this.logger.info("socialEventId from route params:", paramMap, socialEventId);
      if (socialEventId) {
        this.socialEventId = socialEventId;
      }
      this.pageService.setTitle("Home");
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  public refreshEvents() {
    this.notify.setBusy();
    const dataQueryOptions: DataQueryOptions = {criteria: this.criteria(), sort: this.sort()};
    this.logger.info("refreshSocialEvents:dataQueryOptions", dataQueryOptions);
    this.queryAndReturnEvents(dataQueryOptions)
      .then((extendedGroupEvents: ExtendedGroupEvent[]) => {
        this.display.confirm.clear();
        this.extendedGroupEvents = extendedGroupEvents;
        this.logger.info("received extendedGroupEvents:", extendedGroupEvents);
        this.applyFilterToSocialEvents();
      })
      .catch(error => {
        this.logger.error("received error:", error);
        this.notify.error({
          title: "Problem viewing Social Events",
          message: error
        });
      });
  }

  private queryAndReturnEvents(dataQueryOptions: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    const eventQueryParameters: EventQueryParameters = {
      types: this?.eventsData?.eventTypes || [RamblersEventType.GROUP_EVENT],
      dataQueryOptions
    };
    if (this.memberLoginService.memberLoggedIn()) {
      return this.walksAndEventsService.all(eventQueryParameters);
    } else {
      return this.walksAndEventsService.allPublic(eventQueryParameters);
    }
  }

  criteria() {
    const {filterCriteria, fromDate, toDate} = this?.eventsData || {};
    const today = this.dateUtils.isoDateTimeStartOfDay();
    switch (filterCriteria) {
      case FilterCriteria.CHOOSE:
      case FilterCriteria.DATE_RANGE:
        return {
          [GroupEventField.START_DATE]: {
            $gte: this.dateUtils.asDateValue(fromDate)?.date,
            $lte: this.dateUtils.asDateValue(toDate)?.date
          }
        };
      case FilterCriteria.FUTURE_EVENTS:
        return {[GroupEventField.START_DATE]: {$gte: today}};
      case FilterCriteria.PAST_EVENTS:
        return {[GroupEventField.START_DATE]: {$lt: today}};
      case FilterCriteria.ALL_EVENTS:
      default:
        return {};
    }
  }

  sort() {
    return {[GroupEventField.START_DATE]: this.sortOrderToValue(this?.eventsData?.sortOrder)};
  }

  private sortOrderToValue(sortOrder: SortOrder): MongoSort {
    return sortOrder === SortOrder.DATE_DESCENDING ? MongoSort.DESCENDING : MongoSort.ASCENDING;
  }

  applyFilterToSocialEvents(searchTerm?: NamedEvent<string>) {
    this.logger.info("applyFilterToSocialEvents:searchTerm:", searchTerm, "filterParameters.quickSearch:", this.filterParameters.quickSearch);
    this.notify.setBusy();
    this.filteredExtendedGroupEvents = this.searchFilterPipe.transform(this.extendedGroupEvents, this.filterParameters.quickSearch);
    const filteredCount = (this.filteredExtendedGroupEvents?.length) || 0;
    const eventCount = (this.filteredExtendedGroupEvents?.length) || 0;
    this.notify.progress(`${filteredCount} of ${this.stringUtils.pluraliseWithCount(eventCount, "event")} shown`);
    this.applyPagination();
    this.broadcastService.broadcast(NamedEvent.withData(NamedEventType.SHOW_PAGINATION, this.pages.length > 1));
    this.notify.clearBusy();
    this.verifyReady();
  }

  private verifyReady() {
    if (this.display.memberFilterSelections?.length > 0 && this.extendedGroupEvents?.length > 0) {
      this.notify.clearBusy();
    }
  }

  pageChanged(event: PageChangedEvent): void {
    this.logger.info("event:", event);
    this.goToPage(event.page);
  }

  goToPage(pageNumber) {
    this.pageNumber = pageNumber;
    this.applyPagination();
  }

  paginate(walks: ExtendedGroupEvent[], pageSize, pageNumber): ExtendedGroupEvent[] {
    return walks.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  }

  private applyPagination() {
    this.pageCount = Math.ceil(this.filteredExtendedGroupEvents.length / this.pageSize);
    this.currentPageFilteredEvents = this.paginate(this.filteredExtendedGroupEvents, this.pageSize, this.pageNumber);
    this.pages = range(1, this.pageCount + 1);
    this.logger.info("applyPagination: filtered event count", this.filteredExtendedGroupEvents.length, "current page event count", this.currentPageFilteredEvents.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages, "currentPageFilteredEvents:", this.currentPageFilteredEvents.map(item => item.id));
    this.logger.info("applyPagination: current page events:", this.currentPageFilteredEvents);
    if (this.currentPageFilteredEvents.length === 0) {
      this.notify.progress("No social events found");
    } else {
      const offset = (this.pageNumber - 1) * this.pageSize + 1;
      const pageIndicator = this.pageCount > 1 ? `Page ${this.pageNumber} of ${this.pageCount}` : `Page ${this.pageNumber}`;
      this.notify.progress(`${pageIndicator} — showing ${offset} to ${offset + this.pageSize - 1} of ${this.stringUtils.pluraliseWithCount(this.filteredExtendedGroupEvents.length, "event")}`);
    }
  }
}
