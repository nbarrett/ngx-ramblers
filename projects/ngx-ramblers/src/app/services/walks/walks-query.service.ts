import { inject, Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { EventType, Walk, WalkDateAscending, WalkDateDescending } from "../../models/walk.model";
import { sortBy } from "../../functions/arrays";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalkEventService } from "./walk-event.service";
import { DataQueryOptions } from "../../models/api-request.model";
import { StringUtilsService } from "../string-utils.service";
import { FilterParameters, HasBasicEventSelection } from "../../models/search.model";

@Injectable({
  providedIn: "root"
})

export class WalksQueryService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksQueryService", NgxLoggerLevel.ERROR);
  private walkEventsService = inject(WalkEventService);
  private dateUtils = inject(DateUtilsService);
  protected stringUtils = inject(StringUtilsService);
  private todayValue = this.dateUtils.momentNowNoTime().valueOf();

  dataQueryOptions(filterParameters: HasBasicEventSelection): DataQueryOptions {
    const criteria = this.walksCriteriaObject(filterParameters);
    const sort = this.walksSortObject(filterParameters);
    this.logger.debug("walksCriteriaObject:this.filterParameters.criteria", criteria, "sort:", sort);
    return {criteria, sort};
  }

  walksCriteriaObject(filterParameters: HasBasicEventSelection) {
    switch (filterParameters.selectType) {
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
        return "walk.walkDate";
      case false:
        return "-walk.walkDate";
    }
  }

  activeWalk(walk: Walk) {
    return !this.walkEventsService.latestEventWithStatusChangeIs(walk, EventType.DELETED);
  }

  deletedWalk(walk: Walk) {
    return this.walkEventsService.latestEventWithStatusChangeIs(walk, EventType.DELETED);
  }

  approvedWalk(walk: Walk) {
    return this.walkEventsService.latestEventWithStatusChangeIs(walk, EventType.APPROVED);
  }

  activeWalks(walks: Walk[]): Walk[] {
    return walks?.filter(walk => this.activeWalk(walk));
  }

  deletedWalks(walks: Walk[]): Walk[] {
    return walks?.filter(walk => this.deletedWalk(walk));
  }

  nextWalkId(walks: Walk[]): string {
    const today = this.dateUtils.momentNowNoTime().valueOf();
    const nextWalk: Walk = first(cloneDeep(walks)?.filter((walk: Walk) => walk.walkDate >= today)?.sort(sortBy("walkDate")));
    this.logger.info("nextWalk:", nextWalk);
    return nextWalk?.id;
  }

}
