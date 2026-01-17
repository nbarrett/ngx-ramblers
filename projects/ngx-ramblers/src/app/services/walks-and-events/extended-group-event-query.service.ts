import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { HttpClient, HttpParams } from "@angular/common/http";
import {
  EventEventField,
  EventField,
  EventStartDateAscending,
  EventStartDateDescending,
  EventType,
  GroupEventField,
  ID
} from "../../models/walk.model";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { GroupEventService } from "./group-event.service";
import { DataQueryOptions, FilterCriteria, MongoCriteria } from "../../models/api-request.model";
import { StringUtilsService } from "../string-utils.service";
import { FilterParameters, HasBasicEventSelection, GroupEventSearchParams, GroupEventSearchResponse, SyncStatusResponse } from "../../models/search.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { EventQueryParameters } from "../../models/ramblers-walks-manager";
import { UrlService } from "../url.service";
import { isNumericRamblersId } from "../path-matchers";
import { toSlug } from "../../functions/strings";

@Injectable({
  providedIn: "root"
})

export class ExtendedGroupEventQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("ExtendedGroupEventQueryService", NgxLoggerLevel.ERROR);
  private groupEventService = inject(GroupEventService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);
  private http = inject(HttpClient);
  private BASE_URL = "/api/database/walks";

  dataQueryOptions(filterParameters: HasBasicEventSelection, dateComparison?: string, upperDateComparison?: string): DataQueryOptions {
    const criteria = this.criteriaFor(filterParameters, dateComparison, upperDateComparison);
    const sort = this.sortFor(filterParameters);
    this.logger.debug("walksCriteriaObject:this.filterParameters.criteria", criteria, "sort:", sort);
    return {criteria, sort};
  }

  dataQueryOptionsFrom(eventQueryParameters: EventQueryParameters): DataQueryOptions {
    const andCriteria: any[] = [];

    if (eventQueryParameters?.groupCode) {
      andCriteria.push({[GroupEventField.GROUP_CODE]: eventQueryParameters.groupCode});
    }
    if (eventQueryParameters?.ids && eventQueryParameters?.ids?.length > 0) {
      andCriteria.push({[GroupEventField.ID]: {$in: eventQueryParameters.ids}});
    }
    if (eventQueryParameters?.types && eventQueryParameters.types.length > 0) {
      andCriteria.push({[GroupEventField.ITEM_TYPE]: {$in: eventQueryParameters.types}});
    }

    if (eventQueryParameters?.dataQueryOptions?.criteria) {
      andCriteria.push(eventQueryParameters.dataQueryOptions.criteria);
    }

    const criteria = andCriteria.length > 0 ? {$and: andCriteria} : {};

    const dataQueryOptions = {...eventQueryParameters?.dataQueryOptions, criteria};
    this.logger.info("dataQueryOptionsFrom: eventQueryParameters.dataQueryOptions", eventQueryParameters?.dataQueryOptions, "dataQueryOptions:", dataQueryOptions);
    return dataQueryOptions;
  }

  criteriaFor(filterParameters: HasBasicEventSelection, dateComparison?: string, upperDateComparison?: string): MongoCriteria {
    const date: Date = dateComparison ? this.dateUtils.asDateTime(dateComparison).toJSDate() : this.dateUtils.dateTimeNowNoTime().toJSDate();
    switch (filterParameters.selectType) {
      case FilterCriteria.FUTURE_EVENTS:
        return {[GroupEventField.START_DATE]: {$gte: date}};
      case FilterCriteria.DATE_RANGE:
        return {[GroupEventField.START_DATE]: {$gte: date, $lte: this.dateUtils.asDateTime(upperDateComparison).toJSDate()}};
      case FilterCriteria.PAST_EVENTS:
        return {[GroupEventField.START_DATE]: {$lt: date}};
      case FilterCriteria.ALL_EVENTS:
        return {};
      case FilterCriteria.NO_CONTACT_DETAILS:
        return {[EventField.CONTACT_DETAILS_PHONE]: {$exists: false}};
      case FilterCriteria.NO_EVENT_TITLE:
        return {[GroupEventField.TITLE]: {$exists: false}};
      case FilterCriteria.MISSING_LOCATION:
        return {
          $or: [
            {[GroupEventField.START_LOCATION_LATITUDE]: {$exists: false}},
            {[GroupEventField.START_LOCATION_LATITUDE]: null},
            {[GroupEventField.START_LOCATION_LATITUDE]: 0},
            {[GroupEventField.START_LOCATION_LONGITUDE]: {$exists: false}},
            {[GroupEventField.START_LOCATION_LONGITUDE]: null},
            {[GroupEventField.START_LOCATION_LONGITUDE]: 0}
          ]
        };
      case FilterCriteria.DELETED_EVENTS:
        return {[EventEventField.EVENT_TYPE]: {$eq: EventType.DELETED.toString()}};
    }
  }

  eventIdCriteriaFor(identifier: string): MongoCriteria {
    if (!(this.urlService.isMongoId(identifier) || isNumericRamblersId(identifier)) && this.urlService.looksLikeASlug(identifier)) {
      return this.slugCriteria(identifier);
    } else {
      return this.identifierCriteria(identifier);
    }
  }

  private slugCriteria(identifier: string): MongoCriteria {
    const slug = toSlug(identifier);
    return {
      $or: [
        {
          $expr: {
            $regexMatch: {
              input: {$arrayElemAt: [{$split: [`$${GroupEventField.URL}`, "/"]}, -1]},
              regex: slug,
              options: "i"
            }
          }
        },
        {[GroupEventField.URL]: {$regex: slug, $options: "i"}},
        {
          $expr: {
            $eq: [
              {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: {$toLower: `$${GroupEventField.TITLE}`},
                      find: "/",
                      replacement: ""
                    }
                  },
                  find: " ",
                  replacement: "-"
                }
              },
              slug
            ]
          }
        }
      ]
    };
  }

  private identifierCriteria(identifier: string): MongoCriteria {
    const orCriteria: MongoCriteria[] = [
      {[GroupEventField.ID]: identifier},
      {[EventField.MIGRATED_FROM_ID]: identifier}
    ];
    if (this.urlService.isMongoId(identifier)) {
      orCriteria.unshift({[ID]: identifier});
    }
    return {$or: orCriteria};
  }

  sortFor(filterParameters: HasBasicEventSelection) {
    this.logger.info("walksSortObject:", filterParameters);
    switch (this.stringUtils.asBoolean(filterParameters.ascending)) {
      case true:
        return EventStartDateAscending;
      case false:
        return EventStartDateDescending;
    }
  }

  public localWalksSortObject(filterParameters: FilterParameters): string {
    this.logger.info("localWalksSortObject:walksSortObject:", filterParameters);
    switch (this.stringUtils.asBoolean(filterParameters.ascending)) {
      case true:
        return "walk." + GroupEventField.START_DATE;
      case false:
        return "-walk." + GroupEventField.START_DATE;
    }
  }

  activeWalk(walk: ExtendedGroupEvent) {
    return !this.groupEventService.latestEventWithStatusChangeIs(walk, EventType.DELETED);
  }

  deletedWalk(walk: ExtendedGroupEvent) {
    return this.groupEventService.latestEventWithStatusChangeIs(walk, EventType.DELETED);
  }

  approvedWalk(walk: ExtendedGroupEvent) {
    return this.groupEventService.latestEventWithStatusChangeIs(walk, EventType.APPROVED);
  }

  activeEvents(extendedGroupEvents: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    const activeEvents = extendedGroupEvents?.filter(walk => this.activeWalk(walk));
    this.logger.info("extendedGroupEvents:", extendedGroupEvents, "activeEvents:", activeEvents);
    return activeEvents;
  }

  deletedWalks(walks: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    return walks?.filter(walk => this.deletedWalk(walk));
  }

  fetchNextWalkId(groupCode?: string): Observable<{ nextWalkId: string }> {
    let httpParams = new HttpParams();
    if (groupCode) {
      httpParams = httpParams.set("groupCode", groupCode);
    }
    return this.http.get<{ nextWalkId: string }>(
      `${this.BASE_URL}/next-walk-id`,
      { params: httpParams }
    );
  }


  getSyncStatus(groupCode?: string): Observable<SyncStatusResponse> {
    let httpParams = new HttpParams();
    if (groupCode) {
      httpParams = httpParams.set("groupCode", groupCode);
    }
    return this.http.get<SyncStatusResponse>(
      `${this.BASE_URL}/sync/status`,
      { params: httpParams }
    );
  }

  triggerSync(fullSync: boolean = false): Observable<{ message: string; added: number; updated: number }> {
    return this.http.post<{ message: string; added: number; updated: number }>(
      `${this.BASE_URL}/sync/walks-manager`,
      { fullSync }
    );
  }

}
