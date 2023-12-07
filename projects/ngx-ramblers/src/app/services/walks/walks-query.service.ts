import { Injectable } from "@angular/core";
import cloneDeep from "lodash-es/cloneDeep";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { EventType, Walk } from "../../models/walk.model";
import { sortBy } from "../arrays";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalkEventService } from "./walk-event.service";

@Injectable({
  providedIn: "root"
})

export class WalksQueryService {
  private logger: Logger;

  constructor(
    private walkEventsService: WalkEventService,
    private dateUtils: DateUtilsService,
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalksQueryService, NgxLoggerLevel.OFF);
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

  activeWalks(walks: Walk[]) {
    return walks?.filter(walk => this.activeWalk(walk));
  }

  deletedWalks(walks: Walk[]) {
    return walks?.filter(walk => this.deletedWalk(walk));
  }

  nextWalkId(walks: Walk[]): string {
    const today = this.dateUtils.momentNowNoTime().valueOf();
    const nextWalk: Walk = first(cloneDeep(walks)?.filter((walk: Walk) => walk.walkDate >= today)?.sort(sortBy("walkDate")));
    this.logger.info("nextWalk:", nextWalk);
    return nextWalk?.id;
  }

}
