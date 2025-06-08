import { inject, Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import {
  EventType,
  EventStartDateAscending,
  EventStartDateDescending,
  GROUP_EVENT_START_DATE
} from "../../models/walk.model";
import { sortBy } from "../../functions/arrays";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { GroupEventService } from "./group-event.service";
import { DataQueryOptions } from "../../models/api-request.model";
import { StringUtilsService } from "../string-utils.service";
import { FilterParameters, HasBasicEventSelection } from "../../models/search.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})

export class ExtendedGroupEventQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("ExtendedGroupEventQueryService", NgxLoggerLevel.ERROR);
  private walkEventsService = inject(GroupEventService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private todayValue = this.dateUtils.asMoment().toDate();

  dataQueryOptions(filterParameters: HasBasicEventSelection, dateComparison?: string): DataQueryOptions {
    const criteria = this.walksCriteriaObject(filterParameters, dateComparison);
    const sort = this.walksSortObject(filterParameters);
    this.logger.debug("walksCriteriaObject:this.filterParameters.criteria", criteria, "sort:", sort);
    return {criteria, sort};
  }

  walksCriteriaObject(filterParameters: HasBasicEventSelection, dateComparison?: string) {
    const date = this.dateUtils.asMoment(dateComparison).toDate() || this.todayValue;
    switch (filterParameters.selectType) {
      case 1:
        return {[GROUP_EVENT_START_DATE]: {$gte: date}};
      case 2:
        return {[GROUP_EVENT_START_DATE]: {$lt: date}};
      case 3:
        return {};
      case 4:
        return {"fields.contactDetails.phone": {$exists: false}};
      case 5:
        return {"groupEvent.title": {$exists: false}};
      case 6:
        return {"events.eventType": {$eq: EventType.DELETED.toString()}};
    }
  }

  walksSortObject(filterParameters: HasBasicEventSelection) {
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
        return "walk.groupEvent.start_date_time";
      case false:
        return "-walk.groupEvent.start_date_time";
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

  activeWalks(walks: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    return walks?.filter(walk => this.activeWalk(walk));
  }

  deletedWalks(walks: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    return walks?.filter(walk => this.deletedWalk(walk));
  }

  nextWalkId(walks: ExtendedGroupEvent[]): string {
    const today = this.dateUtils.momentNow().valueOf();
    const nextWalk: ExtendedGroupEvent = first(cloneDeep(walks)?.filter((walk: ExtendedGroupEvent) => this.dateUtils.asMoment(walk.groupEvent.start_date_time).valueOf() >= today)?.sort(sortBy("walk.groupEvent.start_date_time")));
    this.logger.info("nextWalk:", nextWalk);
    return nextWalk?.id;
  }

}
