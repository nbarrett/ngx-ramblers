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
import groupBy from "lodash-es/groupBy";

@Injectable({
  providedIn: "root"
})
export class WalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksAndEventsService", NgxLoggerLevel.INFO);
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

  urlFromTitle(title: string, id?: string): Promise<string> {
    return this.localWalksAndEventsService.urlFromTitle(title, id);
  }

  async all(eventQueryParameters: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation, "eventQueryParameters:", eventQueryParameters);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all(eventQueryParameters);
      case EventPopulation.LOCAL:
        const localWalks = await this.localWalksAndEventsService.all(eventQueryParameters);
        this.logger.info("walkPopulation:", this?.group?.walkPopulation, "queryById:eventQueryParameters:", eventQueryParameters, "ramblers returned no data:returning localWalks:", localWalks);
        return localWalks;
      case EventPopulation.HYBRID:
        const hybridResults = await Promise.all([
          this.ramblersWalksAndEventsService.all(eventQueryParameters),
          this.localWalksAndEventsService.all(eventQueryParameters)]);
        return this.groupByIdAndPrioritiseRamblersEvents(hybridResults.flat(2));
    }
  }

  async allPublic(eventQueryParameters: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    this.logger.info("all called with walkPopulation:", this.group?.walkPopulation, "eventQueryParameters:", eventQueryParameters);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        return this.ramblersWalksAndEventsService.all(eventQueryParameters);
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.allPublic(eventQueryParameters);
      case EventPopulation.HYBRID:
        const hybridResults = await Promise.all([
          this.ramblersWalksAndEventsService.all(eventQueryParameters),
          this.localWalksAndEventsService.allPublic(eventQueryParameters)]);
        return this.groupByIdAndPrioritiseRamblersEvents(hybridResults.flat(2));
    }
  }

  async queryWalkLeaders(): Promise<string[]> {
    this.logger.info("queryWalkLeaders:walkPopulation:", this?.group?.walkPopulation);
    switch (this?.group?.walkPopulation) {
      case EventPopulation.HYBRID:
        const ramblers = await this.queryWalkLeaderNames();
        const local = await this.localWalksAndEventsService.queryWalkLeaders();
        return this.removeDuplicates([...ramblers, ...local]);
      case EventPopulation.WALKS_MANAGER:
        return await this.queryWalkLeaderNames();
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.queryWalkLeaders();
    }
  }

  private async queryWalkLeaderNames() {
    const walkLeaders = await this.ramblersWalksAndEventsService.queryWalkLeaders();
    this.logger.info("queryWalkLeaders:", walkLeaders);
    return walkLeaders.map(item => item.name);
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
      case EventPopulation.HYBRID:
        const ramblers: ExtendedGroupEvent = await this.ramblersWalksAndEventsService.queryById(walkId);
        if (ramblers) {
          this.logger.info("walkPopulation:", this?.group?.walkPopulation, "queryById:walkId:", walkId, "ramblers:", ramblers);
          return ramblers;
        } else {
          const local = await this.localWalksAndEventsService.queryById(walkId);
          this.logger.info("walkPopulation:", this?.group?.walkPopulation, "queryById:walkId:", walkId, "ramblers returned no data:returning local:", local);
          return local;
        }
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
    const eventPopulation: EventPopulation = extendedGroupEvent?.groupEvent?.item_type === RamblersEventType.GROUP_WALK ? this?.group?.walkPopulation : this?.group?.socialEventPopulation;
    switch (eventPopulation) {
      case EventPopulation.WALKS_MANAGER:
        throw new Error(`cannot delete event as ${extendedGroupEvent?.groupEvent?.item_type} is ${eventPopulation}`);
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

  public async count({ criteria }: { criteria: any }): Promise<number> {
    this.logger.info("count called with walkPopulation:", this.group?.walkPopulation, "criteria:", criteria);
    switch (this.group?.walkPopulation) {
      case EventPopulation.WALKS_MANAGER:
        throw new Error("count: WALKS_MANAGER population not supported, use localWalksAndEventsService.count instead");
      case EventPopulation.LOCAL:
        return this.localWalksAndEventsService.count({ criteria });
      default:
        this.logger.warn("count: unknown walkPopulation, returning 0");
        return 0;
    }
  }

  private groupByIdAndPrioritiseRamblersEvents(events: ExtendedGroupEvent[]): ExtendedGroupEvent[] {
    return Object.entries(groupBy(events, (extendedGroupEvent: ExtendedGroupEvent) => extendedGroupEvent.groupEvent.id))
      .map((entry: [path: string, duplicates: ExtendedGroupEvent[]]) => {
        const allEventsForKey: ExtendedGroupEvent[] = entry[1];
        const selectedEventForKey: ExtendedGroupEvent = allEventsForKey.find(item => !item.id) || allEventsForKey[0];
        const key = entry[0];
        const noKeyFound: boolean = key === "undefined";
        const returnData: ExtendedGroupEvent[] = noKeyFound ? allEventsForKey : [selectedEventForKey];
        if (noKeyFound) {
          this.logger.info("no key found to group data by returning all data:", returnData);
        } else if (allEventsForKey.length > 1) {
          this.logger.info("selectedEventForKey:", selectedEventForKey, "given grouping key:", key, "given all events:", returnData);
        }
        return returnData;
      }).flat(2);
  }

  private removeDuplicates(items: string[]): string[] {
    return [...new Set(items)];
  }
}
