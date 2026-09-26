import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, ParamMap } from "@angular/router";
import { range } from "es-toolkit";
import { keys } from "es-toolkit/compat";
import { PageChangedEvent } from "ngx-bootstrap/pagination";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { AlertTarget } from "../../../models/alert-target.model";
import { DataQueryOptions, FilterCriteria, SortOrder } from "../../../models/api-request.model";
import { NamedEvent, NamedEventType } from "../../../models/broadcast.model";
import { EventsData } from "../../../models/group-events.model";
import { DateDirection } from "../../../models/search.model";
import { SearchFilterPipe } from "../../../pipes/search-filter.pipe";
import { BroadcastService } from "../../../services/broadcast-service";
import { DateUtilsService } from "../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { MemberLoginService } from "../../../services/member/member-login.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { PageService } from "../../../services/page.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UrlService } from "../../../services/url.service";
import { GroupEventDisplayService } from "../../../pages/group-events/group-event-display.service";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { EventsHeader } from "./events-header";
import { EventCardsList } from "./event-cards-list";
import { EventsFull } from "./events-full";
import { WalksConfig } from "../../../models/walks-config.model";
import { WalksConfigService } from "../../../services/system/walks-config.service";
import { ExtendedGroupEvent, InputSource } from "../../../models/group-event.model";
import { WalksAndEventsService } from "../../../services/walks-and-events/walks-and-events.service";
import { EventQueryParameters, RamblersEventType } from "../../../models/ramblers-walks-manager";
import { DateFilterParameters } from "../../../models/search.model";
import { MongoSort } from "../../../models/mongo-models";
import {GroupEventField} from "../../../models/walk.model";
import { tagCriteriaClauses } from "../../../functions/walks/event-tag-filter";
import { WalkDisplayService } from "../../../pages/walks/walk-display.service";
import { EM_DASH_WITH_SPACES } from "../../../models/content-text.model";
import { enumValues } from "../../../functions/enums";
import {groupEventIdsCriteria} from "../../../functions/group-event-id-criteria";
import { UiActionsService } from "../../../services/ui-actions.service";
import { StoredValue, StoredValueQueryParameters } from "../../../models/ui-actions";

