import { inject, Injectable } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Observable } from "rxjs";
import { DataQueryOptions } from "../../models/api-request.model";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { LocalWalksAndEventsService } from "./local-walks-and-events.service";
import { Organisation } from "../../models/system.model";
import { SystemConfigService } from "../system/system-config.service";
import { EventQueryParameters } from "../../models/ramblers-walks-manager";
import { ExtendedGroupEvent, ExtendedGroupEventApiResponse } from "../../models/group-event.model";
import { SearchDateRange } from "../../models/search.model";

@Injectable({
  providedIn: "root"
})
export class WalksAndEventsService {

  private logger: Logger = inject(LoggerFactory).createLogger("WalksAndEventsService", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  private localWalksAndEventsService = inject(LocalWalksAndEventsService);
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
    this.logger.info("all called with eventQueryParameters:", eventQueryParameters);
    return this.localWalksAndEventsService.all(eventQueryParameters);
  }

  async allPublic(eventQueryParameters: EventQueryParameters): Promise<ExtendedGroupEvent[]> {
    this.logger.info("allPublic called with eventQueryParameters:", eventQueryParameters);
    return this.localWalksAndEventsService.allPublic(eventQueryParameters);
  }

  async dateRange(): Promise<{ minDate: number | null; maxDate: number | null }> {
    return this.localWalksAndEventsService.dateRange();
  }

  async queryWalkLeaders(range?: SearchDateRange | null): Promise<string[]> {
    this.logger.info("queryWalkLeaders called with range:", range);
    return this.localWalksAndEventsService.queryWalkLeaders(range);
  }

  leaderLabelMap(): Map<string, string> {
    return this.localWalksAndEventsService.leaderLabelMap();
  }

  leaderLabelRecords() {
    return this.localWalksAndEventsService.leaderLabelRecords();
  }

  async createOrUpdate(extendedGroupEvent: ExtendedGroupEvent): Promise<ExtendedGroupEvent> {
    return this.localWalksAndEventsService.createOrUpdate(extendedGroupEvent);
  }

  async queryById(walkId: string): Promise<ExtendedGroupEvent> {
    return this.localWalksAndEventsService.queryById(walkId);
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
    return this.localWalksAndEventsService.delete(extendedGroupEvent);
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
    this.logger.info("count called with criteria:", criteria);
    return this.localWalksAndEventsService.count({ criteria });
  }
}
