import { inject, Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import {
  EventStartDateAscending,
  EventStartDateDescending,
  EventType,
  GROUP_EVENT_MIGRATED_FROM_ID,
  GROUP_EVENT_START_DATE,
  GROUP_EVENT_TITLE,
  GROUP_EVENT_URL,
  ID
} from "../../models/walk.model";
import { sortBy } from "../../functions/arrays";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { GroupEventService } from "./group-event.service";
import { DataQueryOptions, FilterCriteria, MongoCriteria } from "../../models/api-request.model";
import { StringUtilsService } from "../string-utils.service";
import { FilterParameters, HasBasicEventSelection } from "../../models/search.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { EventQueryParameters } from "../../models/ramblers-walks-manager";
import { UrlService } from "../url.service";

@Injectable({
  providedIn: "root"
})

export class ExtendedGroupEventQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("ExtendedGroupEventQueryService", NgxLoggerLevel.ERROR);
  private walkEventsService = inject(GroupEventService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private urlService: UrlService = inject(UrlService);

  dataQueryOptions(filterParameters: HasBasicEventSelection, dateComparison?: string): DataQueryOptions {
    const criteria = this.criteriaFor(filterParameters, dateComparison);
    const sort = this.sortFor(filterParameters);
    this.logger.debug("walksCriteriaObject:this.filterParameters.criteria", criteria, "sort:", sort);
    return {criteria, sort};
  }

  dataQueryOptionsFrom(eventQueryParameters: EventQueryParameters): DataQueryOptions {
    const andCriteria: any[] = [];

    if (eventQueryParameters.groupCode) {
      andCriteria.push({"groupEvent.group_code": eventQueryParameters.groupCode});
    }
    if (eventQueryParameters.ids && eventQueryParameters.ids.length > 0) {
      andCriteria.push({"groupEvent.id": {$in: eventQueryParameters.ids}});
    }
    if (eventQueryParameters.types && eventQueryParameters.types.length > 0) {
      andCriteria.push({"groupEvent.item_type": {$in: eventQueryParameters.types}});
    }

    if (eventQueryParameters.dataQueryOptions?.criteria) {
      andCriteria.push(eventQueryParameters.dataQueryOptions.criteria);
    }

    const criteria = andCriteria.length > 0 ? {$and: andCriteria} : {};

    const dataQueryOptions = {...eventQueryParameters.dataQueryOptions, criteria};
    this.logger.info("dataQueryOptionsFrom: eventQueryParameters.dataQueryOptions", eventQueryParameters.dataQueryOptions, "dataQueryOptions:", dataQueryOptions);
    return dataQueryOptions;
  }

  criteriaFor(filterParameters: HasBasicEventSelection, dateComparison?: string): MongoCriteria {
    const date: Date = dateComparison ? this.dateUtils.asMoment(dateComparison).toDate() : this.dateUtils.momentNowNoTime().toDate();
    switch (filterParameters.selectType) {
      case FilterCriteria.FUTURE_EVENTS:
        return {[GROUP_EVENT_START_DATE]: {$gte: date}};
      case FilterCriteria.PAST_EVENTS:
        return {[GROUP_EVENT_START_DATE]: {$lt: date}};
      case FilterCriteria.ALL_EVENTS:
        return {};
      case FilterCriteria.NO_CONTACT_DETAILS:
        return {"fields.contactDetails.phone": {$exists: false}};
      case FilterCriteria.NO_EVENT_TITLE:
        return {"groupEvent.title": {$exists: false}};
      case FilterCriteria.DELETED_EVENTS:
        return {"events.eventType": {$eq: EventType.DELETED.toString()}};
    }
  }

  eventIdCriteriaFor(identifier: string): MongoCriteria {
    if (this.urlService.looksLikeASlug(identifier)) {
      const slug = this.stringUtils.kebabCase(identifier);
      return {
        $or: [
          {
            $expr: {
              $eq: [
                {$arrayElemAt: [{$split: [`$${GROUP_EVENT_URL}`, "/"]}, -1]},
                slug
              ]
            }
          },
          {[GROUP_EVENT_URL]: slug},
          {
            $expr: {
              $eq: [
                {
                  $replaceAll: {
                    input: {$toLower: `$${GROUP_EVENT_TITLE}`},
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
    } else {
      return {
        $or: [
          {[ID]: identifier},
          {[GROUP_EVENT_MIGRATED_FROM_ID]: identifier}
        ]
      };
    }
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
        return "walk." + GROUP_EVENT_START_DATE;
      case false:
        return "-walk." + GROUP_EVENT_START_DATE;
    }
  }

  activeWalk(walk: ExtendedGroupEvent) {
    return !this.walkEventsService.latestEventWithStatusChangeIs(walk, EventType.DELETED);
  }

  deletedWalk(walk: ExtendedGroupEvent) {
    return this.walkEventsService.latestEventWithStatusChangeIs(walk, EventType.DELETED);
  }

  approvedWalk(walk: ExtendedGroupEvent) {
    return this.walkEventsService.latestEventWithStatusChangeIs(walk, EventType.APPROVED);
  }

  activeEvents(extendedGroupEvents: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    const activeEvents = extendedGroupEvents?.filter(walk => this.activeWalk(walk));
    this.logger.info("extendedGroupEvents:", extendedGroupEvents, "activeEvents:", activeEvents);
    return activeEvents;
  }

  deletedWalks(walks: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    return walks?.filter(walk => this.deletedWalk(walk));
  }

  nextWalkId(walks: ExtendedGroupEvent[]): string {
    const today = this.dateUtils.momentNow().valueOf();
    const nextWalk: ExtendedGroupEvent = first(cloneDeep(walks)?.filter((walk: ExtendedGroupEvent) => this.dateUtils.asMoment(walk?.groupEvent?.start_date_time).valueOf() >= today)?.sort(sortBy("walk.groupEvent.start_date_time")));
    const nextWalkId = nextWalk?.id || nextWalk?.groupEvent?.id;
    this.logger.info("nextWalk:", nextWalk, "nextWalkId:", nextWalkId);
    return nextWalkId;
  }

}
