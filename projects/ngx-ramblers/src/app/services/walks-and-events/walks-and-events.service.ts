import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { LocalWalksAndEventsService } from "./local-walks-and-events.service";
import { RamblersWalksAndEventsService } from "./ramblers-walks-and-events.service";
import { EventPopulation, Organisation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { EventQueryParameters, RamblersEventType } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";

@Injectable({
  providedIn: "root"
})
export class WalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksAndEventsService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
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
    return this.localWalksAndEventsService.notifications();
  }

  async all(eventQueryParameters: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation, "eventQueryParameters:", eventQueryParameters);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all(eventQueryParameters);
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.all(eventQueryParameters);
    }
  }

  async allPublic(eventQueryParameters: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation, "eventQueryParameters:", eventQueryParameters);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all(eventQueryParameters);
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.allPublic(eventQueryParameters);
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
        return this.localWalksAndEventsService.queryWalkLeaders();
    }
  }

  async createOrUpdate(extendedGroupEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    return this.localWalksAndEventsService.createOrUpdate(extendedGroupEvent);
  }

  async queryById(walkId: string): Promise<ExtendedGroupEvent> {
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.queryById(walkId);
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.queryById(walkId);
    }

  }

  async getByIdIfPossible(walkId: string): Promise<ExtendedGroupEvent> {
    switch (this?.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.getByIdIfPossible(walkId);
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.getByIdIfPossible(walkId);
    }
  }

  async updateMany(dataQueryOptions: DataQueryOptions): Promise<ExtendedGroupEvent[]> {
    this.logger.info("updateMany called with dataQueryOptions:", dataQueryOptions);
    try {
      const result = await this.localWalksAndEventsService.updateMany(dataQueryOptions);
      this.logger.info("updateMany: updated documents:", result);
      return result;
    } catch (error) {
      this.logger.error("updateMany: error:", error);
      throw error;
    }
  }

  fixIncorrectWalkDates() {
    return this.localWalksAndEventsService.fixIncorrectStartDates();
  }

  async delete(extendedGroupEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    const eventPopulation: EventPopulation = extendedGroupEvent.groupEvent.item_type === RamblersEventType.GROUP_WALK ? this?.group?.walkPopulation : this?.group?.socialEventPopulation;
    switch (eventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        throw new Error(`cannot delete event as ${extendedGroupEvent.groupEvent.item_type} is ${eventPopulation}`);
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.delete(extendedGroupEvent);
    }
  }

  async update(extendedGroupEvent: ExtendedGroupEvent) {
    this.logger.info("update called with extendedGroupEvent:", extendedGroupEvent);
    try {
      const result = await this.localWalksAndEventsService.update(extendedGroupEvent);
      this.logger.info("update: updated documents:", result);
      return result;
    } catch (error) {
      this.logger.error("update: error:", error);
      throw error;
    }
  }
}
