import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalksAndEventsLocalService } from "./walks-and-events-local.service";
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class WalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private walksAndEventsLocalService = inject(WalksAndEventsLocalService);
  private ramblersWalksAndEventsService = inject(RamblersWalksAndEventsService);
  public group: Organisation;

  constructor() {
    this.applyConfig();
  }

  private applyConfig() {
    this.logger.info("applyConfig called");
    this.systemConfigService.events().subscribe(item => {
      this.group = item.group;
      this.logger.info("group:", this.group);
    });
  }

  notifications(): Observable<ExtendedGroupEventApiResponse> {
    return this.walksAndEventsLocalService.notifications();
  }

  async all(dataQueryOptions?: DataQueryOptions, ids?: string[], types?: RamblersEventType[]): Promise<ExtendedGroupEvent[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation, "dataQueryOptions:", dataQueryOptions);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all({dataQueryOptions, ids, types});
      case EventPopulation.LOCAL:
        return this.walksAndEventsLocalService.all(dataQueryOptions);
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
        return this.walksAndEventsLocalService.queryWalkLeaders();
    }
  }

  async createOrUpdate(walk: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    return this.walksAndEventsLocalService.createOrUpdate(walk);
  }

  async getById(walkId: string): Promise<ExtendedGroupEvent> {
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.walkForId(walkId);
      case EventPopulation.LOCAL:
        return this.walksAndEventsLocalService.getById(walkId);
    }

  }

  async getByIdIfPossible(walkId: string): Promise<ExtendedGroupEvent> {
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.getByIdIfPossible(walkId);
      case EventPopulation.LOCAL:
        return this.walksAndEventsLocalService.getByIdIfPossible(walkId);
    }
  }

  async updateMany(dataQueryOptions: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    this.logger.info("updateMany called with dataQueryOptions:", dataQueryOptions);
    try {
      const result = await this.walksAndEventsLocalService.updateMany(dataQueryOptions);
      this.logger.info("updateMany: updated documents:", result);
      return result;
    } catch (error) {
      this.logger.error("updateMany: error:", error);
      throw error;
    }
  }

  fixIncorrectWalkDates() {
    return this.walksAndEventsLocalService.fixIncorrectWalkDates();
  }

}
