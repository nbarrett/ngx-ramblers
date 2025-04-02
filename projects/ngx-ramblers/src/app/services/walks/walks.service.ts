import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Walk, WalkApiResponse } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalksLocalService } from "./walks-local.service";
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { RamblersEventType } from "../../models/ramblers-walks-manager";

@Injectable({
  providedIn: "root"
})
export class WalksService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private walksLocalService = inject(WalksLocalService);
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

  notifications(): Observable<WalkApiResponse> {
    return this.walksLocalService.notifications();
  }

  async all(dataQueryOptions?: DataQueryOptions, ids?: string[], types?: RamblersEventType[]): Promise<Walk[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation, "dataQueryOptions:", dataQueryOptions);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all({dataQueryOptions, ids, types});
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

  async updateMany(dataQueryOptions: DataQueryOptions): Promise<Walk[]> {
    this.logger.info("updateMany called with dataQueryOptions:", dataQueryOptions);
    try {
      const result = await this.walksLocalService.updateMany(dataQueryOptions);
      this.logger.info("updateMany: updated documents:", result);
      return result;
    } catch (error) {
      this.logger.error("updateMany: error:", error);
      throw error;
    }
  }

  fixIncorrectWalkDates() {
    return this.walksLocalService.fixIncorrectWalkDates();
  }

}
