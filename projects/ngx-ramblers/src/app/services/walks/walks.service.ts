import { Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Walk, WalkApiResponse } from "../../models/walk.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { WalksLocalService } from "./walks-local.service";
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { Organisation, WalkPopulation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";

@Injectable({
  providedIn: "root"
})
export class WalksService {

  private readonly logger: Logger;
  public group: Organisation;

  constructor(private systemConfigService: SystemConfigService,
              private walksLocalService: WalksLocalService,
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
      case WalkPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all(dataQueryOptions);
      case WalkPopulation.LOCAL:
        return this.walksLocalService.all(dataQueryOptions);
    }
  }

  async queryWalkLeaders(): Promise<string[]> {
    this.logger.info("queryWalkLeaders:walkPopulation:", this?.group?.walkPopulation);
    switch (this?.group?.walkPopulation) {
      case WalkPopulation.WALKS_MANAGER:
        const walkLeaders = await this.ramblersWalksAndEventsService.queryWalkLeaders();
        this.logger.info("queryWalkLeaders:", walkLeaders);
        return walkLeaders.map(item => item.name);
      case WalkPopulation.LOCAL:
        return this.walksLocalService.queryWalkLeaders();
    }
  }

  async createOrUpdate(walk: Walk): Promise<Walk> {
    return this.walksLocalService.createOrUpdate(walk);
  }

  async getById(walkId: string): Promise<Walk> {
    return this.walksLocalService.getById(walkId);
  }

  async getByIdIfPossible(walkId: string): Promise<Walk | null> {
    switch (this?.group?.walkPopulation) {
      case WalkPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.getByIdIfPossible(walkId);
      case WalkPopulation.LOCAL:
        return this.walksLocalService.getByIdIfPossible(walkId);
    }
  }

  fixIncorrectWalkDates() {
    return this.walksLocalService.fixIncorrectWalkDates();
  }
}
