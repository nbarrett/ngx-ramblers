import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { EventType, Walk, WalkApiResponse } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalksLocalService } from "./walks-local.service";
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import first from "lodash-es/first";
import last from "lodash-es/last";
import { DateUtilsService } from "../date-utils.service";
import omit from "lodash-es/omit";
import { WalkEventService } from "./walk-event.service";

@Injectable({
  providedIn: "root"
})
export class WalksService {

  private readonly logger: Logger;
  public group: Organisation;

  constructor(private systemConfigService: SystemConfigService,
              private walksLocalService: WalksLocalService,
              private dateUtils: DateUtilsService,
              private walkEventService: WalkEventService,
              private ramblersWalksAndEventsService: RamblersWalksAndEventsService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalksService, NgxLoggerLevel.OFF);
    this.applyConfig();
  }

  private applyConfig() {
    this.logger.info("applyConfig called");
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.logger.info("group:", this.group);
    });
  }

  notifications(): Observable<WalkApiResponse> {
    return this.walksLocalService.notifications();
  }

  async all(dataQueryOptions?: DataQueryOptions): Promise<Walk[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all(dataQueryOptions);
      case EventPopulation.LOCAL:
        return this.walksLocalService.all(dataQueryOptions);
    }
  }

  async queryWalkLeaders(): Promise<string[]> {
    this.logger.info("queryWalkLeaders:walkPopulation:", this?.group?.walkPopulation);
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        const walkLeaders = await this.ramblersWalksAndEventsService.queryWalkLeaders();
        this.logger.info("queryWalkLeaders:", walkLeaders);
        return walkLeaders.map(item => item.name);
      case EventPopulation.LOCAL:
        return this.walksLocalService.queryWalkLeaders();
    }
  }

  async createOrUpdate(walk: Walk): Promise<Walk> {
    return this.walksLocalService.createOrUpdate(walk);
  }

  async getById(walkId: string): Promise<Walk> {
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.walkForId(walkId);
      case EventPopulation.LOCAL:
        return this.walksLocalService.getById(walkId);
    }

  }

  async getByIdIfPossible(walkId: string): Promise<Walk | null> {
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.getByIdIfPossible(walkId);
      case EventPopulation.LOCAL:
        return this.walksLocalService.getByIdIfPossible(walkId);
    }
  }

  fixIncorrectWalkDates() {
    return this.walksLocalService.fixIncorrectWalkDates();
  }

  async copyWalks(walks: Walk[]) {
    const firstWalk = first(walks);
    const lastWalk = last(walks);
    this.logger.info("firstWalk:", firstWalk, "on", this.dateUtils.displayDate(firstWalk.walkDate), "lastWalk:", lastWalk, "on", this.dateUtils.displayDate(lastWalk.walkDate));
    const existingWalks = await this.walksLocalService.all();
    const walksWithinRange = existingWalks.filter(walk => walk.walkDate >= firstWalk.walkDate && walk.walkDate <= lastWalk.walkDate);
    this.logger.info("existingWalks:", existingWalks, "walks within range", walksWithinRange);
    walksWithinRange.forEach(walk => this.walksLocalService.delete(walk));
    Promise.all(walks.map(walk => {
      const walkWithoutId: Walk = omit(walk, ["_id", "id"]) as Walk;
      this.logger.info("copying walk:", walkWithoutId);
      const event = this.walkEventService.createEventIfRequired(walkWithoutId, EventType.APPROVED, "Imported from Walks Manager");
      this.walkEventService.writeEventIfRequired(walkWithoutId, event);
      return this.walksLocalService.createOrUpdate(walkWithoutId);
    })).then(response => {
      this.logger.info("walk copy completed with response:", response);
    });
  }
}