@Component({
    selector: "app-events",
    template: `
      @if (eventsData?.allow?.viewSelector) {
        <app-events-full [eventsData]="eventsData"/>
      } @else {
        <app-events-header [totalItems]="filteredExtendedGroupEvents?.length" [filterParameters]="filterParameters" [currentPageFilteredEvents]="currentPageFilteredEvents"
                           [notifyTarget]="notifyTarget" [eventsData]="eventsData" [pageNumber]="pageNumber"
                           [itemsPerPage]="pageSize" [queryIndex]="queryIndex"
                           (pageChanged)="pageChanged($event)"/>
        <app-event-cards-list [eventsData]="eventsData"
                              [notifyTarget]="notifyTarget"
                              [currentPageFilteredEvents]="currentPageFilteredEvents"/>
      }
    `,
  styleUrls: ["../../../pages/group-events/home/group-event-home.sass"],
  imports: [EventsHeader, EventCardsList, EventsFull]
})
export class Events implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("Events", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private walksConfigService = inject(WalksConfigService);
  pageService = inject(PageService);
  private stringUtils = inject(StringUtilsService);
  private searchFilterPipe = inject(SearchFilterPipe);
  private notifierService = inject(NotifierService);
  display = inject(GroupEventDisplayService);
  walkDisplayService = inject(WalkDisplayService);
  private broadcastService = inject<BroadcastService<any>>(BroadcastService);
  private route = inject(ActivatedRoute);
  private uiActionsService = inject(UiActionsService);
  private urlService = inject(UrlService);
  private walksAndEventsService = inject(WalksAndEventsService);
  private memberLoginService = inject(MemberLoginService);
  protected dateUtils = inject(DateUtilsService);
  private subscriptions: Subscription[] = [];
  public notify: AlertInstance;
  public notifyTarget: AlertTarget = {};
  public groupEventId: string;
  public filterParameters: DateFilterParameters = {
    fieldSort: 1,
    selectType: FilterCriteria.FUTURE_EVENTS,
    quickSearch: ""
  };
  public pageSize = 8;
  public pageNumber = 1;
  public pageCount: number;
  public pages: number[] = [];
  public extendedGroupEvents: ExtendedGroupEvent[] = [];
  public filteredExtendedGroupEvents: ExtendedGroupEvent[] = [];
  public currentPageFilteredEvents: ExtendedGroupEvent[] = this.filteredExtendedGroupEvents;
  public walksConfig: WalksConfig;
  @Input() rowIndex: number;
  @Input() queryIndex = 0;
  public eventsData: EventsData;
  private appliedEventsDataKey: string = null;
  private eventsInitialised = false;

  @Input("eventsData") set acceptEventsData(eventsData: EventsData) {
    this.eventsData = eventsData;
    this.applyEventsDataToFilters(eventsData);
    this.applyFilterQueryParams(this.route.snapshot.queryParamMap);
    const nextKey = this.eventsDataKey(eventsData);
    if (nextKey !== this.appliedEventsDataKey) {
      this.appliedEventsDataKey = nextKey;
      this.logger.info("eventsData changed:", nextKey, "eventsInitialised:", this.eventsInitialised);
      if (this.eventsInitialised) {
        this.pageNumber = 1;
        this.refreshEvents();
      }
    }
  }

  ngOnInit() {
    this.logger.info("ngOnInit started");
    this.notify = this.notifierService.createAlertInstance(this.notifyTarget);
    this.subscriptions.push(this.systemConfigService.events().subscribe(() => {
      this.notify.success({
        title: "Events",
        message: "Querying for data"
      });
      this.refreshEvents();
    }));
    this.walksConfig = this.walksConfigService.walksConfig() ?? this.walksConfigService.default();
    this.subscriptions.push(this.walksConfigService.events().subscribe(config => this.walksConfig = config));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.REFRESH, () => this.refreshEvents()));
    this.subscriptions.push(this.broadcastService.on(NamedEventType.APPLY_FILTER, (searchTerm?: NamedEvent<string>) => this.applyFilterToGroupEvents(searchTerm)));
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => this.applyFilterQueryParams(params)));
    this.subscriptions.push(this.route.paramMap.subscribe((paramMap: ParamMap) => {
      const groupEventId = paramMap.get("relativePath");
      this.logger.info("groupEventId from route params:", paramMap, groupEventId);
      if (groupEventId) {
        this.groupEventId = groupEventId;
      }
      this.applyPageTitle();
    }));
    this.eventsInitialised = true;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
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

  public refreshEvents() {
    this.persistFilterQueryParams();
    this.notify.progress({title: "Events", message: "Querying events"}, true);
    const dataQueryOptions: DataQueryOptions = {criteria: this.criteria(), sort: this.sort()};
    this.logger.info("refreshEvents:dataQueryOptions", dataQueryOptions, "eventIds:", this?.eventsData?.eventIds);
    this.queryAndReturnEvents(dataQueryOptions)
      .then((extendedGroupEvents: ExtendedGroupEvent[]) => {
        this.display.confirm.clear();
        this.extendedGroupEvents = this.filterByEventIds(extendedGroupEvents);
        this.logger.info("received extendedGroupEvents:", extendedGroupEvents.length, "after filtering by eventIds:", this.extendedGroupEvents.length);
        this.applyFilterToGroupEvents();
      })
      .catch(error => {
        this.logger.error("received error:", error);
        this.notify.error({
          title: "Problem viewing events",
          message: error,
          continue: true
        });
      });
  }

  private filterByEventIds(events: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    const eventIds = this?.eventsData?.eventIds;
    if (!eventIds || eventIds.length === 0) {
      return events;
    }
    return events.filter(event => {
      const ids = [event?.groupEvent?.id, event?.id].filter(value => !!value);
      return ids.some(id => eventIds.includes(id));
    });
  }

  private queryAndReturnEvents(dataQueryOptions: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    const ids = this?.eventsData?.eventIds || [];
    const eventQueryParameters: EventQueryParameters = {
      inputSource: this.walkDisplayService.walkPopulationLocal() ? InputSource.MANUALLY_CREATED : InputSource.WALKS_MANAGER_CACHE,
      suppressEventLinking: false,
      ids: ids.length > 0 ? ids : null,
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
    const clauses = [this.dateOrEventIdsCriteria(), ...this.tagCriteria()].filter(clause => clause && keys(clause).length > 0);
    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return {$and: clauses};
  }

  private applyFilterQueryParams(params: ParamMap): void {
    const type = params.get(this.uiActionsService.queryParameterName(StoredValue.WALK_SELECT_TYPE, this.queryIndex));
    const sort = params.get(this.uiActionsService.queryParameterName(StoredValue.WALK_SORT_ASC, this.queryIndex));
    const search = params.get(this.uiActionsService.queryParameterName(StoredValue.SEARCH, this.queryIndex));
    if (type) {
      this.filterParameters.selectType = type.replace(/-/g, "_").toUpperCase() as FilterCriteria;
    }
    if (sort !== null) {
      this.filterParameters.fieldSort = sort === "false" ? MongoSort.DESCENDING : MongoSort.ASCENDING;
    }
    if (search !== null) {
      this.filterParameters.quickSearch = search;
    }
  }

  private persistFilterQueryParams(): void {
    const defaultSelect = this.eventsData?.filterCriteria || FilterCriteria.FUTURE_EVENTS;
    const defaultAscending = this.normalizedSortOrder(this.eventsData?.sortOrder) !== SortOrder.DATE_DESCENDING;
    const selectType = this.filterParameters.selectType;
    const ascending = Number(this.filterParameters.fieldSort) !== MongoSort.DESCENDING;
    this.uiActionsService.saveValueFor(StoredValue.WALK_SELECT_TYPE, selectType, this.queryIndex);
    this.uiActionsService.saveValueFor(StoredValue.WALK_SORT_ASC, ascending, this.queryIndex);
    this.uiActionsService.saveValueFor(StoredValue.SEARCH, this.filterParameters.quickSearch || "", this.queryIndex);
    const queryParams: StoredValueQueryParameters = {};
    if (this.eventsData?.allow?.allowFilterChange) {
      queryParams[StoredValue.WALK_SELECT_TYPE] = selectType === defaultSelect ? null : this.stringUtils.kebabCase(selectType);
    }
    if (this.eventsData?.allow?.allowSortChange) {
      queryParams[StoredValue.WALK_SORT_ASC] = ascending === defaultAscending ? null : (ascending ? "true" : "false");
    }
    const term = (this.filterParameters.quickSearch || "").trim();
    queryParams[StoredValue.SEARCH] = term ? term : null;
    if (keys(queryParams).length > 0) {
      this.uiActionsService.updateQueryParameters(queryParams, true, this.queryIndex).then(() => this.urlService.rememberListUrl());
    } else {
      this.urlService.rememberListUrl();
    }
    this.applyPageTitle();
  }

  private applyPageTitle(): void {
    const defaultSelect = this.eventsData?.filterCriteria || FilterCriteria.FUTURE_EVENTS;
    const defaultAscending = this.normalizedSortOrder(this.eventsData?.sortOrder) !== SortOrder.DATE_DESCENDING;
    const ascending = Number(this.filterParameters.fieldSort) !== MongoSort.DESCENDING;
    const extras = [
      this.filterParameters.selectType && this.filterParameters.selectType !== defaultSelect ? this.stringUtils.asTitle(this.filterParameters.selectType) : null,
      (this.filterParameters.quickSearch || "").trim() || null,
      ascending === defaultAscending ? null : this.stringUtils.asTitle(this.resolvedSortOrder())
    ].filter(part => !!part);
    this.pageService.setTitle(this.pageService.areaTitle(), ...extras);
  }

  private applyEventsDataToFilters(eventsData: EventsData): void {
    if (eventsData?.filterCriteria) {
      this.filterParameters.selectType = eventsData.filterCriteria;
    }
    const configuredSort = this.normalizedSortOrder(eventsData?.sortOrder);
    if (configuredSort) {
      this.filterParameters.fieldSort = configuredSort === SortOrder.DATE_DESCENDING ? MongoSort.DESCENDING : MongoSort.ASCENDING;
    }
  }

  private resolvedFilterCriteria(): FilterCriteria {
    if (this.eventsData?.allow?.allowFilterChange && this.filterParameters.selectType) {
      return this.filterParameters.selectType;
    } else {
      return this.eventsData?.filterCriteria || this.filterParameters.selectType;
    }
  }

  private dateOrEventIdsCriteria() {
    const {fromDate, toDate, eventIds, savedCriteria} = this?.eventsData || {};
    const filterCriteria = this.resolvedFilterCriteria();
    const today = this.dateUtils.isoDateTimeStartOfDay();
    const hasEventIds = eventIds?.length > 0;
    switch (filterCriteria) {
      case FilterCriteria.DATE_RANGE: {
        const resolvedFrom = fromDate ?? this.resolveRelativeDate(savedCriteria?.dateRange);
        const resolvedTo = toDate ?? this.resolveRelativeEndDate(savedCriteria?.dateRange);
        if (resolvedFrom && resolvedTo) {
          if (hasEventIds) {
            return {$and: [this.dateRangeCriteria(resolvedFrom, resolvedTo), this.eventIdsCriteria(eventIds)]};
          }
          return this.dateRangeCriteria(resolvedFrom, resolvedTo);
        }
        return {};
      }
      case FilterCriteria.FUTURE_EVENTS:
        return {[GroupEventField.START_DATE]: {$gte: today}};
      case FilterCriteria.PAST_EVENTS:
        return {[GroupEventField.START_DATE]: {$lt: today}};
      case FilterCriteria.ALL_EVENTS:
      default:
        return {};
    }
  }

  private tagCriteria(): any[] {
    const {tagsAny, tagsExclude} = this?.eventsData || {};
    return tagCriteriaClauses(tagsAny, tagsExclude);
  }

  private resolveRelativeDate(dateRange?: { direction: DateDirection; duration: { days?: number; months?: number; years?: number } }): number | undefined {
    if (!dateRange) { return undefined; }
    const now = this.dateUtils.dateTimeNow().startOf("day");
    return dateRange.direction === DateDirection.FUTURE ? now.toMillis() : now.minus(dateRange.duration).toMillis();
  }

  private resolveRelativeEndDate(dateRange?: { direction: DateDirection; duration: { days?: number; months?: number; years?: number } }): number | undefined {
    if (!dateRange) { return undefined; }
    const now = this.dateUtils.dateTimeNow().startOf("day");
    return dateRange.direction === DateDirection.FUTURE ? now.plus(dateRange.duration).toMillis() : now.toMillis();
  }

  private dateRangeCriteria(fromDate: number, toDate: number) {
    const fromDateTime = this.dateUtils.asDateTime(fromDate).startOf("day");
    const toDateTime = this.dateUtils.asDateTime(toDate).endOf("day");
    return {
      [GroupEventField.START_DATE]: {
        $gte: fromDateTime.toJSDate(),
        $lte: toDateTime.toJSDate()
      }
    };
  }

  private eventIdsCriteria(eventIds: string[]) {
    return groupEventIdsCriteria(eventIds);
  }

  sort() {
    return {[GroupEventField.START_DATE]: this.sortOrderToValue(this.resolvedSortOrder())};
  }

  private sortOrderToValue(sortOrder: SortOrder): MongoSort {
    return sortOrder === SortOrder.DATE_DESCENDING ? MongoSort.DESCENDING : MongoSort.ASCENDING;
  }

  private resolvedSortOrder(): SortOrder {
    const configuredSortOrder = this.normalizedSortOrder(this.eventsData?.sortOrder);
    if (configuredSortOrder && !this.eventsData?.allow?.allowSortChange) {
      return configuredSortOrder;
    } else if (Number(this.filterParameters.fieldSort) === MongoSort.DESCENDING) {
      return SortOrder.DATE_DESCENDING;
    } else {
      return SortOrder.DATE_ASCENDING;
    }
  }

  private normalizedSortOrder(sortOrder: SortOrder | string): SortOrder {
    if (!sortOrder) {
      return null;
    }
    const match = enumValues(SortOrder).find(value => value === sortOrder);
    if (match) {
      return match as SortOrder;
    }
    const titledMatch = enumValues(SortOrder)
      .find(value => this.stringUtils.asTitle(value) === sortOrder);
    return (titledMatch as SortOrder) || null;
  }

  applyFilterToGroupEvents(searchTerm?: NamedEvent<string>) {
    this.logger.info("applyFilterToGroupEvents:searchTerm:", searchTerm, "filterParameters.quickSearch:", this.filterParameters.quickSearch);
    this.persistFilterQueryParams();
    this.notify.setBusy();
    this.filteredExtendedGroupEvents = this.searchFilterPipe.transform(this.extendedGroupEvents, this.filterParameters.quickSearch);
    this.pageNumber = 1;
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
    this.pageCount = Math.max(1, Math.ceil((this.filteredExtendedGroupEvents?.length || 0) / this.pageSize));
    if (this.pageNumber > this.pageCount) {
      this.pageNumber = 1;
    }
    this.currentPageFilteredEvents = this.paginate(this.filteredExtendedGroupEvents, this.pageSize, this.pageNumber);
    this.pages = range(1, this.pageCount + 1);
    this.logger.info("applyPagination: current page events:", this.currentPageFilteredEvents);
    if (this.currentPageFilteredEvents.length === 0) {
      this.notify.progress("No events found");
    } else {
      const offset = (this.pageNumber - 1) * this.pageSize + 1;
      const toEventNumber = Math.min(this.currentPageFilteredEvents?.length + offset - 1, this.filteredExtendedGroupEvents?.length || 0);
      this.logger.info("applyPagination: filtered event count", this.filteredExtendedGroupEvents.length, "current page event count", this.currentPageFilteredEvents.length, "pageSize:", this.pageSize, "pageCount", this.pageCount, "pages", this.pages, "currentPageFilteredEvents:", this.currentPageFilteredEvents, "toEventNumber:", toEventNumber, "offset:", offset);
      const totalOnly = this.stringUtils.pluraliseWithCount(this.filteredExtendedGroupEvents.length, "event");
      const count = this.pageCount <= 1 ? totalOnly : `${offset} to ${toEventNumber} of ${totalOnly}`;
      const defaultSort = this.normalizedSortOrder(this.eventsData?.sortOrder) || SortOrder.DATE_ASCENDING;
      const extras = [
        this.resolvedSortOrder() === defaultSort ? null : this.stringUtils.asTitle(this.resolvedSortOrder()),
        this.pageCount > 1 ? `page ${this.pageNumber} of ${this.pageCount}` : null
      ].filter(part => !!part);
      this.notify.progress(extras.length === 0 ? count : `${count}${EM_DASH_WITH_SPACES}${extras.join(EM_DASH_WITH_SPACES)}`);
    }
  }
}
