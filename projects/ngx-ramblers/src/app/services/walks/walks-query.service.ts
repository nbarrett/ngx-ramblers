import { inject, Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { EventType, WalkDateAscending, WalkDateDescending } from "../../models/walk.model";
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

export class WalksQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksQueryService", NgxLoggerLevel.ERROR);
  private walkEventsService = inject(GroupEventService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private todayValue = this.dateUtils.asMoment().toISOString();

  dataQueryOptions(filterParameters: HasBasicEventSelection): DataQueryOptions {
    const criteria = this.walksCriteriaObject(filterParameters);
    const sort = this.walksSortObject(filterParameters);
    this.logger.debug("walksCriteriaObject:this.filterParameters.criteria", criteria, "sort:", sort);
    return {criteria, sort};
  }

  walksCriteriaObject(filterParameters: HasBasicEventSelection) {
    switch (filterParameters.selectType) {
      case 1:
        return { "groupEvent.start_date_time": { $gte: this.todayValue } };
      case 2:
        return { "groupEvent.start_date_time": { $lt: this.todayValue } };
      case 3:
        return {};
      case 4:
        return { "fields.contactDetails.phone": { $exists: false } };
      case 5:
        return { "groupEvent.title": { $exists: false } };
      case 6:
        return { "events.eventType": { $eq: EventType.DELETED.toString() } };
    }
  }

  walksSortObject(filterParameters: HasBasicEventSelection) {
    this.logger.info("walksSortObject:", filterParameters);
    switch (this.stringUtils.asBoolean(filterParameters.ascending)) {
      case true:
        return WalkDateAscending;
      case false:
        return WalkDateDescending;
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
